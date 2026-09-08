import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
  GoneException,
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
import { UserRole } from '@prisma/client';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { SubscriptionBillingService } from '../../subscriptions/subscription-billing.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SCHEME_GENERATION_QUEUE } from './scheme-of-work.processor';
import { SetupSchemeOfWorkDto } from './dto/scheme-of-work.dto';
import { SchemeGenerationMode, SchemeOfWorkStatus } from '@prisma/client';
import { AiService } from '../../ai/ai.service';
import { CloudinaryService } from '../../storage/cloudinary/cloudinary.service';
import { SchemeSpineService } from './scheme-spine.service';
import { schemeActiveKey } from '../../common/utils/topic-stable-key.util';

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
    private readonly subscriptionBilling: SubscriptionBillingService,
    private readonly aiService: AiService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly schemeSpine: SchemeSpineService,
    @InjectQueue(SCHEME_GENERATION_QUEUE) private readonly schemeQueue: Queue
  ) { }

  /** Blocks billing-suspended teachers/admins from curriculum writes (curation, schemes, status). */
  private async assertStaffMayMutateCurriculum(schoolId: string, user: UserWithContext): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.TEACHER && user.currentProfileId) {
      await this.subscriptionBilling.assertTeacherMayWrite(schoolId, user.currentProfileId);
    }
    if (user.role === UserRole.SCHOOL_ADMIN && user.currentProfileId) {
      await this.subscriptionBilling.assertSchoolAdminNotBillingSuspended(schoolId, user.currentProfileId);
    }
  }

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
    _schoolId: string,
    _createDto: CreateCurriculumDto,
    _user: UserWithContext
  ): Promise<CurriculumDto> {
    throw new GoneException('Legacy curriculum create is retired. Use scheme of work setup.');
  }

  /**
   * Generate curriculum from NERDC template
   */
  async generateFromNerdc(
    _schoolId: string,
    _dto: GenerateCurriculumDto,
    _user: UserWithContext
  ): Promise<CurriculumDto> {
    throw new GoneException('Legacy NERDC generate is retired. Import a published Bud library curriculum.');
  }

  /**
   * Bulk generate curricula from NERDC for multiple subjects
   */
  async bulkGenerateFromNerdc(
    _schoolId: string,
    _dto: BulkGenerateCurriculumDto,
    _user: UserWithContext
  ): Promise<{ created: string[]; failed: { subjectId: string; error: string }[] }> {
    throw new GoneException('Legacy bulk NERDC generate is retired. Use scheme of work setup.');
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

    const schemeFirst = await this.getCurriculumFromSchemeOfWork(schoolId, classId, {
      subjectName: subject,
      termId,
      classLevelId,
    });
    if (schemeFirst) return schemeFirst;

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

    // Teachers may view class-level curricula for classes they teach (not only rows they "own")
    if (user?.currentProfileId && user.role === 'TEACHER') {
      const teacher = await this.staffRepository.findTeacherByTeacherId(user.currentProfileId);
      if (!teacher) {
        return null;
      }
      const teachesClass = await (this.prisma as any).classTeacher.findFirst({
        where: {
          teacherId: teacher.id,
          OR: [{ classArmId: classId }, { classId }],
        },
        select: { id: true },
      });
      const isFormTeacher = await (this.prisma as any).classArm.findFirst({
        where: { id: classId, classTeacherId: teacher.id },
        select: { id: true },
      });
      // Not assigned to this class → only curricula explicitly owned by the teacher
      if (!teachesClass && !isFormTeacher) {
        where.teacherId = teacher.id;
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

    if (curriculum) {
      return this.mapToDto(curriculum);
    }

    return null;
  }

  /**
   * Map a published SchemeOfWork into the CurriculumDto shape used by teacher/student Curriculum tabs.
   */
  private async getCurriculumFromSchemeOfWork(
    schoolId: string,
    classId: string,
    options: { subjectName?: string; termId?: string; classLevelId?: string | null },
  ): Promise<CurriculumDto | null> {
    let classLevelId = options.classLevelId;
    if (!classLevelId) {
      const resolved = await this.resolveClassTarget(schoolId, classId);
      classLevelId = resolved.classLevelId;
    }
    if (!classLevelId) {
      return null;
    }

    let subjectId: string | undefined;
    if (options.subjectName) {
      const subject = await (this.prisma as any).subject.findFirst({
        where: {
          schoolId,
          name: { equals: options.subjectName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      subjectId = subject?.id;
    }

    const schemeWhere: any = {
      schoolId,
      classLevelId,
      status: { in: ['PUBLISHED', 'APPROVED'] },
    };
    if (options.termId) schemeWhere.termId = options.termId;
    if (subjectId) schemeWhere.subjectId = subjectId;

    const scheme = await (this.prisma as any).schemeOfWork.findFirst({
      where: schemeWhere,
      include: {
        weeks: { orderBy: { order: 'asc' }, include: { topics: true, deliveries: true } },
        classLevel: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!scheme) {
      // If subject filter missed, try any published scheme for the level
      if (subjectId) {
        const anyScheme = await (this.prisma as any).schemeOfWork.findFirst({
          where: {
            schoolId,
            classLevelId,
            status: { in: ['PUBLISHED', 'APPROVED'] },
            ...(options.termId ? { termId: options.termId } : {}),
          },
          include: {
            weeks: { orderBy: { order: 'asc' }, include: { topics: true, deliveries: true } },
            classLevel: true,
          },
          orderBy: { updatedAt: 'desc' },
        });
        if (!anyScheme) return null;
        const subject = await (this.prisma as any).subject.findUnique({
          where: { id: anyScheme.subjectId },
        });
        const term = anyScheme.termId
          ? await (this.prisma as any).term.findUnique({
              where: { id: anyScheme.termId },
              include: { academicSession: { select: { name: true } } },
            })
          : null;
        return this.mapSchemeToCurriculumDto(this.overlayArmDelivery({ ...anyScheme, term }, classId), subject);
      }
      return null;
    }

    const subject = await (this.prisma as any).subject.findUnique({
      where: { id: scheme.subjectId },
    });
    const term = scheme.termId
      ? await (this.prisma as any).term.findUnique({
          where: { id: scheme.termId },
          include: { academicSession: { select: { name: true } } },
        })
      : null;

    return this.mapSchemeToCurriculumDto(this.overlayArmDelivery({ ...scheme, term }, classId), subject);
  }

  private overlayArmDelivery(scheme: any, classId: string) {
    const weeks = (scheme.weeks || []).map((w: any) => {
      const arm = (w.deliveries || []).find((d: any) => d.classArmId === classId);
      if (!arm) return { ...w, weekStatus: w.isDelivered ? 'DELIVERED' : 'PENDING' };
      return {
        ...w,
        isDelivered: arm.status === 'DELIVERED',
        weekStatus: arm.status,
        deliveryNote: arm.deliveryNote ?? w.deliveryNote,
        deliveredAt: arm.deliveredAt ?? w.deliveredAt,
      };
    });
    return { ...scheme, weeks };
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

    await this.assertStaffMayMutateCurriculum(schoolId, user);

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

    await this.assertStaffMayMutateCurriculum(schoolId, user);

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
    await this.assertStaffMayMutateCurriculum(schoolId, user);
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

    await this.assertStaffMayMutateCurriculum(schoolId, user);

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

    await this.assertStaffMayMutateCurriculum(schoolId, user);

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
    await this.assertStaffMayMutateCurriculum(schoolId, user);
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
    await this.assertStaffMayMutateCurriculum(schoolId, user);
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
    await this.assertStaffMayMutateCurriculum(schoolId, user);
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
    await this.assertStaffMayMutateCurriculum(schoolId, user);
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
    await this.assertStaffMayMutateCurriculum(schoolId, user);
    const { classLevelId, classId, subjectId, mode } = dto;

    // Get all terms for the current session
    const session = await this.prisma.academicSession.findFirst({
      where: { schoolId, status: 'ACTIVE' },
      include: { terms: { orderBy: { number: 'asc' } } },
    });

    if (!session || !session.terms || session.terms.length === 0) {
      throw new BadRequestException('No active session or terms found to generate a yearly scheme.');
    }

    if (mode === SchemeGenerationMode.AGORA_ONLY) {
      throw new BadRequestException('Myschoolbud templates must be set up per-term directly.');
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
          where: { schoolId, subjectId, termId: term.id, classLevelId, status: { not: SchemeOfWorkStatus.ARCHIVED } }
        });

        if (existing && existing.status !== SchemeOfWorkStatus.ARCHIVED) {
          if (dto.forceOverwrite) {
            await (tx as any).schemeOfWork.update({
              where: { id: existing.id },
              data: {
                status: SchemeOfWorkStatus.ARCHIVED,
                archivedAt: new Date(),
                archivedBy: user.id,
                activeKey: null,
              },
            });
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
            activeKey: schemeActiveKey(schoolId, subjectId, term.id, classLevelId),
            status: 'QUEUED',
            parentSchemeId: batchGroupId // internal tag to link them
          }
        });
        schemes.push(scheme.id);
      }

      // Enqueue a dedicated yearly generation job
      await this.schemeQueue.add('generate-yearly-scheme', {
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
    await this.assertStaffMayMutateCurriculum(schoolId, user);
    if (!dto.termId) {
      return this.setupYearlySchemeOfWork(schoolId, dto, user);
    }
    const { classLevelId, classId, subjectId, termId, mode } = dto;

    if (mode === SchemeGenerationMode.AGORA_ONLY) {
      if (!dto.agoraCurriculumId) {
        throw new BadRequestException('Bud library Curriculum ID is required for Bud library-only mode.');
      }
      return this.schemeSpine.snapshotAgoraOnly({
        schoolId,
        subjectId,
        termId,
        classLevelId,
        classId,
        agoraCurriculumId: dto.agoraCurriculumId,
        userId: user.id,
        forceOverwrite: dto.forceOverwrite,
      });
    }

    const existing = await this.schemeSpine.findLiveScheme(schoolId, subjectId, termId, classLevelId);
    if (existing) {
      if (dto.forceOverwrite) {
        await this.schemeSpine.archiveLiveScheme(existing.id, user.id);
      } else {
        throw new ConflictException('A Scheme of Work already exists for this subject and term. Pass forceOverwrite to replace it.');
      }
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
          mergeWeightAgora: dto.mergeWeightAgora ?? (mode === SchemeGenerationMode.MERGED ? 70 : null),
          mergeWeightSchool: dto.mergeWeightSchool ?? (mode === SchemeGenerationMode.MERGED ? 30 : null),
          activeKey: schemeActiveKey(schoolId, subjectId, termId, classLevelId),
          status: 'QUEUED',
        };

        const scheme = await (tx as any).schemeOfWork.create({
          data: schemaData,
        });

        // 4. Enqueue BullMQ job
        await this.schemeQueue.add('generate-scheme', {
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

  async diffSchemeLibrary(schoolId: string, schemeId: string) {
    return this.schemeSpine.libraryDiff(schoolId, schemeId);
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
        status: { not: SchemeOfWorkStatus.ARCHIVED },
      },
      include: {
        weeks: {
          select: { id: true, isDelivered: true },
        },
      },
    });

    const schemeMap = new Map(schemes.map((s: any) => [s.subjectId, s]));

    return subjects.map(subject => {
      const scheme = schemeMap.get(subject.subjectId) as any;
      const weeks = scheme?.weeks || [];
      const weeksTotal = weeks.length;
      const weeksCompleted = weeks.filter((w: any) => w.isDelivered).length;
      return {
        ...subject,
        schemeId: scheme?.id || null,
        status: scheme?.status || 'NOT_SET_UP',
        generationMode: scheme?.generationMode || null,
        version: scheme?.version || null,
        updatedAt: scheme?.updatedAt || null,
        isAgoraBased: !!scheme?.agoraCurriculumId,
        agoraCurriculumId: scheme?.agoraCurriculumId || null,
        weeksTotal,
        weeksCompleted,
        progressPercentage: weeksTotal > 0 ? Math.round((weeksCompleted / weeksTotal) * 100) : 0,
      };
    });
  }

  /**
   * Get Scheme of Work by ID with weeks
   */
  async getSchemeOfWorkById(schoolId: string, schemeId: string, user: UserWithContext): Promise<CurriculumDto> {
    const scheme = await (this.prisma as any).schemeOfWork.findFirst({
      where: { id: schemeId, schoolId },
      include: {
        weeks: { orderBy: { order: 'asc' }, include: { topics: true } },
        classLevel: true,
        school: true,
      }
    });

    if (!scheme) throw new NotFoundException('Scheme not found');

    // Get subject details
    const subject = await (this.prisma as any).subject.findUnique({
      where: { id: scheme.subjectId }
    });

    // termId is stored without a Prisma relation — load explicitly
    const term = scheme.termId
      ? await (this.prisma as any).term.findUnique({
          where: { id: scheme.termId },
          include: { academicSession: { select: { name: true } } },
        })
      : null;

    // Prefer a timetable teacher for this subject + level + term
    let teacherName: string | undefined;
    let teacherId = '';
    if (scheme.classLevelId && scheme.termId && scheme.subjectId) {
      const period = await (this.prisma as any).timetablePeriod.findFirst({
        where: {
          type: 'LESSON',
          subjectId: scheme.subjectId,
          termId: scheme.termId,
          teacherId: { not: null },
          OR: [
            { classArm: { classLevelId: scheme.classLevelId } },
            { classId: scheme.classLevelId },
          ],
        },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      if (period?.teacher) {
        teacherId = period.teacher.id;
        teacherName = `${period.teacher.firstName || ''} ${period.teacher.lastName || ''}`.trim() || undefined;
      }
    }

    return this.mapSchemeToCurriculumDto(
      { ...scheme, term },
      subject,
      { teacherId, teacherName },
    );
  }

  /**
   * Delete a Scheme of Work
   */
  async deleteSchemeOfWork(schoolId: string, schemeId: string, user: UserWithContext): Promise<void> {
    const scheme = await (this.prisma as any).schemeOfWork.findFirst({
      where: { id: schemeId, schoolId }
    });

    if (!scheme) throw new NotFoundException('Scheme not found');

    // Only Admin can delete
    const isAdmin = user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      throw new ForbiddenException('Only administrators can delete schemes');
    }

    await this.assertStaffMayMutateCurriculum(schoolId, user);

    await this.schemeSpine.archiveLiveScheme(schemeId, user.id);
  }

  private mapSchemeToCurriculumDto(
    scheme: any,
    subject: any,
    extras?: { teacherId?: string; teacherName?: string },
  ): CurriculumDto {
    const weeks = scheme.weeks || [];
    const totalWeeks = weeks.length;
    const completedWeeks = weeks.filter((w: any) => w.isDelivered).length;
    const term = scheme.term;

    // Map scheme statuses onto curriculum badge vocabulary where needed
    const statusMap: Record<string, string> = {
      PUBLISHED: 'ACTIVE',
      DRAFT: 'DRAFT',
      APPROVED: 'APPROVED',
      GENERATING: 'DRAFT',
      QUEUED: 'DRAFT',
      FAILED: 'REJECTED',
      CANCELLED: 'DRAFT',
    };

    return {
      id: scheme.id,
      schoolId: scheme.schoolId,
      classId: scheme.classId,
      classLevelId: scheme.classLevelId,
      subjectId: scheme.subjectId,
      subject: subject?.name || 'Unknown Subject',
      teacherId: extras?.teacherId || '',
      teacherName: extras?.teacherName,
      academicYear: term?.academicSession?.name || scheme.classLevel?.name || '',
      termId: scheme.termId,
      termName: term?.name,
      agoraCurriculumTemplateId: scheme.agoraCurriculumId,
      isAgoraBased: !!scheme.agoraCurriculumId,
      customizations: 0,
      status: (statusMap[scheme.status] || scheme.status) as any,
      submittedAt: null,
      approvedBy: scheme.approvedBy,
      approvedAt: scheme.approvedAt,
      rejectionReason: scheme.rejectionReason || null,
      isActive: scheme.status === 'PUBLISHED',
      createdAt: scheme.createdAt,
      updatedAt: scheme.updatedAt,
      items: weeks.map((w: any) => ({
        id: w.id,
        curriculumId: scheme.id,
        weekNumber: w.weekNumber,
        topic: w.topic,
        subTopics: w.subTopics || [],
        objectives: w.learningOutcomes || [],
        activities: w.suggestedActivities || [],
        resources: w.resources || [],
        assessment: w.assessmentType || null,
        status: (w.weekStatus || (w.isDelivered ? 'DELIVERED' : 'PENDING')) === 'SKIPPED'
          ? 'SKIPPED'
          : w.isDelivered
            ? 'COMPLETED'
            : 'PENDING',
        weekStatus: w.weekStatus || (w.isDelivered ? 'DELIVERED' : 'PENDING'),
        order: w.order,
        stableKeys: (w.topics || []).map((t: any) => t.stableKey),
        stableKey: w.topics?.[0]?.stableKey,
      })),
      totalWeeks,
      completedWeeks,
      progressPercentage: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0,
    };
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
