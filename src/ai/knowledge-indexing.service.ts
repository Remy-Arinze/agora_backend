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
              take: 20,
              orderBy: { signedAt: 'desc' }
            },
            attendances: {
              take: 20,
              orderBy: { date: 'desc' }
            }
          }
        }
      }
    });

    if (!student) return;

    for (const enrollment of student.enrollments) {
      const schoolId = enrollment.schoolId;
      
      // Construct a text representation for the student's progress
      const recentGrades = enrollment.grades
        .map(g => `${g.subject}: ${g.score}/${g.maxScore} (${g.gradeType}) on ${g.signedAt.toLocaleDateString()}`)
        .join(', ');
      
      const attendanceStats = `Total present: ${enrollment.attendances.filter(a => a.status === 'PRESENT').length} out of ${enrollment.attendances.length} recorded days.`;

      const content = `
        Student Name: ${student.firstName} ${student.lastName}
        Grade Level: ${enrollment.classLevel}
        Academic Year: ${enrollment.academicYear}
        Recent Performance: ${recentGrades || 'No recent grades recorded.'}
        Attendance Summary: ${attendanceStats}
      `.trim();

      // Define permission metadata
      // Teachers of this class and admins can see this
      const permissions = {
        roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
        allowedStudentId: student.id,
        allowedClassLevel: enrollment.classLevel
      };

      await this.upsertKnowledgeChunk(
        schoolId,
        `student_progress_${student.id}_${enrollment.id}`,
        content,
        { type: 'student_progress', studentId: student.id, enrollmentId: enrollment.id, permissions }
      );
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
              take: 5,
              orderBy: { weekNumber: 'asc' }
            }
          }
        },
        school: true
      }
    });

    if (!classData) return;

    const curriculumText = classData.curricula
      .map(c => `Subject: ${c.subjectRef?.name || c.subject || 'N/A'}. Academic Year: ${c.academicYear}. Status: ${c.status}. Topics: ${c.items.map(i => i.topic).join(', ')}`)
      .join('\n');

    const content = `
      Class Name: ${classData.name}
      Level: ${classData.classLevel}
      Academic Year: ${classData.academicYear}
      Details: ${classData.description || 'N/A'}
      ${curriculumText ? `Curricula:\n${curriculumText}` : ''}
    `.trim();

    const permissions = {
      roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
      isPublic: false,
      allowedClassId: classData.id
    };

    await this.upsertKnowledgeChunk(
      classData.schoolId,
      `class_info_${classData.id}`,
      content,
      { type: 'class_info', classId: classData.id, permissions }
    );
  }

  /**
   * Index all students in a school (Background job)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncAllStudents() {
    this.logger.log('Starting daily student data indexing...');
    const students = await this.prisma.student.findMany({
      select: { id: true }
    });

    for (const student of students) {
      try {
        await this.indexStudent(student.id);
      } catch (error) {
        this.logger.error(`Failed to index student ${student.id}: ${error}`);
      }
    }
    this.logger.log('Finished daily student data indexing.');
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
