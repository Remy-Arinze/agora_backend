import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolRepository } from '../domain/repositories/school.repository';
import { StaffRepository } from '../domain/repositories/staff.repository';
import {
  CreateCurriculumDto,
  CreateCurriculumItemDto,
  GenerateCurriculumDto,
  BulkGenerateCurriculumDto,
  UpdateCurriculumDto,
} from './dto/create-curriculum.dto';
import { CreateSchoolCurriculumDocDto } from './dto/school-curriculum-doc.dto';
import {
  CurriculumDto,
  CurriculumItemDto,
  CurriculumSummaryDto,
  TimetableSubjectDto,
} from './dto/curriculum.dto';
import { NerdcCurriculumService } from './nerdc-curriculum.service';
import {
  AgoraCurriculumTemplateDto,
  AgoraSubjectDto,
  getClassLevelCode,
} from './dto/nerdc-curriculum.dto';
import { UserWithContext } from '../../auth/types/user-with-context.type';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CURRICULUM_PROCESSING_QUEUE, JOB_PROCESS_SOURCE } from '../../agora-curriculum/curriculum.processor';
import { SetupSchemeOfWorkDto } from './dto/scheme-of-work.dto';
import { SchemeGenerationMode, SchemeOfWorkStatus } from '@prisma/client';
import { AiService } from '../../ai/ai.service';
import { CloudinaryService } from '../../storage/cloudinary/cloudinary.service';

@Injectable()
export class CurriculumService {
  private readonly logger = new Logger(CurriculumService.name);

  // Credit Constants
  private readonly VERIFICATION_COST = 5;
  private readonly GENERATION_COST = 45;
  private readonly TOTAL_COST = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository,
    private readonly staffRepository: StaffRepository,
    private readonly nerdcService: NerdcCurriculumService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly aiService: AiService,
    private readonly cloudinaryService: CloudinaryService,
    @InjectQueue(CURRICULUM_PROCESSING_QUEUE) private readonly curriculumQueue: Queue
  ) { }

  // ============================================
  // Timetable-Driven Subject Discovery
  // ============================================

  /**
   * Get subjects from timetable for a class level
   * This is the primary method for determining what subjects are available for curriculum creation
   */
  async getSubjectsFromTimetable(
    schoolId: string,
    classLevelId: string,
    termId: string
  ): Promise<TimetableSubjectDto[]> {
    // Get all ClassArms for this ClassLevel
    const classArms = await (this.prisma as any).classArm.findMany({
      where: { classLevelId },
      select: { id: true },
    });

    // Build the list of IDs to check
    // Include both ClassArm IDs and the classLevelId itself (which might be a ClassArm ID in legacy data)
    const idsToCheck = classArms.map((ca: any) => ca.id);

    // Also add the classLevelId itself - in case timetable was created with class ID
    // that happens to be stored incorrectly
    if (!idsToCheck.includes(classLevelId)) {
      idsToCheck.push(classLevelId);
    }

    if (idsToCheck.length === 0) {
      return [];
    }

    // Get distinct subjects from timetable periods
    // Check both classArmId and classId since timetable periods might be stored with either
    const periods = await (this.prisma as any).timetablePeriod.findMany({
      where: {
        AND: [
          { termId },
          { type: 'LESSON' },
          { subjectId: { not: null } },
          {
            OR: [{ classArmId: { in: idsToCheck } }, { classId: { in: idsToCheck } }],
          },
        ],
      },
      select: {
        subjectId: true,
        teacherId: true,
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Group by subject, collecting unique teachers
    const subjectMap = new Map<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectCode: string | null;
        teachers: Map<string, string>;
        periodCount: number;
      }
    >();

    for (const period of periods) {
      if (!period.subject) continue;

      const existing = subjectMap.get(period.subjectId);
      if (existing) {
        existing.periodCount++;
        if (period.teacher) {
          const teacherName =
            `${period.teacher.firstName || ''} ${period.teacher.lastName || ''}`.trim();
          existing.teachers.set(period.teacherId, teacherName);
        }
      } else {
        const teachers = new Map<string, string>();
        if (period.teacher) {
          const teacherName =
            `${period.teacher.firstName || ''} ${period.teacher.lastName || ''}`.trim();
          teachers.set(period.teacherId, teacherName);
        }
        subjectMap.set(period.subjectId, {
          subjectId: period.subjectId,
          subjectName: period.subject.name,
          subjectCode: period.subject.code,
          teachers,
          periodCount: 1,
        });
      }
    }

    // Convert to DTOs
    return Array.from(subjectMap.values()).map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      subjectCode: s.subjectCode,
      periodsPerWeek: s.periodCount,
      teachers: Array.from(s.teachers.entries()).map(([id, name]) => ({ id, name })),
    }));
  }

  /**
   * Get curriculum summary for all subjects in a class level's timetable
   * Shows which subjects have curricula and their status
   */
  async getCurriculaSummary(
    schoolId: string,
    classLevelId: string,
    termId: string
  ): Promise<CurriculumSummaryDto[]> {
    // Get subjects from timetable
    const timetableSubjects = await this.getSubjectsFromTimetable(schoolId, classLevelId, termId);

    if (timetableSubjects.length === 0) {
      return [];
    }

    // Get existing curricula for these subjects
    const subjectIds = timetableSubjects.map((s) => s.subjectId);
    const curricula = await (this.prisma as any).curriculum.findMany({
      where: {
        schoolId,
        classLevelId,
        termId,
        subjectId: { in: subjectIds },
        isActive: true,
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    // Create a map of subjectId -> curriculum
    const curriculumMap = new Map<string, any>();
    for (const curr of curricula) {
      curriculumMap.set(curr.subjectId, curr);
    }

    // Build summary for each subject
    return timetableSubjects.map((subject) => {
      const curriculum = curriculumMap.get(subject.subjectId);
      const totalWeeks = curriculum?.items?.length || 0;
      const completedWeeks =
        curriculum?.items?.filter((i: any) => i.status === 'COMPLETED').length || 0;

      return {
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        subjectCode: subject.subjectCode,
        isRequired: true, // All timetable subjects are required
        curriculumId: curriculum?.id || null,
        status: curriculum?.status || null,
        teacherId: curriculum?.teacherId || null,
        teacherName: curriculum?.teacher
          ? `${curriculum.teacher.firstName || ''} ${curriculum.teacher.lastName || ''}`.trim()
          : null,
        weeksTotal: totalWeeks,
        weeksCompleted: completedWeeks,
        isAgoraBased: curriculum?.isNerdcBased || false,
        periodsPerWeek: subject.periodsPerWeek,
        teachers: subject.teachers,
      };
    });
  }

  // ============================================
  // Curriculum CRUD Operations
  // ============================================

  /**
   * Create a new curriculum (manual creation)
   */
  async createCurriculum(
    schoolId: string,
    createDto: CreateCurriculumDto,
    user: UserWithContext
  ): Promise<CurriculumDto> {
    // Validate school exists
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Resolve class/classLevel
    const { classLevelId, targetClassId } = await this.resolveClassTarget(
      schoolId,
      createDto.classId
    );

    // Get teacher from context
    const isAdmin = user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN';
    let teacher: any = null;

    if (!isAdmin) {
      teacher = await this.getTeacherFromContext(user, schoolId);
    } else if (createDto.teacherId) {
      teacher = await (this.prisma as any).teacher.findUnique({ where: { id: createDto.teacherId } });
    }

    // Validate subject is in timetable (for PRIMARY/SECONDARY)
    if (classLevelId && createDto.subjectId) {
      const timetableSubjects = await this.getSubjectsFromTimetable(
        schoolId,
        classLevelId,
        createDto.termId
      );
      const subjectInTimetable = timetableSubjects.find((s) => s.subjectId === createDto.subjectId);
      if (!subjectInTimetable) {
        throw new BadRequestException(
          'Subject is not in the timetable for this class. Please set up the timetable first.'
        );
      }
    }

    // Check for existing curriculum
    await this.checkExistingCurriculum(
      schoolId,
      classLevelId,
      targetClassId,
      createDto.subjectId,
      createDto.termId
    );

    // Get term info for academic year
    const term = await (this.prisma as any).term.findUnique({
      where: { id: createDto.termId },
      include: { academicSession: true },
    });

    // Create curriculum
    const curriculum = await (this.prisma as any).curriculum.create({
      data: {
        schoolId: school.id,
        classLevelId,
        classId: targetClassId,
        subjectId: createDto.subjectId || null,
        subject: createDto.subject || null,
        termId: createDto.termId,
        teacherId: teacher?.id || null,
        academicYear:
          createDto.academicYear ||
          term?.academicSession?.name ||
          new Date().getFullYear().toString(),
        nerdcCurriculumId: createDto.nerdcCurriculumId || null,
        isNerdcBased: !!createDto.nerdcCurriculumId,
        status: isAdmin ? 'APPROVED' : 'DRAFT',
        items: {
          create: createDto.items.map((item, index) => ({
            weekNumber: item.weekNumber || item.week || index + 1,
            topic: item.topic,
            subTopics: item.subTopics || [],
            objectives: item.objectives,
            activities: item.activities || [],
            resources: item.resources,
            assessment: item.assessment || null,
            order: item.order ?? index,
            status: 'PENDING',
          })),
        },
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        term: true,
        subjectRef: true,
      },
    });

    return this.mapToDto(curriculum);
  }

  /**
   * Generate curriculum from NERDC template
   */
  async generateFromNerdc(
    schoolId: string,
    dto: GenerateCurriculumDto,
    user: UserWithContext
  ): Promise<CurriculumDto> {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Get class level info
    const classLevel = await (this.prisma as any).classLevel.findUnique({
      where: { id: dto.classLevelId },
    });

    if (!classLevel || classLevel.schoolId !== school.id) {
      throw new NotFoundException('Class level not found');
    }

    // Get subject info
    const subject = await (this.prisma as any).subject.findUnique({
      where: { id: dto.subjectId },
    });

    if (!subject || subject.schoolId !== school.id) {
      throw new NotFoundException('Subject not found');
    }

    // Get term info
    const term = await (this.prisma as any).term.findUnique({
      where: { id: dto.termId },
      include: { academicSession: true },
    });

    if (!term) {
      throw new NotFoundException('Term not found');
    }

    // Get teacher
    const isAdmin = user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN';
    let teacher: any = null;

    if (!isAdmin) {
      teacher = await this.getTeacherFromContext(user, schoolId);
    } else if (dto.teacherId) {
      teacher = await (this.prisma as any).teacher.findUnique({ where: { id: dto.teacherId } });
    }

    if (teacher && teacher.schoolId !== schoolId) {
      throw new ForbiddenException('Teacher not found in this school');
    }

    // Validate subject is in timetable
    const timetableSubjects = await this.getSubjectsFromTimetable(
      schoolId,
      dto.classLevelId,
      dto.termId
    );
    const subjectInTimetable = timetableSubjects.find((s) => s.subjectId === dto.subjectId);
    if (!subjectInTimetable) {
      throw new BadRequestException(
        'Subject is not in the timetable for this class. Please set up the timetable first.'
      );
    }

    // Check for existing curriculum
    await this.checkExistingCurriculum(schoolId, dto.classLevelId, null, dto.subjectId, dto.termId);

    // Get NERDC template - try to match by subject name/code
    const classLevelCode = getClassLevelCode(classLevel.name, classLevel.type);
    let nerdcTemplate: any = null;

    if (classLevelCode) {
      // Try to find NERDC template by matching subject name or code
      nerdcTemplate = await this.nerdcService.getCurriculumTemplate(
        subject.name, // Try matching by subject name
        classLevel.name,
        classLevel.type,
        term.number
      );

      // If not found by name, try by subject code if available
      if (!nerdcTemplate && subject.code) {
        nerdcTemplate = await this.nerdcService.getCurriculumTemplate(
          subject.code,
          classLevel.name,
          classLevel.type,
          term.number
        );
      }
    }

    // Build curriculum items from template or create skeleton
    let nerdcCurriculumId: string | null = null;
    let items: any[] = [];

    if (nerdcTemplate && nerdcTemplate.weeks.length > 0) {
      nerdcCurriculumId = nerdcTemplate.id;
      items = nerdcTemplate.weeks.map((w: any, index: number) => ({
        weekNumber: w.weekNumber,
        topic: w.topic,
        subTopics: w.subTopics || [],
        objectives: w.objectives || [],
        activities: w.activities || [],
        resources: w.resources || [],
        assessment: w.assessment || null,
        order: index,
        status: 'PENDING',
      }));
    } else {
      items = Array.from({ length: 13 }, (_, i) => {
        const isIntro = i === 0;
        const isMidTerm = i === 6;
        const isEndTerm = i === 12;

        return {
          weekNumber: i + 1,
          topic: isIntro
            ? `Introduction to ${subject.name}`
            : isMidTerm
              ? 'Mid-Term Review and Assessment'
              : isEndTerm
                ? 'Revision and End of Term Examination'
                : `${subject.name} - Week ${i + 1} Topic`,
          subTopics: isMidTerm || isEndTerm ? [] : [`Understanding core concepts for week ${i + 1}`, `Practical applications of week ${i + 1} topics`],
          objectives: isIntro
            ? [`Introduce key concepts of ${subject.name}`, 'Set expectations for the term']
            : isMidTerm
              ? ['Review topics covered in weeks 1-6', 'Assess student progress']
              : isEndTerm
                ? ['Review all topics covered this term', 'Prepare for final examination']
                : ['Understand the core concepts presented this week', 'Apply knowledge to practical exercises'],
          activities: isMidTerm
            ? ['Revision exercises', 'Mid-Term Test']
            : isEndTerm
              ? ['Comprehensive revision', 'Final Examination']
              : ['Class discussion', 'Group exercises', 'Take-home assignment'],
          resources: isMidTerm || isEndTerm ? ['Assessment papers', 'Revision notes'] : ['Textbook chapter', 'Worksheet', 'Visual aids'],
          assessment: isMidTerm ? 'Mid-term assessment' : isEndTerm ? 'End of term examination' : 'Weekly Quiz',
          order: i,
          status: 'PENDING',
        };
      });
    }

    // Create curriculum
    const curriculum = await (this.prisma as any).curriculum.create({
      data: {
        schoolId: school.id,
        classLevelId: dto.classLevelId,
        subjectId: dto.subjectId,
        termId: dto.termId,
        teacherId: teacher?.id || null,
        academicYear: term.academicSession?.name || new Date().getFullYear().toString(),
        nerdcCurriculumId,
        isNerdcBased: !!nerdcCurriculumId,
        status: isAdmin ? 'APPROVED' : 'DRAFT',
        items: {
          create: items,
        },
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        term: true,
        subjectRef: true,
      },
    });

    return this.mapToDto(curriculum);
  }

  /**
   * Bulk generate curricula from NERDC for multiple subjects
   */
  async bulkGenerateFromNerdc(
    schoolId: string,
    dto: BulkGenerateCurriculumDto,
    user: UserWithContext
  ): Promise<{ created: string[]; failed: { subjectId: string; error: string }[] }> {
    const created: string[] = [];
    const failed: { subjectId: string; error: string }[] = [];

    for (const subjectId of dto.subjectIds) {
      try {
        const curriculum = await this.generateFromNerdc(
          schoolId,
          {
            classLevelId: dto.classLevelId,
            subjectId,
            termId: dto.termId,
            teacherId: dto.teacherId,
          },
          user
        );
        created.push(curriculum.id);
      } catch (error) {
        failed.push({
          subjectId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { created, failed };
  }

  /**
   * Get curriculum for a class (backward compatible)
   */
  async getCurriculumForClass(
    schoolId: string,
    classId: string,
    subject?: string,
    academicYear?: string,
    termId?: string,
    user?: UserWithContext
  ): Promise<CurriculumDto | null> {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const { classLevelId, targetClassId } = await this.resolveClassTarget(schoolId, classId);

    const where: any = {
      isActive: true,
      schoolId: school.id,
    };

    if (classLevelId) {
      where.classLevelId = classLevelId;
    } else if (targetClassId) {
      where.classId = targetClassId;
    } else {
      return null;
    }

    if (subject) {
      where.OR = [{ subject }, { subjectRef: { name: subject } }];
    }

    if (academicYear) {
      where.academicYear = academicYear;
    }

    if (termId) {
      where.termId = termId;
    }

    // If user is a teacher, filter by their assigned subjects in timetable
    if (user?.currentProfileId && user.role === 'TEACHER') {
      const teacher = await this.staffRepository.findTeacherByTeacherId(user.currentProfileId);
      if (teacher) {
        // Allow viewing curricula the teacher owns or is assigned to teach
        where.OR = [
          { teacherId: teacher.id },
          // Also allow if they're assigned to teach this subject in timetable
        ];
      } else {
        return null;
      }
    }

    const curriculum = await (this.prisma as any).curriculum.findFirst({
      where,
      include: {
        items: { orderBy: { order: 'asc' } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        term: true,
        subjectRef: true,
      },
    });

    return curriculum ? this.mapToDto(curriculum) : null;
  }

  /**
   * Get curriculum by ID
   */
  async getCurriculumById(
    schoolId: string,
    curriculumId: string,
    user?: UserWithContext
  ): Promise<CurriculumDto> {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const curriculum = await (this.prisma as any).curriculum.findFirst({
      where: {
        id: curriculumId,
        schoolId: school.id,
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        term: true,
        subjectRef: true,
      },
    });

    if (!curriculum) {
      throw new NotFoundException('Curriculum not found');
    }

    return this.mapToDto(curriculum);
  }

  /**
   * Update curriculum
   */
  async updateCurriculum(
    schoolId: string,
    curriculumId: string,
    updateData: UpdateCurriculumDto,
    user: UserWithContext
  ): Promise<CurriculumDto> {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const curriculum = await (this.prisma as any).curriculum.findFirst({
      where: {
        id: curriculumId,
        schoolId: school.id,
      },
      include: { items: true },
    });

    if (!curriculum) {
      throw new NotFoundException('Curriculum not found');
    }

    // Check if user is admin first (admins can edit any curriculum)
    const isAdmin = user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN';

    if (!isAdmin) {
      // Only check teacher ownership/assignment if not admin
      const teacher = await this.getTeacherFromContext(user, schoolId);
      const isOwner = curriculum.teacherId === teacher.id;

      if (!isOwner) {
        // Check if teacher is assigned to this subject in timetable
        const timetableSubjects = await this.getSubjectsFromTimetable(
          schoolId,
          curriculum.classLevelId,
          curriculum.termId
        );
        const assignedToSubject = timetableSubjects.some(
          (s) => s.subjectId === curriculum.subjectId && s.teachers.some((t) => t.id === teacher.id)
        );

        if (!assignedToSubject) {
          throw new ForbiddenException('You are not authorized to edit this curriculum');
        }
      }
    }

    // Track customizations if NERDC-based
    let customizations = curriculum.customizations;
    if (curriculum.isNerdcBased && updateData.items) {
      const originalItems = curriculum.items;
      for (const newItem of updateData.items) {
        const originalItem = originalItems.find(
          (i: any) => i.weekNumber === (newItem.weekNumber || newItem.week)
        );
        if (originalItem && originalItem.topic !== newItem.topic) {
          customizations++;
        }
      }
    }

    // Update curriculum
    const updated = await (this.prisma as any).curriculum.update({
      where: { id: curriculumId },
      data: {
        ...(updateData.academicYear && { academicYear: updateData.academicYear }),
        ...(updateData.termId && { termId: updateData.termId }),
        customizations,
        ...(updateData.items && {
          items: {
            deleteMany: {},
            create: updateData.items.map((item, index) => ({
              weekNumber: item.weekNumber || item.week || index + 1,
              topic: item.topic,
              subTopics: item.subTopics || [],
              objectives: item.objectives,
              activities: item.activities || [],
              resources: item.resources,
              assessment: item.assessment || null,
              order: item.order ?? index,
              status: 'PENDING',
              isCustomized: curriculum.isNerdcBased,
            })),
          },
        }),
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        term: true,
        subjectRef: true,
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Delete curriculum
   */
  async deleteCurriculum(
    schoolId: string,
    curriculumId: string,
    user: UserWithContext
  ): Promise<void> {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const curriculum = await (this.prisma as any).curriculum.findFirst({
      where: {
        id: curriculumId,
        schoolId: school.id,
      },
    });

    if (!curriculum) {
      throw new NotFoundException('Curriculum not found');
    }

    // Check if user is admin first (admins can delete any curriculum)
    const isAdmin = user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN';

    if (!isAdmin) {
      // Only check teacher ownership if not admin
      const teacher = await this.getTeacherFromContext(user, schoolId);
      const isOwner = curriculum.teacherId === teacher.id;

      if (!isOwner) {
        throw new ForbiddenException('You can only delete your own curriculum');
      }
    }

    await (this.prisma as any).curriculum.delete({
      where: { id: curriculumId },
    });
  }

  // ============================================
  // Status Management
  // ============================================

  /**
   * Submit curriculum for admin approval
   */
  async submitForApproval(
    schoolId: string,
    curriculumId: string,
    user: UserWithContext
  ): Promise<CurriculumDto> {
    const curriculum = await this.getCurriculumById(schoolId, curriculumId, user);

    if (curriculum.status !== 'DRAFT' && curriculum.status !== 'REJECTED') {
      throw new BadRequestException('Only draft or rejected curricula can be submitted');
    }

    const teacher = await this.getTeacherFromContext(user, schoolId);
    if (curriculum.teacherId !== teacher.id) {
      throw new ForbiddenException('Only the curriculum owner can submit for approval');
    }

    const updated = await (this.prisma as any).curriculum.update({
      where: { id: curriculumId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        rejectionReason: null,
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        term: true,
        subjectRef: true,
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Approve curriculum (admin only)
   */
  async approveCurriculum(
    schoolId: string,
    curriculumId: string,
    user: UserWithContext
  ): Promise<CurriculumDto> {
    if (user.role !== 'SCHOOL_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only admins can approve curricula');
    }

    const curriculum = await this.getCurriculumById(schoolId, curriculumId, user);

    if (curriculum.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted curricula can be approved');
    }

    const updated = await (this.prisma as any).curriculum.update({
      where: { id: curriculumId },
      data: {
        status: 'APPROVED',
        approvedBy: user.id,
        approvedAt: new Date(),
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        term: true,
        subjectRef: true,
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Reject curriculum (admin only)
   */
  async rejectCurriculum(
    schoolId: string,
    curriculumId: string,
    reason: string,
    user: UserWithContext
  ): Promise<CurriculumDto> {
    if (user.role !== 'SCHOOL_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only admins can reject curricula');
    }

    const curriculum = await this.getCurriculumById(schoolId, curriculumId, user);

    if (curriculum.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted curricula can be rejected');
    }

    const updated = await (this.prisma as any).curriculum.update({
      where: { id: curriculumId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        term: true,
        subjectRef: true,
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Activate curriculum (start teaching)
   */
  async activateCurriculum(
    schoolId: string,
    curriculumId: string,
    user: UserWithContext
  ): Promise<CurriculumDto> {
    const curriculum = await this.getCurriculumById(schoolId, curriculumId, user);

    if (curriculum.status !== 'APPROVED') {
      throw new BadRequestException('Only approved curricula can be activated');
    }

    const updated = await (this.prisma as any).curriculum.update({
      where: { id: curriculumId },
      data: { status: 'ACTIVE' },
      include: {
        items: { orderBy: { order: 'asc' } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        term: true,
        subjectRef: true,
      },
    });

    return this.mapToDto(updated);
  }

  // ============================================
  // Progress Tracking
  // ============================================

  /**
   * Mark a week as complete
   */
  async markWeekComplete(
    schoolId: string,
    curriculumId: string,
    weekNumber: number,
    notes: string | undefined,
    classId: string | undefined,
    user: UserWithContext
  ): Promise<CurriculumItemDto> {
    const curriculum = await this.getCurriculumById(schoolId, curriculumId, user);
    const teacher = await this.getTeacherFromContext(user, schoolId);

    // Verify teacher can mark this week
    const isOwner = curriculum.teacherId === teacher.id;
    const timetableSubjects = await this.getSubjectsFromTimetable(
      schoolId,
      curriculum.classLevelId || '',
      curriculum.termId || ''
    );
    const assignedToSubject = timetableSubjects.some(
      (s) => s.subjectId === curriculum.subjectId && s.teachers.some((t) => t.id === teacher.id)
    );

    if (!isOwner && !assignedToSubject) {
      throw new ForbiddenException('You are not authorized to track progress for this curriculum');
    }

    const item = await (this.prisma as any).curriculumItem.findFirst({
      where: {
        curriculumId,
        weekNumber,
      },
    });

    if (!item) {
      throw new NotFoundException(`Week ${weekNumber} not found in curriculum`);
    }

    if (classId) {
      const classArm = await (this.prisma as any).classArm.findUnique({ where: { id: classId } });
      const targetClassArmId = classArm ? classId : null;
      const targetClassId = !classArm ? classId : null;

      const existingProgress = await (this.prisma as any).curriculumItemProgress.findFirst({
        where: { curriculumItemId: item.id, classArmId: targetClassArmId, classId: targetClassId },
      });

      if (existingProgress) {
        await (this.prisma as any).curriculumItemProgress.update({
          where: { id: existingProgress.id },
          data: {
            status: 'COMPLETED',
            taughtAt: new Date(),
            teacherNotes: notes || null,
            completedBy: teacher.id,
          },
        });
      } else {
        await (this.prisma as any).curriculumItemProgress.create({
          data: {
            curriculumItemId: item.id,
            classArmId: targetClassArmId,
            classId: targetClassId,
            teacherId: teacher.id,
            status: 'COMPLETED',
            taughtAt: new Date(),
            teacherNotes: notes || null,
            completedBy: teacher.id,
          },
        });
      }
    }

    const updated = await (this.prisma as any).curriculumItem.update({
      where: { id: item.id },
      data: {
        status: 'COMPLETED',
        taughtAt: new Date(),
        teacherNotes: notes || null,
        completedBy: teacher.id,
      },
    });

    return this.mapItemToDto(updated);
  }

  /**
   * Mark a week as in progress
   */
  async markWeekInProgress(
    schoolId: string,
    curriculumId: string,
    weekNumber: number,
    classId: string | undefined,
    user: UserWithContext
  ): Promise<CurriculumItemDto> {
    const curriculum = await this.getCurriculumById(schoolId, curriculumId, user);
    const teacher = await this.getTeacherFromContext(user, schoolId);

    const item = await (this.prisma as any).curriculumItem.findFirst({
      where: {
        curriculumId,
        weekNumber,
      },
    });

    if (!item) {
      throw new NotFoundException(`Week ${weekNumber} not found in curriculum`);
    }

    if (classId) {
      const classArm = await (this.prisma as any).classArm.findUnique({ where: { id: classId } });
      const targetClassArmId = classArm ? classId : null;
      const targetClassId = !classArm ? classId : null;

      const existingProgress = await (this.prisma as any).curriculumItemProgress.findFirst({
        where: { curriculumItemId: item.id, classArmId: targetClassArmId, classId: targetClassId },
      });

      if (existingProgress) {
        await (this.prisma as any).curriculumItemProgress.update({
          where: { id: existingProgress.id },
          data: {
            status: 'IN_PROGRESS',
          },
        });
      } else {
        await (this.prisma as any).curriculumItemProgress.create({
          data: {
            curriculumItemId: item.id,
            classArmId: targetClassArmId,
            classId: targetClassId,
            teacherId: teacher.id,
            status: 'IN_PROGRESS',
          },
        });
      }
    }

    const updated = await (this.prisma as any).curriculumItem.update({
      where: { id: item.id },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    return this.mapItemToDto(updated);
  }

  /**
   * Skip a week with reason
   */
  async skipWeek(
    schoolId: string,
    curriculumId: string,
    weekNumber: number,
    reason: string,
    classId: string | undefined,
    user: UserWithContext
  ): Promise<CurriculumItemDto> {
    const curriculum = await this.getCurriculumById(schoolId, curriculumId, user);
    const teacher = await this.getTeacherFromContext(user, schoolId);

    const item = await (this.prisma as any).curriculumItem.findFirst({
      where: {
        curriculumId,
        weekNumber,
      },
    });

    if (!item) {
      throw new NotFoundException(`Week ${weekNumber} not found in curriculum`);
    }

    if (classId) {
      const classArm = await (this.prisma as any).classArm.findUnique({ where: { id: classId } });
      const targetClassArmId = classArm ? classId : null;
      const targetClassId = !classArm ? classId : null;

      const existingProgress = await (this.prisma as any).curriculumItemProgress.findFirst({
        where: { curriculumItemId: item.id, classArmId: targetClassArmId, classId: targetClassId },
      });

      if (existingProgress) {
        await (this.prisma as any).curriculumItemProgress.update({
          where: { id: existingProgress.id },
          data: {
            status: 'SKIPPED',
            teacherNotes: reason,
            completedBy: teacher.id,
          },
        });
      } else {
        await (this.prisma as any).curriculumItemProgress.create({
          data: {
            curriculumItemId: item.id,
            classArmId: targetClassArmId,
            classId: targetClassId,
            teacherId: teacher.id,
            status: 'SKIPPED',
            teacherNotes: reason,
            completedBy: teacher.id,
          },
        });
      }
    }

    const updated = await (this.prisma as any).curriculumItem.update({
      where: { id: item.id },
      data: {
        status: 'SKIPPED',
        teacherNotes: reason,
        completedBy: teacher.id,
      },
    });

    return this.mapItemToDto(updated);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async resolveClassTarget(
    schoolId: string,
    classId: string
  ): Promise<{ classLevelId: string | null; targetClassId: string | null }> {
    // Check if it's a ClassArm
    const classArm = await (this.prisma as any).classArm.findUnique({
      where: { id: classId },
      include: { classLevel: true },
    });

    if (classArm) {
      return { classLevelId: classArm.classLevelId, targetClassId: null };
    }

    // Check if it's a Class
    const classData = await (this.prisma as any).class.findFirst({
      where: { id: classId, schoolId },
    });

    if (classData) {
      // For PRIMARY/SECONDARY, try to find ClassLevel
      if (classData.type !== 'TERTIARY' && classData.classLevel) {
        const classLevel = await (this.prisma as any).classLevel.findFirst({
          where: {
            schoolId,
            name: classData.classLevel,
            type: classData.type,
          },
        });
        if (classLevel) {
          return { classLevelId: classLevel.id, targetClassId: null };
        }
      }
      return { classLevelId: null, targetClassId: classData.id };
    }

    throw new NotFoundException('Class not found');
  }

  private async getTeacherFromContext(user: UserWithContext, schoolId: string) {
    const teacherIdString = user.currentProfileId;
    if (!teacherIdString) {
      throw new ForbiddenException('Teacher ID not found in context');
    }

    const teacher = await this.staffRepository.findTeacherByTeacherId(teacherIdString);
    if (!teacher || teacher.schoolId !== schoolId) {
      throw new ForbiddenException('Teacher not found in this school');
    }

    return teacher;
  }

  private async checkExistingCurriculum(
    schoolId: string,
    classLevelId: string | null,
    classId: string | null,
    subjectId: string | null | undefined,
    termId: string
  ): Promise<void> {
    const where: any = {
      schoolId,
      termId,
      isActive: true,
    };

    if (classLevelId) {
      where.classLevelId = classLevelId;
    }
    if (classId) {
      where.classId = classId;
    }
    if (subjectId) {
      where.subjectId = subjectId;
    }

    const existing = await (this.prisma as any).curriculum.findFirst({ where });

    if (existing) {
      throw new ConflictException(
        'A curriculum already exists for this class/subject/term combination'
      );
    }
  }

  // ============================================
  // Mapping Methods
  // ============================================

  private mapToDto(curriculum: any): CurriculumDto {
    const items = curriculum.items || [];
    const totalWeeks = items.length;
    const completedWeeks = items.filter((i: any) => i.status === 'COMPLETED').length;

    return {
      id: curriculum.id,
      schoolId: curriculum.schoolId,
      classId: curriculum.classId,
      classLevelId: curriculum.classLevelId,
      subjectId: curriculum.subjectId,
      subject: curriculum.subject || curriculum.subjectRef?.name || null,
      teacherId: curriculum.teacherId,
      teacherName: curriculum.teacher
        ? `${curriculum.teacher.firstName || ''} ${curriculum.teacher.lastName || ''}`.trim()
        : undefined,
      academicYear: curriculum.academicYear,
      termId: curriculum.termId,
      termName: curriculum.term?.name,
      agoraCurriculumTemplateId: curriculum.nerdcCurriculumId,
      isAgoraBased: curriculum.isNerdcBased,
      customizations: curriculum.customizations,
      status: curriculum.status,
      submittedAt: curriculum.submittedAt,
      approvedBy: curriculum.approvedBy,
      approvedAt: curriculum.approvedAt,
      rejectionReason: curriculum.rejectionReason,
      isActive: curriculum.isActive,
      createdAt: curriculum.createdAt,
      updatedAt: curriculum.updatedAt,
      items: items.map((item: any) => this.mapItemToDto(item)),
      totalWeeks,
      completedWeeks,
      progressPercentage: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0,
    };
  }

  private mapItemToDto(item: any): CurriculumItemDto {
    return {
      id: item.id,
      curriculumId: item.curriculumId,
      weekNumber: item.weekNumber || item.week,
      topic: item.topic,
      subTopics: item.subTopics || [],
      objectives: item.objectives || [],
      activities: item.activities || [],
      resources: item.resources || [],
      assessment: item.assessment,
      order: item.order,
      isCustomized: item.isCustomized || false,
      originalTopic: item.originalTopic,
      status: item.status || 'PENDING',
      taughtAt: item.taughtAt,
      teacherNotes: item.teacherNotes,
      completedBy: item.completedBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  // ============================================
  // SCHEME OF WORK (New Flow)
  // ============================================

  /**
   * Find the latest published Agora curriculum for a subject and level
   */
  async getLatestAgoraCurriculum(subjectId: string, gradeLevel: string) {
    return await (this.prisma as any).agoraCurriculum.findFirst({
      where: {
        subjectId,
        gradeLevel,
        status: 'PUBLISHED',
      },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Set up a multi-term (Yearly) Scheme of Work when termId is not provided
   */
  async setupYearlySchemeOfWork(schoolId: string, dto: SetupSchemeOfWorkDto, user: UserWithContext) {
    const { classLevelId, classId, subjectId, mode } = dto;

    // Get all terms for the current session
    const session = await (this.prisma as any).session.findFirst({
      where: { schoolId, isCurrent: true },
      include: { terms: { orderBy: { number: 'asc' } } }
    });

    if (!session || !session.terms || session.terms.length === 0) {
      throw new BadRequestException('No active session or terms found to generate a yearly scheme.');
    }

    if (mode === SchemeGenerationMode.AGORA_ONLY) {
      throw new BadRequestException('Agora templates must be set up per-term directly.');
    }

    const creditsNeeded = this.TOTAL_COST * session.terms.length;
    const summary = await this.subscriptionsService.getSubscriptionSummary(schoolId);
    if (summary.aiCreditsRemaining < creditsNeeded && summary.tier !== 'CUSTOM') {
      throw new BadRequestException(`Insufficient AI credits. Required: ${creditsNeeded}, Available: ${summary.aiCreditsRemaining}`);
    }

    const docIds = dto.schoolCurriculumDocIds || (dto.schoolCurriculumDocId ? [dto.schoolCurriculumDocId] : []);
    if (docIds.length === 0) {
      throw new BadRequestException('Please provide at least one source document ID.');
    }

    return await this.prisma.$transaction(async (tx) => {
      const creditResult = await this.subscriptionsService.useAiCredits(
        schoolId,
        creditsNeeded,
        user.id,
        `GENERATE_YEARLY_SCHEME: ${subjectId}`
      );

      if (!creditResult.success) {
        throw new BadRequestException(creditResult.message || 'Failed to deduct AI credits.');
      }

      const schemes = [];
      const batchGroupId = 'batch_' + Array.from({ length: 8 }, () => Math.random().toString(36)[2]).join('');

      for (const term of session.terms) {
        // Check for existing
        const existing = await (tx as any).schemeOfWork.findFirst({
          where: { schoolId, subjectId, termId: term.id, classLevelId }
        });

        if (existing) {
          if (dto.forceOverwrite) {
            await (tx as any).schemeOfWork.delete({ where: { id: existing.id } });
          } else {
            throw new ConflictException(`A Scheme of Work exists for Term ${term.number}. Pass forceOverwrite to replace.`);
          }
        }

        const scheme = await (tx as any).schemeOfWork.create({
          data: {
            schoolId,
            subjectId,
            termId: term.id,
            classLevelId,
            classId: classId || null,
            generationMode: mode,
            schoolCurriculumId: docIds[0], // primary tracking ID
            status: 'QUEUED',
            parentSchemeId: batchGroupId // internal tag to link them
          }
        });
        schemes.push(scheme.id);
      }

      // Enqueue a dedicated yearly generation job
      await this.curriculumQueue.add('generate-yearly-scheme', {
        schemeIds: schemes,
        schoolCurriculumDocIds: docIds,
        schoolId,
        userId: user.id
      });

      return { message: 'Yearly scheme generation queued successfully', schemes };
    });
  }

  async setupSchemeOfWork(
    schoolId: string,
    dto: SetupSchemeOfWorkDto,
    user: UserWithContext
  ) {
    if (!dto.termId) {
      return this.setupYearlySchemeOfWork(schoolId, dto, user);
    }
    const { classLevelId, classId, subjectId, termId, mode } = dto;

    // Check for existing scheme
    const existing = await (this.prisma as any).schemeOfWork.findFirst({
      where: {
        schoolId,
        subjectId,
        termId,
        classLevelId,
      },
    });

    if (existing) {
      if (dto.forceOverwrite) {
        await (this.prisma as any).schemeOfWork.delete({
          where: { id: existing.id }
        });
      } else {
        throw new ConflictException('A Scheme of Work already exists for this subject and term. Pass forceOverwrite to replace it.');
      }
    }

    // PATH A: Agora Curriculum (Free)
    if (mode === SchemeGenerationMode.AGORA_ONLY) {
      if (!dto.agoraCurriculumId) {
        throw new BadRequestException('Agora Curriculum ID is required for Agora-only mode.');
      }

      const agoraCurriculum = await (this.prisma as any).agoraCurriculum.findUnique({
        where: { id: dto.agoraCurriculumId },
        include: { topics: { orderBy: { weekNumber: 'asc' } } },
      });

      if (!agoraCurriculum) {
        throw new NotFoundException('Agora Curriculum not found.');
      }

      // 1. Get the current term number (1, 2, or 3)
      const term = await (this.prisma as any).term.findUnique({
        where: { id: termId },
        select: { number: true }
      });

      if (!term) {
        throw new BadRequestException('Invalid term sequence.');
      }

      const targetTermNumber = term.number;

      // 2. Filter topics for this specific term
      const termTopics = agoraCurriculum.topics.filter((t: any) => t.term === targetTermNumber);

      if (termTopics.length === 0) {
        // Fallback or warning: If no topics found for this term, we might be using a legacy 1-term curriculum
        // In that case, we decide whether to use ALL topics or throw error.
        // For now, if it's term 1 and exactly 1-14 weeks exist without term field set (or all default to 1), it works.
      }

      return await this.prisma.$transaction(async (tx) => {
        const scheme = await (tx as any).schemeOfWork.create({
          data: {
            schoolId,
            classLevelId,
            classId: classId || null,
            subjectId,
            termId,
            generationMode: mode,
            agoraCurriculumId: agoraCurriculum.id,
            status: SchemeOfWorkStatus.DRAFT,
          },
        });

        // 3. Clone ONLY the term-relevant topics into weeks
        await (tx as any).schemeOfWorkWeek.createMany({
          data: termTopics.map((t: any) => ({
            schemeOfWorkId: scheme.id,
            weekNumber: t.weekNumber,
            topic: t.title,
            subTopics: t.subTopics || [],
            learningOutcomes: t.learningOutcomes || [],
            studentFriendlyOutcomes: t.studentFriendlyOutcomes || [],
            suggestedActivities: t.suggestedActivities || [],
            resources: t.resources || [],
            assessmentType: t.assessmentType,
            order: t.order || t.weekNumber,
          })),
        });

        return scheme;
      });
    }

    // PATH B: Custom School Curriculum (Paid)
    if (mode === SchemeGenerationMode.SCHOOL_ONLY || mode === SchemeGenerationMode.MERGED) {
      const creditsNeeded = this.TOTAL_COST;

      // 1. Check access and credits
      const summary = await this.subscriptionsService.getSubscriptionSummary(schoolId);
      if (summary.aiCreditsRemaining < creditsNeeded && summary.tier !== 'CUSTOM') {
        throw new BadRequestException(`Insufficient AI credits. Required: ${creditsNeeded}, Available: ${summary.aiCreditsRemaining}`);
      }

      return await this.prisma.$transaction(async (tx) => {
        // 2. Deduct credits
        const creditResult = await this.subscriptionsService.useAiCredits(
          schoolId,
          creditsNeeded,
          user.id,
          `GENERATE_SCHEME: ${subjectId}`
        );

        if (!creditResult.success) {
          throw new BadRequestException(creditResult.message || 'Failed to deduct AI credits.');
        }

        // 3. Create the Scheme entry in QUEUED status
        const schemaData: any = {
          schoolId,
          subjectId,
          termId,
          classLevelId,
          classId: classId || null,
          generationMode: mode,
          agoraCurriculumId: dto.agoraCurriculumId || null,
          schoolCurriculumId: dto.schoolCurriculumDocId || dto.schoolCurriculumDocIds?.[0] || null,
          status: 'QUEUED',
        };

        const scheme = await (tx as any).schemeOfWork.create({
          data: schemaData,
        });

        // 4. Enqueue BullMQ job
        await this.curriculumQueue.add('generate-scheme', {
          schemeId: scheme.id,
          schoolId,
          userId: user.id,
          creditsUsed: this.TOTAL_COST,
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
        });

        return scheme;
      });
    }

    throw new BadRequestException('Invalid generation mode.');
  }

  /**
   * Get all schemes of work for a class and term
   */
  async getSchemesSummary(schoolId: string, classLevelId: string, termId: string) {
    const subjects = await this.getSubjectsFromTimetable(schoolId, classLevelId, termId);

    const schemes = await (this.prisma as any).schemeOfWork.findMany({
      where: {
        schoolId,
        classLevelId,
        termId,
      },
    });

    const schemeMap = new Map(schemes.map((s: any) => [s.subjectId, s]));

    return subjects.map(subject => {
      const scheme = schemeMap.get(subject.subjectId) as any;
      return {
        ...subject,
        schemeId: scheme?.id || null,
        status: scheme?.status || 'NOT_SET_UP',
        generationMode: scheme?.generationMode || null,
        version: scheme?.version || null,
        updatedAt: scheme?.updatedAt || null,
      };
    });
  }

  /**
   * Get Agora Master curricula for the library
   * Prioritizes matching via agoraSubjectId if available
   */
  /**
   * Get Agora Master curricula for the library
   * Prioritizes matching via agoraSubjectId if available
   */
  async getAgoraLibraryCurricula(schoolSubjectId: string, gradeLevel: string) {
    // 1. Get the school subject to check for agoraSubjectId
    const schoolSubject = await (this.prisma as any).subject.findUnique({
      where: { id: schoolSubjectId },
      select: { agoraSubjectId: true, name: true, code: true }
    });

    if (!schoolSubject) return [];

    // 2. Determine which global subject ID to use for lookup
    let targetAgoraSubjectId = schoolSubject.agoraSubjectId;

    if (!targetAgoraSubjectId) {
      // Fallback: Try to find a matching global subject by code or name
      const globalSub = await (this.prisma as any).agoraSubject.findFirst({
        where: {
          OR: [
            { code: schoolSubject.code },
            { name: { contains: schoolSubject.name, mode: 'insensitive' } }
          ],
          isActive: true
        }
      });
      targetAgoraSubjectId = globalSub?.id;
    }

    if (!targetAgoraSubjectId) return [];

    // 3. Fetch published Agora curricula for that global subject
    const normalizedGradeLevel = gradeLevel.replace(/\s+/g, '_');
    const curricula = await (this.prisma as any).agoraCurriculum.findMany({
      where: {
        subjectId: targetAgoraSubjectId,
        gradeLevel: normalizedGradeLevel,
        status: 'PUBLISHED'
      },
      include: {
        subject: true,
        topics: {
          select: { id: true, term: true }
        }
      }
    });

    // 4. Transform into a list with term-level counts
    return curricula.map((c: any) => {
      const termStats = [1, 2, 3].map(tNum => ({
        term: tNum,
        count: c.topics.filter((t: any) => t.term === tNum).length
      }));

      return {
        ...c,
        termStats,
        totalTopics: c.topics.length
      };
    });
  }

  /**
   * Detailed preview for a specific Agora curriculum
   */
  async getAgoraCurriculumPreview(curriculumId: string) {
    const curriculum = await (this.prisma as any).agoraCurriculum.findUnique({
      where: { id: curriculumId },
      include: {
        subject: true,
        topics: {
          orderBy: [{ term: 'asc' }, { weekNumber: 'asc' }]
        }
      }
    });

    if (!curriculum) throw new NotFoundException('Curriculum not found');

    // 5. Parse the overview (Handle both legacy JSON and new Markdown format)
    let overview: any = { description: '', themes: [], progressionNotes: '' };
    const notes = curriculum.consolidationNotes || '';

    try {
      if (notes.startsWith('{')) {
        const parsed = JSON.parse(notes);
        overview = {
          description: parsed.description || '',
          themes: parsed.themes || [],
          progressionNotes: parsed.progressionNotes || '',
        };
      } else if (notes.includes('# Description')) {
        overview = {
          description: notes.split('# Description')[1]?.split('# Theme')[0]?.trim() || '',
          themes: notes.split('# Themes')[1]?.split('# Progression Notes')[0]
            ?.trim()
            ?.split('\n')
            .map((t: string) => t.replace(/^- /, '').trim())
            .filter(Boolean) || [],
          progressionNotes: notes.split('# Progression Notes')[1]?.trim() || '',
        };
      } else {
        overview.description = notes;
      }
    } catch (e) {
      overview.description = notes;
    }

    // Group topics by term
    const termSchemes = [1, 2, 3].map(termNum => ({
      term: termNum,
      topics: curriculum.topics.filter((t: any) => t.term === termNum),
      topicCount: curriculum.topics.filter((t: any) => t.term === termNum).length
    }));

    return {
      ...curriculum,
      overview,
      termSchemes,
      totalTopics: curriculum.topics.length
    };
  }

  /**
   * Cancel an active scheme generation and refund credits
   */
  async cancelSchemeGeneration(schoolId: string, schemeId: string, user: UserWithContext) {
    const scheme = await (this.prisma as any).schemeOfWork.findUnique({
      where: { id: schemeId },
    });

    if (!scheme) throw new NotFoundException('Scheme not found');

    const status = scheme.status as string;
    const canCancel = ['QUEUED', 'VERIFYING', 'GENERATING'].includes(status);

    if (!canCancel) {
      throw new BadRequestException(`Cannot cancel generation in status: ${status}`);
    }

    // 1. Calculate refund based on status (Production-ready logic)
    let creditsToRefund = 0;
    let reason = `CANCEL_GENERATION: ${schemeId} in status ${status}`;

    if (status === 'QUEUED') {
      // Not started yet - 100% refund
      creditsToRefund = this.TOTAL_COST;
    } else if (status === 'VERIFYING') {
      // Verification in progress - Refund generation portion, keep verification fee
      creditsToRefund = this.GENERATION_COST;
      reason += ' (Kept verification fee)';
    } else if (status === 'GENERATING') {
      // Deep generation started - 0 refund to cover API costs
      creditsToRefund = 0;
      reason += ' (No refund - generation in progress)';
    }

    // 2. Update status to CANCELLED (The BullMQ processor will see this and skip work)
    await (this.prisma as any).schemeOfWork.update({
      where: { id: schemeId },
      data: { status: 'CANCELLED' },
    });

    // 3. Refund credits if applicable
    if (creditsToRefund > 0) {
      await this.subscriptionsService.refundAiCredits(
        schoolId,
        creditsToRefund,
        user.id,
        reason
      );
    }

    return {
      success: true,
      refunded: creditsToRefund,
      message: creditsToRefund > 0
        ? `Generation cancelled. ${creditsToRefund} credits refunded.`
        : 'Generation stopped. No refund available for in-progress tasks.'
    };
  }

  // ============================================
  // School Private Source Library (Production Ready)
  // ============================================

  /**
   * Upload and process a school's own curriculum document
   * Includes Magic Number validation and Multi-grade splitting
   */
  async uploadSchoolCurriculumDoc(
    schoolId: string,
    file: Express.Multer.File,
    dto: CreateSchoolCurriculumDocDto,
    userId: string
  ) {
    // 1. Secure Upload & Binary Verification
    const uploadedFile = await this.cloudinaryService.uploadRawFile(file, 'schools/curriculum');

    // 2. Initial record creation
    const doc = await (this.prisma as any).schoolCurriculumDoc.create({
      data: {
        schoolId,
        subjectId: dto.subjectId,
        gradeLevel: dto.gradeLevel,
        termNumber: dto.termNumber,
        sourceType: 'FILE_UPLOAD',
        fileName: file.originalname,
        fileUrl: uploadedFile.url, // Corrected from uploadedFile.secure_url to match Result
        fileType: file.mimetype.includes('pdf') ? 'PDF' : 'DOCX',
        status: 'PENDING_PARSE',
        uploadedBy: userId,
      },
    });

    // 3. Trigger Lois AI splitting & parsing (Job)
    // For now, doing it synchronously to simulate the intelligent response
    // In production, move this to a background worker
    this.aiService.parseSchoolCurriculumDocument(doc.id).catch(err => {
      this.logger.error(`Failed to parse school doc ${doc.id}: ${err.message}`);
    });

    return doc;
  }

  /**
   * Get all curriculum documents for a school
   */
  async getSchoolCurriculumDocs(schoolId: string, subjectId?: string) {
    return await (this.prisma as any).schoolCurriculumDoc.findMany({
      where: {
        schoolId,
        ...(subjectId && { subjectId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  /**
   * Delete a school curriculum document
   */
  async deleteSchoolCurriculumDoc(schoolId: string, docId: string, userId: string) {
    const doc = await (this.prisma as any).schoolCurriculumDoc.findFirst({
      where: { id: docId, schoolId }
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    await (this.prisma as any).schoolCurriculumDoc.delete({
      where: { id: docId }
    });
  }
}
