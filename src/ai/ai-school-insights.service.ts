import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type AtRiskStudentRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  avgPercent: number;
  gradeCount: number;
};

export type TeacherRagAccess = {
  teacherId: string;
  classIds: Set<string>;
  classArmIds: Set<string>;
  studentIds: Set<string>;
};

/**
 * Deterministic school analytics for Lois tools (no LLM-generated SQL).
 */
@Injectable()
export class AiSchoolInsightsService {
  private readonly logger = new Logger(AiSchoolInsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Class / arm / student IDs a teacher may see in RAG (knowledge chunks).
   */
  async resolveTeacherRagAccess(userId: string, schoolId: string): Promise<TeacherRagAccess | null> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId, schoolId },
      include: {
        classTeachers: { select: { classId: true, classArmId: true } },
        classArms: { select: { id: true } },
      },
    });
    if (!teacher) return null;

    const classIds = new Set<string>();
    const classArmIds = new Set<string>();

    for (const ct of teacher.classTeachers) {
      if (ct.classId) classIds.add(ct.classId);
      if (ct.classArmId) classArmIds.add(ct.classArmId);
    }
    for (const arm of teacher.classArms) {
      classArmIds.add(arm.id);
    }

    const armList = [...classArmIds];
    const classList = [...classIds];

    if (armList.length > 0) {
      const fromArms = await this.prisma.enrollment.findMany({
        where: { schoolId, isActive: true, classArmId: { in: armList }, classId: { not: null } },
        select: { classId: true },
        distinct: ['classId'],
      });
      for (const row of fromArms) {
        if (row.classId) classIds.add(row.classId);
      }
    }

    const studentIds = new Set<string>();
    const orClause: Prisma.EnrollmentWhereInput[] = [];
    if (classList.length) orClause.push({ classId: { in: classList } });
    if (armList.length) orClause.push({ classArmId: { in: armList } });

    if (orClause.length > 0) {
      const rows = await this.prisma.enrollment.findMany({
        where: { schoolId, isActive: true, OR: orClause },
        select: { studentId: true },
      });
      for (const r of rows) studentIds.add(r.studentId);
    }

    return { teacherId: teacher.id, classIds, classArmIds, studentIds };
  }

  /** Whether a knowledge-chunk metadata object is visible to this teacher (after role-based SQL). */
  chunkVisibleToTeacher(metadata: any, access: TeacherRagAccess): boolean {
    if (!metadata || typeof metadata !== 'object') return false;
    const perms = metadata.permissions;
    if (perms?.isPublic === true) return true;

    const allowedStudentId = perms?.allowedStudentId ?? metadata.studentId;
    const allowedClassId = perms?.allowedClassId ?? metadata.classId;
    const allowedTeacherId = perms?.allowedTeacherId ?? metadata.teacherId;

    const type = metadata.type as string | undefined;

    if (type === 'teacher_info' && allowedTeacherId) {
      return allowedTeacherId === access.teacherId;
    }

    if (type === 'assessment' && (allowedTeacherId || allowedClassId)) {
      if (allowedTeacherId === access.teacherId) return true;
      if (allowedClassId && access.classIds.has(allowedClassId)) return true;
      return false;
    }

    if (allowedStudentId && access.studentIds.has(allowedStudentId)) return true;
    if (allowedClassId && access.classIds.has(allowedClassId)) return true;

    if (type === 'curriculum' && allowedClassId) {
      return access.classIds.has(allowedClassId);
    }

    if (!allowedStudentId && !allowedClassId && !allowedTeacherId) {
      return true;
    }

    if (allowedTeacherId) return allowedTeacherId === access.teacherId;
    return false;
  }

  async getActiveTermId(schoolId: string): Promise<string | null> {
    const session = await this.prisma.academicSession.findFirst({
      where: { schoolId, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
      select: {
        terms: { where: { status: 'ACTIVE' }, take: 1, select: { id: true } },
      },
    });
    return session?.terms?.[0]?.id ?? null;
  }

  /**
   * Students with average published grade percentage below threshold (default 45%).
   */
  async findAtRiskStudents(
    schoolId: string,
    options: {
      termId?: string | null;
      useActiveTermWhenMissing?: boolean;
      thresholdPercent?: number;
      limit?: number;
      studentIdFilter?: Set<string> | null;
    } = {},
  ): Promise<AtRiskStudentRow[]> {
    const threshold = options.thresholdPercent ?? 45;
    const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);

    let termId = options.termId;
    if (termId === undefined && options.useActiveTermWhenMissing !== false) {
      termId = await this.getActiveTermId(schoolId);
    }

    if (options.studentIdFilter && options.studentIdFilter.size === 0) {
      return [];
    }

    const termFilter = termId ? Prisma.sql`AND g."termId" = ${termId}` : Prisma.empty;
    const studentFilter =
      options.studentIdFilter && options.studentIdFilter.size > 0
        ? Prisma.sql`AND e."studentId" IN (${Prisma.join([...options.studentIdFilter].map((id) => Prisma.sql`${id}`))})`
        : Prisma.empty;

    try {
      return await this.prisma.$queryRaw<AtRiskStudentRow[]>`
        SELECT
          e."studentId" AS "studentId",
          s."firstName" AS "firstName",
          s."lastName" AS "lastName",
          (AVG((g."score"::numeric / NULLIF(g."maxScore", 0)::numeric) * 100))::float AS "avgPercent",
          COUNT(g."id")::int AS "gradeCount"
        FROM "Grade" g
        INNER JOIN "Enrollment" e ON e."id" = g."enrollmentId"
        INNER JOIN "Student" s ON s."id" = e."studentId"
        WHERE e."schoolId" = ${schoolId}
          AND g."isPublished" = true
          AND COALESCE(g."maxScore", 0) > 0
          ${termFilter}
          ${studentFilter}
        GROUP BY e."studentId", s."firstName", s."lastName"
        HAVING AVG((g."score"::numeric / NULLIF(g."maxScore", 0)::numeric) * 100) < ${threshold}
        ORDER BY "avgPercent" ASC
        LIMIT ${limit}
      `;
    } catch (e) {
      this.logger.error(`findAtRiskStudents failed: ${e}`);
      return [];
    }
  }
}
