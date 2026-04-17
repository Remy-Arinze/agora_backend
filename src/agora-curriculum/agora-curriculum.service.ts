import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAgoraCurriculumSourceDto, ConsolidateCurriculumDto, PublishCurriculumDto } from './dto/agora-curriculum.dto';
import { AgoraCurriculumSourceStatus, AgoraCurriculumPublishStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { CloudinaryService } from '../storage/cloudinary/cloudinary.service';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CURRICULUM_PROCESSING_QUEUE, CURRICULUM_CONSOLIDATION_QUEUE, JOB_PROCESS_SOURCE, JOB_CONSOLIDATE_BATCH } from './curriculum.processor';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AgoraCurriculumService {
  private readonly logger = new Logger(AgoraCurriculumService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly cloudinaryService: CloudinaryService,
    @InjectQueue(CURRICULUM_PROCESSING_QUEUE) private readonly curriculumQueue: Queue,
    @InjectQueue(CURRICULUM_CONSOLIDATION_QUEUE) private readonly consolidationQueue: Queue,
  ) { }

  // ==========================================
  // SUBJECTS
  // ==========================================

  async getNerdcSubjects(schoolType?: string, category?: string) {
    const subjects = await this.prisma.nerdcSubject.findMany({
      where: {
        ...(schoolType && { schoolType }),
        ...(category && { category }),
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    return subjects;
  }

  // ==========================================
  // SOURCES MANAGEMENT
  // ==========================================

  async createSource(dto: CreateAgoraCurriculumSourceDto, userId: string, batchId?: string) {
    const subject = await this.prisma.nerdcSubject.findUnique({
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

    // Queue for background processing
    await this.curriculumQueue.add(JOB_PROCESS_SOURCE, {
      sourceId: source.id,
      batchId: source.batchId,
    });

    this.logger.log(`Created and queued curriculum source: ${source.id}`);
    return source;
  }

  async uploadAndCreateSource(
    file: Express.Multer.File,
    dto: CreateAgoraCurriculumSourceDto,
    userId: string,
    batchId?: string
  ) {
    const subject = await this.prisma.nerdcSubject.findUnique({
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

    // Queue for background processing
    await this.curriculumQueue.add(JOB_PROCESS_SOURCE, {
      sourceId: source.id,
      batchId: source.batchId,
    });

    this.logger.log(`Created and queued curriculum source from upload: ${source.id}`);
    return source;
  }

  async uploadMultipleSources(
    files: Express.Multer.File[],
    dto: CreateAgoraCurriculumSourceDto,
    userId: string
  ) {
    const batchId = uuidv4();
    const results = [];

    for (const file of files) {
      const source = await this.uploadAndCreateSource(file, dto, userId, batchId);
      results.push(source);
    }

    return { batchId, sources: results };
  }

  async getSources(subjectId?: string, gradeLevel?: string) {
    return (this.prisma as any).agoraCurriculumSource.findMany({
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
    const source = await (this.prisma as any).agoraCurriculumSource.findUnique({
      where: { id },
      include: { subject: true },
    });
    if (!source) throw new NotFoundException('Source not found');
    return source;
  }

  async getSourceStatus(id: string) {
    const source = await (this.prisma as any).agoraCurriculumSource.findUnique({
      where: { id },
      select: { id: true, status: true, parseErrors: true, updatedAt: true },
    });
    if (!source) throw new NotFoundException('Source not found');
    return source;
  }

  async getBatchStatus(batchId: string) {
    const sources = await (this.prisma as any).agoraCurriculumSource.findMany({
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
    const source = await (this.prisma as any).agoraCurriculumSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Source not found');

    if (source.status !== AgoraCurriculumSourceStatus.FAILED) {
      throw new BadRequestException('Can only retry failed parsing jobs');
    }

    await (this.prisma as any).agoraCurriculumSource.update({
      where: { id },
      data: { status: AgoraCurriculumSourceStatus.PENDING_PARSE, parseErrors: null },
    });

    await this.curriculumQueue.add(JOB_PROCESS_SOURCE, {
      sourceId: source.id,
      batchId: source.batchId,
    });

    return { message: 'Retry job queued successfully' };
  }

  // ==========================================
  // CONSOLIDATED CURRICULUM
  // ==========================================

  async consolidateSources(dto: ConsolidateCurriculumDto, userId: string) {
    const sources = await (this.prisma as any).agoraCurriculumSource.findMany({
      where: { id: { in: dto.sourceIds }, status: AgoraCurriculumSourceStatus.PARSED },
    });

    if (sources.length === 0) {
      throw new BadRequestException('No parsed sources found for consolidation');
    }

    // Determine the next version
    const existing = await (this.prisma as any).agoraCurriculum.findFirst({
      where: { subjectId: dto.subjectId, gradeLevel: dto.gradeLevel },
      orderBy: { version: 'desc' },
    });
    const nextVersion = existing ? existing.version + 1 : 1;

    // Create draft curriculum version
    const curriculum = await (this.prisma as any).agoraCurriculum.create({
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
    return (this.prisma as any).agoraCurriculum.findMany({
      where: {
        ...(subjectId && { subjectId }),
        ...(gradeLevel && { gradeLevel }),
        ...(status && { status }),
      },
      include: {
        subject: true,
      },
      orderBy: [
        { subjectId: 'asc' },
        { gradeLevel: 'asc' },
        { version: 'desc' },
      ],
    });
  }

  async getCurriculum(id: string) {
    const curriculum = await (this.prisma as any).agoraCurriculum.findUnique({
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
    const curriculum = await (this.prisma as any).agoraCurriculum.findUnique({ where: { id } });
    if (!curriculum) throw new NotFoundException('Curriculum not found');

    if (dto.status === AgoraCurriculumPublishStatus.PUBLISHED) {
      // Validate that it has topics before publishing
      const topicsCount = await (this.prisma as any).agoraCurriculumTopic.count({ where: { curriculumId: id } });
      if (topicsCount === 0) {
        throw new BadRequestException('Cannot publish a curriculum with no topics');
      }
    }

    return (this.prisma as any).agoraCurriculum.update({
      where: { id },
      data: {
        status: dto.status,
        publishedAt: dto.status === AgoraCurriculumPublishStatus.PUBLISHED ? new Date() : null,
        publishedBy: dto.status === AgoraCurriculumPublishStatus.PUBLISHED ? userId : null,
      },
    });
  }
}
