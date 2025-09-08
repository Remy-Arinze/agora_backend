import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import {
  ClassLevelDto,
  ClassArmDto,
  RoomDto,
  SubjectDto,
  CreateClassArmDto,
  CreateRoomDto,
  CreateSubjectDto,
  UpdateSubjectDto,
  AutoGenerateSubjectsDto,
  AutoGenerateSubjectsResponseDto,
  SubjectClassAssignmentsDto,
  BulkClassSubjectAssignmentDto,
} from './dto/resource.dto';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository
  ) {}

  // Access Prisma models using bracket notation for reserved keywords
  private get classLevelModel() {
    return (this.prisma as any)['classLevel'];
  }

  private get classArmModel() {
    return (this.prisma as any)['classArm'];
  }

  private get roomModel() {
    return (this.prisma as any)['room'];
  }

  private get subjectModel() {
    return (this.prisma as any)['subject'];
  }

  // ClassLevels
  async getClassLevels(
    schoolId: string,
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<ClassLevelDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const where: any = {
      schoolId: school.id,
      isActive: true,
    };

    if (schoolType) {
      where.type = schoolType;
    }

    const classLevels = await this.classLevelModel.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { level: 'asc' },
      ],
    });

    return classLevels.map((cl: any) => ({
      id: cl.id,
      name: cl.name,
      code: cl.code,
      level: cl.level,
      type: cl.type,
      schoolId: cl.schoolId,
      isActive: cl.isActive,
      nextLevelId: cl.nextLevelId,
    }));
  }

  // ClassArms
  async getClassArms(
    schoolId: string,
    classLevelId?: string,
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<ClassArmDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const where: any = {
      classLevel: {
        schoolId: school.id,
      },
      isActive: true,
    };

    if (classLevelId) {
      where.classLevelId = classLevelId;
    }

    if (schoolType) {
      where.classLevel = {
        ...where.classLevel,
        type: schoolType,
      };
    }

    const classArms = await this.classArmModel.findMany({
      where,
      include: {
        classLevel: true,
      },
      orderBy: [
        { classLevel: { level: 'asc' } },
        { name: 'asc' },
      ],
    });

    return classArms.map((ca: any) => ({
      id: ca.id,
      name: ca.name,
      capacity: ca.capacity,
      classLevelId: ca.classLevelId,
      classLevelName: ca.classLevel.name,
      isActive: ca.isActive,
    }));
  }

  /**
   * Generate default ClassLevels and ClassArms for a school
   * This is now a PUBLIC method that should be called explicitly via API
   */
  async generateDefaultClasses(
    schoolId: string,
    schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<{ created: number; message: string }> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate school has this type
    if (schoolType === 'PRIMARY' && !school.hasPrimary) {
      throw new BadRequestException('School does not have PRIMARY level');
    }
    if (schoolType === 'SECONDARY' && !school.hasSecondary) {
      throw new BadRequestException('School does not have SECONDARY level');
    }
    if (schoolType === 'TERTIARY' && !school.hasTertiary) {
      throw new BadRequestException('School does not have TERTIARY level');
    }

    // Check if ClassLevels already exist for this type
    const existingLevels = await this.classLevelModel.findMany({
      where: {
        schoolId: school.id,
        type: schoolType,
      },
      include: {
        classArms: {
          where: { isActive: true },
        },
      },
    });

    if (existingLevels.length > 0) {
      // Check if any levels have active ClassArms
      const levelsWithArms = existingLevels.filter((level: any) => level.classArms && level.classArms.length > 0);
      
      if (levelsWithArms.length > 0) {
        throw new ConflictException(`Classes for ${schoolType} already exist. Delete them first to regenerate.`);
      }

      // If levels exist but have no arms, delete the orphaned levels first
      for (const level of existingLevels) {
        await this.classLevelModel.delete({
          where: { id: level.id },
        });
      }
    }

    // Create ClassLevels based on type
    const levelsToCreate: Array<{ name: string; code: string; level: number; type: string }> = [];

    if (schoolType === 'PRIMARY') {
      for (let i = 1; i <= 6; i++) {
        levelsToCreate.push({
          name: `Primary ${i}`,
          code: `PRIMARY${i}`,
          level: i,
          type: 'PRIMARY',
        });
      }
    } else if (schoolType === 'SECONDARY') {
      // JSS levels
      for (let i = 1; i <= 3; i++) {
        levelsToCreate.push({
          name: `JSS ${i}`,
          code: `JSS${i}`,
          level: i,
          type: 'SECONDARY',
        });
      }
      // SS levels
      for (let i = 1; i <= 3; i++) {
        levelsToCreate.push({
          name: `SS ${i}`,
          code: `SS${i}`,
          level: i + 3,
          type: 'SECONDARY',
        });
      }
    } else if (schoolType === 'TERTIARY') {
      // For tertiary, create year levels
      for (let i = 1; i <= 4; i++) {
        levelsToCreate.push({
          name: `Year ${i}`,
          code: `YEAR${i}`,
          level: i,
          type: 'TERTIARY',
        });
      }
    }

    // Create ClassLevels
    const createdLevels = [];
    for (const levelData of levelsToCreate) {
      const level = await this.classLevelModel.create({
        data: {
          ...levelData,
          schoolId: school.id,
          isActive: true,
        },
      });
      createdLevels.push(level);
    }

    // Set up nextLevelId chain for promotion
    for (let i = 0; i < createdLevels.length - 1; i++) {
      await this.classLevelModel.update({
        where: { id: createdLevels[i].id },
        data: { nextLevelId: createdLevels[i + 1].id },
      });
    }

    // Create default ClassArms for each ClassLevel
    const now = new Date();
    const year = now.getFullYear();
    const academicYear = now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;

    for (const level of createdLevels) {
      await this.classArmModel.create({
        data: {
          name: 'A',
          classLevelId: level.id,
          academicYear: academicYear,
          isActive: true,
        },
      });
    }

    return {
      created: createdLevels.length,
      message: `Successfully created ${createdLevels.length} ${schoolType.toLowerCase()} classes`,
    };
  }

  async createClassArm(schoolId: string, dto: CreateClassArmDto): Promise<ClassArmDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Verify class level belongs to school
    const classLevel = await this.classLevelModel.findUnique({
      where: { id: dto.classLevelId },
    });

    if (!classLevel || classLevel.schoolId !== school.id) {
      throw new NotFoundException('Class level not found');
    }

    // Get current academic year
    const now = new Date();
    const year = now.getFullYear();
    const academicYear = now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;

    // Check if class arm already exists for this academic year
    const existing = await this.classArmModel.findFirst({
      where: {
        classLevelId: dto.classLevelId,
        name: dto.name,
        academicYear: academicYear,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `ClassArm "${dto.name}" already exists for ${classLevel.name} in academic year ${academicYear}. ` +
        `Please use a different arm name (e.g., "Gold", "Blue", "A", "B") or select a different ClassLevel.`
      );
    }

    // Note: Classes can coexist with ClassArms - this is intentional
    // Schools can have both Classes (e.g., "JSS1") and ClassArms (e.g., "JSS1 Gold", "JSS1 Blue")
    // This allows schools to gradually transition or use both systems simultaneously

    const classArm = await this.classArmModel.create({
      data: {
        name: dto.name,
        capacity: dto.capacity,
        classLevelId: dto.classLevelId,
        academicYear: academicYear,
        isActive: true,
      },
      include: {
        classLevel: true,
      },
    });

    return {
      id: classArm.id,
      name: classArm.name,
      capacity: classArm.capacity,
      classLevelId: classArm.classLevelId,
      classLevelName: classArm.classLevel.name,
      isActive: classArm.isActive,
    };
  }

  // Rooms
  async getRooms(schoolId: string): Promise<RoomDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const rooms = await this.roomModel.findMany({
      where: {
        schoolId: school.id,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return rooms.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      capacity: r.capacity,
      roomType: r.roomType,
      schoolId: r.schoolId,
      isActive: r.isActive,
    }));
  }

  async createRoom(schoolId: string, dto: CreateRoomDto): Promise<RoomDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check if room code already exists
    if (dto.code) {
      const existing = await this.roomModel.findFirst({
        where: {
          schoolId: school.id,
          code: dto.code,
        },
      });

      if (existing) {
        throw new BadRequestException(`Room with code "${dto.code}" already exists`);
      }
    }

    const room = await this.roomModel.create({
      data: {
        name: dto.name,
        code: dto.code,
        capacity: dto.capacity,
        roomType: dto.roomType,
        schoolId: school.id,
        isActive: true,
      },
    });

    return {
      id: room.id,
      name: room.name,
      code: room.code,
      capacity: room.capacity,
      roomType: room.roomType,
      schoolId: room.schoolId,
      isActive: room.isActive,
    };
  }

  // Subjects
  async getSubjects(
    schoolId: string,
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
    classLevelId?: string,
    termId?: string
  ): Promise<SubjectDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const where: any = {
      schoolId: school.id,
      isActive: true,
    };

    if (schoolType) {
      where.schoolType = schoolType;
    }

    if (classLevelId) {
      where.classLevelId = classLevelId;
    }

    const subjects = await this.subjectModel.findMany({
      where,
      include: {
        classLevel: true,
        subjectTeachers: {
          include: {
            teacher: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // If termId is provided, fetch teacher workloads for that term
    let teacherWorkloads: Map<string, { periodCount: number; classCount: number }> = new Map();
    
    if (termId && schoolType === 'SECONDARY') {
      // Get all teacher IDs from subjects
      const teacherIds = new Set<string>();
      subjects.forEach((s: any) => {
        s.subjectTeachers?.forEach((st: any) => {
          teacherIds.add(st.teacher.id);
        });
      });

      if (teacherIds.size > 0) {
        // Count periods per teacher for this term
        const periodCounts = await this.prisma.timetablePeriod.groupBy({
          by: ['teacherId'],
          where: {
            termId,
            teacherId: { in: Array.from(teacherIds) },
          },
          _count: { id: true },
        });

        // Count unique classes per teacher
        const classCountsRaw = await this.prisma.timetablePeriod.findMany({
          where: {
            termId,
            teacherId: { in: Array.from(teacherIds) },
            OR: [
              { classId: { not: null } },
              { classArmId: { not: null } },
            ],
          },
          select: {
            teacherId: true,
            classId: true,
            classArmId: true,
          },
          distinct: ['teacherId', 'classId', 'classArmId'],
        });

        // Build workload map
        periodCounts.forEach((pc: any) => {
          teacherWorkloads.set(pc.teacherId, {
            periodCount: pc._count.id,
            classCount: 0,
          });
        });

        // Count unique classes per teacher
        const classCountsByTeacher = new Map<string, Set<string>>();
        classCountsRaw.forEach((row: any) => {
          if (!row.teacherId) return;
          if (!classCountsByTeacher.has(row.teacherId)) {
            classCountsByTeacher.set(row.teacherId, new Set());
          }
          const classKey = row.classArmId || row.classId;
          if (classKey) {
            classCountsByTeacher.get(row.teacherId)!.add(classKey);
          }
        });

        classCountsByTeacher.forEach((classes, teacherId) => {
          const existing = teacherWorkloads.get(teacherId) || { periodCount: 0, classCount: 0 };
          existing.classCount = classes.size;
          teacherWorkloads.set(teacherId, existing);
        });
      }
    }

    return subjects.map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      schoolId: s.schoolId,
      schoolType: s.schoolType,
      classLevelId: s.classLevelId,
      classLevelName: s.classLevel?.name,
      description: s.description,
      isActive: s.isActive,
      teachers: s.subjectTeachers?.map((st: any) => {
        const workload = teacherWorkloads.get(st.teacher.id);
        return {
          id: st.teacher.id,
          firstName: st.teacher.firstName,
          lastName: st.teacher.lastName,
          periodCount: workload?.periodCount,
          classCount: workload?.classCount,
        };
      }) || [],
    }));
  }

  async createSubject(schoolId: string, dto: CreateSubjectDto): Promise<SubjectDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate classLevel if provided
    if (dto.classLevelId) {
      const classLevel = await this.classLevelModel.findUnique({
        where: { id: dto.classLevelId },
      });
      if (!classLevel || classLevel.schoolId !== school.id) {
        throw new NotFoundException('Class level not found');
      }
      // Ensure schoolType matches if provided
      if (dto.schoolType && classLevel.type !== dto.schoolType) {
        throw new BadRequestException('Class level type does not match school type');
      }
    }

    // Check if subject code already exists for the same schoolType
    if (dto.code) {
      const existing = await this.subjectModel.findFirst({
        where: {
          schoolId: school.id,
          code: dto.code,
          schoolType: dto.schoolType || null, // Match null if schoolType is not provided
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Subject with code "${dto.code}" already exists for ${dto.schoolType || 'this school type'}`
        );
      }
    }

    const subject = await this.subjectModel.create({
      data: {
        name: dto.name,
        code: dto.code,
        schoolId: school.id,
        schoolType: dto.schoolType,
        classLevelId: dto.classLevelId,
        description: dto.description,
        isActive: true,
      },
      include: {
        classLevel: true,
        subjectTeachers: {
          include: {
            teacher: true,
          },
        },
      },
    });

    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      schoolId: subject.schoolId,
      schoolType: subject.schoolType,
      classLevelId: subject.classLevelId,
      classLevelName: subject.classLevel?.name,
      description: subject.description,
      isActive: subject.isActive,
      teachers: subject.subjectTeachers?.map((st: any) => ({
        id: st.teacher.id,
        firstName: st.teacher.firstName,
        lastName: st.teacher.lastName,
      })) || [],
    };
  }

  async updateSubject(
    schoolId: string,
    subjectId: string,
    dto: UpdateSubjectDto
  ): Promise<SubjectDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const subject = await this.subjectModel.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.schoolId !== school.id) {
      throw new NotFoundException('Subject not found');
    }

    // Validate classLevel if provided
    if (dto.classLevelId) {
      const classLevel = await this.classLevelModel.findUnique({
        where: { id: dto.classLevelId },
      });
      if (!classLevel || classLevel.schoolId !== school.id) {
        throw new NotFoundException('Class level not found');
      }
      if (dto.schoolType && classLevel.type !== dto.schoolType) {
        throw new BadRequestException('Class level type does not match school type');
      }
    }

    // Check if subject code already exists for the same schoolType (if changing code)
    if (dto.code && dto.code !== subject.code) {
      const schoolTypeToCheck = dto.schoolType !== undefined ? dto.schoolType : subject.schoolType;
      const existing = await this.subjectModel.findFirst({
        where: {
          schoolId: school.id,
          code: dto.code,
          schoolType: schoolTypeToCheck || null, // Match null if schoolType is not provided
          id: { not: subjectId }, // Exclude the current subject
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Subject with code "${dto.code}" already exists for ${schoolTypeToCheck || 'this school type'}`
        );
      }
    }

    const updated = await this.subjectModel.update({
      where: { id: subjectId },
      data: {
        name: dto.name,
        code: dto.code,
        schoolType: dto.schoolType,
        classLevelId: dto.classLevelId,
        description: dto.description,
        isActive: dto.isActive,
      },
      include: {
        classLevel: true,
        subjectTeachers: {
          include: {
            teacher: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      schoolId: updated.schoolId,
      schoolType: updated.schoolType,
      classLevelId: updated.classLevelId,
      classLevelName: updated.classLevel?.name,
      description: updated.description,
      isActive: updated.isActive,
      teachers: updated.subjectTeachers?.map((st: any) => ({
        id: st.teacher.id,
        firstName: st.teacher.firstName,
        lastName: st.teacher.lastName,
      })) || [],
    };
  }

  async deleteSubject(schoolId: string, subjectId: string): Promise<void> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const subject = await this.subjectModel.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.schoolId !== school.id) {
      throw new NotFoundException('Subject not found');
    }

    // Check if subject is used in timetable periods
    const periodsCount = await this.prisma.timetablePeriod.count({
      where: { subjectId: subjectId },
    });

    if (periodsCount > 0) {
      throw new BadRequestException(
        `Cannot delete subject. It is used in ${periodsCount} timetable period(s). Please remove it from timetables first.`
      );
    }

    await this.subjectModel.delete({
      where: { id: subjectId },
    });
  }

  async assignTeacherToSubject(
    schoolId: string,
    subjectId: string,
    teacherId: string
  ): Promise<SubjectDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const subject = await this.subjectModel.findUnique({
      where: { id: subjectId },
      include: {
        subjectTeachers: true,
      },
    });

    if (!subject || subject.schoolId !== school.id) {
      throw new NotFoundException('Subject not found');
    }

    // Determine school type from subject's schoolType field
    // If subject doesn't have schoolType, infer from school flags (for backward compatibility)
    let schoolType = subject.schoolType;
    if (!schoolType) {
      if (school.hasPrimary && !school.hasSecondary && !school.hasTertiary) {
        schoolType = 'PRIMARY';
      } else if (school.hasSecondary && !school.hasPrimary && !school.hasTertiary) {
        schoolType = 'SECONDARY';
      } else if (school.hasTertiary) {
        schoolType = 'TERTIARY';
      }
    }

    // For PRIMARY schools, only allow one teacher per subject
    if (schoolType === 'PRIMARY' && subject.subjectTeachers && subject.subjectTeachers.length > 0) {
      throw new BadRequestException('Primary schools can only have one teacher per subject. Please remove the existing teacher first.');
    }

    // Verify teacher belongs to school
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher || teacher.schoolId !== school.id) {
      throw new NotFoundException('Teacher not found');
    }

    // Check if assignment already exists
    const existing = await this.prisma.subjectTeacher.findUnique({
      where: {
        subjectId_teacherId: {
          subjectId,
          teacherId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Teacher is already assigned to this subject');
    }

    await this.prisma.subjectTeacher.create({
      data: {
        subjectId,
        teacherId,
      },
    });

    // Return updated subject
    const updated = await this.subjectModel.findUnique({
      where: { id: subjectId },
      include: {
        classLevel: true,
        subjectTeachers: {
          include: {
            teacher: true,
          },
        },
      },
    });

    return {
      id: updated!.id,
      name: updated!.name,
      code: updated!.code,
      schoolId: updated!.schoolId,
      schoolType: updated!.schoolType,
      classLevelId: updated!.classLevelId,
      classLevelName: updated!.classLevel?.name,
      description: updated!.description,
      isActive: updated!.isActive,
      teachers: updated!.subjectTeachers?.map((st: any) => ({
        id: st.teacher.id,
        firstName: st.teacher.firstName,
        lastName: st.teacher.lastName,
      })) || [],
    };
  }

  async removeTeacherFromSubject(
    schoolId: string,
    subjectId: string,
    teacherId: string
  ): Promise<SubjectDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const subject = await this.subjectModel.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.schoolId !== school.id) {
      throw new NotFoundException('Subject not found');
    }

    await this.prisma.subjectTeacher.deleteMany({
      where: {
        subjectId,
        teacherId,
      },
    });

    // Return updated subject
    const updated = await this.subjectModel.findUnique({
      where: { id: subjectId },
      include: {
        classLevel: true,
        subjectTeachers: {
          include: {
            teacher: true,
          },
        },
      },
    });

    return {
      id: updated!.id,
      name: updated!.name,
      code: updated!.code,
      schoolId: updated!.schoolId,
      schoolType: updated!.schoolType,
      classLevelId: updated!.classLevelId,
      classLevelName: updated!.classLevel?.name,
      description: updated!.description,
      isActive: updated!.isActive,
      teachers: updated!.subjectTeachers?.map((st: any) => ({
        id: st.teacher.id,
        firstName: st.teacher.firstName,
        lastName: st.teacher.lastName,
      })) || [],
    };
  }

  // Courses (for TERTIARY schools)
  async getCourses(
    schoolId: string,
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<any[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const where: any = {
      schoolId: school.id,
      isActive: true,
    };

    // Only return courses for TERTIARY schools
    if (schoolType === 'TERTIARY') {
      where.type = 'TERTIARY';
    } else {
      // For primary/secondary, return empty array or filter by type
      where.type = { not: 'TERTIARY' };
    }

    const courses = await this.prisma.class.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    return courses.map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      creditHours: c.creditHours,
      schoolId: c.schoolId,
      type: c.type,
      isActive: c.isActive,
    }));
  }

  // Predefined subjects for auto-generation
  private readonly primarySubjects = [
    { name: 'English Language', code: 'ENG', color: '#3B82F6' },
    { name: 'Mathematics', code: 'MATH', color: '#10B981' },
    { name: 'Basic Science', code: 'BSCI', color: '#8B5CF6' },
    { name: 'Social Studies', code: 'SOCS', color: '#F59E0B' },
    { name: 'Civic Education', code: 'CVCE', color: '#EF4444' },
    { name: 'Physical & Health Education', code: 'PHE', color: '#06B6D4' },
    { name: 'Creative Arts', code: 'CART', color: '#EC4899' },
    { name: 'Agricultural Science', code: 'AGSC', color: '#84CC16' },
    { name: 'Computer Studies', code: 'COMP', color: '#6366F1' },
    { name: 'Home Economics', code: 'HECO', color: '#F97316' },
    { name: 'Religious Studies', code: 'RELS', color: '#14B8A6' },
    { name: 'French', code: 'FREN', color: '#A855F7' },
    { name: 'Yoruba', code: 'YORB', color: '#22C55E' },
    { name: 'Music', code: 'MUSC', color: '#E11D48' },
  ];

  private readonly secondarySubjects = [
    { name: 'English Language', code: 'ENG', color: '#3B82F6' },
    { name: 'Mathematics', code: 'MATH', color: '#10B981' },
    { name: 'Physics', code: 'PHY', color: '#8B5CF6' },
    { name: 'Chemistry', code: 'CHEM', color: '#F59E0B' },
    { name: 'Biology', code: 'BIO', color: '#EF4444' },
    { name: 'Further Mathematics', code: 'FMATH', color: '#06B6D4' },
    { name: 'Economics', code: 'ECON', color: '#EC4899' },
    { name: 'Government', code: 'GOVT', color: '#84CC16' },
    { name: 'Literature in English', code: 'LIT', color: '#6366F1' },
    { name: 'Geography', code: 'GEO', color: '#F97316' },
    { name: 'Agricultural Science', code: 'AGSC', color: '#14B8A6' },
    { name: 'Computer Science', code: 'COMP', color: '#A855F7' },
    { name: 'Civic Education', code: 'CVCE', color: '#22C55E' },
    { name: 'History', code: 'HIST', color: '#E11D48' },
    { name: 'Fine Arts', code: 'FART', color: '#0EA5E9' },
    { name: 'Technical Drawing', code: 'TDRW', color: '#7C3AED' },
    { name: 'Food & Nutrition', code: 'FNU', color: '#F472B6' },
    { name: 'Christian Religious Studies', code: 'CRS', color: '#34D399' },
    { name: 'Islamic Religious Studies', code: 'IRS', color: '#FBBF24' },
    { name: 'French', code: 'FREN', color: '#818CF8' },
    { name: 'Yoruba', code: 'YORB', color: '#2DD4BF' },
    { name: 'Commerce', code: 'COMM', color: '#FB7185' },
    { name: 'Accounting', code: 'ACCT', color: '#4ADE80' },
  ];

  async autoGenerateSubjects(
    schoolId: string,
    dto: AutoGenerateSubjectsDto
  ): Promise<AutoGenerateSubjectsResponseDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const predefinedSubjects = dto.schoolType === 'PRIMARY' 
      ? this.primarySubjects 
      : this.secondarySubjects;

    // Get existing subjects for this school and schoolType
    const existingSubjects = await this.subjectModel.findMany({
      where: {
        schoolId: school.id,
        schoolType: dto.schoolType,
      },
    });

    const existingNames = new Set(existingSubjects.map((s: any) => s.name.toLowerCase()));
    const existingCodes = new Set(existingSubjects.map((s: any) => s.code?.toLowerCase()));

    const createdSubjects: SubjectDto[] = [];
    let skipped = 0;

    for (const subjectData of predefinedSubjects) {
      // Skip if subject with same name or code already exists
      if (
        existingNames.has(subjectData.name.toLowerCase()) ||
        existingCodes.has(subjectData.code.toLowerCase())
      ) {
        skipped++;
        continue;
      }

      const subject = await this.subjectModel.create({
        data: {
          name: subjectData.name,
          code: subjectData.code,
          schoolId: school.id,
          schoolType: dto.schoolType,
          isActive: true,
        },
      });

      createdSubjects.push({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        schoolId: subject.schoolId,
        schoolType: subject.schoolType,
        classLevelId: subject.classLevelId,
        description: subject.description,
        isActive: subject.isActive,
        teachers: [],
      });
    }

    return {
      created: createdSubjects.length,
      skipped,
      subjects: createdSubjects,
    };
  }

  // ============================================
  // CLASS SUBJECT TEACHER ASSIGNMENTS (SECONDARY)
  // ============================================

  /**
   * Get all class arms for a subject with current teacher assignments
   * Used by SECONDARY schools to see which teacher teaches a subject in each class
   */
  async getSubjectClassAssignments(
    schoolId: string,
    subjectId: string,
    sessionId?: string
  ): Promise<SubjectClassAssignmentsDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const subject = await this.subjectModel.findUnique({
      where: { id: subjectId },
      include: {
        subjectTeachers: {
          include: {
            teacher: true,
          },
        },
      },
    });

    if (!subject || subject.schoolId !== school.id) {
      throw new NotFoundException('Subject not found');
    }

    // Only relevant for SECONDARY schools
    if (subject.schoolType !== 'SECONDARY') {
      throw new BadRequestException('Class assignments are only available for SECONDARY school subjects');
    }

    // Get active session if not provided
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const activeSession = await this.prisma.academicSession.findFirst({
        where: {
          schoolId: school.id,
          schoolType: 'SECONDARY',
          status: 'ACTIVE',
        },
      });
      activeSessionId = activeSession?.id;
    }

    // Get all class arms for SECONDARY school type
    const classArms = await this.prisma.classArm.findMany({
      where: {
        classLevel: {
          schoolId: school.id,
          type: 'SECONDARY',
          isActive: true,
        },
        isActive: true,
      },
      include: {
        classLevel: true,
      },
      orderBy: [
        { classLevel: { level: 'asc' } },
        { name: 'asc' },
      ],
    });

    // Get current assignments for this subject
    const assignments = await this.prisma.classTeacher.findMany({
      where: {
        subjectId: subjectId,
        classArmId: { not: null },
        ...(activeSessionId ? { sessionId: activeSessionId } : {}),
      },
      include: {
        teacher: true,
        classArm: {
          include: {
            classLevel: true,
          },
        },
      },
    });

    // Build assignments map: classArmId -> assignment details
    const assignmentsMap: Record<string, { assignmentId: string; teacherId: string; teacherName: string }> = {};
    for (const assignment of assignments) {
      if (assignment.classArmId) {
        assignmentsMap[assignment.classArmId] = {
          assignmentId: assignment.id,
          teacherId: assignment.teacherId,
          teacherName: `${assignment.teacher.firstName} ${assignment.teacher.lastName}`,
        };
      }
    }

    // Get competent teachers (teachers who can teach this subject)
    const competentTeachers = subject.subjectTeachers?.map((st: any) => ({
      id: st.teacher.id,
      firstName: st.teacher.firstName,
      lastName: st.teacher.lastName,
    })) || [];

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      schoolType: subject.schoolType || 'SECONDARY',
      classArms: classArms.map((arm: any) => ({
        id: arm.id,
        name: arm.name,
        classLevelId: arm.classLevelId,
        classLevelName: arm.classLevel.name,
        fullName: `${arm.classLevel.name} ${arm.name}`,
      })),
      assignments: assignmentsMap,
      competentTeachers,
    };
  }

  /**
   * Bulk assign teachers to classes for a subject
   * For SECONDARY schools: assign which teacher teaches a subject in each class
   */
  async bulkAssignTeachersToClasses(
    schoolId: string,
    subjectId: string,
    dto: BulkClassSubjectAssignmentDto
  ): Promise<{ updated: number; removed: number }> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const subject = await this.subjectModel.findUnique({
      where: { id: subjectId },
      include: {
        subjectTeachers: true,
      },
    });

    if (!subject || subject.schoolId !== school.id) {
      throw new NotFoundException('Subject not found');
    }

    if (subject.schoolType !== 'SECONDARY') {
      throw new BadRequestException('Class assignments are only available for SECONDARY school subjects');
    }

    // Get or determine session
    let sessionId = dto.sessionId;
    if (!sessionId) {
      const activeSession = await this.prisma.academicSession.findFirst({
        where: {
          schoolId: school.id,
          schoolType: 'SECONDARY',
          status: 'ACTIVE',
        },
      });
      sessionId = activeSession?.id;
    }

    // Validate all class arms belong to this school
    const classArmIds = dto.assignments.map(a => a.classArmId);
    const validClassArms = await this.prisma.classArm.findMany({
      where: {
        id: { in: classArmIds },
        classLevel: {
          schoolId: school.id,
          type: 'SECONDARY',
        },
      },
    });

    const validClassArmIdSet = new Set(validClassArms.map(ca => ca.id));
    for (const assignment of dto.assignments) {
      if (!validClassArmIdSet.has(assignment.classArmId)) {
        throw new BadRequestException(`Invalid class arm: ${assignment.classArmId}`);
      }
    }

    // Get competent teacher IDs
    const competentTeacherIds = new Set(subject.subjectTeachers?.map((st: any) => st.teacherId) || []);

    let updated = 0;
    let removed = 0;

    for (const assignment of dto.assignments) {
      // Find existing assignment for this subject + classArm + session
      const existing = await this.prisma.classTeacher.findFirst({
        where: {
          subjectId: subjectId,
          classArmId: assignment.classArmId,
          ...(sessionId ? { sessionId } : {}),
        },
      });

      if (!assignment.teacherId) {
        // Remove assignment
        if (existing) {
          await this.prisma.classTeacher.delete({
            where: { id: existing.id },
          });
          removed++;
        }
      } else {
        // Validate teacher is competent to teach this subject
        if (!competentTeacherIds.has(assignment.teacherId)) {
          throw new BadRequestException(
            `Teacher ${assignment.teacherId} is not marked as competent to teach ${subject.name}. Please add them as a subject teacher first.`
          );
        }

        if (existing) {
          // Update existing assignment
          await this.prisma.classTeacher.update({
            where: { id: existing.id },
            data: {
              teacherId: assignment.teacherId,
            },
          });
          updated++;
        } else {
          // Create new assignment
          await this.prisma.classTeacher.create({
            data: {
              classArmId: assignment.classArmId,
              teacherId: assignment.teacherId,
              subjectId: subjectId,
              sessionId: sessionId,
              isPrimary: false,
              isFormTeacher: false,
            },
          });
          updated++;
        }
      }
    }

    return { updated, removed };
  }

  /**
   * Remove a specific class-subject-teacher assignment
   */
  async removeClassSubjectAssignment(
    schoolId: string,
    subjectId: string,
    classArmId: string,
    sessionId?: string
  ): Promise<void> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const subject = await this.subjectModel.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.schoolId !== school.id) {
      throw new NotFoundException('Subject not found');
    }

    // Delete the assignment
    await this.prisma.classTeacher.deleteMany({
      where: {
        subjectId: subjectId,
        classArmId: classArmId,
        ...(sessionId ? { sessionId } : {}),
      },
    });
  }

  // ============================================
  // TEACHER WORKLOAD ANALYSIS
  // ============================================

  /**
   * Workload thresholds (periods per week)
   * These can be configured per school in the future
   */
  private readonly WORKLOAD_THRESHOLDS = {
    LOW: 10,      // Less than 10 periods = underutilized
    NORMAL: 25,   // 10-25 periods = normal
    HIGH: 30,     // 25-30 periods = high
    OVERLOADED: 30, // More than 30 = overloaded
  };

  /**
   * Get comprehensive teacher workload summary for a school and term
   * Used by admin to monitor and balance teacher assignments
   */
  async getTeacherWorkloadSummary(
    schoolId: string,
    termId: string,
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<{
    teachers: Array<{
      teacherId: string;
      firstName: string;
      lastName: string;
      totalPeriods: number;
      classCount: number;
      subjectCount: number;
      periodsBySubject: Record<string, { name: string; count: number }>;
      periodsByClass: Record<string, { name: string; count: number }>;
      status: 'LOW' | 'NORMAL' | 'HIGH' | 'OVERLOADED';
    }>;
    averagePeriods: number;
    warnings: Array<{
      teacherId: string;
      teacherName: string;
      periodCount: number;
      status: string;
      message: string;
    }>;
    unassignedSubjects: Array<{
      subjectId: string;
      subjectName: string;
      message: string;
    }>;
  }> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Verify term exists
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicSession: true },
    });

    if (!term || term.academicSession?.schoolId !== school.id) {
      throw new NotFoundException('Term not found');
    }

    // Build school type filter
    const typeFilter: any = {};
    if (schoolType) {
      typeFilter.type = schoolType;
    }

    // Get all teachers for this school (filtered by school type via their class/subject assignments)
    const teachers = await this.prisma.teacher.findMany({
      where: {
        schoolId: school.id,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    // Get all periods for this term with subject and class info
    const periods = await this.prisma.timetablePeriod.findMany({
      where: {
        termId,
        teacherId: { not: null },
        ...(schoolType ? {
          OR: [
            { classArm: { classLevel: { type: schoolType } } },
            { class: { type: schoolType } },
          ],
        } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
        classArm: { 
          include: { 
            classLevel: { select: { name: true } } 
          } 
        },
        class: { select: { id: true, name: true } },
      },
    });

    // Build workload data per teacher
    const teacherWorkloads = new Map<string, {
      totalPeriods: number;
      subjectPeriods: Map<string, { name: string; count: number }>;
      classPeriods: Map<string, { name: string; count: number }>;
      subjectIds: Set<string>;
      classIds: Set<string>;
    }>();

    periods.forEach((period: any) => {
      if (!period.teacherId) return;

      if (!teacherWorkloads.has(period.teacherId)) {
        teacherWorkloads.set(period.teacherId, {
          totalPeriods: 0,
          subjectPeriods: new Map(),
          classPeriods: new Map(),
          subjectIds: new Set(),
          classIds: new Set(),
        });
      }

      const workload = teacherWorkloads.get(period.teacherId)!;
      workload.totalPeriods++;

      // Track subject periods
      if (period.subject) {
        const subjectKey = period.subject.id;
        workload.subjectIds.add(subjectKey);
        const existing = workload.subjectPeriods.get(subjectKey) || { name: period.subject.name, count: 0 };
        existing.count++;
        workload.subjectPeriods.set(subjectKey, existing);
      }

      // Track class periods
      const className = period.classArm 
        ? `${period.classArm.classLevel.name} ${period.classArm.name}`
        : period.class?.name || 'Unknown';
      const classKey = period.classArmId || period.classId || 'unknown';
      
      workload.classIds.add(classKey);
      const existingClass = workload.classPeriods.get(classKey) || { name: className, count: 0 };
      existingClass.count++;
      workload.classPeriods.set(classKey, existingClass);
    });

    // Determine workload status
    const getStatus = (periods: number): 'LOW' | 'NORMAL' | 'HIGH' | 'OVERLOADED' => {
      if (periods < this.WORKLOAD_THRESHOLDS.LOW) return 'LOW';
      if (periods <= this.WORKLOAD_THRESHOLDS.NORMAL) return 'NORMAL';
      if (periods <= this.WORKLOAD_THRESHOLDS.HIGH) return 'HIGH';
      return 'OVERLOADED';
    };

    // Build result
    const teacherResults = teachers
      .map((teacher) => {
        const workload = teacherWorkloads.get(teacher.id);
        const totalPeriods = workload?.totalPeriods || 0;
        
        return {
          teacherId: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          totalPeriods,
          classCount: workload?.classIds.size || 0,
          subjectCount: workload?.subjectIds.size || 0,
          periodsBySubject: Object.fromEntries(workload?.subjectPeriods || new Map()),
          periodsByClass: Object.fromEntries(workload?.classPeriods || new Map()),
          status: getStatus(totalPeriods),
        };
      })
      .filter(t => t.totalPeriods > 0) // Only include teachers with assignments
      .sort((a, b) => b.totalPeriods - a.totalPeriods); // Sort by workload desc

    // Calculate average
    const totalPeriods = teacherResults.reduce((sum, t) => sum + t.totalPeriods, 0);
    const averagePeriods = teacherResults.length > 0 ? totalPeriods / teacherResults.length : 0;

    // Build warnings
    const warnings = teacherResults
      .filter(t => t.status === 'HIGH' || t.status === 'OVERLOADED')
      .map(t => ({
        teacherId: t.teacherId,
        teacherName: `${t.firstName} ${t.lastName}`,
        periodCount: t.totalPeriods,
        status: t.status,
        message: t.status === 'OVERLOADED'
          ? `${t.firstName} ${t.lastName} has ${t.totalPeriods} periods - consider redistributing workload`
          : `${t.firstName} ${t.lastName} has ${t.totalPeriods} periods - approaching maximum capacity`,
      }));

    // Find subjects without competent teachers
    const subjectsWhere: any = {
      schoolId: school.id,
      isActive: true,
    };
    if (schoolType) {
      subjectsWhere.schoolType = schoolType;
    }

    const subjectsWithoutTeachers = await this.subjectModel.findMany({
      where: {
        ...subjectsWhere,
        subjectTeachers: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const unassignedSubjects = subjectsWithoutTeachers.map((s: any) => ({
      subjectId: s.id,
      subjectName: s.name,
      message: `No teachers assigned to ${s.name}. Add competent teachers before generating timetables.`,
    }));

    return {
      teachers: teacherResults,
      averagePeriods: Math.round(averagePeriods * 10) / 10,
      warnings,
      unassignedSubjects,
    };
  }

  /**
   * Get the least loaded teacher for a subject (for auto-assignment)
   * Used by timetable auto-generation to balance workload
   */
  async getLeastLoadedTeacherForSubject(
    schoolId: string,
    subjectId: string,
    termId: string,
    excludeTeacherIds: string[] = []
  ): Promise<{ id: string; firstName: string; lastName: string; periodCount: number } | null> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Get competent teachers for this subject
    const subjectTeachers = await this.prisma.subjectTeacher.findMany({
      where: {
        subjectId,
        teacherId: { notIn: excludeTeacherIds },
        teacher: {
          schoolId: school.id,
          isActive: true,
        },
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (subjectTeachers.length === 0) {
      return null;
    }

    // Get period counts for these teachers
    const teacherIds = subjectTeachers.map((st: any) => st.teacher.id);
    
    const periodCounts = await this.prisma.timetablePeriod.groupBy({
      by: ['teacherId'],
      where: {
        termId,
        teacherId: { in: teacherIds },
      },
      _count: { id: true },
    });

    const periodCountMap = new Map<string, number>();
    periodCounts.forEach((pc: any) => {
      periodCountMap.set(pc.teacherId, pc._count.id);
    });

    // Find teacher with lowest workload
    let leastLoaded = subjectTeachers[0];
    let minPeriods = periodCountMap.get(leastLoaded.teacher.id) || 0;

    subjectTeachers.forEach((st: any) => {
      const periods = periodCountMap.get(st.teacher.id) || 0;
      if (periods < minPeriods) {
        minPeriods = periods;
        leastLoaded = st;
      }
    });

    return {
      id: leastLoaded.teacher.id,
      firstName: leastLoaded.teacher.firstName,
      lastName: leastLoaded.teacher.lastName,
      periodCount: minPeriods,
    };
  }

  /**
   * Get classes assigned to a teacher based on timetable periods
   * This is used for SECONDARY schools where class assignment is derived from timetable
   */
  async getTeacherTimetableClasses(
    schoolId: string,
    teacherId: string,
    termId?: string
  ): Promise<{
    classes: Array<{
      classId: string;
      className: string;
      classLevel: string;
      subjects: Array<{
        subjectId: string;
        subjectName: string;
        periodCount: number;
      }>;
      totalPeriods: number;
    }>;
    totalPeriods: number;
    totalClasses: number;
    totalSubjects: number;
  }> {
    // Validate school
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Validate teacher - teacherId can be either the database id or the public teacherId field
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        OR: [
          { id: teacherId },
          { teacherId: teacherId },
        ],
        schoolId,
      },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher not found in this school');
    }

    // Get term filter
    let termFilter: any = {};
    if (termId) {
      termFilter.termId = termId;
    } else {
      // Get current active term - try SECONDARY first, then any active term
      let activeTerm = await this.prisma.term.findFirst({
        where: {
          academicSession: {
            is: {
              schoolId,
              status: 'ACTIVE',
              schoolType: 'SECONDARY',
            },
          },
          status: 'ACTIVE',
        },
        orderBy: { startDate: 'desc' },
      });
      
      // If no SECONDARY-specific term, get any active term for the school
      if (!activeTerm) {
        activeTerm = await this.prisma.term.findFirst({
          where: {
            academicSession: {
              is: {
                schoolId,
                status: 'ACTIVE',
              },
            },
            status: 'ACTIVE',
          },
          orderBy: { startDate: 'desc' },
        });
      }
      
      if (activeTerm) {
        termFilter.termId = activeTerm.id;
      }
    }

    // Get all periods for this teacher using the database ID
    const periods = await this.prisma.timetablePeriod.findMany({
      where: {
        teacherId: teacher.id,  // Use database ID, not the public ID
        type: 'LESSON',
        ...termFilter,
      },
      include: {
        subject: { select: { id: true, name: true } },
        classArm: {
          include: {
            classLevel: { select: { id: true, name: true, type: true } },
          },
        },
        class: { select: { id: true, name: true, classLevel: true, type: true } },
      },
    });

    // Group by class, then by subject
    const classMap = new Map<string, {
      classId: string;
      className: string;
      classLevel: string;
      classType: string;
      subjects: Map<string, { subjectId: string; subjectName: string; count: number }>;
    }>();

    periods.forEach((period: any) => {
      // Determine class info
      let classId: string;
      let className: string;
      let classLevel: string;
      let classType: string;

      if (period.classArm) {
        classId = period.classArm.id;
        className = `${period.classArm.classLevel.name} ${period.classArm.name}`;
        classLevel = period.classArm.classLevel.name;
        classType = period.classArm.classLevel.type;
      } else if (period.class) {
        classId = period.class.id;
        className = period.class.name;
        classLevel = period.class.classLevel || period.class.name;
        classType = period.class.type;
      } else {
        return; // Skip periods without class info
      }

      // Only include SECONDARY classes
      if (classType !== 'SECONDARY') return;

      if (!classMap.has(classId)) {
        classMap.set(classId, {
          classId,
          className,
          classLevel,
          classType,
          subjects: new Map(),
        });
      }

      const classData = classMap.get(classId)!;

      // Add subject
      if (period.subject) {
        const subjectId = period.subject.id;
        if (!classData.subjects.has(subjectId)) {
          classData.subjects.set(subjectId, {
            subjectId,
            subjectName: period.subject.name,
            count: 0,
          });
        }
        classData.subjects.get(subjectId)!.count++;
      }
    });

    // Convert to array format
    const classes = Array.from(classMap.values()).map((classData) => ({
      classId: classData.classId,
      className: classData.className,
      classLevel: classData.classLevel,
      subjects: Array.from(classData.subjects.values()).map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        periodCount: s.count,
      })),
      totalPeriods: Array.from(classData.subjects.values()).reduce((sum, s) => sum + s.count, 0),
    }));

    // Sort by class name
    classes.sort((a, b) => a.className.localeCompare(b.className));

    // Calculate totals
    const totalPeriods = classes.reduce((sum, c) => sum + c.totalPeriods, 0);
    const allSubjectIds = new Set<string>();
    classes.forEach((c) => c.subjects.forEach((s) => allSubjectIds.add(s.subjectId)));

    return {
      classes,
      totalPeriods,
      totalClasses: classes.length,
      totalSubjects: allSubjectIds.size,
    };
  }
}

