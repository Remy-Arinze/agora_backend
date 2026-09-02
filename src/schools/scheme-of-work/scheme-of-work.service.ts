import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GenerateSchemeOfWorkDto, UpdateSchemeOfWorkStatusDto, UpdateSchemeOfWorkWeekDto, MarkWeekDeliveredDto } from './dto/scheme-of-work.dto';
import { SchemeGenerationMode, SchemeOfWorkStatus, SchemeDeliveryCatchUpReason } from '@prisma/client';
import { AiService } from '../../ai/ai.service';
import { CloudinaryService } from '../../storage/cloudinary/cloudinary.service';
import {
  buildHalfTermRange,
  getTeachingWeekInfo,
  DEFAULT_WORKING_DAYS,
} from '../../common/utils/instructional-day.util';
import { SchoolSettingsService } from '../../school-settings/school-settings.service';

/** Confidence contributions — higher when more proof is attached */
const CONFIDENCE = {
  ATTESTATION: 25,
  DELIVERY_NOTE: 20,
  CATCH_UP_REASON: 5,
  LESSON_FILE: 40,
} as const;

@Injectable()
export class SchemeOfWorkService {
  private readonly logger = new Logger(SchemeOfWorkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly schoolSettingsService: SchoolSettingsService,
  ) {}

  // ==========================================
  // SCHOOL ADMIN / BASE SCHEMES
  // ==========================================

  async generateScheme(schoolId: string, dto: GenerateSchemeOfWorkDto, userId: string) {
    const curriculum = await this.schoolSettingsService.getCurriculumPolicy(schoolId);
    const generationMode =
      dto.generationMode ??
      (curriculum.curriculumSource === 'AGORA_NATIONAL'
        ? SchemeGenerationMode.AGORA_ONLY
        : curriculum.curriculumSource === 'SCHOOL_UPLOAD'
          ? SchemeGenerationMode.SCHOOL_ONLY
          : SchemeGenerationMode.MERGED);
    const mergeWeightAgora =
      dto.mergeWeightAgora ?? (generationMode === SchemeGenerationMode.MERGED ? 50 : undefined);
    const mergeWeightSchool =
      dto.mergeWeightSchool ?? (generationMode === SchemeGenerationMode.MERGED ? 50 : undefined);

    // Basic validations
    if (generationMode === SchemeGenerationMode.AGORA_ONLY && !dto.agoraCurriculumId) {
      throw new BadRequestException('Bud library Curriculum ID is required when mode is AGORA_ONLY');
    }
    if (generationMode === SchemeGenerationMode.SCHOOL_ONLY && !dto.schoolCurriculumId) {
      throw new BadRequestException('School Curriculum Doc ID is required when mode is SCHOOL_ONLY');
    }
    if (generationMode === SchemeGenerationMode.MERGED && (!dto.agoraCurriculumId || !dto.schoolCurriculumId)) {
      throw new BadRequestException('Both Bud library Curriculum and School Curriculum Doc IDs are required for MERGED mode');
    }
    if (generationMode === SchemeGenerationMode.MERGED && (!mergeWeightAgora || !mergeWeightSchool)) {
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
        generationMode,
        agoraCurriculumId: dto.agoraCurriculumId,
        agoraCurriculumVersion: agoraCurriculumVersion,
        schoolCurriculumId: dto.schoolCurriculumId,
        mergeWeightAgora,
        mergeWeightSchool,
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

    const curriculumPolicy = await this.schoolSettingsService.getCurriculumPolicy(schoolId);
    if (
      dto.status === SchemeOfWorkStatus.PUBLISHED &&
      curriculumPolicy.schemeApprovalRequired &&
      scheme.status !== SchemeOfWorkStatus.APPROVED
    ) {
      throw new BadRequestException('Scheme must be approved before it can be published.');
    }

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

    const resolved = await this.resolveClassScope(schoolId, classId);
    if (!resolved.classLevelId && !resolved.classId && !resolved.classArmId) {
      throw new NotFoundException('Class not found in this school');
    }

    // Allow form/class teachers and subject teachers assigned via ClassTeacher
    const assignment = await this.prisma.classTeacher.findFirst({
      where: {
        teacherId: teacher.id,
        OR: [
          ...(resolved.classArmId ? [{ classArmId: resolved.classArmId }] : []),
          ...(resolved.classId ? [{ classId: resolved.classId }] : []),
        ],
      },
    });
    const isFormTeacher =
      !!resolved.classArmId &&
      !!(await this.prisma.classArm.findFirst({
        where: { id: resolved.classArmId, classTeacherId: teacher.id },
        select: { id: true },
      }));

    if (!assignment && !isFormTeacher) {
      throw new ForbiddenException('You are not assigned to this class');
    }

    return this.prisma.schemeOfWork.findMany({
      where: {
        schoolId,
        termId,
        status: SchemeOfWorkStatus.PUBLISHED,
        OR: [
          ...(resolved.classLevelId ? [{ classLevelId: resolved.classLevelId }] : []),
          ...(resolved.classArmId ? [{ classArmId: resolved.classArmId }] : []),
          ...(resolved.classId ? [{ classId: resolved.classId }] : []),
        ],
      },
      include: {
        weeks: { orderBy: { weekNumber: 'asc' } },
      },
    });
  }

  /**
   * Class detail UI: resolve ClassArm/Class → class level schemes (Agora imports are level-scoped).
   * Returns one published scheme (optionally filtered by subjectId) plus subject switcher metadata.
   */
  async getPublishedSchemeForClass(
    schoolId: string,
    classId: string,
    options: { subjectId?: string; termId?: string } = {},
  ) {
    const resolved = await this.resolveClassScope(schoolId, classId);
    if (!resolved.classLevelId && !resolved.classId && !resolved.classArmId) {
      throw new NotFoundException('Class not found');
    }

    const whereBase: any = {
      schoolId,
      status: { in: [SchemeOfWorkStatus.PUBLISHED, SchemeOfWorkStatus.APPROVED, SchemeOfWorkStatus.DRAFT, SchemeOfWorkStatus.GENERATING] },
      OR: [
        ...(resolved.classLevelId ? [{ classLevelId: resolved.classLevelId }] : []),
        ...(resolved.classArmId ? [{ classArmId: resolved.classArmId }] : []),
        ...(resolved.classId ? [{ classId: resolved.classId }] : []),
      ],
    };
    if (options.termId) {
      whereBase.termId = options.termId;
    }

    const schemes = await this.prisma.schemeOfWork.findMany({
      where: whereBase,
      include: {
        weeks: { orderBy: { weekNumber: 'asc' } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });

    if (schemes.length === 0) {
      return null;
    }

    // Prefer PUBLISHED, then APPROVED, then others
    const rank = (status: string) =>
      status === 'PUBLISHED' ? 0 : status === 'APPROVED' ? 1 : status === 'GENERATING' ? 2 : 3;
    schemes.sort((a, b) => rank(a.status) - rank(b.status));

    const subjectIds = [...new Set(schemes.map((s) => s.subjectId))];
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true, code: true },
    });
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    const availableSubjects = schemes.map((s) => ({
      subjectId: s.subjectId,
      subjectName: subjectMap.get(s.subjectId)?.name || 'Subject',
      subjectCode: subjectMap.get(s.subjectId)?.code || null,
      schemeId: s.id,
      status: s.status,
      termId: s.termId,
    }));

    // Dedupe subjects preferring published
    const bySubject = new Map<string, (typeof availableSubjects)[0]>();
    for (const row of availableSubjects) {
      const existing = bySubject.get(row.subjectId);
      if (!existing || rank(row.status) < rank(existing.status)) {
        bySubject.set(row.subjectId, row);
      }
    }
    const uniqueSubjects = Array.from(bySubject.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName),
    );

    let selected =
      (options.subjectId
        ? schemes.find((s) => s.subjectId === options.subjectId)
        : undefined) || schemes[0];

    // If subjectId requested but only via schemeId uniqueness, still ok
    if (options.subjectId) {
      const match = schemes.find((s) => s.subjectId === options.subjectId);
      if (match) selected = match;
    }

    return {
      ...selected,
      subjectName: subjectMap.get(selected.subjectId)?.name || null,
      availableSubjects: uniqueSubjects,
    };
  }

  async updateWeekForSchool(
    schoolId: string,
    weekId: string,
    dto: MarkWeekDeliveredDto,
    userId: string,
  ) {
    const week = await this.prisma.schemeOfWorkWeek.findUnique({
      where: { id: weekId },
      include: { schemeOfWork: true },
    });
    if (!week) throw new NotFoundException('Week not found');
    if (week.schemeOfWork.schoolId !== schoolId) throw new ForbiddenException('Access denied');

    const teacher = await this.prisma.teacher.findFirst({
      where: { userId, schoolId },
    });

    // Unmarking — clear delivery state, keep lesson file for history unless they clear later
    if (!dto.isDelivered) {
      return this.prisma.schemeOfWorkWeek.update({
        where: { id: weekId },
        data: {
          isDelivered: false,
          deliveredAt: null,
          deliveredBy: null,
          deliveryNote: null,
          catchUpReason: null,
          deliveryConfidence: 0,
          privateTeacherNotes:
            dto.privateTeacherNotes !== undefined
              ? dto.privateTeacherNotes
              : week.privateTeacherNotes,
        },
      });
    }

    const rawCurrentWeek = await this.resolveCurrentSchoolWeek(week.schemeOfWork.termId);
    const maxWeekInScheme = await this.prisma.schemeOfWorkWeek.aggregate({
      where: { schemeOfWorkId: week.schemeOfWorkId },
      _max: { weekNumber: true },
    });
    const schemeMaxWeek = maxWeekInScheme._max.weekNumber ?? rawCurrentWeek;
    const currentWeek = Math.min(rawCurrentWeek, schemeMaxWeek);
    this.assertDeliveryWindow(week.weekNumber, currentWeek, dto.catchUpReason);

    const deliveryNote =
      dto.deliveryNote !== undefined ? dto.deliveryNote.trim() : week.deliveryNote;
    const catchUpReason =
      week.weekNumber < currentWeek
        ? (dto.catchUpReason ?? week.catchUpReason)
        : null;
    const privateTeacherNotes =
      dto.privateTeacherNotes !== undefined
        ? dto.privateTeacherNotes
        : week.privateTeacherNotes;

    const confidence = this.computeDeliveryConfidence({
      isDelivered: true,
      deliveryNote,
      catchUpReason,
      lessonNoteUrl: week.lessonNoteUrl,
    });

    return this.prisma.schemeOfWorkWeek.update({
      where: { id: weekId },
      data: {
        isDelivered: true,
        deliveredAt: week.deliveredAt ?? new Date(),
        deliveredBy: teacher?.id ?? week.deliveredBy,
        deliveryNote: deliveryNote || null,
        catchUpReason,
        privateTeacherNotes,
        deliveryConfidence: confidence,
      },
    });
  }

  async uploadLessonNote(
    schoolId: string,
    weekId: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    if (!file) throw new BadRequestException('Lesson note file is required');

    const week = await this.prisma.schemeOfWorkWeek.findUnique({
      where: { id: weekId },
      include: { schemeOfWork: true },
    });
    if (!week) throw new NotFoundException('Week not found');
    if (week.schemeOfWork.schoolId !== schoolId) throw new ForbiddenException('Access denied');

    const teacher = await this.prisma.teacher.findFirst({
      where: { userId, schoolId },
    });

    const folder = `agora/schools/${schoolId}/scheme-of-work/${week.schemeOfWorkId}/weeks`;
    const publicId = `week-${week.weekNumber}-lesson-${Date.now()}`;
    const { url, publicId: storedPublicId } = await this.cloudinaryService.uploadRawFile(
      file,
      folder,
      publicId,
    );

    // Replace previous file if any
    if (week.lessonNotePublicId) {
      try {
        await this.cloudinaryService.deleteRawFile(week.lessonNotePublicId);
      } catch {
        this.logger.warn(`Failed to delete old lesson note ${week.lessonNotePublicId}`);
      }
    }

    const confidence = this.computeDeliveryConfidence({
      isDelivered: week.isDelivered,
      deliveryNote: week.deliveryNote,
      catchUpReason: week.catchUpReason,
      lessonNoteUrl: url,
    });

    return this.prisma.schemeOfWorkWeek.update({
      where: { id: weekId },
      data: {
        lessonNoteUrl: url,
        lessonNotePublicId: storedPublicId,
        lessonNoteFileName: file.originalname,
        deliveryConfidence: confidence,
        // Uploading evidence after the fact still counts toward audit trail
        deliveredBy: week.deliveredBy ?? teacher?.id ?? null,
      },
    });
  }

  computeDeliveryConfidence(input: {
    isDelivered: boolean;
    deliveryNote?: string | null;
    catchUpReason?: SchemeDeliveryCatchUpReason | null;
    lessonNoteUrl?: string | null;
  }): number {
    if (!input.isDelivered) return 0;
    let score = CONFIDENCE.ATTESTATION;
    if (input.deliveryNote && input.deliveryNote.trim().length >= 10) {
      score += CONFIDENCE.DELIVERY_NOTE;
    }
    if (input.catchUpReason) {
      score += CONFIDENCE.CATCH_UP_REASON;
    }
    if (input.lessonNoteUrl) {
      score += CONFIDENCE.LESSON_FILE;
    }
    return Math.min(100, score);
  }

  private async resolveCurrentSchoolWeek(termId: string): Promise<number> {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      select: {
        startDate: true,
        endDate: true,
        status: true,
        halfTermStart: true,
        halfTermEnd: true,
      },
    });
    if (!term?.startDate || !term?.endDate) {
      throw new BadRequestException('Cannot verify delivery window: term dates are missing');
    }

    const now = new Date();
    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);
    const halfTerm = buildHalfTermRange(term.halfTermStart, term.halfTermEnd);
    const days = await this.schoolSettingsService.getWorkingDays(schoolId);
    const teaching = getTeachingWeekInfo(termStart, termEnd, now, {
      workingDays: days?.length ? days : DEFAULT_WORKING_DAYS,
      nonInstructionalRanges: halfTerm ? [halfTerm] : [],
    });

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfEnd = new Date(termEnd);
    startOfEnd.setHours(0, 0, 0, 0);
    const isPastEnd = startOfToday.getTime() > startOfEnd.getTime();

    if (isPastEnd) {
      return teaching.totalTeachingWeeks;
    }

    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    let currentWeek = Math.max(
      1,
      Math.floor((now.getTime() - termStart.getTime()) / msPerWeek) + 1,
    );
    const totalWeeks = Math.max(
      1,
      Math.ceil((termEnd.getTime() - termStart.getTime()) / msPerWeek),
    );
    currentWeek = Math.min(currentWeek, totalWeeks);

    if (teaching.currentTeachingWeek != null) {
      return Math.min(currentWeek, teaching.currentTeachingWeek);
    }

    return currentWeek;
  }

  private assertDeliveryWindow(
    weekNumber: number,
    currentWeek: number,
    catchUpReason?: SchemeDeliveryCatchUpReason | null,
  ) {
    if (weekNumber > currentWeek) {
      throw new BadRequestException(
        `Week ${weekNumber} is in the future (school is on week ${currentWeek}). You cannot mark it delivered yet.`,
      );
    }
    if (weekNumber < currentWeek && !catchUpReason) {
      throw new BadRequestException(
        `Week ${weekNumber} is past (school is on week ${currentWeek}). Choose a catch-up reason (MISSED, CATCH_UP, or COMBINED).`,
      );
    }
  }

  private async resolveClassScope(
    schoolId: string,
    classId: string,
  ): Promise<{ classLevelId: string | null; classArmId: string | null; classId: string | null }> {
    const classArm = await this.prisma.classArm.findUnique({
      where: { id: classId },
      select: { id: true, classLevelId: true, classLevel: { select: { schoolId: true } } },
    });
    if (classArm) {
      // ClassArm has no schoolId — verify via classLevel
      const level = await this.prisma.classLevel.findFirst({
        where: { id: classArm.classLevelId, schoolId },
        select: { id: true },
      });
      if (!level) throw new NotFoundException('Class arm not found in this school');
      return { classLevelId: classArm.classLevelId, classArmId: classArm.id, classId: null };
    }

    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, classLevel: true, type: true },
    });
    if (!classRecord) throw new NotFoundException('Class not found in this school');

    if (classRecord.type !== 'TERTIARY' && classRecord.classLevel) {
      const level = await this.prisma.classLevel.findFirst({
        where: { schoolId, name: classRecord.classLevel, type: classRecord.type },
        select: { id: true },
      });
      if (level) {
        return { classLevelId: level.id, classArmId: null, classId: classRecord.id };
      }
    }

    return { classLevelId: null, classArmId: null, classId: classRecord.id };
  }

  async markWeekDelivered(schoolId: string, weekId: string, dto: MarkWeekDeliveredDto, teacherUserId: string) {
    // Same rules as class-detail UI path
    return this.updateWeekForSchool(schoolId, weekId, dto, teacherUserId);
  }

  // ==========================================
  // STUDENT APIs
  // ==========================================

  async getSchemeForStudentClassScope(schoolId: string, classId: string, termId: string, studentUserId: string) {
    // Students only see PUBLISHED schemes.
    const student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) throw new ForbiddenException('Student profile not found');

    const resolved = await this.resolveClassScope(schoolId, classId);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        schoolId,
        OR: [
          ...(resolved.classArmId ? [{ classArmId: resolved.classArmId }] : []),
          ...(resolved.classId ? [{ classId: resolved.classId }] : []),
          { classId },
        ],
      },
    });
    if (enrollments.length === 0) throw new ForbiddenException('Student not enrolled in this class');

    const schemes = await this.prisma.schemeOfWork.findMany({
      where: {
        schoolId,
        termId,
        status: SchemeOfWorkStatus.PUBLISHED,
        OR: [
          ...(resolved.classLevelId ? [{ classLevelId: resolved.classLevelId }] : []),
          ...(resolved.classArmId ? [{ classArmId: resolved.classArmId }] : []),
          ...(resolved.classId ? [{ classId: resolved.classId }] : []),
        ],
      },
      include: {
        weeks: {
          orderBy: { weekNumber: 'asc' },
          select: {
            id: true,
            weekNumber: true,
            topic: true,
            subTopics: true,
            studentFriendlyOutcomes: true,
            suggestedActivities: true,
            resources: true,
            assessmentType: true,
            isDelivered: true,
            deliveredAt: true,
          },
        },
      },
    });

    return schemes;
  }
}
