import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAgoraCurriculumSourceDto, ConsolidateCurriculumDto, PublishCurriculumDto } from './dto/agora-curriculum.dto';
import { AgoraCurriculumSourceStatus, AgoraCurriculumPublishStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { CloudinaryService } from '../storage/cloudinary/cloudinary.service';

@Injectable()
export class AgoraCurriculumService {
  private readonly logger = new Logger(AgoraCurriculumService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

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

  async createSource(dto: CreateAgoraCurriculumSourceDto, userId: string) {
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
      },
    });

    // Phase 4 trigger: Send to background AiService parser
    this.logger.log(`Created new curriculum source: ${source.id}`);
    this.aiService.parseCurriculumDocument(source.id).catch(e => {
      this.logger.error(`Background parsing failed for ${source.id}:`, e);
    });

    return source;
  }

  async uploadAndCreateSource(
    file: Express.Multer.File,
    dto: CreateAgoraCurriculumSourceDto,
    userId: string
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
        status: 'PENDING_PARSE',
        createdBy: userId,
      },
    });

    // Phase 4 trigger
    this.logger.log(`Created new curriculum source from upload: ${source.id}`);
    this.aiService.parseCurriculumDocument(source.id).catch(e => {
      this.logger.error(`Background parsing failed for ${source.id}:`, e);
    });

    return source;
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
      },
    });

    // Phase 4 trigger: Trigger AiService for background consolidation
    this.logger.log(`Created DRAFT curriculum consolidation: ${curriculum.id} (Version ${nextVersion})`);
    this.aiService.consolidateAgoraCurriculum(curriculum.id).catch(e => {
      this.logger.error(`Background consolidation failed for ${curriculum.id}:`, e);
    });

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
}
