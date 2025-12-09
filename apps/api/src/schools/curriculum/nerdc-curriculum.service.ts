import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { 
  NerdcSubjectDto, 
  NerdcCurriculumDto, 
  NerdcCurriculumWeekDto,
  GetNerdcSubjectsQueryDto,
  getClassLevelCode,
} from './dto/nerdc-curriculum.dto';

@Injectable()
export class NerdcCurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Subject Operations
  // ============================================

  /**
   * Get all NERDC subjects, optionally filtered by school type
   */
  async getSubjects(query: GetNerdcSubjectsQueryDto): Promise<NerdcSubjectDto[]> {
    const subjects = await (this.prisma as any).nerdcSubject.findMany({
      where: {
        isActive: true,
        ...(query.schoolType && {
          schoolTypes: { has: query.schoolType },
        }),
        ...(query.category && {
          category: query.category,
        }),
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    return subjects.map(this.mapToSubjectDto);
  }

  /**
   * Get a single NERDC subject by code
   */
  async getSubjectByCode(code: string): Promise<NerdcSubjectDto | null> {
    const subject = await (this.prisma as any).nerdcSubject.findUnique({
      where: { code },
    });

    return subject ? this.mapToSubjectDto(subject) : null;
  }

  // ============================================
  // Curriculum Template Operations
  // ============================================

  /**
   * Get NERDC curriculum template for a specific subject, class level, and term
   */
  async getCurriculumTemplate(
    subjectCode: string,
    classLevelName: string,
    schoolType: string,
    term: number
  ): Promise<NerdcCurriculumDto | null> {
    // Convert class level name to code
    const classLevelCode = getClassLevelCode(classLevelName, schoolType);
    if (!classLevelCode) {
      return null;
    }

    // Find the subject first
    const subject = await (this.prisma as any).nerdcSubject.findFirst({
      where: {
        OR: [
          { code: subjectCode },
          { name: { contains: subjectCode, mode: 'insensitive' } },
        ],
        isActive: true,
      },
    });

    if (!subject) {
      return null;
    }

    // Find the curriculum
    const curriculum = await (this.prisma as any).nerdcCurriculum.findFirst({
      where: {
        subjectId: subject.id,
        classLevel: classLevelCode,
        term,
      },
      include: {
        subject: true,
        weeks: {
          orderBy: { weekNumber: 'asc' },
        },
      },
    });

    return curriculum ? this.mapToCurriculumDto(curriculum) : null;
  }

  /**
   * Get NERDC curriculum template by ID
   */
  async getCurriculumById(id: string): Promise<NerdcCurriculumDto | null> {
    const curriculum = await (this.prisma as any).nerdcCurriculum.findUnique({
      where: { id },
      include: {
        subject: true,
        weeks: {
          orderBy: { weekNumber: 'asc' },
        },
      },
    });

    return curriculum ? this.mapToCurriculumDto(curriculum) : null;
  }

  /**
   * Get NERDC curriculum template by subject ID and class level
   */
  async getCurriculumBySubjectAndLevel(
    subjectId: string,
    classLevel: string,
    term: number
  ): Promise<NerdcCurriculumDto | null> {
    const curriculum = await (this.prisma as any).nerdcCurriculum.findFirst({
      where: {
        subjectId,
        classLevel,
        term,
      },
      include: {
        subject: true,
        weeks: {
          orderBy: { weekNumber: 'asc' },
        },
      },
    });

    return curriculum ? this.mapToCurriculumDto(curriculum) : null;
  }

  /**
   * List all available curriculum templates
   */
  async listCurricula(filters?: {
    schoolType?: string;
    classLevel?: string;
    term?: number;
    subjectId?: string;
  }): Promise<NerdcCurriculumDto[]> {
    const where: any = {};

    if (filters?.classLevel) {
      where.classLevel = filters.classLevel;
    }

    if (filters?.term) {
      where.term = filters.term;
    }

    if (filters?.subjectId) {
      where.subjectId = filters.subjectId;
    }

    if (filters?.schoolType) {
      where.subject = {
        schoolTypes: { has: filters.schoolType },
      };
    }

    const curricula = await (this.prisma as any).nerdcCurriculum.findMany({
      where,
      include: {
        subject: true,
        weeks: {
          orderBy: { weekNumber: 'asc' },
        },
      },
      orderBy: [
        { classLevel: 'asc' },
        { term: 'asc' },
      ],
    });

    return curricula.map((c: any) => this.mapToCurriculumDto(c));
  }

  // ============================================
  // Admin Operations (for seeding/management)
  // ============================================

  /**
   * Create or update a NERDC subject
   */
  async upsertSubject(data: {
    code: string;
    name: string;
    category?: string;
    schoolTypes: string[];
    description?: string;
  }): Promise<NerdcSubjectDto> {
    const subject = await (this.prisma as any).nerdcSubject.upsert({
      where: { code: data.code },
      update: {
        name: data.name,
        category: data.category || null,
        schoolTypes: data.schoolTypes,
        description: data.description || null,
      },
      create: {
        code: data.code,
        name: data.name,
        category: data.category || null,
        schoolTypes: data.schoolTypes,
        description: data.description || null,
      },
    });

    return this.mapToSubjectDto(subject);
  }

  /**
   * Create or update a NERDC curriculum with weeks
   */
  async upsertCurriculum(data: {
    subjectCode: string;
    classLevel: string;
    term: number;
    description?: string;
    weeks: Array<{
      weekNumber: number;
      topic: string;
      subTopics?: string[];
      objectives: string[];
      activities?: string[];
      resources?: string[];
      assessment?: string;
      duration?: string;
    }>;
  }): Promise<NerdcCurriculumDto> {
    // Find subject
    const subject = await (this.prisma as any).nerdcSubject.findUnique({
      where: { code: data.subjectCode },
    });

    if (!subject) {
      throw new NotFoundException(`NERDC subject with code ${data.subjectCode} not found`);
    }

    // Check if curriculum exists
    const existing = await (this.prisma as any).nerdcCurriculum.findFirst({
      where: {
        subjectId: subject.id,
        classLevel: data.classLevel,
        term: data.term,
      },
    });

    let curriculum;

    if (existing) {
      // Update existing curriculum and replace weeks
      await (this.prisma as any).nerdcCurriculumWeek.deleteMany({
        where: { curriculumId: existing.id },
      });

      curriculum = await (this.prisma as any).nerdcCurriculum.update({
        where: { id: existing.id },
        data: {
          description: data.description || null,
          weeks: {
            create: data.weeks.map((w) => ({
              weekNumber: w.weekNumber,
              topic: w.topic,
              subTopics: w.subTopics || [],
              objectives: w.objectives,
              activities: w.activities || [],
              resources: w.resources || [],
              assessment: w.assessment || null,
              duration: w.duration || null,
            })),
          },
        },
        include: {
          subject: true,
          weeks: {
            orderBy: { weekNumber: 'asc' },
          },
        },
      });
    } else {
      // Create new curriculum
      curriculum = await (this.prisma as any).nerdcCurriculum.create({
        data: {
          subjectId: subject.id,
          classLevel: data.classLevel,
          term: data.term,
          description: data.description || null,
          weeks: {
            create: data.weeks.map((w) => ({
              weekNumber: w.weekNumber,
              topic: w.topic,
              subTopics: w.subTopics || [],
              objectives: w.objectives,
              activities: w.activities || [],
              resources: w.resources || [],
              assessment: w.assessment || null,
              duration: w.duration || null,
            })),
          },
        },
        include: {
          subject: true,
          weeks: {
            orderBy: { weekNumber: 'asc' },
          },
        },
      });
    }

    return this.mapToCurriculumDto(curriculum);
  }

  // ============================================
  // Mapping Methods
  // ============================================

  private mapToSubjectDto(subject: any): NerdcSubjectDto {
    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      category: subject.category,
      schoolTypes: subject.schoolTypes,
      description: subject.description,
      isActive: subject.isActive,
    };
  }

  private mapToCurriculumDto(curriculum: any): NerdcCurriculumDto {
    return {
      id: curriculum.id,
      classLevel: curriculum.classLevel,
      term: curriculum.term,
      description: curriculum.description,
      subject: this.mapToSubjectDto(curriculum.subject),
      weeks: curriculum.weeks?.map((w: any) => this.mapToWeekDto(w)) || [],
    };
  }

  private mapToWeekDto(week: any): NerdcCurriculumWeekDto {
    return {
      id: week.id,
      weekNumber: week.weekNumber,
      topic: week.topic,
      subTopics: week.subTopics || [],
      objectives: week.objectives || [],
      activities: week.activities || [],
      resources: week.resources || [],
      assessment: week.assessment,
      duration: week.duration,
    };
  }
}

