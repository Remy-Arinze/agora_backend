import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GenerateSchemeOfWorkDto, UpdateSchemeOfWorkStatusDto, UpdateSchemeOfWorkWeekDto, MarkWeekDeliveredDto } from './dto/scheme-of-work.dto';
import { SchemeGenerationMode, SchemeOfWorkStatus } from '@prisma/client';
import { AiService } from '../../ai/ai.service';

@Injectable()
export class SchemeOfWorkService {
  private readonly logger = new Logger(SchemeOfWorkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService
  ) {}

  // ==========================================
  // SCHOOL ADMIN / BASE SCHEMES
  // ==========================================

  async generateScheme(schoolId: string, dto: GenerateSchemeOfWorkDto, userId: string) {
    // Basic validations
    if (dto.generationMode === SchemeGenerationMode.AGORA_ONLY && !dto.agoraCurriculumId) {
      throw new BadRequestException('Agora Curriculum ID is required when mode is AGORA_ONLY');
    }
    if (dto.generationMode === SchemeGenerationMode.SCHOOL_ONLY && !dto.schoolCurriculumId) {
      throw new BadRequestException('School Curriculum Doc ID is required when mode is SCHOOL_ONLY');
    }
    if (dto.generationMode === SchemeGenerationMode.MERGED && (!dto.agoraCurriculumId || !dto.schoolCurriculumId)) {
      throw new BadRequestException('Both Agora Curriculum and School Curriculum Doc IDs are required for MERGED mode');
    }
    if (dto.generationMode === SchemeGenerationMode.MERGED && (!dto.mergeWeightAgora || !dto.mergeWeightSchool)) {
      throw new BadRequestException('Merge weights are required for MERGED mode');
    }

    // Determine parent fork tracking
    let isFork = false;
    let parentSchemeId = null;
    let version = 1;

    if (dto.parentSchemeId) {
      const parent = await this.prisma.schemeOfWork.findUnique({ where: { id: dto.parentSchemeId } });
      if (!parent) throw new NotFoundException('Parent Scheme of Work not found');
      if (parent.schoolId !== schoolId) throw new ForbiddenException('Cannot fork a scheme from another school');

      isFork = true;
      parentSchemeId = parent.id;
      version = parent.version + 1;
    }

    // Capture the version of Agora Curriculum used if passed
    let agoraCurriculumVersion = null;
    if (dto.agoraCurriculumId) {
      const ac = await this.prisma.agoraCurriculum.findUnique({ where: { id: dto.agoraCurriculumId } });
      if (ac) agoraCurriculumVersion = ac.version;
    }

    const scheme = await this.prisma.schemeOfWork.create({
      data: {
        schoolId,
        classArmId: dto.classArmId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        termId: dto.termId,
        generationMode: dto.generationMode,
        agoraCurriculumId: dto.agoraCurriculumId,
        agoraCurriculumVersion: agoraCurriculumVersion,
        schoolCurriculumId: dto.schoolCurriculumId,
        mergeWeightAgora: dto.mergeWeightAgora,
        mergeWeightSchool: dto.mergeWeightSchool,
        isFork,
        parentSchemeId,
        version,
        status: SchemeOfWorkStatus.GENERATING, // Initial state, handed to AI
      },
    });

    this.logger.log(`Created Scheme of Work [${scheme.id}] for generation queuing.`);
    // Phase 4 trigger: Send to background AiService parser
    this.aiService.generateSchemeOfWork(scheme.id).catch(e => {
      this.logger.error(`Background Scheme of Work generation failed for ${scheme.id}:`, e);
    });

    return scheme;
  }

  async getSchemesBySchool(schoolId: string, query: { classId?: string, termId?: string, subjectId?: string }) {
    return this.prisma.schemeOfWork.findMany({
      where: {
        schoolId,
        ...(query.classId && { classId: query.classId }),
        ...(query.termId && { termId: query.termId }),
        ...(query.subjectId && { subjectId: query.subjectId }),
      },
      include: {
        agoraCurriculum: { include: { subject: true } },
        schoolCurriculum: true,
      },
      orderBy: [{ termId: 'asc' }, { version: 'desc' }],
    });
  }

  async getSchemeById(schoolId: string, id: string) {
    const scheme = await this.prisma.schemeOfWork.findUnique({
      where: { id },
      include: {
        agoraCurriculum: { include: { subject: true } },
        schoolCurriculum: true,
        weeks: { orderBy: { weekNumber: 'asc' } },
      },
    });
    if (!scheme) throw new NotFoundException('Scheme of Work not found');
    if (scheme.schoolId !== schoolId) throw new ForbiddenException('Access denied');
    return scheme;
  }

  async updateSchemeStatus(schoolId: string, id: string, dto: UpdateSchemeOfWorkStatusDto, userId: string) {
    const scheme = await this.getSchemeById(schoolId, id);
    
    // Prevent reverse transition out of publishing if not strictly allowed, or allow it for now.
    return this.prisma.schemeOfWork.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === SchemeOfWorkStatus.APPROVED && { approvedAt: new Date(), approvedBy: userId }),
        ...(dto.status === SchemeOfWorkStatus.PUBLISHED && { publishedAt: new Date(), publishedBy: userId }),
      },
    });
  }

  // ==========================================
  // TEACHER APIs
  // ==========================================

  async getSchemeForTeacherClassScope(schoolId: string, classId: string, termId: string, teacherUserId: string) {
    // Ensure the teacher actually teaches this class
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: teacherUserId, schoolId },
    });
    if (!teacher) throw new ForbiddenException('Teacher profile not found');

    const classRecord = await this.prisma.class.findUnique({
      where: { id: classId, schoolId },
      include: { classTeachers: true },
    });
    
    if (!classRecord) throw new NotFoundException('Class not found in this school');

    // 1. Get the class's enrolled subjects for the teacher's mapping or global fetching...
    // For simplicity, fetch the published Scheme of Work associated with this class + term
    const schemes = await this.prisma.schemeOfWork.findMany({
      where: {
        schoolId,
        termId,
        status: SchemeOfWorkStatus.PUBLISHED,
        OR: [
          { classId },
          { classArmId: { in: classRecord.classTeachers.filter(ct => ct.teacherId === teacher.id).map(ct => ct.classArmId || undefined).filter((id): id is string => id !== undefined) } }
        ]
      },
      include: {
        weeks: { orderBy: { weekNumber: 'asc' } }
      }
    });

    return schemes;
  }

  async markWeekDelivered(schoolId: string, weekId: string, dto: MarkWeekDeliveredDto, teacherUserId: string) {
    // Retrieve the week + scheme to check ownership and scope
    const week = await this.prisma.schemeOfWorkWeek.findUnique({
      where: { id: weekId },
      include: { schemeOfWork: true },
    });
    if (!week) throw new NotFoundException('Week not found');
    if (week.schemeOfWork.schoolId !== schoolId) throw new ForbiddenException('Access denied');

    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: teacherUserId, schoolId },
    });
    if (!teacher) throw new ForbiddenException('Teacher profile not found');

    return this.prisma.schemeOfWorkWeek.update({
      where: { id: weekId },
      data: {
        isDelivered: dto.isDelivered,
        privateTeacherNotes: dto.privateTeacherNotes !== undefined ? dto.privateTeacherNotes : week.privateTeacherNotes,
        deliveredAt: dto.isDelivered ? new Date() : null,
        deliveredBy: dto.isDelivered ? teacher.id : null,
      },
    });
  }

  // ==========================================
  // STUDENT APIs
  // ==========================================

  async getSchemeForStudentClassScope(schoolId: string, classId: string, termId: string, studentUserId: string) {
    // Students only see PUBLISHED schemes.
    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) throw new ForbiddenException('Student profile not found');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: student.id, classId, schoolId },
    });
    if (enrollments.length === 0) throw new ForbiddenException('Student not enrolled in this class');

    const schemes = await this.prisma.schemeOfWork.findMany({
      where: {
        schoolId,
        classId,
        termId,
        status: SchemeOfWorkStatus.PUBLISHED,
      },
      include: {
        weeks: {
          orderBy: { weekNumber: 'asc' },
          select: {
            id: true,
            weekNumber: true,
            topic: true,
            subTopics: true,
            studentFriendlyOutcomes: true, // Formal outcomes hidden
            suggestedActivities: true,
            resources: true,
            assessmentType: true,
            isDelivered: true,
            deliveredAt: true, // Only allow student to see if a topic was taught
            // NOTE: privateTeacherNotes and teacherNotes explicitly excluded
          }
        }
      }
    });

    return schemes;
  }
}
