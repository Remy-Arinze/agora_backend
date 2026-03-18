import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiService } from './ai.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class KnowledgeIndexingService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeIndexingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async onModuleInit() {
    this.logger.log('Knowledge Indexing Service initialized');
    // We could trigger an initial sync here if needed
  }

  /**
   * Sync a specific student's data into the knowledge base
   */
  async indexStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        enrollments: {
          include: {
            school: true,
            grades: {
              take: 50,
              orderBy: { signedAt: 'desc' }
            },
            attendances: {
              take: 50,
              orderBy: { date: 'desc' }
            }
          }
        }
      }
    });

    if (!student) return;

    for (const enrollment of student.enrollments) {
      const schoolId = enrollment.schoolId;
      
      // Group grades by subject for better chunking
      const subjects = [...new Set(enrollment.grades.map(g => g.subject))];
      
      for (const subject of subjects) {
        const subjectGrades = enrollment.grades.filter(g => g.subject === subject);
        const gradesText = subjectGrades
          .map(g => `${g.score}/${g.maxScore} (${g.gradeType}) on ${g.signedAt.toLocaleDateString()}`)
          .join(', ');

        const content = `
          Student: ${student.firstName} ${student.lastName}
          Subject: ${subject}
          Grade Level: ${enrollment.classLevel}
          Academic Performance: ${gradesText}
          Recent Attendance: ${enrollment.attendances.slice(0, 10).map(a => `${a.date.toLocaleDateString()}: ${a.status}`).join('; ')}
        `.trim();

        await this.upsertKnowledgeChunk(
          schoolId,
          `student_perf_${student.id}_${subject}_${enrollment.id}`,
          content,
          { 
            type: 'student_progress', 
            studentId: student.id, 
            subject,
            timestamp: new Date().toISOString(),
            permissions: {
              roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
              allowedStudentId: student.id,
              allowedClassLevel: enrollment.classLevel
            } 
          }
        );
      }
    }
  }

  /**
   * Sync class and curriculum data
   */
  async indexClass(classId: string) {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        curricula: {
          include: {
            subjectRef: true,
            items: {
              orderBy: { weekNumber: 'asc' }
            }
          }
        },
        school: true
      }
    });

    if (!classData) return;

    for (const curriculum of classData.curricula) {
      const subjectName = curriculum.subjectRef?.name || curriculum.subject || 'N/A';
      
      // Chunk curriculum by months or terms for better retrieval
      const chunkedItems = this.chunkArray(curriculum.items, 5);
      
      for (const [index, items] of chunkedItems.entries()) {
        const curriculumText = items
          .map(i => `Week ${i.weekNumber}: ${i.topic}. Topics: ${i.subTopics.join(', ')}. Objectives: ${i.objectives.join(', ')}`)
          .join('\n');

        const content = `
          School: ${classData.school.name}
          Class: ${classData.name} (${classData.classLevel})
          Subject: ${subjectName}
          Curriculum Plan (Part ${index + 1}):
          ${curriculumText}
        `.trim();

        await this.upsertKnowledgeChunk(
          classData.schoolId,
          `class_curr_${classData.id}_${curriculum.id}_${index}`,
          content,
          { 
            type: 'curriculum', 
            classId: classData.id, 
            subject: subjectName,
            timestamp: new Date().toISOString(),
            permissions: {
              roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
              isPublic: false,
              allowedClassId: classData.id
            } 
          }
        );
      }
    }
  }

  /**
   * Index teacher-created assessments
   */
  async indexAssessment(assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        teacher: true,
        class: true,
        subject: true,
        questions: true
      }
    });

    if (!assessment) return;

    const questionsText = assessment.questions
      .map((q, i) => `${i + 1}. ${q.text} (${q.type})`)
      .join('\n');

    const content = `
      Teacher: ${assessment.teacher.firstName} ${assessment.teacher.lastName}
      Subject: ${assessment.subject.name}
      Assessment: ${assessment.title}
      Type: ${assessment.type}
      Grade Level: ${assessment.class?.classLevel || 'N/A'}
      Description: ${assessment.description || 'N/A'}
      Questions Summary:
      ${questionsText}
    `.trim();

    await this.upsertKnowledgeChunk(
      assessment.schoolId,
      `assessment_${assessment.id}`,
      content,
      {
        type: 'assessment',
        teacherId: assessment.teacherId,
        title: assessment.title,
        subject: assessment.subject.name,
        timestamp: assessment.updatedAt.toISOString(),
        permissions: {
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
          isPublic: false,
          allowedTeacherId: assessment.teacherId,
          allowedClassId: assessment.classId
        }
      }
    );
  }

  /**
   * Index school general information and key analytics
   */
  async indexSchool(schoolId: string) {
    const [school, classCount, teacherCount, studentCount] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: schoolId },
        include: {
          academicSessions: {
            where: { status: 'ACTIVE' },
            include: { terms: { where: { status: 'ACTIVE' } } }
          }
        }
      }),
      this.prisma.class.count({ where: { schoolId } }),
      this.prisma.teacher.count({ where: { schoolId } }),
      this.prisma.enrollment.count({ where: { schoolId } })
    ]);

    if (!school) return;

    const session = school.academicSessions[0];
    const term = session?.terms[0];

    const content = `
      School Name: ${school.name}
      Location: ${school.address || 'N/A'}, ${school.city || 'N/A'}, ${school.state || 'N/A'}, ${school.country}
      Contact: ${school.email || 'N/A'}, ${school.phone || 'N/A'}
      Current Academic Session: ${session?.name || 'N/A'}
      Current Term: ${term?.name || 'N/A'}
      Educational Levels: ${[school.hasPrimary ? 'Primary' : '', school.hasSecondary ? 'Secondary' : '', school.hasTertiary ? 'Tertiary' : ''].filter(Boolean).join(', ')}
      
      SCHOOL ANALYTICS:
      - Total Classes: ${classCount}
      - Total Teachers: ${teacherCount}
      - Total Enrolled Students: ${studentCount}
    `.trim();

    await this.upsertKnowledgeChunk(
      schoolId,
      `school_profile_${schoolId}`,
      content,
      {
        type: 'school_info',
        timestamp: new Date().toISOString(),
        permissions: {
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT'],
          isPublic: true
        }
      }
    );
  }

  /**
   * Index teacher profile and assignments
   */
  async indexTeacher(teacherId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        school: true,
        classTeachers: {
          include: {
            class: true,
            classArm: true,
            subjectRef: true
          }
        }
      }
    });

    if (!teacher) return;

    const assignments = teacher.classTeachers.map(ct => {
      const className = ct.class?.name || ct.classArm?.name || 'N/A';
      return `- ${ct.subject || ct.subjectRef?.name || 'N/A'} for ${className}`;
    }).join('\n');

    const content = `
      Teacher: ${teacher.firstName} ${teacher.lastName}
      Email: ${teacher.email || 'N/A'}
      Phone: ${teacher.phone || 'N/A'}
      Staff ID: ${teacher.employeeId || teacher.teacherId}
      Specialization: ${teacher.subject || 'N/A'}
      Current Assignments:
      ${assignments || 'No active class assignments found.'}
    `.trim();

    await this.upsertKnowledgeChunk(
      teacher.schoolId,
      `teacher_profile_${teacher.id}`,
      content,
      {
        type: 'teacher_info',
        teacherId: teacher.id,
        timestamp: new Date().toISOString(),
        permissions: {
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
          isPublic: false,
          allowedTeacherId: teacher.id
        }
      }
    );
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (v, i) =>
      array.slice(i * size, i * size + size)
    );
  }

  /**
   * Index all students in a school (Background job)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncAllData() {
    this.logger.log('Starting daily knowledge indexing sync...');
    
    // 1. Sync Schools
    const schools = await this.prisma.school.findMany({ select: { id: true } });
    for (const school of schools) {
      try { await this.indexSchool(school.id); } catch (e) {}
    }

    // 2. Sync Teachers
    const teachers = await this.prisma.teacher.findMany({ select: { id: true } });
    for (const teacher of teachers) {
      try { await this.indexTeacher(teacher.id); } catch (e) {}
    }

    // 3. Sync Students
    const students = await this.prisma.student.findMany({ select: { id: true } });
    for (const student of students) {
      try {
        await this.indexStudent(student.id);
      } catch (error) {
        this.logger.error(`Failed to index student ${student.id}: ${error}`);
      }
    }
    this.logger.log('Finished daily knowledge indexing sync.');
  }

  /**
   * Manual trigger for a school's full sync
   */
  async syncSchool(schoolId: string) {
    this.logger.log(`Manual sync for school: ${schoolId}`);
    await this.indexSchool(schoolId);
    
    const teachers = await this.prisma.teacher.findMany({ where: { schoolId }, select: { id: true } });
    for (const t of teachers) await this.indexTeacher(t.id);
    
    const classes = await this.prisma.class.findMany({ where: { schoolId }, select: { id: true } });
    for (const c of classes) await this.indexClass(c.id);
  }

  private async upsertKnowledgeChunk(schoolId: string, externalId: string, content: string, metadata: any) {
    if (!this.aiService.isConfigured()) return;

    const embedding = await this.aiService.createEmbedding(content);
    const vectorString = `[${embedding.join(',')}]`;

    // Check if chunk exists
    const existing = await this.prisma.knowledgeChunk.findFirst({
      where: {
        schoolId,
        metadata: {
          path: ['externalId'],
          equals: externalId
        }
      }
    });

    const metadataWithId = { ...metadata, externalId };

    if (existing) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "KnowledgeChunk"
        SET "content" = $1, "metadata" = $2, "embedding" = $3::vector, "updatedAt" = NOW()
        WHERE "id" = $4
      `, content, JSON.stringify(metadataWithId), vectorString, existing.id);
    } else {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "KnowledgeChunk" ("id", "schoolId", "content", "metadata", "embedding", "updatedAt")
        VALUES ($1, $2, $3, $4, $5::vector, NOW())
      `, 
      `kc_${Math.random().toString(36).substring(2, 11)}`, 
      schoolId, 
      content, 
      JSON.stringify(metadataWithId), 
      vectorString
      );
    }
  }
}
