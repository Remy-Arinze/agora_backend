import { 
  Injectable, 
  BadRequestException, 
  NotFoundException, 
  ForbiddenException,
  ConflictException,
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
import { 
  CurriculumDto, 
  CurriculumItemDto, 
  CurriculumSummaryDto,
  TimetableSubjectDto,
} from './dto/curriculum.dto';
import { NerdcCurriculumService } from './nerdc-curriculum.service';
import { getClassLevelCode } from './dto/nerdc-curriculum.dto';
import { UserWithContext } from '../../auth/types/user-with-context.type';

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository,
    private readonly staffRepository: StaffRepository,
    private readonly nerdcService: NerdcCurriculumService,
  ) {}

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
            OR: [
              { classArmId: { in: idsToCheck } },
              { classId: { in: idsToCheck } },
            ],
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
    const subjectMap = new Map<string, {
      subjectId: string;
      subjectName: string;
      subjectCode: string | null;
      teachers: Map<string, string>;
      periodCount: number;
    }>();

    for (const period of periods) {
      if (!period.subject) continue;

      const existing = subjectMap.get(period.subjectId);
      if (existing) {
        existing.periodCount++;
        if (period.teacher) {
          const teacherName = `${period.teacher.firstName || ''} ${period.teacher.lastName || ''}`.trim();
          existing.teachers.set(period.teacherId, teacherName);
        }
      } else {
        const teachers = new Map<string, string>();
        if (period.teacher) {
          const teacherName = `${period.teacher.firstName || ''} ${period.teacher.lastName || ''}`.trim();
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
      const completedWeeks = curriculum?.items?.filter((i: any) => i.status === 'COMPLETED').length || 0;

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
        isNerdcBased: curriculum?.isNerdcBased || false,
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
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Resolve class/classLevel
    const { classLevelId, targetClassId } = await this.resolveClassTarget(schoolId, createDto.classId);

    // Get teacher from context
    const teacher = await this.getTeacherFromContext(user, schoolId);

    // Validate subject is in timetable (for PRIMARY/SECONDARY)
    if (classLevelId && createDto.subjectId) {
      const timetableSubjects = await this.getSubjectsFromTimetable(schoolId, classLevelId, createDto.termId);
      const subjectInTimetable = timetableSubjects.find((s) => s.subjectId === createDto.subjectId);
      if (!subjectInTimetable) {
        throw new BadRequestException('Subject is not in the timetable for this class. Please set up the timetable first.');
      }
    }

    // Check for existing curriculum
    await this.checkExistingCurriculum(schoolId, classLevelId, targetClassId, createDto.subjectId, createDto.termId);

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
        teacherId: teacher.id,
        academicYear: createDto.academicYear || term?.academicSession?.name || new Date().getFullYear().toString(),
        nerdcCurriculumId: createDto.nerdcCurriculumId || null,
        isNerdcBased: !!createDto.nerdcCurriculumId,
        status: 'DRAFT',
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
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
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
    const teacher = dto.teacherId 
      ? await (this.prisma as any).teacher.findUnique({ where: { id: dto.teacherId } })
      : await this.getTeacherFromContext(user, schoolId);

    if (!teacher || teacher.schoolId !== school.id) {
      throw new ForbiddenException('Teacher not found in this school');
    }

    // Validate subject is in timetable
    const timetableSubjects = await this.getSubjectsFromTimetable(schoolId, dto.classLevelId, dto.termId);
    const subjectInTimetable = timetableSubjects.find((s) => s.subjectId === dto.subjectId);
    if (!subjectInTimetable) {
      throw new BadRequestException('Subject is not in the timetable for this class. Please set up the timetable first.');
    }

    // Check for existing curriculum
    await this.checkExistingCurriculum(schoolId, dto.classLevelId, null, dto.subjectId, dto.termId);

    // Get NERDC template - try to match by subject name/code
    const classLevelCode = getClassLevelCode(classLevel.name, classLevel.type);
    let nerdcTemplate = null;
    
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
      items = nerdcTemplate.weeks.map((w, index) => ({
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
      // No NERDC template found - create a helpful skeleton with subject-specific placeholders
      items = Array.from({ length: 13 }, (_, i) => ({
        weekNumber: i + 1,
        topic: i === 0 ? `Introduction to ${subject.name}` 
             : i === 6 ? 'Mid-Term Review and Assessment'
             : i === 12 ? 'Revision and End of Term Examination'
             : `${subject.name} - Week ${i + 1} Topic`,
        subTopics: [],
        objectives: i === 0 
          ? [`Introduce key concepts of ${subject.name}`, 'Set expectations for the term']
          : [],
        activities: [],
        resources: [],
        assessment: i === 6 ? 'Mid-term assessment' : i === 12 ? 'End of term examination' : null,
        order: i,
        status: 'PENDING',
      }));
    }

    // Create curriculum
    const curriculum = await (this.prisma as any).curriculum.create({
      data: {
        schoolId: school.id,
        classLevelId: dto.classLevelId,
        subjectId: dto.subjectId,
        termId: dto.termId,
        teacherId: teacher.id,
        academicYear: term.academicSession?.name || new Date().getFullYear().toString(),
        nerdcCurriculumId,
        isNerdcBased: !!nerdcCurriculumId,
        status: 'DRAFT',
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
        const curriculum = await this.generateFromNerdc(schoolId, {
          classLevelId: dto.classLevelId,
          subjectId,
          termId: dto.termId,
          teacherId: dto.teacherId,
        }, user);
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
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
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
      where.OR = [
        { subject },
        { subjectRef: { name: subject } },
      ];
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
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
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
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
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
        const originalItem = originalItems.find((i: any) => 
          i.weekNumber === (newItem.weekNumber || newItem.week)
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
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
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
      throw new ConflictException('A curriculum already exists for this class/subject/term combination');
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
      nerdcCurriculumId: curriculum.nerdcCurriculumId,
      isNerdcBased: curriculum.isNerdcBased,
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
}
