import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiContentGeneratorsService } from './ai-content-generators.service';
import { AiContextRagService } from './ai-context-rag.service';
import { AiLlmClientService } from './ai-llm-client.service';
import { AiSchoolInsightsService } from './ai-school-insights.service';
import { AiStaffPermissionCheckerService } from './ai-staff-permission-checker.service';

export type AgentToolContext = { schoolId?: string; userRole?: string; userId?: string };

/**
 * Lois agent tool execution: SQL, semantic search, stats, and delegation to content generators.
 */
@Injectable()
export class AiAgentToolsService {
  private readonly logger = new Logger(AiAgentToolsService.name);

  constructor(
    private readonly llm: AiLlmClientService,
    private readonly prisma: PrismaService,
    private readonly generators: AiContentGeneratorsService,
    private readonly contextRag: AiContextRagService,
    private readonly schoolInsights: AiSchoolInsightsService,
    private readonly staffPermissionChecker: AiStaffPermissionCheckerService,
  ) {}

  getToolDisplayName(toolName: string): string {
    const names: Record<string, string> = {
      generate_lesson_plan: '?? Lesson Plan Generator',
      generate_quiz: '? Quiz Generator',
      generate_flashcards: '?? Flashcard Creator',
      generate_summary: '?? Study Summary',
      generate_assessment: '?? Assessment Builder',
      grade_essay: '?? Essay Grader',
      execute_sql: '🔍 Querying School Records',
      search_semantic: '📖 Checking Knowledge Base',
      get_school_stats: '📊 Gathering school statistics',
      get_academic_risk_summary: '📉 Reviewing academic risk indicators',
    };
    return names[toolName] || toolName.replace(/_/g, ' ');
  }

  getToolThinkingMessage(toolName: string): string {
    const messages: Record<string, string> = {
      generate_lesson_plan: "I'll craft a detailed lesson plan for you...",
      generate_quiz: 'Let me generate some quiz questions...',
      generate_flashcards: 'Creating study flashcards for you...',
      generate_summary: 'Let me prepare a comprehensive study summary...',
      generate_assessment: 'Building formal assessment questions...',
      grade_essay: 'Analyzing the essay for grading...',
      execute_sql: "I'm searching the school records for the information you requested...",
      search_semantic: "Let me check the school's knowledge base and policies...",
      get_school_stats: 'Gathering the latest school statistics...',
      get_academic_risk_summary: 'Analyzing published grades for students below the performance threshold...',
    };
    return messages[toolName] || 'Processing your request...';
  }

  async executeAgentTool(
    toolName: string,
    args: any,
    context?: AgentToolContext,
  ): Promise<{ data: any; usage: any }> {
    await this.staffPermissionChecker.assertLoisToolAllowed({
      toolName,
      userRole: context?.userRole,
      userId: context?.userId,
      schoolId: context?.schoolId,
    });

    switch (toolName) {
      case 'generate_lesson_plan':
        return this.generators.generateLessonPlan({
          topic: args.topic || 'General Topic',
          subject: args.subject || 'General Studies',
          gradeLevel: args.gradeLevel || 'Any',
          objectives: args.objectives || ['Understand key concepts', 'Apply knowledge practically'],
          duration: args.duration || 40,
        });

      case 'generate_quiz': {
        const res = await this.generators.generateQuiz({
          topic: args.topic || 'Quick Quiz',
          subject: args.subject || 'General',
          gradeLevel: args.gradeLevel || 'Any',
          questionCount: args.questionCount || 5,
          questionTypes: args.questionTypes || ['multiple_choice'],
          difficulty: args.difficulty || 'medium',
        });

        if (context?.schoolId && args.subject) {
          const subject = await this.prisma.subject.findFirst({
            where: {
              schoolId: context.schoolId,
              name: { contains: args.subject, mode: 'insensitive' },
              isActive: true,
            },
            select: { id: true },
          });
          if (subject) {
            (res.data as any).subjectId = subject.id;
          }
        }
        return res;
      }

      case 'generate_flashcards':
        return this.generators.generateFlashcards({
          topic: args.topic || 'General Revision',
          subject: args.subject || 'General',
          gradeLevel: args.gradeLevel || 'Any',
          count: args.count || 10,
        });

      case 'generate_summary':
        return this.generators.generateSummary({
          topic: args.topic || 'Content Summary',
          subject: args.subject || 'General',
          gradeLevel: args.gradeLevel || 'Any',
        });

      case 'generate_assessment': {
        const res = await this.generators.generateAssessmentQuestions({
          topic: args.topic || 'Assessment',
          subject: args.subject || 'General',
          gradeLevel: args.gradeLevel || 'Any',
          questionCount: args.questionCount || 20,
          questionTypes: args.questionTypes || ['multiple_choice', 'short_answer', 'essay'],
          difficulty: args.difficulty || 'mixed',
        });

        if (context?.schoolId && args.subject) {
          const subject = await this.prisma.subject.findFirst({
            where: {
              schoolId: context.schoolId,
              name: { contains: args.subject, mode: 'insensitive' },
              isActive: true,
            },
            select: { id: true },
          });
          if (subject) {
            (res.data as any).subjectId = subject.id;
          }
        }
        return res;
      }

      case 'grade_essay':
        return this.generators.gradeEssay({
          essay: args.essay,
          prompt: args.prompt,
          subject: args.subject,
          gradeLevel: args.gradeLevel,
          rubric: args.rubric,
          maxScore: args.maxScore || 100,
        });

      case 'get_school_stats': {
        const sid = context?.schoolId || args.schoolId;
        if (!sid) {
          return { data: { error: 'School ID context is required for statistics.' }, usage: null };
        }
        if (context?.schoolId && args.schoolId && args.schoolId !== context.schoolId) {
          this.logger.warn(
            `get_school_stats: model schoolId ${args.schoolId} ignored; using request school ${context.schoolId}`,
          );
        }
        return this.getSchoolStats(sid);
      }

      case 'execute_sql':
        return this.executeSql(args.sql, context?.schoolId);

      case 'search_semantic':
        return this.searchSemantic(
          args.query,
          args.limit,
          context?.schoolId,
          context?.userRole,
          context?.userId,
        );

      case 'get_academic_risk_summary':
        return this.getAcademicRiskSummary(args, context);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  assertSqlScopedToSchool(sql: string, schoolId: string): { ok: true } | { ok: false; message: string } {
    const withoutTrailingSemicolons = sql.replace(/;+\s*$/g, '').trim();
    if (/;\s*\S/.test(withoutTrailingSemicolons)) {
      return { ok: false, message: 'Only a single SELECT statement is allowed.' };
    }
    const escaped = schoolId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`"schoolId"\\s*=\\s*'${escaped}'`, 'i'),
      new RegExp(`"schoolId"\\s*=\\s*"${escaped}"`, 'i'),
      new RegExp(`\\bschoolId\\s*=\\s*'${escaped}'`, 'i'),
      new RegExp(`\\bschoolId\\s*=\\s*"${escaped}"`, 'i'),
    ];
    if (!patterns.some((p) => p.test(sql))) {
      return {
        ok: false,
        message: `For security, each query must include this exact tenant filter: "schoolId" = '${schoolId}' on relevant tables (see schema instructions).`,
      };
    }
    return { ok: true };
  }

  async executeSql(sql: string, schoolId?: string): Promise<{ data: any; usage: any }> {
    if (!schoolId) {
      return { data: { error: 'School ID context is required for secure querying.' }, usage: null };
    }

    const trimmedSql = sql.trim();
    const lowerSql = trimmedSql.toLowerCase();

    if (!lowerSql.startsWith('select')) {
      return { data: { error: 'Only read-only SELECT queries are allowed.' }, usage: null };
    }

    const scopeCheck = this.assertSqlScopedToSchool(trimmedSql, schoolId);
    if (!scopeCheck.ok) {
      return { data: { error: scopeCheck.message }, usage: null };
    }

    try {
      const readOnlyPrisma = this.llm.getReadOnlyPrisma();
      const results = await readOnlyPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL row_security = on;`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_school_id = '${schoolId}';`);

        const rows = await tx.$queryRawUnsafe(sql);

        return JSON.parse(
          JSON.stringify(rows, (_key, value) => (typeof value === 'bigint' ? Number(value) : value)),
        );
      });

      return { data: results, usage: null };
    } catch (error: any) {
      return {
        data: {
          error: `SQL Execution failed: ${error?.message || 'Invalid query'}. Please refine your query.`,
        },
        usage: null,
      };
    }
  }

  private async getAcademicRiskSummary(
    args: { thresholdPercent?: number; limit?: number },
    context?: AgentToolContext,
  ): Promise<{ data: any; usage: any }> {
    const schoolId = context?.schoolId;
    if (!schoolId) {
      return { data: { error: 'School context is required.' }, usage: null };
    }

    const role = context?.userRole;
    const canSchoolWide = role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN';
    const isTeacher = role === 'TEACHER';

    if (!canSchoolWide && !isTeacher) {
      return {
        data: { error: 'Only school administrators and teachers can view academic risk summaries.' },
        usage: null,
      };
    }

    let studentFilter: Set<string> | null = null;
    if (isTeacher) {
      if (!context?.userId) {
        return { data: { error: 'User context is required for teacher risk views.' }, usage: null };
      }
      const access = await this.schoolInsights.resolveTeacherRagAccess(context.userId, schoolId);
      if (!access || access.studentIds.size === 0) {
        return {
          data: {
            termId: await this.schoolInsights.getActiveTermId(schoolId),
            thresholdPercent: args.thresholdPercent ?? 45,
            students: [],
            message: 'No enrolled students found for your assignments, or no roster access.',
          },
          usage: null,
        };
      }
      studentFilter = access.studentIds;
    }

    const threshold = args.thresholdPercent ?? 45;
    const limit = args.limit ?? 25;
    const termId = await this.schoolInsights.getActiveTermId(schoolId);
    const students = await this.schoolInsights.findAtRiskStudents(schoolId, {
      termId,
      thresholdPercent: threshold,
      limit,
      studentIdFilter: studentFilter,
      useActiveTermWhenMissing: false,
    });

    return {
      data: {
        termId,
        thresholdPercent: threshold,
        scope: canSchoolWide ? 'school' : 'my_students',
        count: students.length,
        students: students.map((s) => ({
          studentId: s.studentId,
          name: `${s.firstName} ${s.lastName}`.trim(),
          avgPercent: Math.round(s.avgPercent * 10) / 10,
          gradeCount: s.gradeCount,
        })),
      },
      usage: null,
    };
  }

  async searchSemantic(query: string, limit?: number, schoolId?: string, role?: string, userId?: string) {
    const effectiveLimit = limit ?? 5;
    if (schoolId && role) {
      const { text, sources } = await this.contextRag.findRelevantContext(query, schoolId, role, effectiveLimit, {
        userId,
      });
      return {
        data: text
          ? { text, sources }
          : { text: 'No relevant knowledge base results found for this query.', sources: [] },
        usage: null,
      };
    }
    return {
      data: {
        text: 'Semantic search requires school context. Please ensure you are in a school scope.',
        sources: [],
      },
      usage: null,
    };
  }

  async getSchoolStats(schoolId: string): Promise<{ data: any; usage: any }> {
    if (!schoolId) return { data: { error: 'School ID is required' }, usage: null };

    const [classCount, teacherCount, studentCount] = await Promise.all([
      this.prisma.class.count({ where: { schoolId } }),
      this.prisma.teacher.count({ where: { schoolId } }),
      this.prisma.enrollment.count({ where: { schoolId } }),
    ]);

    return {
      data: {
        classes: classCount,
        teachers: teacherCount,
        students: studentCount,
        totalPopulation: studentCount + teacherCount,
      },
      usage: null,
    };
  }
}
