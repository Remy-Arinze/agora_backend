import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../database/prisma.service';
import { CreateAgoraCurriculumSourceDto, ConsolidateCurriculumDto, PublishCurriculumDto, CreateAgoraSubjectDto, UpdateAgoraSubjectDto } from './dto/agora-curriculum.dto';
import { AgoraCurriculumSourceStatus, AgoraCurriculumPublishStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { CloudinaryService } from '../storage/cloudinary/cloudinary.service';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CURRICULUM_PROCESSING_QUEUE, CURRICULUM_CONSOLIDATION_QUEUE, JOB_PROCESS_SOURCE, JOB_CONSOLIDATE_BATCH } from './curriculum.processor';
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
      if (activeJobs.length > 0) {
        this.logger.warn(`[Startup] Found ${activeJobs.length} stale active job(s). Cleaning up...`);
        for (const job of activeJobs) {
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

  async getNerdcSubjects(schoolType?: string, category?: string, search?: string) {
    return this.prisma.agoraSubject.findMany({
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
    dto: CreateAgoraCurriculumSourceDto,
    userId: string
  ) {
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

    if (source.status !== AgoraCurriculumSourceStatus.FAILED) {
      throw new BadRequestException('Can only retry failed parsing jobs');
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

  async consolidateSources(dto: ConsolidateCurriculumDto, userId: string) {
    const sources = await this.prisma.agoraCurriculumSource.findMany({
      where: { id: { in: dto.sourceIds }, status: AgoraCurriculumSourceStatus.PARSED },
    });

    if (sources.length === 0) {
      throw new BadRequestException('No parsed sources found for consolidation');
    }

    // Determine the next version
    const existing = await this.prisma.agoraCurriculum.findFirst({
      where: { subjectId: dto.subjectId, gradeLevel: dto.gradeLevel },
      orderBy: { version: 'desc' },
    });
    const nextVersion = existing ? existing.version + 1 : 1;

    // Create draft curriculum version
    const curriculum = await this.prisma.agoraCurriculum.create({
      data: {
        subjectId: dto.subjectId,
        gradeLevel: dto.gradeLevel,
        sourceIds: dto.sourceIds,
        version: nextVersion,
        status: AgoraCurriculumPublishStatus.DRAFT,
        createdBy: userId,
      },
    });

    // Queue for background consolidation
    await this.consolidationQueue.add(JOB_CONSOLIDATE_BATCH, {
      batchId: 'manual-trigger-' + uuidv4(), // Manual trigger doesn't have a single batchId necessarily
      subjectId: dto.subjectId,
      gradeLevel: dto.gradeLevel,
      uploadedBy: userId,
    });

    this.logger.log(`Queued DRAFT curriculum consolidation: ${curriculum.id} (Version ${nextVersion})`);
    return curriculum;
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
        topics: true,
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
      // Validate that it has topics before publishing
      const topicsCount = await this.prisma.agoraCurriculumTopic.count({ where: { curriculumId: id } });
      if (topicsCount === 0) {
        throw new BadRequestException('Cannot publish a curriculum with no topics');
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
    return this.prisma.agoraCurriculumTopic.update({
      where: { id: topicId },
      data,
    });
  }

  async addTopic(curriculumId: string, data: any) {
    // Get the highest week number to auto-increment
    const lastTopic = await this.prisma.agoraCurriculumTopic.findFirst({
      where: { curriculumId },
      orderBy: { weekNumber: 'desc' },
    });

    const nextWeek = (lastTopic?.weekNumber || 0) + 1;

    return this.prisma.agoraCurriculumTopic.create({
      data: {
        ...data,
        curriculumId,
        weekNumber: nextWeek,
        order: nextWeek,
      },
    });
  }

  async deleteTopic(topicId: string) {
    return this.prisma.agoraCurriculumTopic.delete({
      where: { id: topicId },
    });
  }
}
