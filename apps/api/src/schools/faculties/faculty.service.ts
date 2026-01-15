import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolRepository } from '../domain/repositories/school.repository';
import {
  CreateFacultyDto,
  UpdateFacultyDto,
  FacultyDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  DepartmentDto,
  GenerateLevelsDto,
  DepartmentLevelDto,
} from '../dto/faculty.dto';

@Injectable()
export class FacultyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository
  ) {}

  // ============ FACULTY METHODS ============

  /**
   * Get all faculties for a school
   */
  async getFaculties(schoolId: string): Promise<FacultyDto[]> {
    const school = await this.validateSchoolTertiary(schoolId);

    const faculties = await this.prisma.faculty.findMany({
      where: { schoolId: school.id },
      include: {
        dean: {
          select: { firstName: true, lastName: true },
        },
        departments: {
          where: { isActive: true },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return faculties.map((faculty) => this.mapToFacultyDto(faculty));
  }

  /**
   * Get a single faculty by ID
   */
  async getFaculty(schoolId: string, facultyId: string): Promise<FacultyDto> {
    const school = await this.validateSchoolTertiary(schoolId);

    const faculty = await this.prisma.faculty.findFirst({
      where: { id: facultyId, schoolId: school.id },
      include: {
        dean: {
          select: { firstName: true, lastName: true },
        },
        departments: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    return this.mapToFacultyDto(faculty);
  }

  /**
   * Create a new faculty
   */
  async createFaculty(schoolId: string, dto: CreateFacultyDto): Promise<FacultyDto> {
    const school = await this.validateSchoolTertiary(schoolId);

    // Check for duplicate code
    const existing = await this.prisma.faculty.findFirst({
      where: { schoolId: school.id, code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Faculty with code "${dto.code}" already exists`);
    }

    // Validate dean if provided
    if (dto.deanId) {
      await this.validateTeacher(school.id, dto.deanId);
    }

    const faculty = await this.prisma.faculty.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        imageUrl: dto.imageUrl,
        schoolId: school.id,
        deanId: dto.deanId,
      },
      include: {
        dean: {
          select: { firstName: true, lastName: true },
        },
        departments: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    return this.mapToFacultyDto(faculty);
  }

  /**
   * Update a faculty
   */
  async updateFaculty(
    schoolId: string,
    facultyId: string,
    dto: UpdateFacultyDto
  ): Promise<FacultyDto> {
    const school = await this.validateSchoolTertiary(schoolId);

    const faculty = await this.prisma.faculty.findFirst({
      where: { id: facultyId, schoolId: school.id },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    // Check for duplicate code if updating
    if (dto.code && dto.code.toUpperCase() !== faculty.code) {
      const existing = await this.prisma.faculty.findFirst({
        where: {
          schoolId: school.id,
          code: dto.code.toUpperCase(),
          id: { not: facultyId },
        },
      });

      if (existing) {
        throw new ConflictException(`Faculty with code "${dto.code}" already exists`);
      }
    }

    // Validate dean if provided
    if (dto.deanId) {
      await this.validateTeacher(school.id, dto.deanId);
    }

    const updated = await this.prisma.faculty.update({
      where: { id: facultyId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.deanId !== undefined && { deanId: dto.deanId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        dean: {
          select: { firstName: true, lastName: true },
        },
        departments: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    return this.mapToFacultyDto(updated);
  }

  /**
   * Delete a faculty (only if no departments)
   */
  async deleteFaculty(schoolId: string, facultyId: string, force = false): Promise<void> {
    const school = await this.validateSchoolTertiary(schoolId);

    const faculty = await this.prisma.faculty.findFirst({
      where: { id: facultyId, schoolId: school.id },
      include: {
        departments: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
      },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    if (faculty.departments.length > 0 && !force) {
      throw new BadRequestException(
        `Cannot delete faculty with ${faculty.departments.length} active department(s). ` +
          `Delete departments first or use force delete.`
      );
    }

    // If force delete, set departments to inactive
    if (force && faculty.departments.length > 0) {
      // Get the ClassLevel model with bracket notation for reserved keyword
      await (this.prisma as any).classLevel.updateMany({
        where: {
          facultyId: facultyId,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    await this.prisma.faculty.delete({
      where: { id: facultyId },
    });
  }

  /**
   * Auto-generate common university faculties
   */
  async generateDefaultFaculties(
    schoolId: string
  ): Promise<{ created: number; skipped: number; message: string }> {
    const school = await this.validateSchoolTertiary(schoolId);

    const defaultFaculties = [
      { name: 'Faculty of Science', code: 'FOS', description: 'Natural and Physical Sciences' },
      { name: 'Faculty of Engineering', code: 'FOE', description: 'Engineering and Technology' },
      { name: 'Faculty of Arts', code: 'FOA', description: 'Humanities and Arts' },
      {
        name: 'Faculty of Social Sciences',
        code: 'FOSS',
        description: 'Social and Behavioral Sciences',
      },
      { name: 'Faculty of Law', code: 'FOL', description: 'Legal Studies' },
      { name: 'Faculty of Medicine', code: 'FOM', description: 'Medical and Health Sciences' },
      { name: 'Faculty of Education', code: 'FOED', description: 'Education and Teaching' },
      {
        name: 'Faculty of Management Sciences',
        code: 'FMS',
        description: 'Business and Management',
      },
      { name: 'Faculty of Agriculture', code: 'FOAG', description: 'Agricultural Sciences' },
      {
        name: 'Faculty of Environmental Sciences',
        code: 'FOES',
        description: 'Environmental Studies',
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const facultyData of defaultFaculties) {
      // Check if faculty with this code already exists
      const existing = await this.prisma.faculty.findFirst({
        where: { schoolId: school.id, code: facultyData.code },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.faculty.create({
        data: {
          ...facultyData,
          schoolId: school.id,
        },
      });
      created++;
    }

    return {
      created,
      skipped,
      message:
        created > 0
          ? `Successfully created ${created} facultie(s)${skipped > 0 ? `, ${skipped} already existed` : ''}`
          : 'All default faculties already exist',
    };
  }

  /**
   * Generate default departments for a specific faculty based on its type
   */
  async generateDepartmentsForFaculty(
    schoolId: string,
    facultyId: string
  ): Promise<{ created: number; skipped: number; message: string }> {
    const school = await this.validateSchoolTertiary(schoolId);

    const faculty = await this.prisma.faculty.findFirst({
      where: { id: facultyId, schoolId: school.id },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    // Map faculty codes to their default departments
    const defaultDepartmentsByFaculty: Record<
      string,
      Array<{ name: string; code: string; description?: string }>
    > = {
      // Faculty of Science
      FOS: [
        {
          name: 'Physics',
          code: 'PHY',
          description: 'Study of matter, energy, and their interactions',
        },
        {
          name: 'Chemistry',
          code: 'CHM',
          description: 'Study of composition, structure, and properties of matter',
        },
        {
          name: 'Mathematics',
          code: 'MTH',
          description: 'Study of numbers, quantities, and shapes',
        },
        {
          name: 'Computer Science',
          code: 'CSC',
          description: 'Study of computation and information processing',
        },
        {
          name: 'Biology',
          code: 'BIO',
          description: 'Study of living organisms and life processes',
        },
        {
          name: 'Biochemistry',
          code: 'BCH',
          description: 'Study of chemical processes in living organisms',
        },
        { name: 'Microbiology', code: 'MCB', description: 'Study of microorganisms' },
        {
          name: 'Statistics',
          code: 'STA',
          description: 'Collection, analysis, and interpretation of data',
        },
        {
          name: 'Industrial Chemistry',
          code: 'ICH',
          description: 'Application of chemistry in industry',
        },
      ],
      // Faculty of Engineering
      FOE: [
        {
          name: 'Civil Engineering',
          code: 'CVE',
          description: 'Design and construction of infrastructure',
        },
        {
          name: 'Mechanical Engineering',
          code: 'MEE',
          description: 'Design and manufacturing of mechanical systems',
        },
        {
          name: 'Electrical Engineering',
          code: 'EEE',
          description: 'Study of electricity and electronics',
        },
        {
          name: 'Chemical Engineering',
          code: 'CHE',
          description: 'Application of chemistry in industrial processes',
        },
        {
          name: 'Computer Engineering',
          code: 'CPE',
          description: 'Design and development of computer systems',
        },
        {
          name: 'Petroleum Engineering',
          code: 'PTE',
          description: 'Extraction and production of oil and gas',
        },
        {
          name: 'Agricultural Engineering',
          code: 'AGE',
          description: 'Engineering applications in agriculture',
        },
        {
          name: 'Systems Engineering',
          code: 'SYE',
          description: 'Design and management of complex systems',
        },
      ],
      // Faculty of Arts
      FOA: [
        {
          name: 'English & Literary Studies',
          code: 'ELS',
          description: 'Study of English language and literature',
        },
        {
          name: 'History & International Studies',
          code: 'HIS',
          description: 'Study of past events and global relations',
        },
        {
          name: 'Philosophy',
          code: 'PHL',
          description: 'Study of fundamental questions about existence and knowledge',
        },
        {
          name: 'Religious Studies',
          code: 'REL',
          description: 'Study of religious beliefs and practices',
        },
        { name: 'Theatre Arts', code: 'THA', description: 'Performance and dramatic arts' },
        { name: 'Music', code: 'MUS', description: 'Study of musical theory and performance' },
        { name: 'Fine & Applied Arts', code: 'FAA', description: 'Visual arts and design' },
        { name: 'Linguistics', code: 'LIN', description: 'Scientific study of language' },
        { name: 'French', code: 'FRE', description: 'French language and literature' },
      ],
      // Faculty of Social Sciences
      FOSS: [
        { name: 'Political Science', code: 'POL', description: 'Study of politics and government' },
        {
          name: 'Economics',
          code: 'ECO',
          description: 'Study of production and consumption of goods',
        },
        {
          name: 'Sociology',
          code: 'SOC',
          description: 'Study of human society and social behavior',
        },
        { name: 'Psychology', code: 'PSY', description: 'Study of mind and behavior' },
        {
          name: 'Mass Communication',
          code: 'MAC',
          description: 'Study of media and communication',
        },
        {
          name: 'Geography',
          code: 'GEO',
          description: 'Study of places and relationships between people and environments',
        },
        {
          name: 'Social Work',
          code: 'SWK',
          description: 'Practice of helping individuals and communities',
        },
      ],
      // Faculty of Law
      FOL: [
        {
          name: 'Private & Property Law',
          code: 'PPL',
          description: 'Law relating to private matters and property',
        },
        {
          name: 'Public & International Law',
          code: 'PIL',
          description: 'Constitutional and international law',
        },
        { name: 'Commercial Law', code: 'CML', description: 'Law relating to commerce and trade' },
        { name: 'Jurisprudence', code: 'JUR', description: 'Theory and philosophy of law' },
      ],
      // Faculty of Medicine
      FOM: [
        {
          name: 'Medicine & Surgery',
          code: 'MBS',
          description: 'Medical practice and surgical procedures',
        },
        { name: 'Nursing Science', code: 'NUR', description: 'Patient care and nursing practice' },
        { name: 'Pharmacy', code: 'PHM', description: 'Preparation and dispensing of drugs' },
        { name: 'Anatomy', code: 'ANA', description: 'Study of body structure' },
        { name: 'Physiology', code: 'PHY', description: 'Study of body functions' },
        {
          name: 'Medical Laboratory Science',
          code: 'MLS',
          description: 'Laboratory diagnosis and testing',
        },
        { name: 'Dentistry', code: 'DEN', description: 'Oral health and dental care' },
        {
          name: 'Public Health',
          code: 'PUH',
          description: 'Population health and disease prevention',
        },
      ],
      // Faculty of Education
      FOED: [
        {
          name: 'Educational Management',
          code: 'EDM',
          description: 'Administration of educational institutions',
        },
        {
          name: 'Curriculum & Instruction',
          code: 'CUI',
          description: 'Design and delivery of educational content',
        },
        {
          name: 'Educational Psychology',
          code: 'EDP',
          description: 'Psychology applied to education',
        },
        {
          name: 'Guidance & Counselling',
          code: 'GCO',
          description: 'Student guidance and counseling',
        },
        { name: 'Science Education', code: 'SCE', description: 'Teaching of science subjects' },
        { name: 'Arts Education', code: 'ARE', description: 'Teaching of arts and humanities' },
        {
          name: 'Special Education',
          code: 'SPE',
          description: 'Education for students with special needs',
        },
        { name: 'Adult Education', code: 'ADE', description: 'Education for adult learners' },
      ],
      // Faculty of Management Sciences
      FMS: [
        {
          name: 'Business Administration',
          code: 'BUS',
          description: 'General business management',
        },
        { name: 'Accounting', code: 'ACC', description: 'Financial accounting and reporting' },
        { name: 'Banking & Finance', code: 'BNF', description: 'Financial services and banking' },
        { name: 'Marketing', code: 'MKT', description: 'Product promotion and sales' },
        {
          name: 'Public Administration',
          code: 'PUA',
          description: 'Government and public sector management',
        },
        { name: 'Entrepreneurship', code: 'ENT', description: 'Business creation and innovation' },
        {
          name: 'Human Resource Management',
          code: 'HRM',
          description: 'Personnel management and development',
        },
        { name: 'Insurance', code: 'INS', description: 'Risk management and insurance' },
      ],
      // Faculty of Agriculture
      FOAG: [
        {
          name: 'Agricultural Economics',
          code: 'AEC',
          description: 'Economics of agricultural production',
        },
        { name: 'Soil Science', code: 'SOS', description: 'Study of soil and land use' },
        { name: 'Crop Science', code: 'CRS', description: 'Study of crop production' },
        { name: 'Animal Science', code: 'ANS', description: 'Study of livestock production' },
        {
          name: 'Fisheries & Aquaculture',
          code: 'FIS',
          description: 'Fish production and management',
        },
        { name: 'Forestry & Wildlife', code: 'FOR', description: 'Forest and wildlife management' },
        {
          name: 'Agricultural Extension',
          code: 'AEX',
          description: 'Agricultural knowledge dissemination',
        },
        {
          name: 'Food Science & Technology',
          code: 'FST',
          description: 'Food processing and preservation',
        },
      ],
      // Faculty of Environmental Sciences
      FOES: [
        { name: 'Architecture', code: 'ARC', description: 'Design of buildings and structures' },
        {
          name: 'Urban & Regional Planning',
          code: 'URP',
          description: 'City and regional development planning',
        },
        {
          name: 'Estate Management',
          code: 'ESM',
          description: 'Property and real estate management',
        },
        {
          name: 'Building Technology',
          code: 'BLD',
          description: 'Construction methods and techniques',
        },
        {
          name: 'Surveying & Geoinformatics',
          code: 'SVG',
          description: 'Land measurement and mapping',
        },
        { name: 'Quantity Surveying', code: 'QTS', description: 'Construction cost management' },
        {
          name: 'Environmental Management',
          code: 'ENM',
          description: 'Environmental protection and sustainability',
        },
      ],
    };

    // Try to match faculty code, or use a generic default
    let departmentsToCreate = defaultDepartmentsByFaculty[faculty.code];

    // If no exact match, try to infer from name
    if (!departmentsToCreate) {
      const facultyNameLower = faculty.name.toLowerCase();
      if (
        facultyNameLower.includes('science') &&
        !facultyNameLower.includes('social') &&
        !facultyNameLower.includes('management') &&
        !facultyNameLower.includes('environmental')
      ) {
        departmentsToCreate = defaultDepartmentsByFaculty['FOS'];
      } else if (facultyNameLower.includes('engineering')) {
        departmentsToCreate = defaultDepartmentsByFaculty['FOE'];
      } else if (facultyNameLower.includes('art')) {
        departmentsToCreate = defaultDepartmentsByFaculty['FOA'];
      } else if (facultyNameLower.includes('social')) {
        departmentsToCreate = defaultDepartmentsByFaculty['FOSS'];
      } else if (facultyNameLower.includes('law')) {
        departmentsToCreate = defaultDepartmentsByFaculty['FOL'];
      } else if (facultyNameLower.includes('medicine') || facultyNameLower.includes('health')) {
        departmentsToCreate = defaultDepartmentsByFaculty['FOM'];
      } else if (facultyNameLower.includes('education')) {
        departmentsToCreate = defaultDepartmentsByFaculty['FOED'];
      } else if (facultyNameLower.includes('management') || facultyNameLower.includes('business')) {
        departmentsToCreate = defaultDepartmentsByFaculty['FMS'];
      } else if (facultyNameLower.includes('agriculture')) {
        departmentsToCreate = defaultDepartmentsByFaculty['FOAG'];
      } else if (facultyNameLower.includes('environmental')) {
        departmentsToCreate = defaultDepartmentsByFaculty['FOES'];
      }
    }

    // If still no match, create a generic department
    if (!departmentsToCreate || departmentsToCreate.length === 0) {
      departmentsToCreate = [
        {
          name: 'General Studies',
          code: 'GNS',
          description: 'General studies and interdisciplinary programs',
        },
      ];
    }

    // Get max level for ordering
    const maxLevel = await (this.prisma as any).classLevel.aggregate({
      where: { schoolId: school.id, type: 'TERTIARY' },
      _max: { level: true },
    });

    let created = 0;
    let skipped = 0;
    let currentLevel = maxLevel._max?.level || 0;

    for (const deptData of departmentsToCreate) {
      // Check if department with this code already exists
      const existing = await (this.prisma as any).classLevel.findFirst({
        where: { schoolId: school.id, code: deptData.code },
      });

      if (existing) {
        skipped++;
        continue;
      }

      currentLevel++;
      await (this.prisma as any).classLevel.create({
        data: {
          name: deptData.name,
          code: deptData.code,
          description: deptData.description,
          type: 'TERTIARY',
          level: currentLevel,
          schoolId: school.id,
          facultyId: faculty.id,
        },
      });
      created++;
    }

    return {
      created,
      skipped,
      message:
        created > 0
          ? `Successfully created ${created} department(s) for ${faculty.name}${skipped > 0 ? `, ${skipped} already existed` : ''}`
          : 'All default departments for this faculty already exist',
    };
  }

  // ============ DEPARTMENT METHODS ============

  /**
   * Get all departments for a school (optionally filtered by faculty)
   */
  async getDepartments(schoolId: string, facultyId?: string): Promise<DepartmentDto[]> {
    const school = await this.validateSchoolTertiary(schoolId);

    const departments = await (this.prisma as any).classLevel.findMany({
      where: {
        schoolId: school.id,
        type: 'TERTIARY',
        ...(facultyId && { facultyId }),
        isActive: true,
      },
      include: {
        faculty: {
          select: { name: true },
        },
        classArms: {
          where: { isActive: true },
          include: {
            enrollments: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
      },
      orderBy: [{ faculty: { name: 'asc' } }, { name: 'asc' }],
    });

    return departments.map((dept: any) => this.mapToDepartmentDto(dept));
  }

  /**
   * Get a single department by ID
   */
  async getDepartment(schoolId: string, departmentId: string): Promise<DepartmentDto> {
    const school = await this.validateSchoolTertiary(schoolId);

    const department = await (this.prisma as any).classLevel.findFirst({
      where: {
        id: departmentId,
        schoolId: school.id,
        type: 'TERTIARY',
      },
      include: {
        faculty: {
          select: { name: true },
        },
        classArms: {
          where: { isActive: true },
          include: {
            enrollments: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return this.mapToDepartmentDto(department);
  }

  /**
   * Get levels (ClassArms) for a department
   */
  async getDepartmentLevels(schoolId: string, departmentId: string): Promise<DepartmentLevelDto[]> {
    const school = await this.validateSchoolTertiary(schoolId);

    const department = await this.prisma.classLevel.findFirst({
      where: {
        id: departmentId,
        schoolId: school.id,
        type: 'TERTIARY',
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const levels = await this.prisma.classArm.findMany({
      where: {
        classLevelId: departmentId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get enrollment counts for each level
    const levelsWithCounts = await Promise.all(
      levels.map(async (level) => {
        const studentsCount = await this.prisma.enrollment.count({
          where: {
            classArmId: level.id,
            isActive: true,
          },
        });
        return {
          id: level.id,
          name: level.name,
          academicYear: level.academicYear,
          studentsCount,
          isActive: level.isActive,
          createdAt: level.createdAt,
        };
      })
    );

    return levelsWithCounts;
  }

  /**
   * Get single level (ClassArm) details
   */
  async getLevel(schoolId: string, levelId: string): Promise<any> {
    const school = await this.validateSchoolTertiary(schoolId);

    const level = await this.prisma.classArm.findFirst({
      where: {
        id: levelId,
        isActive: true,
        classLevel: {
          schoolId: school.id,
          type: 'TERTIARY',
        },
      },
      include: {
        classLevel: {
          include: {
            faculty: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!level) {
      throw new NotFoundException('Level not found');
    }

    // Get counts
    const [studentsCount, coursesCount] = await Promise.all([
      this.prisma.enrollment.count({
        where: { classArmId: levelId, isActive: true },
      }),
      this.prisma.subject.count({
        where: { classLevelId: level.classLevelId, isActive: true },
      }),
    ]);

    return {
      id: level.id,
      name: level.name,
      academicYear: level.academicYear,
      isActive: level.isActive,
      departmentId: level.classLevelId,
      departmentName: level.classLevel.name,
      departmentCode: level.classLevel.code,
      facultyId: level.classLevel.faculty?.id,
      facultyName: level.classLevel.faculty?.name,
      studentsCount,
      coursesCount,
      createdAt: level.createdAt,
    };
  }

  /**
   * Get students enrolled in a level
   */
  async getLevelStudents(schoolId: string, levelId: string): Promise<any[]> {
    const school = await this.validateSchoolTertiary(schoolId);

    // Validate level exists
    const level = await this.prisma.classArm.findFirst({
      where: {
        id: levelId,
        classLevel: {
          schoolId: school.id,
          type: 'TERTIARY',
        },
      },
    });

    if (!level) {
      throw new NotFoundException('Level not found');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classArmId: levelId,
        isActive: true,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                accountStatus: true,
              },
            },
          },
        },
      },
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });

    return enrollments.map((enrollment) => ({
      id: enrollment.student.id,
      uid: enrollment.student.uid,
      firstName: enrollment.student.firstName,
      lastName: enrollment.student.lastName,
      middleName: enrollment.student.middleName,
      profileImage: enrollment.student.profileImage,
      enrollmentId: enrollment.id,
      enrollmentDate: enrollment.enrollmentDate,
      classLevel: enrollment.classLevel,
      academicYear: enrollment.academicYear,
      user: enrollment.student.user,
    }));
  }

  /**
   * Get courses/subjects for a level
   */
  async getLevelCourses(schoolId: string, levelId: string): Promise<any[]> {
    const school = await this.validateSchoolTertiary(schoolId);

    // Validate level exists and get department
    const level = await this.prisma.classArm.findFirst({
      where: {
        id: levelId,
        classLevel: {
          schoolId: school.id,
          type: 'TERTIARY',
        },
      },
      include: {
        classLevel: true,
      },
    });

    if (!level) {
      throw new NotFoundException('Level not found');
    }

    // Get subjects for the department (ClassLevel)
    const subjects = await this.prisma.subject.findMany({
      where: {
        classLevelId: level.classLevelId,
        isActive: true,
      },
      include: {
        subjectTeachers: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      description: subject.description,
      teachers: subject.subjectTeachers.map((st: any) => ({
        id: st.teacher.id,
        name: `${st.teacher.firstName} ${st.teacher.lastName}`,
      })),
    }));
  }

  /**
   * Get timetable for a level
   */
  async getLevelTimetable(schoolId: string, levelId: string, termId: string): Promise<any[]> {
    const school = await this.validateSchoolTertiary(schoolId);

    // Validate level exists
    const level = await this.prisma.classArm.findFirst({
      where: {
        id: levelId,
        classLevel: {
          schoolId: school.id,
          type: 'TERTIARY',
        },
      },
    });

    if (!level) {
      throw new NotFoundException('Level not found');
    }

    const periods = await this.prisma.timetablePeriod.findMany({
      where: {
        classArmId: levelId,
        termId,
      },
      include: {
        subject: {
          select: { id: true, name: true, code: true },
        },
        course: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
        room: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return periods.map((period) => ({
      id: period.id,
      dayOfWeek: period.dayOfWeek,
      startTime: period.startTime,
      endTime: period.endTime,
      type: period.type,
      subjectId: period.subjectId,
      subjectName: period.subject?.name || period.course?.name || '',
      subjectCode: period.subject?.code || '',
      teacherId: period.teacherId,
      teacherName: period.teacher ? `${period.teacher.firstName} ${period.teacher.lastName}` : '',
      roomId: period.roomId,
      roomName: period.room?.name || '',
    }));
  }

  /**
   * Get curriculum for a level
   */
  async getLevelCurriculum(schoolId: string, levelId: string): Promise<any[]> {
    const school = await this.validateSchoolTertiary(schoolId);

    // Validate level exists
    const level = await this.prisma.classArm.findFirst({
      where: {
        id: levelId,
        classLevel: {
          schoolId: school.id,
          type: 'TERTIARY',
        },
      },
    });

    if (!level) {
      throw new NotFoundException('Level not found');
    }

    // Get curriculum for the department (ClassLevel)
    const curricula = await this.prisma.curriculum.findMany({
      where: {
        classLevelId: level.classLevelId,
        isActive: true,
      },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
        items: {
          orderBy: { weekNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return curricula.map((curriculum) => ({
      id: curriculum.id,
      subject: curriculum.subject,
      academicYear: curriculum.academicYear,
      teacher: curriculum.teacher
        ? `${curriculum.teacher.firstName} ${curriculum.teacher.lastName}`
        : null,
      teacherId: curriculum.teacherId,
      itemsCount: curriculum.items.length,
      items: curriculum.items,
      createdAt: curriculum.createdAt,
    }));
  }

  /**
   * Get resources for a level
   */
  async getLevelResources(schoolId: string, levelId: string): Promise<any[]> {
    const school = await this.validateSchoolTertiary(schoolId);

    // Validate level exists
    const level = await this.prisma.classArm.findFirst({
      where: {
        id: levelId,
        classLevel: {
          schoolId: school.id,
          type: 'TERTIARY',
        },
      },
    });

    if (!level) {
      throw new NotFoundException('Level not found');
    }

    const resources = await this.prisma.classResource.findMany({
      where: {
        classArm: {
          id: levelId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch user profile details for uploadedBy fields
    // Try to get name from SchoolAdmin or TeacherProfile
    const userIds = [...new Set(resources.map((r) => r.uploadedBy))];
    const [schoolAdmins, teachers] = await Promise.all([
      this.prisma.schoolAdmin.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, firstName: true, lastName: true },
      }),
      this.prisma.teacher.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, firstName: true, lastName: true },
      }),
    ]);
    
    const nameMap = new Map<string, string>();
    schoolAdmins.forEach((admin) => {
      nameMap.set(admin.userId, `${admin.firstName} ${admin.lastName}`);
    });
    teachers.forEach((teacher) => {
      nameMap.set(teacher.userId, `${teacher.firstName} ${teacher.lastName}`);
    });

    return resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      fileName: resource.fileName,
      filePath: resource.filePath,
      fileSize: resource.fileSize,
      mimeType: resource.mimeType,
      fileType: resource.fileType,
      description: resource.description,
      uploadedBy: nameMap.get(resource.uploadedBy) || null,
      createdAt: resource.createdAt,
    }));
  }

  /**
   * Create a new department
   */
  async createDepartment(schoolId: string, dto: CreateDepartmentDto): Promise<DepartmentDto> {
    const school = await this.validateSchoolTertiary(schoolId);

    // Validate faculty exists
    const faculty = await this.prisma.faculty.findFirst({
      where: { id: dto.facultyId, schoolId: school.id },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    // Check for duplicate code
    const existing = await (this.prisma as any).classLevel.findFirst({
      where: { schoolId: school.id, code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Department with code "${dto.code}" already exists`);
    }

    // Get max level for ordering
    const maxLevel = await (this.prisma as any).classLevel.aggregate({
      where: { schoolId: school.id, type: 'TERTIARY' },
      _max: { level: true },
    });

    const department = await (this.prisma as any).classLevel.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        imageUrl: dto.imageUrl,
        type: 'TERTIARY',
        level: (maxLevel._max?.level || 0) + 1,
        schoolId: school.id,
        facultyId: dto.facultyId,
      },
      include: {
        faculty: {
          select: { name: true },
        },
        classArms: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    return this.mapToDepartmentDto(department);
  }

  /**
   * Update a department
   */
  async updateDepartment(
    schoolId: string,
    departmentId: string,
    dto: UpdateDepartmentDto
  ): Promise<DepartmentDto> {
    const school = await this.validateSchoolTertiary(schoolId);

    const department = await (this.prisma as any).classLevel.findFirst({
      where: { id: departmentId, schoolId: school.id, type: 'TERTIARY' },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Validate faculty if provided
    if (dto.facultyId) {
      const faculty = await this.prisma.faculty.findFirst({
        where: { id: dto.facultyId, schoolId: school.id },
      });
      if (!faculty) {
        throw new NotFoundException('Faculty not found');
      }
    }

    // Check for duplicate code if updating
    if (dto.code && dto.code.toUpperCase() !== department.code) {
      const existing = await (this.prisma as any).classLevel.findFirst({
        where: {
          schoolId: school.id,
          code: dto.code.toUpperCase(),
          id: { not: departmentId },
        },
      });

      if (existing) {
        throw new ConflictException(`Department with code "${dto.code}" already exists`);
      }
    }

    const updated = await (this.prisma as any).classLevel.update({
      where: { id: departmentId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.facultyId && { facultyId: dto.facultyId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        faculty: {
          select: { name: true },
        },
        classArms: {
          where: { isActive: true },
          include: {
            enrollments: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
      },
    });

    return this.mapToDepartmentDto(updated);
  }

  /**
   * Delete a department
   */
  async deleteDepartment(schoolId: string, departmentId: string, force = false): Promise<void> {
    const school = await this.validateSchoolTertiary(schoolId);

    const department = await (this.prisma as any).classLevel.findFirst({
      where: { id: departmentId, schoolId: school.id, type: 'TERTIARY' },
      include: {
        classArms: {
          where: { isActive: true },
          include: {
            enrollments: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const totalStudents = department.classArms.reduce(
      (sum: number, arm: any) => sum + arm.enrollments.length,
      0
    );

    if (totalStudents > 0 && !force) {
      throw new BadRequestException(
        `Cannot delete department with ${totalStudents} enrolled student(s). ` +
          `Transfer students first or use force delete.`
      );
    }

    // If force delete, deactivate enrollments
    if (force && totalStudents > 0) {
      for (const arm of department.classArms) {
        await this.prisma.enrollment.updateMany({
          where: { classArmId: arm.id, isActive: true },
          data: { isActive: false },
        });
      }
    }

    // Delete class arms first
    await (this.prisma as any).classArm.deleteMany({
      where: { classLevelId: departmentId },
    });

    // Delete department (ClassLevel)
    await (this.prisma as any).classLevel.delete({
      where: { id: departmentId },
    });
  }

  /**
   * Generate default levels for a department (100L, 200L, 300L, 400L, etc.)
   */
  async generateLevels(
    schoolId: string,
    departmentId: string,
    dto?: GenerateLevelsDto
  ): Promise<{ created: number; message: string }> {
    const school = await this.validateSchoolTertiary(schoolId);

    const department = await (this.prisma as any).classLevel.findFirst({
      where: { id: departmentId, schoolId: school.id, type: 'TERTIARY' },
      include: {
        classArms: {
          where: { isActive: true },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (department.classArms.length > 0) {
      throw new ConflictException(
        `Department already has ${department.classArms.length} level(s). Delete them first to regenerate.`
      );
    }

    const levelCount = dto?.levelCount || 4;
    const now = new Date();
    const year = now.getFullYear();
    const academicYear = now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;

    const levelsToCreate = [];
    for (let i = 1; i <= levelCount; i++) {
      levelsToCreate.push({
        name: `${i * 100} Level`,
        classLevelId: departmentId,
        academicYear,
        isActive: true,
      });
    }

    await (this.prisma as any).classArm.createMany({
      data: levelsToCreate,
    });

    return {
      created: levelCount,
      message: `Successfully created ${levelCount} levels (100L - ${levelCount * 100}L)`,
    };
  }

  // ============ HELPER METHODS ============

  /**
   * Validate school exists and has tertiary
   */
  private async validateSchoolTertiary(schoolId: string) {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }
    if (!school.hasTertiary) {
      throw new BadRequestException(
        'This school does not have tertiary level. Faculties are only available for tertiary institutions.'
      );
    }
    return school;
  }

  /**
   * Validate teacher exists in school
   */
  private async validateTeacher(schoolId: string, teacherId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, schoolId },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher not found in this school');
    }
    return teacher;
  }

  /**
   * Map Prisma faculty to DTO
   */
  private mapToFacultyDto(faculty: any): FacultyDto {
    return {
      id: faculty.id,
      name: faculty.name,
      code: faculty.code,
      description: faculty.description,
      imageUrl: faculty.imageUrl,
      schoolId: faculty.schoolId,
      deanId: faculty.deanId,
      deanName: faculty.dean ? `${faculty.dean.firstName} ${faculty.dean.lastName}` : undefined,
      isActive: faculty.isActive,
      departmentsCount: faculty.departments?.length || 0,
      createdAt: faculty.createdAt,
      updatedAt: faculty.updatedAt,
    };
  }

  /**
   * Map Prisma ClassLevel (department) to DTO
   */
  private mapToDepartmentDto(dept: any): DepartmentDto {
    const studentsCount =
      dept.classArms?.reduce((sum: number, arm: any) => sum + (arm.enrollments?.length || 0), 0) ||
      0;

    return {
      id: dept.id,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      imageUrl: dept.imageUrl,
      schoolId: dept.schoolId,
      facultyId: dept.facultyId,
      facultyName: dept.faculty?.name,
      isActive: dept.isActive,
      levelsCount: dept.classArms?.length || 0,
      studentsCount,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
    };
  }
}
