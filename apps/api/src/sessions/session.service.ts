import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import {
  InitializeSessionDto,
  CreateTermDto,
  MigrateStudentsDto,
  SessionType,
} from './dto/initialize-session.dto';
import { AcademicSessionDto, TermDto, ActiveSessionDto } from './dto/session.dto';
import { SessionStatus, TermStatus } from '@prisma/client';

/**
 * Service for managing academic sessions and terms
 * Handles the "Start Term" wizard and student migration logic
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository,
    private readonly emailService: EmailService
  ) {}

  /**
   * Initialize a new academic session
   */
  async initializeSession(
    schoolId: string,
    dto: InitializeSessionDto
  ): Promise<AcademicSessionDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check if there's an active session for this school type
    const activeSession = await this.prisma.academicSession.findFirst({
      where: {
        schoolId: school.id,
        status: SessionStatus.ACTIVE,
        schoolType: dto.schoolType || null,
      },
    });

    if (activeSession) {
      throw new ConflictException(
        `Cannot create a new session while ${activeSession.name} is active for ${dto.schoolType || 'this school'}. Please end the current session first.`
      );
    }

    // Validate dates
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Validate session duration (must be at least 10 months, approximately a year)
    const monthsDiff =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (monthsDiff < 10 || daysDiff < 300) {
      throw new BadRequestException(
        'An academic session must span at least 10 months (approximately one year). Please select appropriate start and end dates.'
      );
    }

    // Check if session name already exists for this school type
    const existingSession = await this.prisma.academicSession.findFirst({
      where: {
        schoolId: school.id,
        name: dto.name,
        schoolType: dto.schoolType || null,
      },
    });

    if (existingSession) {
      throw new ConflictException(
        `Session ${dto.name} already exists for ${dto.schoolType || 'this school'}`
      );
    }

    // Create session
    const session = await this.prisma.academicSession.create({
      data: {
        name: dto.name,
        startDate: startDate,
        endDate: endDate,
        status: SessionStatus.DRAFT,
        schoolId: school.id,
        schoolType: dto.schoolType || null,
      },
      include: {
        terms: true,
      },
    });

    return this.mapToSessionDto(session);
  }

  /**
   * Create a term for an academic session
   */
  async createTerm(schoolId: string, sessionId: string, dto: CreateTermDto): Promise<TermDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const session = await this.prisma.academicSession.findFirst({
      where: {
        id: sessionId,
        schoolId: school.id,
      },
    });

    if (!session) {
      throw new NotFoundException('Academic session not found');
    }

    const termNumber = parseInt(dto.number);
    if (termNumber < 1 || termNumber > 3) {
      throw new BadRequestException('Term number must be between 1 and 3');
    }

    // Check if term number already exists
    const existingTerm = await this.prisma.term.findFirst({
      where: {
        academicSessionId: sessionId,
        number: termNumber,
      },
    });

    if (existingTerm) {
      throw new ConflictException(`Term ${termNumber} already exists for this session`);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Validate dates are within session dates
    if (startDate < session.startDate || endDate > session.endDate) {
      throw new BadRequestException('Term dates must be within session dates');
    }

    const term = await this.prisma.term.create({
      data: {
        name: dto.name,
        number: termNumber,
        startDate: startDate,
        endDate: endDate,
        halfTermStart: dto.halfTermStart ? new Date(dto.halfTermStart) : null,
        halfTermEnd: dto.halfTermEnd ? new Date(dto.halfTermEnd) : null,
        status: TermStatus.DRAFT,
        academicSessionId: sessionId,
      },
    });

    return this.mapToTermDto(term);
  }

  /**
   * Get active session and term for a school (optionally filtered by school type)
   */
  async getActiveSession(schoolId: string, schoolType?: string): Promise<ActiveSessionDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // First, try to find active session for the specified school type
    let session = await this.prisma.academicSession.findFirst({
      where: {
        schoolId: school.id,
        status: SessionStatus.ACTIVE,
        ...(schoolType ? { schoolType } : {}),
      },
      include: {
        terms: {
          where: {
            status: TermStatus.ACTIVE,
          },
          orderBy: {
            number: 'desc',
          },
          take: 1,
        },
      },
    });

    // Fallback: If no session found with specific schoolType, try without schoolType filter
    // This handles cases where sessions were created before schoolType was required
    if (!session && schoolType) {
      session = await this.prisma.academicSession.findFirst({
        where: {
          schoolId: school.id,
          status: SessionStatus.ACTIVE,
          // Also check for null or undefined schoolType
          OR: [{ schoolType: null }, { schoolType: undefined }],
        },
        include: {
          terms: {
            where: {
              status: TermStatus.ACTIVE,
            },
            orderBy: {
              number: 'desc',
            },
            take: 1,
          },
        },
      });
    }

    if (!session) {
      return { session: undefined, term: undefined };
    }

    return {
      session: this.mapToSessionDto(session),
      term: session.terms.length > 0 ? this.mapToTermDto(session.terms[0]) : undefined,
    };
  }

  /**
   * Start a new term (the core "Start Term" wizard logic)
   * Supports school-type-specific sessions (PRIMARY, SECONDARY, TERTIARY)
   */
  async startNewTerm(
    schoolId: string,
    dto: InitializeSessionDto & { termId?: string }
  ): Promise<{
    session: AcademicSessionDto;
    term: TermDto;
    migratedCount: number;
  }> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    let session: any;
    let term: any;
    const schoolType = dto.schoolType || null;
    const isTertiary = schoolType === 'TERTIARY';

    if (dto.type === SessionType.NEW_SESSION) {
      // Check if there's an active session for this school type
      const activeSession = await this.prisma.academicSession.findFirst({
        where: {
          schoolId: school.id,
          status: SessionStatus.ACTIVE,
          schoolType: schoolType,
        },
      });

      if (activeSession) {
        throw new ConflictException(
          `Cannot start a new session while ${activeSession.name} is active for ${schoolType || 'this school'}. Please end the current session first.`
        );
      }

      // Validate session duration (must be at least 10 months)
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      const monthsDiff =
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        (endDate.getMonth() - startDate.getMonth());
      const daysDiff = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (monthsDiff < 10 || daysDiff < 300) {
        throw new BadRequestException(
          'An academic session must span at least 10 months (approximately one year). Please select appropriate start and end dates.'
        );
      }

      // Check if an ACTIVE or DRAFT session with this name already exists for this school type
      // COMPLETED sessions don't block creating a new session with the same name
      // (allows users to fix mistakes - end a wrong session and create a new one with same name)
      const existingActiveSession = await this.prisma.academicSession.findFirst({
        where: {
          schoolId: school.id,
          name: dto.name,
          schoolType: schoolType,
          status: { in: [SessionStatus.ACTIVE, SessionStatus.DRAFT] },
        },
      });

      if (existingActiveSession) {
        throw new ConflictException(
          `An active session named "${dto.name}" already exists for ${schoolType || 'this school'}. Please end the existing session first or use a different name.`
        );
      }

      // Create new session with school type
      session = await this.prisma.academicSession.create({
        data: {
          name: dto.name,
          startDate: startDate,
          endDate: endDate,
          status: SessionStatus.ACTIVE,
          schoolId: school.id,
          schoolType: schoolType,
        },
      });

      // Deactivate previous session for the same school type
      await this.prisma.academicSession.updateMany({
        where: {
          schoolId: school.id,
          status: SessionStatus.ACTIVE,
          schoolType: schoolType,
          id: { not: session.id },
        },
        data: {
          status: SessionStatus.COMPLETED,
        },
      });

      // Create terms/semesters based on school type
      // TERTIARY: 2 semesters, PRIMARY/SECONDARY: 3 terms
      const sessionDurationMs = endDate.getTime() - startDate.getTime();

      if (isTertiary) {
        // TERTIARY: Create 2 semesters
        const semesterDurationMs = sessionDurationMs / 2;

        const sem1Start = new Date(startDate);
        const sem1End = new Date(startDate.getTime() + semesterDurationMs);

        const sem2Start = new Date(sem1End.getTime() + 1);
        const sem2End = new Date(endDate);

        // Create 1st Semester (ACTIVE)
        term = await this.prisma.term.create({
          data: {
            name: '1st Semester',
            number: 1,
            startDate: sem1Start,
            endDate: sem1End,
            status: TermStatus.ACTIVE,
            academicSessionId: session.id,
          },
        });

        // Create 2nd Semester (DRAFT)
        await this.prisma.term.create({
          data: {
            name: '2nd Semester',
            number: 2,
            startDate: sem2Start,
            endDate: sem2End,
            status: TermStatus.DRAFT,
            academicSessionId: session.id,
          },
        });
      } else {
        // PRIMARY/SECONDARY: Create 3 terms
        const termDurationMs = sessionDurationMs / 3;

        const term1Start = new Date(startDate);
        const term1End = new Date(startDate.getTime() + termDurationMs);

        const term2Start = new Date(term1End.getTime() + 1);
        const term2End = new Date(term1End.getTime() + termDurationMs);

        const term3Start = new Date(term2End.getTime() + 1);
        const term3End = new Date(endDate);

        // Create 1st Term (ACTIVE)
        term = await this.prisma.term.create({
          data: {
            name: '1st Term',
            number: 1,
            startDate: term1Start,
            endDate: term1End,
            status: TermStatus.ACTIVE,
            academicSessionId: session.id,
          },
        });

        // Create 2nd Term (DRAFT)
        await this.prisma.term.create({
          data: {
            name: '2nd Term',
            number: 2,
            startDate: term2Start,
            endDate: term2End,
            status: TermStatus.DRAFT,
            academicSessionId: session.id,
          },
        });

        // Create 3rd Term (DRAFT)
        await this.prisma.term.create({
          data: {
            name: '3rd Term',
            number: 3,
            startDate: term3Start,
            endDate: term3End,
            status: TermStatus.DRAFT,
            academicSessionId: session.id,
          },
        });
      }

      // Deactivate previous terms for the same school type
      await this.prisma.term.updateMany({
        where: {
          academicSession: {
            schoolId: school.id,
            schoolType: schoolType,
          },
          status: TermStatus.ACTIVE,
          id: { not: term.id },
        },
        data: {
          status: TermStatus.COMPLETED,
        },
      });

      // Trigger promotion logic (filtered by school type)
      const { promotedCount: migratedCount, promotedStudents } =
        await this.promoteStudentsWithTracking(school.id, term.id, schoolType);

      // Send session start notifications to all school members (in background)
      this.sendSessionTermNotifications(
        school.id,
        school.name,
        session.name,
        term.name,
        new Date(dto.startDate),
        new Date(dto.endDate),
        true, // isNewSession
        schoolType
      );

      // Send promotion emails to promoted students (in background)
      if (promotedStudents.length > 0) {
        this.sendPromotionEmails(promotedStudents, session.name, school.name);
      }

      return {
        session: this.mapToSessionDto(session),
        term: this.mapToTermDto(term),
        migratedCount,
      };
    } else {
      // NEW_TERM - Create new term in existing session
      if (!dto.termId) {
        throw new BadRequestException('termId is required for NEW_TERM type');
      }

      const existingTerm = await this.prisma.term.findUnique({
        where: { id: dto.termId },
        include: { academicSession: true },
      });

      if (!existingTerm || existingTerm.academicSession.schoolId !== school.id) {
        throw new NotFoundException('Term not found');
      }

      // Find previous active term
      const previousTerm = await this.prisma.term.findFirst({
        where: {
          academicSessionId: existingTerm.academicSessionId,
          status: TermStatus.ACTIVE,
          id: { not: dto.termId },
        },
        orderBy: {
          number: 'desc',
        },
      });

      // Activate the new term
      term = await this.prisma.term.update({
        where: { id: dto.termId },
        data: {
          status: TermStatus.ACTIVE,
        },
      });

      // Deactivate previous term
      if (previousTerm) {
        await this.prisma.term.update({
          where: { id: previousTerm.id },
          data: {
            status: TermStatus.COMPLETED,
          },
        });
      }

      session = await this.prisma.academicSession.findUnique({
        where: { id: existingTerm.academicSessionId },
      });

      // Clone timetables from previous term
      if (previousTerm) {
        await this.cloneTimetables(previousTerm.id, term.id);
      }

      // Get schoolType from the session for carry over
      const sessionSchoolType = session?.schoolType || null;

      // Trigger carry over logic (filtered by school type)
      const migratedCount = await this.carryOverStudents(
        school.id,
        term.id,
        previousTerm?.id,
        sessionSchoolType
      );

      // Send term start notifications to all school members (in background)
      this.sendSessionTermNotifications(
        school.id,
        school.name,
        session?.name || '',
        term.name,
        term.startDate,
        term.endDate,
        false, // isNewSession = false (this is a new term)
        sessionSchoolType
      );

      return {
        session: this.mapToSessionDto(session),
        term: this.mapToTermDto(term),
        migratedCount,
      };
    }
  }

  /**
   * Clone timetables from one term to another
   */
  private async cloneTimetables(fromTermId: string, toTermId: string): Promise<number> {
    const existingPeriods = await this.prisma.timetablePeriod.findMany({
      where: { termId: fromTermId },
    });

    let clonedCount = 0;

    for (const period of existingPeriods) {
      // Check if a period already exists at this slot in the new term
      const existsInNewTerm = await this.prisma.timetablePeriod.findFirst({
        where: {
          termId: toTermId,
          classId: period.classId,
          classArmId: period.classArmId,
          dayOfWeek: period.dayOfWeek,
          startTime: period.startTime,
        },
      });

      if (!existsInNewTerm) {
        await this.prisma.timetablePeriod.create({
          data: {
            dayOfWeek: period.dayOfWeek,
            startTime: period.startTime,
            endTime: period.endTime,
            type: period.type,
            subjectId: period.subjectId,
            courseId: period.courseId,
            teacherId: period.teacherId,
            roomId: period.roomId,
            classId: period.classId,
            classArmId: period.classArmId,
            termId: toTermId,
          },
        });
        clonedCount++;
      }
    }

    return clonedCount;
  }

  /**
   * Migrate students (promote or carry over)
   */
  async migrateStudents(
    schoolId: string,
    dto: MigrateStudentsDto
  ): Promise<{ migratedCount: number }> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const term = await this.prisma.term.findUnique({
      where: { id: dto.termId },
      include: { academicSession: true },
    });

    if (!term || term.academicSession.schoolId !== school.id) {
      throw new NotFoundException('Term not found');
    }

    if (dto.carryOver) {
      // Find previous term
      const previousTerm = await this.prisma.term.findFirst({
        where: {
          academicSessionId: term.academicSessionId,
          number: { lt: term.number },
        },
        orderBy: {
          number: 'desc',
        },
      });

      if (!previousTerm) {
        throw new BadRequestException('No previous term found for carry over');
      }

      const migratedCount = await this.carryOverStudents(school.id, term.id, previousTerm.id);
      return { migratedCount };
    } else {
      const migratedCount = await this.promoteStudents(school.id, term.id);
      return { migratedCount };
    }
  }

  /**
   * Ensure ClassLevels have nextLevelId set up for promotion
   * This fixes existing ClassLevels that were created without the progression chain
   */
  private async ensureClassLevelProgression(
    schoolId: string,
    schoolType?: string | null
  ): Promise<void> {
    // Get all class levels for this school type, ordered by level
    const classLevels = await this.prisma.classLevel.findMany({
      where: {
        schoolId,
        ...(schoolType ? { type: schoolType } : {}),
      },
      orderBy: { level: 'asc' },
    });

    // Check if any levels need nextLevelId set
    const needsUpdate = classLevels.some(
      (level, index) => index < classLevels.length - 1 && !level.nextLevelId
    );

    if (needsUpdate) {
      console.log(`Setting up nextLevelId chain for ${classLevels.length} class levels...`);
      // Set up the chain
      for (let i = 0; i < classLevels.length - 1; i++) {
        if (!classLevels[i].nextLevelId) {
          await this.prisma.classLevel.update({
            where: { id: classLevels[i].id },
            data: { nextLevelId: classLevels[i + 1].id },
          });
        }
      }
    }
  }

  /**
   * Promotion Logic: Move students from currentLevel to nextLevel
   * JSS1 -> JSS2, SS3 -> ALUMNI
   * Handles both:
   * - Enrollments with classArm linked (proper setup)
   * - Enrollments with only classLevel string (legacy/simple setup)
   */
  private async promoteStudents(
    schoolId: string,
    termId: string,
    schoolType?: string | null
  ): Promise<number> {
    // Ensure ClassLevel progression is set up
    await this.ensureClassLevelProgression(schoolId, schoolType);

    // Get the previous active term for this school type (could be from previous session)
    const previousTerm = await this.prisma.term.findFirst({
      where: {
        academicSession: {
          schoolId: schoolId,
          ...(schoolType ? { schoolType } : {}),
        },
        id: { not: termId },
        status: { in: [TermStatus.ACTIVE, TermStatus.COMPLETED] },
      },
      orderBy: [{ academicSession: { startDate: 'desc' } }, { number: 'desc' }],
    });

    // Get all active enrollments - either from previous term OR enrollments without termId
    // Don't filter by class.type since classId might be null
    const previousEnrollments = await this.prisma.enrollment.findMany({
      where: {
        schoolId: schoolId,
        isActive: true,
        // Either has the previous term's ID, or has no termId (legacy enrollment)
        OR: [...(previousTerm ? [{ termId: previousTerm.id }] : []), { termId: null }],
      },
      include: {
        classArm: {
          include: {
            classLevel: true,
          },
        },
        class: true,
      },
    });

    // If schoolType is specified, filter enrollments by class type (if class exists) or by classLevel name pattern
    const filteredEnrollments = schoolType
      ? previousEnrollments.filter((e) => {
          // If class is linked, check its type
          if (e.class?.type) {
            return e.class.type === schoolType;
          }
          // Otherwise, try to infer from classLevel string
          // PRIMARY: Class 1-6, Primary 1-6
          // SECONDARY: JSS1-3, SS1-3
          // TERTIARY: 100L-500L
          const level = e.classLevel?.toUpperCase() || '';
          if (schoolType === 'PRIMARY') {
            return level.includes('CLASS') || level.includes('PRIMARY') || /^P[1-6]$/i.test(level);
          }
          if (schoolType === 'SECONDARY') {
            return level.includes('JSS') || level.includes('SS') || level.includes('SECONDARY');
          }
          if (schoolType === 'TERTIARY') {
            return /\d+L/.test(level) || level.includes('LEVEL');
          }
          return true; // Include if can't determine
        })
      : previousEnrollments;

    let promotedCount = 0;

    for (const enrollment of filteredEnrollments) {
      // Try to get current level from classArm first, then fall back to looking up by name
      let currentLevel: any = null;

      if (enrollment.classArm?.classLevel) {
        currentLevel = enrollment.classArm.classLevel;
      } else if (enrollment.classLevel) {
        // Look up ClassLevel by name for this school
        currentLevel = await this.prisma.classLevel.findFirst({
          where: {
            schoolId: schoolId,
            OR: [{ name: enrollment.classLevel }, { code: enrollment.classLevel }],
          },
        });
      }

      if (!currentLevel) {
        // Can't determine current level, skip but log
        console.warn(
          `Cannot determine class level for enrollment ${enrollment.id}, classLevel: ${enrollment.classLevel}`
        );
        continue;
      }

      // Find next level
      const nextLevel = currentLevel.nextLevelId
        ? await this.prisma.classLevel.findUnique({
            where: { id: currentLevel.nextLevelId },
          })
        : null;

      if (!nextLevel) {
        // Highest level (SS3/500L) -> ALUMNI
        // Mark enrollment as completed
        await this.prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { isActive: false },
        });
        promotedCount++;
        continue;
      }

      // Try to find a class arm for the next level
      const nextClassArm = await this.prisma.classArm.findFirst({
        where: {
          classLevelId: nextLevel.id,
          isActive: true,
        },
      });

      // Create new enrollment in next level
      await this.prisma.enrollment.create({
        data: {
          studentId: enrollment.studentId,
          schoolId: schoolId,
          classArmId: nextClassArm?.id || null, // May be null if no class arms set up
          termId: termId,
          classLevel: nextLevel.name,
          academicYear: enrollment.academicYear,
          isActive: true,
          debtBalance: 0,
        },
      });

      // Deactivate old enrollment
      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { isActive: false },
      });

      promotedCount++;
    }

    return promotedCount;
  }

  /**
   * Promotion Logic with tracking - same as promoteStudents but also returns
   * details of promoted students for email notifications
   */
  private async promoteStudentsWithTracking(
    schoolId: string,
    termId: string,
    schoolType?: string | null
  ): Promise<{
    promotedCount: number;
    promotedStudents: Array<{
      email: string;
      name: string;
      previousClass: string;
      newClass: string;
    }>;
  }> {
    // Ensure ClassLevel progression is set up
    await this.ensureClassLevelProgression(schoolId, schoolType);

    // Get the previous active term for this school type
    const previousTerm = await this.prisma.term.findFirst({
      where: {
        academicSession: {
          schoolId: schoolId,
          ...(schoolType ? { schoolType } : {}),
        },
        id: { not: termId },
        status: { in: [TermStatus.ACTIVE, TermStatus.COMPLETED] },
      },
      orderBy: [{ academicSession: { startDate: 'desc' } }, { number: 'desc' }],
    });

    // Get all active enrollments with student details
    const previousEnrollments = await this.prisma.enrollment.findMany({
      where: {
        schoolId: schoolId,
        isActive: true,
        OR: [...(previousTerm ? [{ termId: previousTerm.id }] : []), { termId: null }],
      },
      include: {
        classArm: {
          include: {
            classLevel: true,
          },
        },
        class: true,
        student: {
          include: {
            user: true,
          },
        },
      },
    });

    // Filter by school type
    const filteredEnrollments = schoolType
      ? previousEnrollments.filter((e) => {
          if (e.class?.type) {
            return e.class.type === schoolType;
          }
          const level = e.classLevel?.toUpperCase() || '';
          if (schoolType === 'PRIMARY') {
            return level.includes('CLASS') || level.includes('PRIMARY') || /^P[1-6]$/i.test(level);
          }
          if (schoolType === 'SECONDARY') {
            return level.includes('JSS') || level.includes('SS') || level.includes('SECONDARY');
          }
          if (schoolType === 'TERTIARY') {
            return /\d+L/.test(level) || level.includes('LEVEL');
          }
          return true;
        })
      : previousEnrollments;

    let promotedCount = 0;
    const promotedStudents: Array<{
      email: string;
      name: string;
      previousClass: string;
      newClass: string;
    }> = [];

    for (const enrollment of filteredEnrollments) {
      let currentLevel: any = null;

      if (enrollment.classArm?.classLevel) {
        currentLevel = enrollment.classArm.classLevel;
      } else if (enrollment.classLevel) {
        currentLevel = await this.prisma.classLevel.findFirst({
          where: {
            schoolId: schoolId,
            OR: [{ name: enrollment.classLevel }, { code: enrollment.classLevel }],
          },
        });
      }

      if (!currentLevel) {
        console.warn(
          `Cannot determine class level for enrollment ${enrollment.id}, classLevel: ${enrollment.classLevel}`
        );
        continue;
      }

      const previousClassName = currentLevel.name || enrollment.classLevel || 'Unknown';

      // Find next level
      const nextLevel = currentLevel.nextLevelId
        ? await this.prisma.classLevel.findUnique({
            where: { id: currentLevel.nextLevelId },
          })
        : null;

      if (!nextLevel) {
        // Highest level -> ALUMNI
        await this.prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { isActive: false },
        });
        promotedCount++;

        // Track for email (graduating)
        if (enrollment.student?.user?.email) {
          promotedStudents.push({
            email: enrollment.student.user.email,
            name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
            previousClass: previousClassName,
            newClass: 'Graduated/Alumni',
          });
        }
        continue;
      }

      // Find class arm for next level (for PRIMARY/SECONDARY schools using ClassArms)
      // Get current academic year
      const now = new Date();
      const year = now.getFullYear();
      const academicYear = now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;

      let nextClassArmId: string | null = null;
      let nextClassId: string | null = null;

      // Check if next level has ClassArms
      const nextLevelArms = await this.prisma.classArm.findMany({
        where: {
          classLevelId: nextLevel.id,
          academicYear: academicYear,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });

      if (nextLevelArms.length > 0) {
        // School uses ClassArms - distribute students evenly across arms
        // Simple round-robin distribution
        const armIndex = promotedCount % nextLevelArms.length;
        nextClassArmId = nextLevelArms[armIndex].id;
      } else {
        // No ClassArms - try to find a Class for this level
        const nextClass = await this.prisma.class.findFirst({
          where: {
            schoolId: schoolId,
            OR: [{ name: nextLevel.name }, { classLevel: nextLevel.name }],
            isActive: true,
          },
        });
        if (nextClass) {
          nextClassId = nextClass.id;
        }
      }

      // Create new enrollment
      await this.prisma.enrollment.create({
        data: {
          studentId: enrollment.studentId,
          schoolId: schoolId,
          classArmId: nextClassArmId,
          classId: nextClassId,
          termId: termId,
          classLevel: nextLevel.name,
          academicYear: enrollment.academicYear,
          isActive: true,
          debtBalance: 0,
        },
      });

      // Deactivate old enrollment
      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { isActive: false },
      });

      promotedCount++;

      // Track for email
      if (enrollment.student?.user?.email) {
        promotedStudents.push({
          email: enrollment.student.user.email,
          name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          previousClass: previousClassName,
          newClass: nextLevel.name,
        });
      }
    }

    return { promotedCount, promotedStudents };
  }

  /**
   * Carry Over Logic: Clone all active Enrollments from previous term
   * Keep students in the exact same ClassArm/Class
   * Handles enrollments with or without classId linked
   */
  private async carryOverStudents(
    schoolId: string,
    termId: string,
    previousTermId?: string,
    schoolType?: string | null
  ): Promise<number> {
    // Get previous enrollments - either from previous term OR enrollments without termId
    const previousEnrollments = await this.prisma.enrollment.findMany({
      where: {
        schoolId: schoolId,
        isActive: true,
        OR: [...(previousTermId ? [{ termId: previousTermId }] : []), { termId: null }],
      },
      include: {
        class: true,
      },
    });

    // Filter by school type if specified (using class.type or classLevel pattern)
    const filteredEnrollments = schoolType
      ? previousEnrollments.filter((e) => {
          if (e.class?.type) {
            return e.class.type === schoolType;
          }
          // Infer from classLevel string
          const level = e.classLevel?.toUpperCase() || '';
          if (schoolType === 'PRIMARY') {
            return level.includes('CLASS') || level.includes('PRIMARY') || /^P[1-6]$/i.test(level);
          }
          if (schoolType === 'SECONDARY') {
            return level.includes('JSS') || level.includes('SS') || level.includes('SECONDARY');
          }
          if (schoolType === 'TERTIARY') {
            return /\d+L/.test(level) || level.includes('LEVEL');
          }
          return true;
        })
      : previousEnrollments;

    let carriedOverCount = 0;

    for (const enrollment of filteredEnrollments) {
      // Check if enrollment already exists for this term
      const existing = await this.prisma.enrollment.findFirst({
        where: {
          studentId: enrollment.studentId,
          schoolId: schoolId,
          termId: termId,
        },
      });

      if (existing) {
        continue; // Already migrated
      }

      // Clone enrollment to new term
      await this.prisma.enrollment.create({
        data: {
          studentId: enrollment.studentId,
          schoolId: schoolId,
          classId: enrollment.classId,
          classArmId: enrollment.classArmId, // Keep same class arm
          termId: termId,
          classLevel: enrollment.classLevel,
          academicYear: enrollment.academicYear,
          isActive: true,
          debtBalance: enrollment.debtBalance, // Carry over debt
        },
      });

      carriedOverCount++;
    }

    return carriedOverCount;
  }

  /**
   * End the current active term (optionally filtered by school type)
   */
  async endTerm(schoolId: string, schoolType?: string): Promise<{ term: TermDto }> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Find active term for the specified school type
    const activeTerm = await this.prisma.term.findFirst({
      where: {
        academicSession: {
          schoolId: school.id,
          ...(schoolType ? { schoolType } : {}),
        },
        status: TermStatus.ACTIVE,
      },
      include: {
        academicSession: true,
      },
    });

    if (!activeTerm) {
      throw new NotFoundException(`No active term found${schoolType ? ` for ${schoolType}` : ''}`);
    }

    // Update term status to COMPLETED
    const updatedTerm = await this.prisma.term.update({
      where: { id: activeTerm.id },
      data: { status: TermStatus.COMPLETED },
    });

    return {
      term: this.mapToTermDto(updatedTerm),
    };
  }

  /**
   * End the current active session (optionally filtered by school type)
   * This marks the session and all its terms as COMPLETED
   */
  async endSession(
    schoolId: string,
    schoolType?: string
  ): Promise<{ session: AcademicSessionDto }> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Find active session for the specified school type
    const activeSession = await this.prisma.academicSession.findFirst({
      where: {
        schoolId: school.id,
        status: SessionStatus.ACTIVE,
        ...(schoolType ? { schoolType } : {}),
      },
      include: {
        terms: true,
      },
    });

    if (!activeSession) {
      throw new NotFoundException(
        `No active session found${schoolType ? ` for ${schoolType}` : ''}`
      );
    }

    // Mark all terms in this session as COMPLETED
    await this.prisma.term.updateMany({
      where: {
        academicSessionId: activeSession.id,
      },
      data: {
        status: TermStatus.COMPLETED,
      },
    });

    // Mark session as COMPLETED
    const updatedSession = await this.prisma.academicSession.update({
      where: { id: activeSession.id },
      data: { status: SessionStatus.COMPLETED },
      include: {
        terms: {
          orderBy: { number: 'asc' },
        },
      },
    });

    return {
      session: this.mapToSessionDto(updatedSession),
    };
  }

  /**
   * Reactivate a completed term (continue a term that was ended early)
   * Only allows reactivation if the term's end date hasn't passed yet
   */
  async reactivateTerm(
    schoolId: string,
    termId: string,
    schoolType?: string
  ): Promise<{ term: TermDto }> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Find the term
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: {
        academicSession: true,
      },
    });

    if (!term) {
      throw new NotFoundException('Term not found');
    }

    // Verify term belongs to this school
    if (term.academicSession.schoolId !== school.id) {
      throw new BadRequestException('Term does not belong to this school');
    }

    // Verify school type matches if specified
    if (schoolType && term.academicSession.schoolType !== schoolType) {
      throw new BadRequestException('Term does not match the specified school type');
    }

    // Check if term is COMPLETED (only completed terms can be reactivated)
    if (term.status !== TermStatus.COMPLETED) {
      throw new BadRequestException('Only completed terms can be reactivated');
    }

    // Check if term's end date hasn't passed yet
    const now = new Date();
    if (term.endDate < now) {
      throw new BadRequestException(
        `Cannot reactivate this term - its end date (${term.endDate.toLocaleDateString()}) has already passed`
      );
    }

    // Deactivate any currently active term for this session
    await this.prisma.term.updateMany({
      where: {
        academicSessionId: term.academicSessionId,
        status: TermStatus.ACTIVE,
      },
      data: {
        status: TermStatus.COMPLETED,
      },
    });

    // Reactivate the term
    const updatedTerm = await this.prisma.term.update({
      where: { id: termId },
      data: { status: TermStatus.ACTIVE },
    });

    // Ensure the session is active
    await this.prisma.academicSession.update({
      where: { id: term.academicSessionId },
      data: { status: SessionStatus.ACTIVE },
    });

    this.logger.log(`Term ${term.name} reactivated for school ${school.id}`);

    return {
      term: this.mapToTermDto(updatedTerm),
    };
  }

  /**
   * Get all sessions for a school (optionally filtered by school type)
   */
  async getSessions(schoolId: string, schoolType?: string): Promise<AcademicSessionDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const sessions = await this.prisma.academicSession.findMany({
      where: {
        schoolId: school.id,
        ...(schoolType ? { schoolType } : {}),
      },
      include: {
        terms: {
          orderBy: {
            number: 'asc',
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return sessions.map((s) => this.mapToSessionDto(s));
  }

  private mapToSessionDto(session: any): AcademicSessionDto {
    return {
      id: session.id,
      name: session.name,
      startDate: session.startDate,
      endDate: session.endDate,
      status: session.status,
      schoolId: session.schoolId,
      schoolType: session.schoolType,
      terms: session.terms ? session.terms.map((t: any) => this.mapToTermDto(t)) : [],
      createdAt: session.createdAt,
    };
  }

  private mapToTermDto(term: any): TermDto {
    return {
      id: term.id,
      name: term.name,
      number: term.number,
      startDate: term.startDate,
      endDate: term.endDate,
      halfTermStart: term.halfTermStart,
      halfTermEnd: term.halfTermEnd,
      status: term.status,
      academicSessionId: term.academicSessionId,
      createdAt: term.createdAt,
    };
  }

  /**
   * Get all school members (admins, teachers, students) with email addresses
   */
  private async getSchoolMembers(
    schoolId: string,
    schoolType?: string | null
  ): Promise<
    Array<{
      email: string;
      name: string;
      role: string;
    }>
  > {
    const members: Array<{ email: string; name: string; role: string }> = [];

    // Get school admins
    const admins = await this.prisma.schoolAdmin.findMany({
      where: { schoolId },
      include: { user: true },
    });

    for (const admin of admins) {
      if (admin.user?.email) {
        members.push({
          email: admin.user.email,
          name: `${admin.firstName} ${admin.lastName}`,
          role: admin.role || 'School Administrator',
        });
      }
    }

    // Get teachers
    const teachers = await this.prisma.teacher.findMany({
      where: { schoolId },
      include: { user: true },
    });

    for (const teacher of teachers) {
      const email = teacher.user?.email || teacher.email;
      if (email) {
        members.push({
          email,
          name: `${teacher.firstName} ${teacher.lastName}`,
          role: 'Teacher',
        });
      }
    }

    // Get students (optionally filtered by school type via class level)
    const students = await this.prisma.student.findMany({
      where: {
        enrollments: {
          some: {
            schoolId,
            isActive: true,
          },
        },
      },
      include: {
        user: true,
        enrollments: {
          where: {
            schoolId,
            isActive: true,
          },
          include: {
            class: true,
          },
        },
      },
    });

    for (const student of students) {
      // If schoolType is specified, filter students
      if (schoolType) {
        const enrollment = student.enrollments[0];
        if (enrollment) {
          // Check if student is in this school type
          const classType = enrollment.class?.type;
          const levelStr = enrollment.classLevel?.toUpperCase() || '';

          let matchesType = false;
          if (classType === schoolType) {
            matchesType = true;
          } else if (!classType) {
            // Infer from classLevel
            if (schoolType === 'PRIMARY') {
              matchesType = levelStr.includes('CLASS') || levelStr.includes('PRIMARY');
            } else if (schoolType === 'SECONDARY') {
              matchesType = levelStr.includes('JSS') || levelStr.includes('SS');
            } else if (schoolType === 'TERTIARY') {
              matchesType =
                /\d+L/.test(levelStr) || levelStr.includes('LEVEL') || levelStr.includes('YEAR');
            }
          }

          if (!matchesType) continue;
        }
      }

      if (student.user?.email) {
        members.push({
          email: student.user.email,
          name: `${student.firstName} ${student.lastName}`,
          role: 'Student',
        });
      }
    }

    return members;
  }

  /**
   * Send session/term start notification emails to all school members
   */
  private async sendSessionTermNotifications(
    schoolId: string,
    schoolName: string,
    sessionName: string,
    termName: string,
    startDate: Date,
    endDate: Date,
    isNewSession: boolean,
    schoolType?: string | null
  ): Promise<void> {
    try {
      const members = await this.getSchoolMembers(schoolId, schoolType);

      if (members.length === 0) {
        this.logger.log('No school members found to notify');
        return;
      }

      this.logger.log(
        `Sending ${isNewSession ? 'session' : 'term'} notifications to ${members.length} members`
      );

      // Send emails in background (don't await)
      this.emailService
        .sendBulkEmails(
          members.map((m) => ({ to: m.email, name: m.name, role: m.role })),
          isNewSession ? 'session' : 'term',
          sessionName,
          termName,
          startDate,
          endDate,
          schoolName
        )
        .then((result) => {
          this.logger.log(
            `Session/term notifications: ${result.sent} sent, ${result.failed} failed`
          );
        })
        .catch((error) => {
          this.logger.error('Failed to send session/term notifications:', error);
        });
    } catch (error) {
      this.logger.error('Error preparing session/term notifications:', error);
    }
  }

  /**
   * Send promotion emails to promoted students
   */
  private async sendPromotionEmails(
    promotedStudents: Array<{
      email: string;
      name: string;
      previousClass: string;
      newClass: string;
    }>,
    sessionName: string,
    schoolName: string
  ): Promise<void> {
    if (promotedStudents.length === 0) return;

    this.logger.log(`Sending promotion emails to ${promotedStudents.length} students`);

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < promotedStudents.length; i += batchSize) {
      const batch = promotedStudents.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (student) => {
          try {
            await this.emailService.sendStudentPromotionEmail(
              student.email,
              student.name,
              student.previousClass,
              student.newClass,
              sessionName,
              schoolName
            );
          } catch (error) {
            this.logger.error(`Failed to send promotion email to ${student.email}`);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < promotedStudents.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}
