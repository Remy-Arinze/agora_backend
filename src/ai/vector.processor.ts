import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { AiService } from './ai.service';

export const VECTOR_QUEUE_NAME = '{vector}';
export const JOB_GENERATE_EMBEDDING = 'generate-embedding';
export const JOB_INDEX_RECORD = 'index-record';

export interface GenerateEmbeddingPayload {
  chunkId: string;
}

export interface IndexRecordPayload {
  type: 'grade' | 'attendance' | 'student';
  id: string;
}

/**
 * Processes generate-embedding jobs: load KnowledgeChunk by id, call OpenAI embedding, update row.
 * Processes index-record jobs: fetches target row, generates chunk, inserts, and queues embedding.
 * Retries with backoff on OpenAI rate limits.
 */
@Processor(VECTOR_QUEUE_NAME, {
  concurrency: 2,
})
export class VectorProcessor extends WorkerHost {
  private readonly logger = new Logger(VectorProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {
    super();
  }

  async process(job: Job<any, void, string>): Promise<void> {
    if (job.name === JOB_GENERATE_EMBEDDING) {
      await this.processGenerateEmbedding(job as Job<GenerateEmbeddingPayload, void, string>);
    } else if (job.name === JOB_INDEX_RECORD) {
      await this.processIndexRecord(job as Job<IndexRecordPayload, void, string>);
    } else {
      this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async processGenerateEmbedding(job: Job<GenerateEmbeddingPayload, void, string>): Promise<void> {
    const { chunkId } = job.data;
    if (!chunkId) {
      this.logger.warn('Job missing chunkId');
      return;
    }

    const chunk = await this.prisma.knowledgeChunk.findUnique({
      where: { id: chunkId },
      select: { id: true, content: true },
    });

    if (!chunk) {
      this.logger.warn(`Chunk not found: ${chunkId}`);
      return;
    }

    if (!chunk.content || chunk.content.trim() === '') {
      this.logger.debug(`Chunk ${chunkId} has no content, skipping`);
      return;
    }

    try {
      const embedding = await this.aiService.createEmbedding(chunk.content);
      const vectorString = `[${embedding.join(',')}]`;

      await this.prisma.$executeRawUnsafe(
        `UPDATE "KnowledgeChunk" SET "embedding" = $1::vector, "updatedAt" = NOW() WHERE "id" = $2`,
        vectorString,
        chunkId,
      );

      this.logger.debug(`Embedding updated for chunk ${chunkId}`);
    } catch (error: any) {
      this.logger.error(`Embedding failed for chunk ${chunkId}: ${error?.message}`);
      throw error;
    }
  }

  private async processIndexRecord(job: Job<IndexRecordPayload, void, string>): Promise<void> {
    const { type, id } = job.data;
    if (!type || !id) {
      this.logger.warn('Index job missing type or id');
      return;
    }

    try {
      if (type === 'grade') {
        await this.indexGrade(id);
      } else if (type === 'attendance') {
        await this.indexAttendance(id);
      } else if (type === 'student') {
        await this.indexStudent(id);
      }
    } catch (error: any) {
      this.logger.error(`Failed to index ${type} ${id}: ${error?.message}`);
      throw error;
    }
  }

  private async indexGrade(gradeId: string) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: gradeId },
      include: {
        enrollment: {
          include: { student: true, class: true, school: true }
        }
      }
    });

    if (!grade || !grade.enrollment) return;

    const student = grade.enrollment.student;
    const className = grade.enrollment.class?.name || grade.enrollment.classLevel;
    const subject = grade.subject || 'Unknown Subject';

    const content = `Student: ${student.firstName} ${student.lastName}
Class: ${className}
Subject: ${subject}
Assessment: ${grade.assessmentName || 'Assessment'}
Type: ${grade.gradeType}
Grade: received ${grade.score} out of ${grade.maxScore}
Remarks: ${grade.remarks || 'None'}
Date: ${grade.signedAt.toLocaleDateString()}`.trim();

    await this.upsertChunk(
      grade.enrollment.schoolId,
      `grade_${grade.id}`,
      content,
      {
        type: 'grade',
        studentId: student.id,
        classId: grade.enrollment.classId,
        subject,
        timestamp: new Date().toISOString(),
        permissions: {
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
          allowedStudentId: student.id,
          allowedClassId: grade.enrollment.classId,
        }
      }
    );
  }

  private async indexAttendance(attendanceId: string) {
    const att = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        enrollment: {
          include: { student: true, class: true, school: true }
        }
      }
    });

    if (!att || !att.enrollment) return;
    const student = att.enrollment.student;
    const className = att.enrollment.class?.name || att.enrollment.classLevel;

    const content = `Student: ${student.firstName} ${student.lastName}
Class: ${className}
Attendance Date: ${att.date.toLocaleDateString()}
Status: ${att.status}
Remarks: ${att.remarks || 'None'}`.trim();

    await this.upsertChunk(
      att.enrollment.schoolId,
      `att_${att.id}`,
      content,
      {
        type: 'attendance',
        studentId: student.id,
        classId: att.enrollment.classId,
        timestamp: new Date().toISOString(),
        permissions: {
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
          allowedStudentId: student.id,
          allowedClassId: att.enrollment.classId,
        }
      }
    );
  }

  private async indexStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: { include: { school: true, class: true } }
      }
    });
    if (!student) return;

    for (const enr of student.enrollments) {
      const className = enr.class?.name || enr.classLevel;
      const content = `Student Profile: ${student.firstName} ${student.lastName}
Enrolled in: ${className}
School: ${enr.school.name}
Admitted: ${enr.createdAt.toLocaleDateString()}`.trim();

      await this.upsertChunk(
        enr.schoolId,
        `stu_${student.id}_${enr.id}`,
        content,
        {
          type: 'student_profile',
          studentId: student.id,
          classId: enr.classId,
          timestamp: new Date().toISOString(),
          permissions: {
            roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
            allowedStudentId: student.id,
            allowedClassId: enr.classId,
          }
        }
      );
    }
  }

  private async upsertChunk(schoolId: string, externalId: string, content: string, metadata: any) {
    if (!this.aiService.isConfigured()) return;

    const existing = await this.prisma.knowledgeChunk.findFirst({
      where: {
        schoolId,
        metadata: { path: ['externalId'], equals: externalId },
      },
      select: { id: true }
    });

    const metadataWithId = { ...metadata, externalId };

    if (existing) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "KnowledgeChunk" SET "content" = $1, "metadata" = $2, "updatedAt" = NOW() WHERE "id" = $3`,
        content,
        JSON.stringify(metadataWithId),
        existing.id,
      );
      // Not queuing generate-embedding here inside process to prevent recursive queue flooding from inside the job,
      // wait, no, actually we DO need to queue generate-embedding because this is an index-record job!
      // I can't inject vectorQueue here since I am inside VectorProcessor. 
      // But I can directly call createEmbedding!
      
      try {
        const embedding = await this.aiService.createEmbedding(content);
        const vectorString = `[${embedding.join(',')}]`;
        await this.prisma.$executeRawUnsafe(
          `UPDATE "KnowledgeChunk" SET "embedding" = $1::vector, "updatedAt" = NOW() WHERE "id" = $2`,
          vectorString,
          existing.id,
        );
      } catch (err: any) {
        this.logger.error(`Embedding failed for updated chunk ${existing.id}`);
      }
    } else {
      const id = `kc_${Math.random().toString(36).substring(2, 11)}`;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunk" ("id", "schoolId", "content", "metadata", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW())`,
        id,
        schoolId,
        content,
        JSON.stringify(metadataWithId),
      );
      try {
        const embedding = await this.aiService.createEmbedding(content);
        const vectorString = `[${embedding.join(',')}]`;
        await this.prisma.$executeRawUnsafe(
          `UPDATE "KnowledgeChunk" SET "embedding" = $1::vector, "updatedAt" = NOW() WHERE "id" = $2`,
          vectorString,
          id,
        );
      } catch (err: any) {
        this.logger.error(`Embedding failed for new chunk ${id}`);
      }
    }
  }
}

