import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../database/prisma.service';
import { CreateAgoraCurriculumSourceDto, UploadMultipleCurriculumSourcesDto, ConsolidateCurriculumDto, PublishCurriculumDto, CreateAgoraSubjectDto, UpdateAgoraSubjectDto } from './dto/agora-curriculum.dto';
import { AgoraCurriculumSourceStatus, AgoraCurriculumPublishStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { CloudinaryService } from '../storage/cloudinary/cloudinary.service';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CURRICULUM_PROCESSING_QUEUE, CURRICULUM_CONSOLIDATION_QUEUE, JOB_PROCESS_SOURCE, JOB_CONSOLIDATE_BATCH } from './curriculum-queues';
import { nextCurriculumVersion, shouldReuseInFlightDraft } from './agora-curriculum-draft.util';
import { FULL_YEAR_WEEKS, isCompleteFullYearSlots } from './full-year-curriculum.util';
import { inferLevelStream, JUNIOR_SECONDARY_CODES, SENIOR_SECONDARY_CODES } from '../common/utils/subject-level-stream.util';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AgoraCurriculumService implements OnModuleInit {
  private readonly logger = new Logger(AgoraCurriculumService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationService: NotificationService,
    @InjectQueue(CURRICULUM_PROCESSING_QUEUE) private readonly curriculumQueue: Queue,
    @InjectQueue(CURRICULUM_CONSOLIDATION_QUEUE) private readonly consolidationQueue: Queue,
  ) { }

  /**
   * On startup: drain jobs that were left in 'active' state by a crashed worker.
   * Those jobs will never complete on their own and block worker slots indefinitely.
   * We also reset any DB records that are stuck in PARSING status.
   */
  async onModuleInit() {
    try {
      const activeJobs = await this.curriculumQueue.getJobs(['active']);
      const staleConsolidation = await this.consolidationQueue.getJobs(['active']);
      const staleActive = [...activeJobs, ...staleConsolidation];
      if (staleActive.length > 0) {
        this.logger.warn(`[Startup] Found ${staleActive.length} stale active job(s). Cleaning up...`);
        for (const job of staleActive) {
          try {
            await job.moveToFailed(new Error('Worker crashed — job reset on startup'), job.token || 'restart');
          } catch (e) {
            // ignore — job may have already been cleaned up
          }
        }
      }

      // Reset any DB sources stuck in PARSING (from a crashed worker run)
      const staleCount = await this.prisma.agoraCurriculumSource.updateMany({
        where: { status: AgoraCurriculumSourceStatus.PARSING },
        data: { status: AgoraCurriculumSourceStatus.FAILED, parseErrors: 'Worker crashed — process was reset on server restart' },
      });
      if (staleCount.count > 0) {
        this.logger.warn(`[Startup] Reset ${staleCount.count} stale PARSING source(s) to FAILED.`);
      }

      // 3. RECONCILIATION: Drain the queue and re-requeue all PENDING_PARSE sources.
      // This ensures Redis and DB are perfectly in sync and fixes any "stalls" 
      // from lost jobs or Redis connection resets in previous sessions.
      await this.curriculumQueue.drain(true);

      const pendingSources = await this.prisma.agoraCurriculumSource.findMany({
        where: { status: AgoraCurriculumSourceStatus.PENDING_PARSE },
      });

      if (pendingSources.length > 0) {
        this.logger.log(`[Startup] Re-queuing ${pendingSources.length} pending sources from database...`);
        for (const source of pendingSources) {
          await this.curriculumQueue.add(JOB_PROCESS_SOURCE, {
            sourceId: source.id,
            batchId: source.batchId,
          }, { priority: 1, removeOnComplete: true, removeOnFail: { count: 100 } });
        }
      }
    } catch (e) {
      this.logger.error('[Startup] Failed to clean/re-queue jobs:', e);
    }
  }

  // ==========================================
  // SUBJECTS
  // ==========================================

  async getNerdcSubjects(schoolType?: string, category?: string, search?: string, levelStream?: string) {
    const subjects = await this.prisma.agoraSubject.findMany({
      where: {
        ...(schoolType && { schoolTypes: { has: schoolType } }),
        ...(category && { category }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { name: 'asc' },
    });

    if (!levelStream) return subjects;

    return subjects.filter((subject) => {
      const streams = (subject as { levelStreams?: string[] }).levelStreams ?? [];
      if (streams.length > 0) return streams.includes(levelStream);
      if (levelStream === 'PRIMARY') return subject.schoolTypes.includes('PRIMARY');
      if (levelStream === 'JUNIOR') {
        return JUNIOR_SECONDARY_CODES.has(subject.code)
          || (subject.schoolTypes.includes('SECONDARY') && !SENIOR_SECONDARY_CODES.has(subject.code));
      }
      if (levelStream === 'SENIOR') {
        return SENIOR_SECONDARY_CODES.has(subject.code)
          || (subject.schoolTypes.includes('SECONDARY') && !JUNIOR_SECONDARY_CODES.has(subject.code));
      }
      return inferLevelStream({ code: subject.code }) === levelStream;
    });
  }

  async createSubject(dto: CreateAgoraSubjectDto) {
    const existing = await this.prisma.agoraSubject.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(`Subject with code ${dto.code} already exists`);
    }

    const subject = await this.prisma.agoraSubject.create({
      data: dto,
    });

    // Notify school admins
    this.notificationService.emitAgoraSubjectAdded({
      subjectId: subject.id,
      subjectName: subject.name,
      subjectCode: subject.code,
      schoolTypes: subject.schoolTypes,
      timestamp: new Date().toISOString(),
    });

    return subject;
  }

  async updateSubject(id: string, dto: UpdateAgoraSubjectDto) {
    const subject = await this.prisma.agoraSubject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');

    if (dto.code && dto.code !== subject.code) {
      const existing = await this.prisma.agoraSubject.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new BadRequestException(`Subject with code ${dto.code} already exists`);
      }
    }

    return this.prisma.agoraSubject.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSubject(id: string) {
    const subject = await this.prisma.agoraSubject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');

    // Check if any school subjects are linked to this
    const linkedCount = await this.prisma.subject.count({
      where: { agoraSubjectId: id },
    });

    if (linkedCount > 0) {
      // Instead of hard delete, maybe just deactivate?
      return this.prisma.agoraSubject.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.agoraSubject.delete({ where: { id } });
  }

  // ==========================================
  // SOURCES MANAGEMENT
  // ==========================================

  async createSource(dto: CreateAgoraCurriculumSourceDto, userId: string, batchId?: string) {
    const subject = await this.prisma.agoraSubject.findUnique({
      where: { id: dto.subjectId },
    });

    if (!subject) throw new NotFoundException('Subject not found');

    const source = await this.prisma.agoraCurriculumSource.create({
      data: {
        subjectId: dto.subjectId,
        gradeLevel: dto.gradeLevel,
        sourceType: dto.sourceType,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileType: dto.fileType,
        manualContent: dto.manualContent,
        status: AgoraCurriculumSourceStatus.PENDING_PARSE,
        createdBy: userId,
        batchId: batchId || uuidv4(),
      },
    });

    // Queue for background processing — no custom jobId to avoid BullMQ dedup silently blocking re-uploads
    await this.curriculumQueue.add(JOB_PROCESS_SOURCE, {
      sourceId: source.id,
      batchId: source.batchId,
    }, { priority: 1 });

    this.logger.log(`Created and queued curriculum source: ${source.id}`);
    return source;
  }

  async uploadAndCreateSource(
    file: Express.Multer.File,
    dto: CreateAgoraCurriculumSourceDto,
    userId: string,
    batchId?: string
  ) {
    const subject = await this.prisma.agoraSubject.findUnique({
      where: { id: dto.subjectId },
    });

    if (!subject) throw new NotFoundException('Subject not found');

    // Upload file
    const uploadResult = await this.cloudinaryService.uploadRawFile(file, 'agora-curricula');

    const source = await this.prisma.agoraCurriculumSource.create({
      data: {
        subjectId: dto.subjectId,
        gradeLevel: dto.gradeLevel,
        sourceType: 'FILE_UPLOAD',
        fileName: file.originalname,
        fileUrl: uploadResult.url,
        fileType: file.mimetype.includes('pdf') ? 'PDF' : 'DOCX',
        status: AgoraCurriculumSourceStatus.PENDING_PARSE,
        createdBy: userId,
        batchId: batchId || uuidv4(),
      },
    });

    // Queue for background processing — no custom jobId to avoid BullMQ dedup silently blocking re-uploads
    await this.curriculumQueue.add(JOB_PROCESS_SOURCE, {
      sourceId: source.id,
      batchId: source.batchId,
    }, { priority: 1 });

    this.logger.log(`Created and queued curriculum source: ${source.id}`);
    return source;
  }

  async uploadMultipleSources(
    files: Express.Multer.File[],
    dto: UploadMultipleCurriculumSourcesDto,
    userId: string
  ) {
    const mappedEntries = this.parseQueueEntries(dto.entries);
    if (mappedEntries) {
      return this.uploadMappedSources(files, mappedEntries, userId);
    }

    if (!dto.subjectId || !dto.gradeLevel) {
      throw new BadRequestException('Subject and grade level are required when entries are not provided');
    }

    const batchId = uuidv4();
    const results = [];
    const grades = dto.gradeLevel.split(',').map(g => g.trim()).filter(g => g);

    const subject = await this.prisma.agoraSubject.findUnique({
      where: { id: dto.subjectId },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    for (const file of files) {
      // Upload file ONCE per file loop
      const uploadResult = await this.cloudinaryService.uploadRawFile(file, 'agora-curricula');

      for (const grade of grades) {
        const source = await this.prisma.agoraCurriculumSource.create({
          data: {
            subjectId: dto.subjectId,
            gradeLevel: grade,
            sourceType: 'FILE_UPLOAD',
            fileName: file.originalname,
            fileUrl: uploadResult.url,
            fileType: file.mimetype.includes('pdf') ? 'PDF' : 'DOCX',
            status: AgoraCurriculumSourceStatus.PENDING_PARSE,
            createdBy: userId,
            batchId: batchId,
          },
        });

        // Queue for background processing — no custom jobId to avoid BullMQ dedup silently blocking re-uploads
        await this.curriculumQueue.add(JOB_PROCESS_SOURCE, {
          sourceId: source.id,
          batchId: source.batchId,
        }, { priority: 1 });
        results.push(source);
      }
    }

    return { batchId, sources: results };
  }

  private parseQueueEntries(raw?: string): Array<{ fileIndex: number; subjectId: string; gradeLevel: string }> | null {
    if (!raw || !raw.trim()) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('entries must be valid JSON');
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new BadRequestException('entries must be a non-empty array');
    }

    return parsed.map((entry, i) => {
      const fileIndex = Number(entry?.fileIndex);
      const subjectId = typeof entry?.subjectId === 'string' ? entry.subjectId.trim() : '';
      const gradeLevel = typeof entry?.gradeLevel === 'string' ? entry.gradeLevel.trim() : '';

      if (!Number.isInteger(fileIndex) || fileIndex < 0) {
        throw new BadRequestException(`entries[${i}].fileIndex must be a non-negative integer`);
      }
      if (!subjectId) throw new BadRequestException(`entries[${i}].subjectId is required`);
      if (!gradeLevel) throw new BadRequestException(`entries[${i}].gradeLevel is required`);

      return { fileIndex, subjectId, gradeLevel };
    });
  }

  private async uploadMappedSources(
    files: Express.Multer.File[],
    entries: Array<{ fileIndex: number; subjectId: string; gradeLevel: string }>,
    userId: string
  ) {
    const batchId = uuidv4();
    const results = [];
    const uploadCache = new Map<number, { url: string }>();
    const subjectIds = [...new Set(entries.map((e) => e.subjectId))];
    const subjects = await this.prisma.agoraSubject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true },
    });
    const knownSubjects = new Set(subjects.map((s) => s.id));

    for (const [i, entry] of entries.entries()) {
      if (!knownSubjects.has(entry.subjectId)) {
        throw new NotFoundException(`Subject not found for entries[${i}]`);
      }
      const file = files[entry.fileIndex];
      if (!file) {
        throw new BadRequestException(`No file uploaded for entries[${i}].fileIndex ${entry.fileIndex}`);
      }

      let uploadResult = uploadCache.get(entry.fileIndex);
      if (!uploadResult) {
        uploadResult = await this.cloudinaryService.uploadRawFile(file, 'agora-curricula');
        uploadCache.set(entry.fileIndex, uploadResult);
      }

      const source = await this.prisma.agoraCurriculumSource.create({
        data: {
          subjectId: entry.subjectId,
          gradeLevel: entry.gradeLevel,
          sourceType: 'FILE_UPLOAD',
          fileName: file.originalname,
          fileUrl: uploadResult.url,
          fileType: file.mimetype.includes('pdf') ? 'PDF' : 'DOCX',
          status: AgoraCurriculumSourceStatus.PENDING_PARSE,
          createdBy: userId,
          batchId,
        },
      });

      await this.curriculumQueue.add(JOB_PROCESS_SOURCE, {
        sourceId: source.id,
        batchId: source.batchId,
      }, { priority: 1 });
      results.push(source);
    }

    return { batchId, sources: results };
  }

  async getSources(subjectId?: string, gradeLevel?: string) {
    return this.prisma.agoraCurriculumSource.findMany({
      where: {
        ...(subjectId && { subjectId }),
        ...(gradeLevel && { gradeLevel }),
      },
      include: {
        subject: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSource(id: string) {
    const source = await this.prisma.agoraCurriculumSource.findUnique({
      where: { id },
      include: { subject: true },
    });
    if (!source) throw new NotFoundException('Source not found');
    return source;
  }

  async getSourceStatus(id: string) {
    const source = await this.prisma.agoraCurriculumSource.findUnique({
      where: { id },
      include: { subject: true },
    });

    if (!source) throw new NotFoundException('Source not found');

    // Get real-time progress from BullMQ
    let jobProgress = null;
    let queuePosition: number | null = null;

    if (source.status === AgoraCurriculumSourceStatus.PENDING_PARSE) {
      // Scan waiting + delayed jobs by payload (not by jobId) for accurate position
      const waitingJobs = await this.curriculumQueue.getJobs(['waiting', 'delayed']);
      const index = waitingJobs.findIndex(job => job?.data?.sourceId === id);
      if (index !== -1) {
        queuePosition = index + 1;
        this.logger.debug(`Source ${id} is at queue position ${queuePosition}`);
      } else {
        this.logger.warn(`Source ${id} is PENDING_PARSE but has no job in waiting/delayed. Job may have been consumed already.`);
      }
    } else if (source.status === AgoraCurriculumSourceStatus.PARSING) {
      // Scan active jobs by payload (safer than getJob(id) which relies on jobId === sourceId)
      const activeJobs = await this.curriculumQueue.getJobs(['active']);
      const activeJob = activeJobs.find(job => job?.data?.sourceId === id);
      if (activeJob) {
        jobProgress = activeJob.progress;
      }
    }

    return {
      ...source,
      jobProgress,
      queuePosition
    };
  }

  async getBatchStatus(batchId: string) {
    const sources = await this.prisma.agoraCurriculumSource.findMany({
      where: { batchId },
      select: { id: true, status: true, fileName: true },
    });

    if (sources.length === 0) throw new NotFoundException('Batch not found');

    const total = sources.length;
    const parsed = sources.filter((s: any) => s.status === AgoraCurriculumSourceStatus.PARSED).length;
    const failed = sources.filter((s: any) => s.status === AgoraCurriculumSourceStatus.FAILED).length;
    const processing = sources.filter((s: any) => s.status === AgoraCurriculumSourceStatus.PARSING).length;

    return {
      batchId,
      total,
      parsed,
      failed,
      processing,
      isComplete: parsed === total,
      hasFailures: failed > 0,
      sources,
    };
  }

  async retrySourceParsing(id: string) {
    const source = await this.prisma.agoraCurriculumSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Source not found');

    if (
      source.status !== AgoraCurriculumSourceStatus.FAILED &&
      source.status !== AgoraCurriculumSourceStatus.PENDING_PARSE
    ) {
      throw new BadRequestException('Can only retry failed or stuck queued parsing jobs');
    }

    await this.prisma.agoraCurriculumSource.update({
      where: { id },
      data: { status: AgoraCurriculumSourceStatus.PENDING_PARSE, parseErrors: null },
    });

    await this.curriculumQueue.add(JOB_PROCESS_SOURCE, {
      sourceId: source.id,
      batchId: source.batchId,
    });

    return { message: 'Retry job queued successfully' };
  }

  async deleteSource(id: string) {
    const source = await this.prisma.agoraCurriculumSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Source not found');

    // Check if it's used in any consolidated curricula
    const usedIn = await this.prisma.agoraCurriculum.findFirst({
      where: { sourceIds: { has: id } }
    });

    if (usedIn) {
      throw new BadRequestException('Cannot delete a source that has been consolidated into a curriculum. Delete the curriculum first.');
    }

    // Try to cancel if processing
    if (source.status === AgoraCurriculumSourceStatus.PARSING || source.status === AgoraCurriculumSourceStatus.PENDING_PARSE) {
      try { await this.cancelSourceProcessing(id); } catch (e) { }
    }

    // Delete from Cloudinary if it's a file upload
    if (source.fileUrl && source.sourceType === 'FILE_UPLOAD') {
      try {
        const publicId = this.cloudinaryService.extractPublicId(source.fileUrl);
        if (publicId) {
          await this.cloudinaryService.deleteRawFile(publicId);
          this.logger.log(`Deleted Cloudinary file: ${publicId}`);
        }
      } catch (err) {
        this.logger.error(`Failed to delete file from Cloudinary: ${source.fileUrl}`, err);
        // We don't block DB deletion if Cloudinary fails, to avoid "stuck" records
      }
    }

    return this.prisma.agoraCurriculumSource.delete({ where: { id } });
  }

  async cancelSourceProcessing(id: string) {
    const source = await this.prisma.agoraCurriculumSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Source not found');

    // Find and remove job from BullMQ
    const jobs = await this.curriculumQueue.getJobs(['active', 'waiting', 'delayed']);
    const job = jobs.find(j => j.data.sourceId === id);

    if (job) {
      await job.remove();
    }

    // Update status to FAILED with a cancellation message
    return this.prisma.agoraCurriculumSource.update({
      where: { id },
      data: {
        status: AgoraCurriculumSourceStatus.FAILED,
        parseErrors: 'Processing cancelled by administrator.'
      },
    });
  }

  // ==========================================
  // CONSOLIDATED CURRICULUM
  // ==========================================

  async autoConsolidateParsedSource(source: {
    id: string;
    subjectId: string;
    gradeLevel: string;
    createdBy: string;
    batchId?: string | null;
  }) {
    const peers = await this.prisma.agoraCurriculumSource.findMany({
      where: {
        subjectId: source.subjectId,
        gradeLevel: source.gradeLevel,
        status: AgoraCurriculumSourceStatus.PARSED,
      },
      select: { id: true },
    });

    this.logger.log(
      `Auto-consolidating ${source.subjectId} / ${source.gradeLevel} from ${peers.length} parsed source(s)`,
    );

    return this.enqueueConsolidation({
      subjectId: source.subjectId,
      gradeLevel: source.gradeLevel,
      sourceIds: peers.map((peer) => peer.id),
      userId: source.createdBy,
      batchId: source.batchId || undefined,
    });
  }

  async consolidateSources(dto: ConsolidateCurriculumDto, userId: string) {
    const sources = await this.prisma.agoraCurriculumSource.findMany({
      where: { id: { in: dto.sourceIds }, status: AgoraCurriculumSourceStatus.PARSED },
    });

    if (sources.length === 0) {
      throw new BadRequestException('No parsed sources found for consolidation');
    }

    return this.enqueueConsolidation({
      subjectId: dto.subjectId,
      gradeLevel: dto.gradeLevel,
      sourceIds: dto.sourceIds,
      userId,
      forceNewVersion: dto.forceNewVersion,
    });
  }

  /**
   * One in-flight DRAFT per subject+grade. A new version is only minted after
   * the latest draft is a complete 39-week year (or is published).
   */
  async enqueueConsolidation(params: {
    subjectId: string;
    gradeLevel: string;
    sourceIds: string[];
    userId: string;
    batchId?: string;
    forceNewVersion?: boolean;
  }) {
    const curriculum = await this.getOrCreateDraftForConsolidation(params);
    const jobId = `consolidate-${curriculum.id}`;
    const existingJob = await this.consolidationQueue.getJob(jobId);

    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        this.logger.log(`Consolidation already ${state} for ${curriculum.id}; not queueing a second job`);
        return curriculum;
      }
      await existingJob.remove().catch(() => undefined);
    }

    await this.consolidationQueue.add(
      JOB_CONSOLIDATE_BATCH,
      {
        batchId: params.batchId,
        curriculumId: curriculum.id,
        sourceIds: params.sourceIds,
        subjectId: params.subjectId,
        gradeLevel: params.gradeLevel,
        uploadedBy: params.userId,
      },
      { jobId, priority: 1 },
    );

    this.logger.log(`Queued DRAFT curriculum consolidation: ${curriculum.id} (Version ${curriculum.version})`);
    return curriculum;
  }

  private async getOrCreateDraftForConsolidation(params: {
    subjectId: string;
    gradeLevel: string;
    sourceIds: string[];
    userId: string;
    forceNewVersion?: boolean;
  }) {
    const latest = await this.prisma.agoraCurriculum.findFirst({
      where: { subjectId: params.subjectId, gradeLevel: params.gradeLevel },
      orderBy: { version: 'desc' },
      include: {
        _count: { select: { topics: { where: { deprecatedAt: null } } } },
      },
    });

    if (shouldReuseInFlightDraft(
      latest ? { status: latest.status, topicCount: latest._count.topics } : null,
      { forceNewVersion: params.forceNewVersion },
    )) {
      return this.prisma.agoraCurriculum.update({
        where: { id: latest!.id },
        data: { sourceIds: params.sourceIds },
      });
    }

    const nextVersion = nextCurriculumVersion(latest);
    return this.prisma.agoraCurriculum.create({
      data: {
        subjectId: params.subjectId,
        gradeLevel: params.gradeLevel,
        sourceIds: params.sourceIds,
        version: nextVersion,
        status: AgoraCurriculumPublishStatus.DRAFT,
        createdBy: params.userId,
      },
    });
  }

  async getCurricula(subjectId?: string, gradeLevel?: string, status?: AgoraCurriculumPublishStatus) {
    return this.prisma.agoraCurriculum.findMany({
      where: {
        ...(subjectId && { subjectId }),
        ...(gradeLevel && { gradeLevel }),
        ...(status && { status }),
      },
      include: {
        subject: true,
        topics: {
          where: { deprecatedAt: null },
        },
      },
      orderBy: [
        { subjectId: 'asc' },
        { gradeLevel: 'asc' },
        { version: 'desc' },
      ],
    });
  }

  async getCurriculum(id: string) {
    const curriculum = await this.prisma.agoraCurriculum.findUnique({
      where: { id },
      include: {
        subject: true,
        topics: {
          where: { deprecatedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!curriculum) throw new NotFoundException('Curriculum not found');
    return curriculum;
  }

  async publishCurriculum(id: string, dto: PublishCurriculumDto, userId: string) {
    const curriculum = await this.prisma.agoraCurriculum.findUnique({ where: { id } });
    if (!curriculum) throw new NotFoundException('Curriculum not found');

    if (dto.status === AgoraCurriculumPublishStatus.PUBLISHED) {
      const topics = await this.prisma.agoraCurriculumTopic.findMany({
        where: { curriculumId: id, deprecatedAt: null },
        select: { term: true, weekNumber: true },
      });
      if (!isCompleteFullYearSlots(topics)) {
        throw new BadRequestException(
          `Cannot publish until the curriculum has ${FULL_YEAR_WEEKS} weeks (3 terms × 13). Currently ${topics.length}.`,
        );
      }
    }

    return this.prisma.agoraCurriculum.update({
      where: { id },
      data: {
        status: dto.status,
        publishedAt: dto.status === AgoraCurriculumPublishStatus.PUBLISHED ? new Date() : null,
        publishedBy: dto.status === AgoraCurriculumPublishStatus.PUBLISHED ? userId : null,
      },
    });
  }

  async deleteCurriculum(id: string) {
    return this.prisma.agoraCurriculum.delete({ where: { id } });
  }

  async updateTopic(topicId: string, data: any) {
    const { stableKey: _ignore, ...safe } = data || {};
    return this.prisma.agoraCurriculumTopic.update({
      where: { id: topicId },
      data: safe,
    });
  }

  async addTopic(curriculumId: string, data: any) {
    const lastTopic = await this.prisma.agoraCurriculumTopic.findFirst({
      where: { curriculumId },
      orderBy: { weekNumber: 'desc' },
    });

    const nextWeek = (lastTopic?.weekNumber || 0) + 1;
    const curriculum = await this.prisma.agoraCurriculum.findUnique({
      where: { id: curriculumId },
      include: { subject: true, topics: { select: { stableKey: true } } },
    });
    const { allocateUniqueStableKey, buildTopicStableKey } = await import(
      '../common/utils/topic-stable-key.util'
    );
    const used = new Set((curriculum?.topics || []).map((t) => t.stableKey));
    const preferred = buildTopicStableKey({
      subjectCode: curriculum?.subject?.code || curriculum?.subject?.name,
      gradeLevel: curriculum?.gradeLevel,
      term: data.term || 1,
      weekNumber: nextWeek,
      title: data.title || data.topic || 'Untitled',
    });

    return this.prisma.agoraCurriculumTopic.create({
      data: {
        ...data,
        curriculumId,
        stableKey: allocateUniqueStableKey(preferred, used),
        weekNumber: nextWeek,
        order: nextWeek,
      },
    });
  }

  async deleteTopic(topicId: string) {
    return this.prisma.agoraCurriculumTopic.update({
      where: { id: topicId },
      data: { deprecatedAt: new Date() },
    });
  }
}
