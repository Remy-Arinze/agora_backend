import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SchemeOfWorkStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AiSchoolInsightsService } from './ai-school-insights.service';
import { AgentToolContext, AgentToolResult, toolSource } from './ai-lois-source';

export const LOIS_INSIGHT_TYPES = {
  ACADEMIC_RISK: 'ACADEMIC_RISK',
  STUDENT_DROP: 'STUDENT_DROP',
  SOW_GAP: 'SOW_GAP',
} as const;

export type LoisInsightType = (typeof LOIS_INSIGHT_TYPES)[keyof typeof LOIS_INSIGHT_TYPES];

type InsightInput = {
  type: LoisInsightType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  studentIds?: string[];
  classIds?: string[];
  teacherIds?: string[];
  href?: string | null;
  askPrompt?: string | null;
  fingerprint: string;
};

/**
 * Persistent Lois insights (background loops) + query for the Overview inbox.
 */
@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolInsights: AiSchoolInsightsService,
    private readonly notifications: NotificationService,
  ) {}

  async listForSchool(
    schoolId: string,
    limit = 8,
  ): Promise<
    {
      id: string;
      type: string;
      severity: string;
      title: string;
      summary: string;
      evidence: unknown;
      href: string | null;
      askPrompt: string | null;
      createdAt: Date;
    }[]
  > {
    const rows = await this.prisma.loisInsight.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 15),
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      severity: r.severity,
      title: r.title,
      summary: r.summary,
      evidence: r.evidence,
      href: r.href,
      askPrompt: r.askPrompt,
      createdAt: r.createdAt,
    }));
  }

  async listForTool(args: { limit?: number }, context?: AgentToolContext): Promise<AgentToolResult> {
    const schoolId = context?.schoolId;
    if (!schoolId) {
      return { data: { error: 'School context is required.' }, usage: null };
    }
    const insights = await this.listForSchool(schoolId, args.limit ?? 8);
    return {
      data: { count: insights.length, insights },
      usage: null,
      sources: [
        toolSource(
          'list_lois_insights',
          insights.length ? `${insights.length} Lois insight${insights.length === 1 ? '' : 's'}` : 'No open insights',
          '/dashboard/school/overview',
        ),
      ],
    };
  }

  async upsertInsight(schoolId: string, input: InsightInput): Promise<{ created: boolean; id: string }> {
    const existing = await this.prisma.loisInsight.findUnique({
      where: { schoolId_fingerprint: { schoolId, fingerprint: input.fingerprint } },
      select: { id: true },
    });

    const row = await this.prisma.loisInsight.upsert({
      where: { schoolId_fingerprint: { schoolId, fingerprint: input.fingerprint } },
      create: {
        schoolId,
        type: input.type,
        severity: input.severity,
        title: input.title,
        summary: input.summary,
        evidence: input.evidence as Prisma.InputJsonValue,
        studentIds: input.studentIds ?? [],
        classIds: input.classIds ?? [],
        teacherIds: input.teacherIds ?? [],
        href: input.href ?? null,
        askPrompt: input.askPrompt ?? null,
        fingerprint: input.fingerprint,
      },
      update: {
        severity: input.severity,
        title: input.title,
        summary: input.summary,
        evidence: input.evidence as Prisma.InputJsonValue,
        studentIds: input.studentIds ?? [],
        classIds: input.classIds ?? [],
        teacherIds: input.teacherIds ?? [],
        href: input.href ?? null,
        askPrompt: input.askPrompt ?? null,
      },
      select: { id: true },
    });

    return { created: !existing, id: row.id };
  }

  async runDailyForSchool(schoolId: string, schoolName: string): Promise<void> {
    const created: { type: string; title: string }[] = [];

    const risk = await this.captureAcademicRisk(schoolId, schoolName);
    if (risk) created.push(risk);

    created.push(...(await this.captureStudentDrops(schoolId)));
    created.push(...(await this.captureSowGaps(schoolId)));

    if (created.length > 0) {
      const preview = created.slice(0, 5).map((c) => c.title).join('; ');
      await this.notifications.notifySchoolAdmins(schoolId, {
        type: 'LOIS_INSIGHT',
        title: 'Lois noticed',
        body: preview || `${created.length} new school insight(s)`,
        link: '/dashboard/school/overview',
        metadata: { count: created.length, types: created.map((c) => c.type) },
      });
    }
  }

  private async captureAcademicRisk(
    schoolId: string,
    schoolName: string,
  ): Promise<{ type: string; title: string } | null> {
    const termId = await this.schoolInsights.getActiveTermId(schoolId);
    const students = await this.schoolInsights.findAtRiskStudents(schoolId, {
      termId,
      thresholdPercent: 45,
      limit: 20,
      useActiveTermWhenMissing: false,
    });
    if (students.length === 0) return null;

    const preview = students.slice(0, 8).map((s) => ({
      studentId: s.studentId,
      studentName: `${s.firstName} ${s.lastName}`.trim(),
      avgPercent: Math.round(s.avgPercent * 10) / 10,
    }));

    this.notifications.emitAcademicRiskDigest({
      schoolId,
      schoolName,
      atRiskCount: students.length,
      preview: preview.map((p) => ({ studentName: p.studentName, avgPercent: p.avgPercent })),
      timestamp: new Date().toISOString(),
    });

    const day = new Date().toISOString().slice(0, 10);
    const { created } = await this.upsertInsight(schoolId, {
      type: LOIS_INSIGHT_TYPES.ACADEMIC_RISK,
      severity: students.length >= 10 ? 'critical' : 'warning',
      title: `${students.length} student${students.length === 1 ? '' : 's'} below 45% this term`,
      summary: preview.map((p) => `${p.studentName} (${p.avgPercent}%)`).join(', '),
      evidence: { termId, thresholdPercent: 45, students: preview },
      studentIds: students.map((s) => s.studentId),
      href: '/dashboard/school/students',
      askPrompt: 'Explain the academic risk digest for today and what we should do this week.',
      fingerprint: `ACADEMIC_RISK:${termId || 'none'}:${day}`,
    });

    return created ? { type: LOIS_INSIGHT_TYPES.ACADEMIC_RISK, title: `${students.length} students below 45%` } : null;
  }

  private async captureStudentDrops(schoolId: string): Promise<{ type: string; title: string }[]> {
    const termId = await this.schoolInsights.getActiveTermId(schoolId);
    if (!termId) return [];

    const grades = await this.prisma.grade.findMany({
      where: {
        isPublished: true,
        termId,
        enrollment: { schoolId, isActive: true },
      },
      orderBy: { signedAt: 'asc' },
      take: 4000,
      select: {
        subject: true,
        score: true,
        maxScore: true,
        signedAt: true,
        enrollment: {
          select: {
            studentId: true,
            classId: true,
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    type Bucket = { percents: number[]; studentId: string; name: string; classId: string | null };
    const buckets = new Map<string, Bucket>();
    for (const g of grades) {
      const max = Number(g.maxScore) || 0;
      if (max <= 0) continue;
      const pct = (Number(g.score) / max) * 100;
      const studentId = g.enrollment.studentId;
      const key = `${studentId}::${g.subject}`;
      let b = buckets.get(key);
      if (!b) {
        b = {
          percents: [],
          studentId,
          name: `${g.enrollment.student.firstName} ${g.enrollment.student.lastName}`.trim(),
          classId: g.enrollment.classId,
        };
        buckets.set(key, b);
      }
      b.percents.push(pct);
    }

    const created: { type: string; title: string }[] = [];
    let emitted = 0;
    for (const [key, b] of buckets) {
      if (emitted >= 15) break;
      if (b.percents.length < 3) continue;
      const last = b.percents[b.percents.length - 1];
      const prior = b.percents.slice(0, -1);
      const priorAvg = prior.reduce((a, n) => a + n, 0) / prior.length;
      const drop = priorAvg - last;
      if (drop < 15) continue;

      const subject = key.split('::')[1] || 'Subject';
      const title = `${b.name} dropped ${Math.round(drop)} pts in ${subject}`;
      const { created: isNew } = await this.upsertInsight(schoolId, {
        type: LOIS_INSIGHT_TYPES.STUDENT_DROP,
        severity: drop >= 25 ? 'critical' : 'warning',
        title,
        summary: `${b.name}: ${subject} fell from an average of ${Math.round(priorAvg)}% to ${Math.round(last)}% on the latest published score.`,
        evidence: {
          studentId: b.studentId,
          subject,
          priorAvg: Math.round(priorAvg * 10) / 10,
          latest: Math.round(last * 10) / 10,
          drop: Math.round(drop * 10) / 10,
          samples: b.percents.length,
        },
        studentIds: [b.studentId],
        classIds: b.classId ? [b.classId] : [],
        href: `/dashboard/school/students/${b.studentId}`,
        askPrompt: `Why did ${b.name}'s ${subject} performance drop, and what should we do?`,
        fingerprint: `STUDENT_DROP:${b.studentId}:${subject}:${termId}`,
      });
      if (isNew) {
        created.push({ type: LOIS_INSIGHT_TYPES.STUDENT_DROP, title });
        emitted += 1;
      }
    }
    return created;
  }

  private async captureSowGaps(schoolId: string): Promise<{ type: string; title: string }[]> {
    const termId = await this.schoolInsights.getActiveTermId(schoolId);
    if (!termId) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const schemes = await this.prisma.schemeOfWork.findMany({
      where: { schoolId, termId, status: SchemeOfWorkStatus.PUBLISHED },
      take: 40,
      select: {
        id: true,
        subjectId: true,
        classLevel: { select: { name: true } },
        weeks: {
          where: {
            isDelivered: false,
            OR: [{ lessonNoteUrl: null }, { lessonNoteUrl: '' }],
          },
          orderBy: { weekNumber: 'asc' },
          select: {
            weekNumber: true,
            topic: true,
            calendarEndDate: true,
            lessonNoteUrl: true,
          },
        },
      },
    });

    const subjectIds = [...new Set(schemes.map((s) => s.subjectId))];
    const subjects = subjectIds.length
      ? await this.prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true, name: true },
        })
      : [];
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

    const created: { type: string; title: string }[] = [];
    let emitted = 0;
    for (const scheme of schemes) {
      for (const week of scheme.weeks) {
        if (emitted >= 15) return created;
        const ended =
          week.calendarEndDate != null
            ? week.calendarEndDate < today
            : false;
        if (!ended) continue;

        const subject = subjectName.get(scheme.subjectId) || 'Subject';
        const classLabel = scheme.classLevel?.name || 'class';
        const title = `${classLabel} ${subject} · week ${week.weekNumber} not delivered`;
        const { created: isNew } = await this.upsertInsight(schoolId, {
          type: LOIS_INSIGHT_TYPES.SOW_GAP,
          severity: 'warning',
          title,
          summary: `Week ${week.weekNumber} (${week.topic}) has passed on the calendar with no delivery mark or lesson note.`,
          evidence: {
            schemeId: scheme.id,
            weekNumber: week.weekNumber,
            topic: week.topic,
            subject,
            classLevel: classLabel,
            calendarEnd: week.calendarEndDate?.toISOString().slice(0, 10) ?? null,
          },
          href: '/dashboard/school/overview',
          askPrompt: `The scheme of work for ${classLabel} ${subject} is missing week ${week.weekNumber}. What is outstanding and who should follow up?`,
          fingerprint: `SOW_GAP:${scheme.id}:${week.weekNumber}`,
        });
        if (isNew) {
          created.push({ type: LOIS_INSIGHT_TYPES.SOW_GAP, title });
          emitted += 1;
        }
      }
    }
    return created;
  }
}
