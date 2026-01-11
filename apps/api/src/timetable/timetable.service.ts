import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import {
  CreateTimetablePeriodDto,
  CreateMasterScheduleDto,
} from './dto/create-timetable-period.dto';
import { TimetablePeriodDto, ConflictInfo } from './dto/timetable.dto';
import { DayOfWeek, PeriodType } from './dto/create-timetable-period.dto';

/**
 * Service for managing timetables with conflict detection
 */
@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository
  ) {}

  // Access Prisma models using bracket notation for reserved keywords
  private get timetablePeriodModel() {
    return (this.prisma as any)['timetablePeriod'];
  }

  /**
   * Create a timetable period with conflict detection
   */
  async createPeriod(schoolId: string, dto: CreateTimetablePeriodDto): Promise<TimetablePeriodDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate term exists and belongs to school
    const term = await this.prisma.term.findUnique({
      where: { id: dto.termId },
      include: { academicSession: true },
    });

    if (!term || term.academicSession.schoolId !== school.id) {
      throw new NotFoundException('Term not found');
    }

    // Validate either classId or classArmId is provided
    if (!dto.classId && !dto.classArmId) {
      throw new BadRequestException('Either classId or classArmId must be provided');
    }

    // Validate class exists if classId is provided
    if (dto.classId) {
      const classData = await this.prisma.class.findUnique({
        where: { id: dto.classId },
      });

      if (!classData || classData.schoolId !== school.id) {
        throw new NotFoundException('Class not found');
      }
    }

    // Validate class arm exists if classArmId is provided
    if (dto.classArmId) {
      const classArm = await this.prisma.classArm.findUnique({
        where: { id: dto.classArmId },
        include: { classLevel: true },
      });

      if (!classArm || classArm.classLevel.schoolId !== school.id) {
        throw new NotFoundException('Class arm not found');
      }
    }

    // Check for conflicts
    const conflict = await this.detectConflicts(dto, school.id);
    if (conflict) {
      throw new ConflictException(conflict.message);
    }

    // Validate time format
    this.validateTimeFormat(dto.startTime);
    this.validateTimeFormat(dto.endTime);

    // Validate time range
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Create period
    const period = await this.timetablePeriodModel.create({
      data: {
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        type: dto.type || PeriodType.LESSON,
        subjectId: dto.subjectId || null,
        courseId: dto.courseId || null,
        teacherId: dto.teacherId || null,
        roomId: dto.roomId || null,
        classId: dto.classId || null,
        classArmId: dto.classArmId || null,
        termId: dto.termId,
      },
      include: {
        subject: true,
        course: true,
        class: true,
        teacher: true,
        room: true,
        classArm: {
          include: {
            classLevel: true,
          },
        },
      },
    });

    return this.mapToPeriodDto(period);
  }

  /**
   * Create master schedule (empty slots for all class arms)
   */
  async createMasterSchedule(
    schoolId: string,
    dto: CreateMasterScheduleDto
  ): Promise<{ created: number; skipped: number }> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate term
    const term = await this.prisma.term.findUnique({
      where: { id: dto.termId },
      include: { academicSession: true },
    });

    if (!term || term.academicSession.schoolId !== school.id) {
      throw new NotFoundException('Term not found');
    }

    // Get all active class arms for the school
    const classArms = await this.prisma.classArm.findMany({
      where: {
        classLevel: {
          schoolId: school.id,
        },
        isActive: true,
      },
    });

    let created = 0;
    let skipped = 0;

    // Create periods for each class arm
    for (const classArm of classArms) {
      for (const periodDef of dto.periods) {
        // Check if period already exists
        const existing = await this.timetablePeriodModel.findFirst({
          where: {
            termId: dto.termId,
            classArmId: classArm.id,
            dayOfWeek: periodDef.dayOfWeek,
            startTime: periodDef.startTime,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await this.timetablePeriodModel.create({
          data: {
            dayOfWeek: periodDef.dayOfWeek,
            startTime: periodDef.startTime,
            endTime: periodDef.endTime,
            type: periodDef.type || PeriodType.LESSON,
            classArmId: classArm.id,
            termId: dto.termId,
          },
        });

        created++;
      }
    }

    return { created, skipped };
  }

  /**
   * Get timetable for a class arm
   */
  async getTimetableForClassArm(
    schoolId: string,
    classArmId: string,
    termId: string
  ): Promise<TimetablePeriodDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const periods = await this.timetablePeriodModel.findMany({
      where: {
        classArmId: classArmId,
        termId: termId,
      },
      include: {
        subject: true,
        course: true,
        class: true,
        teacher: true,
        room: true,
        classArm: {
          include: {
            classLevel: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return periods.map((p: any) => this.mapToPeriodDto(p));
  }

  /**
   * Get timetable for a teacher
   * Returns all periods where the teacher is assigned, grouped by day
   * Includes:
   * 1. Periods where teacherId is explicitly set
   * 2. Periods for classes where teacher is assigned (via ClassTeacher)
   *    - For PRIMARY: All periods for assigned classes
   *    - For SECONDARY: Periods where subject matches teacher's assignment
   *    - For TERTIARY: Periods for assigned courses
   */
  async getTimetableForTeacher(
    schoolId: string,
    teacherId: string,
    termId: string
  ): Promise<TimetablePeriodDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate teacher exists and belongs to school
    // Note: teacherId parameter can be either the database id or the unique teacherId field
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        OR: [{ id: teacherId }, { teacherId: teacherId }],
        schoolId: school.id,
      },
      include: {
        classTeachers: {
          include: {
            class: true,
            classArm: {
              include: {
                classLevel: true,
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    // Build conditions for periods where teacher is assigned
    const orConditions: any[] = [
      // Periods where teacherId is explicitly set to this teacher
      { teacherId: teacher.id },
    ];

    // Add conditions for each class/classArm assignment
    for (const ct of teacher.classTeachers) {
      if (ct.classArmId) {
        // ClassArm assignment (PRIMARY/SECONDARY)
        orConditions.push({ classArmId: ct.classArmId });
      } else if (ct.classId && ct.class) {
        // Class assignment
        if (ct.class.type === 'TERTIARY') {
          orConditions.push({ courseId: ct.classId });
        } else {
          orConditions.push({ classId: ct.classId });
        }
      }
    }

    // Get all periods for this teacher
    const periods = await this.timetablePeriodModel.findMany({
      where: {
        termId: termId,
        OR: orConditions,
      },
      include: {
        subject: true,
        course: true,
        class: true,
        teacher: true,
        room: true,
        classArm: {
          include: {
            classLevel: true,
          },
        },
        term: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return periods.map((p: any) => this.mapToPeriodDto(p));
  }

  /**
   * Get timetable for a class or classArm
   * The classId parameter can be either a Class ID or a ClassArm ID
   */
  async getTimetableForClass(
    schoolId: string,
    classId: string,
    termId: string
  ): Promise<TimetablePeriodDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check if this is a ClassArm ID first
    const classArm = await this.prisma.classArm.findUnique({
      where: { id: classId },
    });

    // Build where clause based on whether it's a ClassArm or Class
    const whereClause: any = {
      termId: termId,
    };

    if (classArm) {
      // It's a ClassArm ID
      whereClause.classArmId = classId;
    } else {
      // It's a Class ID - check both classId and courseId for TERTIARY
      whereClause.OR = [{ classId: classId }, { courseId: classId }];
    }

    const periods = await this.timetablePeriodModel.findMany({
      where: whereClause,
      include: {
        subject: true,
        course: true,
        class: true,
        teacher: true,
        room: true,
        classArm: {
          include: {
            classLevel: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return periods.map((p: any) => this.mapToPeriodDto(p));
  }

  /**
   * Get timetable for a student (Hybrid approach for TERTIARY)
   * For PRIMARY/SECONDARY: Returns timetable for student's class level (existing logic)
   * For TERTIARY: Merges home class timetable + course registration subjects
   */
  async getTimetableForStudent(
    schoolId: string,
    studentId: string,
    termId: string
  ): Promise<TimetablePeriodDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Get student with enrollment
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: {
            schoolId: school.id,
            isActive: true,
          },
          include: {
            class: true,
            classArm: {
              include: {
                classLevel: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!student || student.enrollments.length === 0) {
      throw new NotFoundException('Student not found or not enrolled in this school');
    }

    const enrollment = student.enrollments[0];
    const classData = enrollment.class;

    // Check if this is a TERTIARY institution
    const isTertiary = school.hasTertiary && classData?.type === 'TERTIARY';

    if (!isTertiary) {
      // PRIMARY/SECONDARY: Check if enrollment has ClassArm (for schools using ClassArms)
      if (enrollment.classArmId && enrollment.classArm) {
        // School uses ClassArms - get timetable for ClassArm
        return this.getTimetableForClassArm(schoolId, enrollment.classArmId, termId);
      }
      // Fallback to Class timetable (for schools without ClassArms - backward compatibility)
      if (classData?.id) {
        return this.getTimetableForClass(schoolId, classData.id, termId);
      }
      // If no class either, return empty timetable
      return [];
    }

    // TERTIARY: Hybrid approach - merge home class timetable + course registrations
    const [homeClassTimetable, courseRegistrations] = await Promise.all([
      // 1. Get home class timetable (e.g., 400 Level)
      this.getTimetableForClass(schoolId, classData.id, termId),
      // 2. Get active course registrations for this student and term
      (this.prisma as any).courseRegistration.findMany({
        where: {
          studentId: student.id,
          termId: termId,
          isActive: true,
        },
        include: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
    ]);

    // 3. Get timetable slots for registered subjects (carry-overs)
    const registeredSubjectIds = courseRegistrations.map((cr) => cr.subjectId);
    let registeredSubjectTimetable: TimetablePeriodDto[] = [];

    if (registeredSubjectIds.length > 0) {
      const registeredPeriods = await this.timetablePeriodModel.findMany({
        where: {
          termId: termId,
          subjectId: { in: registeredSubjectIds },
        },
        include: {
          subject: true,
          course: true,
          class: true,
          teacher: true,
          room: true,
          classArm: {
            include: {
              classLevel: true,
            },
          },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });

      registeredSubjectTimetable = registeredPeriods.map((p: any) => {
        const dto = this.mapToPeriodDto(p);
        // Mark as from course registration
        (dto as any).isFromCourseRegistration = true;
        return dto;
      });
    }

    // 4. Merge both timetables
    const mergedTimetable = [...homeClassTimetable, ...registeredSubjectTimetable];

    // 5. Detect conflicts (time overlaps)
    const timetableWithConflicts = this.detectTimeConflicts(mergedTimetable);

    return timetableWithConflicts;
  }

  /**
   * Detect time conflicts in a merged timetable
   * Two periods conflict if they overlap in time on the same day
   */
  private detectTimeConflicts(periods: TimetablePeriodDto[]): TimetablePeriodDto[] {
    const periodsWithConflicts = periods.map((period) => ({ ...period }));

    for (let i = 0; i < periodsWithConflicts.length; i++) {
      const period1 = periodsWithConflicts[i];
      const conflicts: string[] = [];
      let conflictMessage = '';

      for (let j = i + 1; j < periodsWithConflicts.length; j++) {
        const period2 = periodsWithConflicts[j];

        // Check if periods are on the same day and overlap in time
        if (
          period1.dayOfWeek === period2.dayOfWeek &&
          this.doPeriodsOverlap(
            period1.startTime,
            period1.endTime,
            period2.startTime,
            period2.endTime
          )
        ) {
          conflicts.push(period2.id);
          if (!period2.hasConflict) {
            period2.hasConflict = true;
            period2.conflictingPeriodIds = period2.conflictingPeriodIds || [];
            period2.conflictingPeriodIds.push(period1.id);
          }

          // Build conflict message
          const period1Name = period1.subjectName || period1.courseName || 'Unknown';
          const period2Name = period2.subjectName || period2.courseName || 'Unknown';
          conflictMessage = `Course clash: ${period1Name} conflicts with ${period2Name} at ${period1.startTime} on ${period1.dayOfWeek}`;
        }
      }

      if (conflicts.length > 0) {
        period1.hasConflict = true;
        period1.conflictingPeriodIds = conflicts;
        period1.conflictMessage = conflictMessage;
      }
    }

    return periodsWithConflicts;
  }

  /**
   * Check if two time periods overlap
   * Periods overlap if: startTime1 < endTime2 AND endTime1 > startTime2
   */
  private doPeriodsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    // Times are in HH:mm format, so string comparison works for lexicographic ordering
    return start1 < end2 && end1 > start2;
  }

  /**
   * Get all timetables for a school type (grouped by class)
   */
  async getTimetablesForSchoolType(
    schoolId: string,
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
    termId?: string
  ): Promise<Record<string, TimetablePeriodDto[]>> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Build where clause that handles both Class and ClassArm periods
    const orConditions: any[] = [];

    // Condition for periods linked to Class records
    const classCondition: any = {
      class: {
        schoolId: school.id,
        ...(schoolType ? { type: schoolType } : {}),
      },
    };
    orConditions.push(classCondition);

    // Condition for periods linked to ClassArm records (for PRIMARY/SECONDARY)
    if (!schoolType || schoolType === 'PRIMARY' || schoolType === 'SECONDARY') {
      const classArmCondition: any = {
        classArm: {
          classLevel: {
            schoolId: school.id,
            ...(schoolType ? { type: schoolType } : {}),
          },
        },
      };
      orConditions.push(classArmCondition);
    }

    const where: any = {
      OR: orConditions,
    };

    if (termId) {
      where.termId = termId;
    }

    const periods = await this.timetablePeriodModel.findMany({
      where,
      include: {
        subject: true,
        course: true,
        class: true,
        teacher: true,
        room: true,
        classArm: {
          include: {
            classLevel: true,
          },
        },
        term: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Group periods by class or classArm
    const timetablesByClass: Record<string, TimetablePeriodDto[]> = {};
    periods.forEach((period: any) => {
      // Use classArmId for ClassArm periods, classId for Class periods
      const groupId = period.classArmId || period.classId;
      if (groupId) {
        if (!timetablesByClass[groupId]) {
          timetablesByClass[groupId] = [];
        }
        timetablesByClass[groupId].push(this.mapToPeriodDto(period));
      }
    });

    return timetablesByClass;
  }

  /**
   * Update a timetable period
   */
  async updatePeriod(
    schoolId: string,
    periodId: string,
    dto: Partial<CreateTimetablePeriodDto>
  ): Promise<TimetablePeriodDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const period = await this.timetablePeriodModel.findUnique({
      where: { id: periodId },
      include: {
        term: {
          include: {
            academicSession: true,
          },
        },
      },
    });

    if (!period || period.term.academicSession.schoolId !== school.id) {
      throw new NotFoundException('Timetable period not found');
    }

    // Check for conflicts if teacher or room is being updated
    if (dto.teacherId || dto.roomId) {
      const conflict = await this.detectConflicts(
        {
          ...period,
          ...dto,
          dayOfWeek: dto.dayOfWeek || period.dayOfWeek,
          startTime: dto.startTime || period.startTime,
          endTime: dto.endTime || period.endTime,
          classArmId: dto.classArmId || period.classArmId,
          termId: dto.termId || period.termId,
        } as CreateTimetablePeriodDto,
        school.id,
        periodId
      );

      if (conflict) {
        throw new ConflictException(conflict.message);
      }
    }

    // Build update data object, only including fields that are provided
    const updateData: any = {};
    if (dto.dayOfWeek !== undefined) updateData.dayOfWeek = dto.dayOfWeek;
    if (dto.startTime !== undefined) updateData.startTime = dto.startTime;
    if (dto.endTime !== undefined) updateData.endTime = dto.endTime;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.subjectId !== undefined) updateData.subjectId = dto.subjectId;
    if (dto.courseId !== undefined) updateData.courseId = dto.courseId;
    if (dto.classId !== undefined) updateData.classId = dto.classId;
    if (dto.teacherId !== undefined) updateData.teacherId = dto.teacherId;
    if (dto.roomId !== undefined) updateData.roomId = dto.roomId;
    if (dto.classArmId !== undefined) updateData.classArmId = dto.classArmId;

    // Validate time format if times are being updated
    if (updateData.startTime) {
      this.validateTimeFormat(updateData.startTime);
    }
    if (updateData.endTime) {
      this.validateTimeFormat(updateData.endTime);
    }

    // Validate time range if both times are provided
    if (updateData.startTime && updateData.endTime) {
      if (updateData.startTime >= updateData.endTime) {
        throw new BadRequestException('Start time must be before end time');
      }
    } else if (updateData.startTime && period.endTime) {
      if (updateData.startTime >= period.endTime) {
        throw new BadRequestException('Start time must be before end time');
      }
    } else if (updateData.endTime && period.startTime) {
      if (period.startTime >= updateData.endTime) {
        throw new BadRequestException('Start time must be before end time');
      }
    }

    const updated = await this.timetablePeriodModel.update({
      where: { id: periodId },
      data: updateData,
      include: {
        subject: true,
        course: true,
        class: true,
        teacher: true,
        room: true,
        classArm: {
          include: {
            classLevel: true,
          },
        },
      },
    });

    return this.mapToPeriodDto(updated);
  }

  /**
   * Delete a timetable period
   */
  async deletePeriod(schoolId: string, periodId: string): Promise<void> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const period = await this.timetablePeriodModel.findUnique({
      where: { id: periodId },
      include: {
        term: {
          include: {
            academicSession: true,
          },
        },
      },
    });

    if (!period || period.term.academicSession.schoolId !== school.id) {
      throw new NotFoundException('Timetable period not found');
    }

    await this.timetablePeriodModel.delete({
      where: { id: periodId },
    });
  }

  /**
   * Delete all timetable periods for a class and term (delete entire timetable)
   */
  async deleteTimetableForClass(schoolId: string, classId: string, termId: string): Promise<void> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check if this is a ClassArm ID first
    const classArm = await this.prisma.classArm.findUnique({
      where: { id: classId },
      include: { classLevel: true },
    });

    let isClassArm = false;

    if (classArm) {
      // Validate ClassArm belongs to school
      if (classArm.classLevel.schoolId !== school.id) {
        throw new NotFoundException('Class not found');
      }
      isClassArm = true;
    } else {
      // Check if it's a Class ID
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classData || classData.schoolId !== school.id) {
        throw new NotFoundException('Class not found');
      }
    }

    // Validate term exists and belongs to school
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: {
        academicSession: true,
      },
    });

    if (!term || term.academicSession.schoolId !== school.id) {
      throw new NotFoundException('Term not found');
    }

    // Delete all periods for this class/classArm and term
    if (isClassArm) {
      await this.timetablePeriodModel.deleteMany({
        where: {
          classArmId: classId,
          termId: termId,
        },
      });
    } else {
      await this.timetablePeriodModel.deleteMany({
        where: {
          classId: classId,
          termId: termId,
        },
      });
    }
  }

  /**
   * Detect conflicts for teacher and room
   * Time overlap: periods overlap if startTime < other.endTime AND endTime > other.startTime
   * Since times are in HH:mm format, string comparison works for lexicographic ordering
   */
  private async detectConflicts(
    dto: CreateTimetablePeriodDto,
    schoolId: string,
    excludePeriodId?: string
  ): Promise<ConflictInfo | null> {
    // Only check conflicts for LESSON periods with teacher/room assigned
    if (dto.type !== PeriodType.LESSON || (!dto.teacherId && !dto.roomId)) {
      return null;
    }

    // Build where clause for conflict detection
    const where: any = {
      termId: dto.termId,
      dayOfWeek: dto.dayOfWeek,
      type: PeriodType.LESSON,
      ...(excludePeriodId && { id: { not: excludePeriodId } }),
    };

    // If classId is provided, check conflicts for that class
    // If classArmId is provided, check conflicts for that class arm
    if (dto.classId) {
      where.classId = dto.classId;
    } else if (dto.classArmId) {
      where.classArmId = dto.classArmId;
    }

    // Get all periods for the same day and term
    const allPeriods = await this.timetablePeriodModel.findMany({
      where,
      include: {
        class: true,
        classArm: {
          include: {
            classLevel: true,
          },
        },
        teacher: true,
        room: true,
      },
    });

    // Filter for overlapping time periods
    const overlappingPeriods = allPeriods.filter((period: any) => {
      // Periods overlap if: startTime < dto.endTime AND endTime > dto.startTime
      return period.startTime < dto.endTime && period.endTime > dto.startTime;
    });

    // Check teacher conflict
    if (dto.teacherId) {
      const teacherConflict = overlappingPeriods.find((p: any) => p.teacherId === dto.teacherId);

      if (teacherConflict) {
        const teacherName = teacherConflict.teacher
          ? `${teacherConflict.teacher.firstName} ${teacherConflict.teacher.lastName}`
          : 'Unknown';
        const classArmName = teacherConflict.classArm
          ? `${teacherConflict.classArm.classLevel.name} ${teacherConflict.classArm.name}`
          : 'Unknown';

        return {
          type: 'TEACHER',
          message: `${teacherName} is already teaching ${classArmName} at ${teacherConflict.startTime} on ${dto.dayOfWeek}`,
          conflictingPeriodId: teacherConflict.id,
        };
      }
    }

    // Check room conflict
    if (dto.roomId) {
      const roomConflict = overlappingPeriods.find((p: any) => p.roomId === dto.roomId);

      if (roomConflict) {
        const roomName = roomConflict.room?.name || 'Unknown';
        const classArmName = roomConflict.classArm
          ? `${roomConflict.classArm.classLevel.name} ${roomConflict.classArm.name}`
          : roomConflict.class
            ? roomConflict.class.name
            : 'Unknown';

        return {
          type: 'ROOM',
          message: `${roomName} is already occupied by ${classArmName} at ${roomConflict.startTime} on ${dto.dayOfWeek}`,
          conflictingPeriodId: roomConflict.id,
        };
      }
    }

    return null;
  }

  /**
   * Validate time format (HH:mm)
   */
  private validateTimeFormat(time: string): void {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      throw new BadRequestException(
        `Invalid time format: ${time}. Expected HH:mm format (e.g., "08:00")`
      );
    }
  }

  /**
   * Map Prisma period to DTO
   */
  private mapToPeriodDto(period: any): TimetablePeriodDto {
    const dto: TimetablePeriodDto = {
      id: period.id,
      dayOfWeek: period.dayOfWeek,
      startTime: period.startTime,
      endTime: period.endTime,
      type: period.type,
      subjectId: period.subjectId,
      subjectName: period.subject?.name,
      courseId: period.courseId,
      courseName: period.course?.name,
      teacherId: period.teacherId,
      teacherName: period.teacher
        ? `${period.teacher.firstName} ${period.teacher.lastName}`
        : undefined,
      // Include full teacher details for secondary school class detail pages
      teacher: period.teacher
        ? {
            id: period.teacher.id,
            firstName: period.teacher.firstName,
            lastName: period.teacher.lastName,
            email: period.teacher.email || '',
            phone: period.teacher.phone || '',
            profileImage: period.teacher.profileImage || null,
          }
        : undefined,
      roomId: period.roomId,
      roomName: period.room?.name,
      classArmId: period.classArmId,
      classArmName: period.classArm
        ? `${period.classArm.classLevel.name} ${period.classArm.name}`
        : '',
      termId: period.termId,
      createdAt: period.createdAt,
    };

    // Add optional fields if they exist
    if (period.hasConflict !== undefined) {
      (dto as any).hasConflict = period.hasConflict;
    }
    if (period.conflictMessage) {
      (dto as any).conflictMessage = period.conflictMessage;
    }
    if (period.conflictingPeriodIds) {
      (dto as any).conflictingPeriodIds = period.conflictingPeriodIds;
    }
    if (period.isFromCourseRegistration !== undefined) {
      (dto as any).isFromCourseRegistration = period.isFromCourseRegistration;
    }

    return dto;
  }
}
