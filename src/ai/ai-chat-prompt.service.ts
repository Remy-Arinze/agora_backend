import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiContextRagService } from './ai-context-rag.service';
import { SystemPromptConfigService } from './system-prompt-config.service';
import { LoisSkillsService } from './lois-skills.service';
import { LoisPageContextInput } from './ai-page-context';

/**
 * Builds the Lois system prompt for each chat turn.
 *
 * Identity context is role-specific:
 *   TEACHER     → assignments, timetable, form-class responsibilities
 *   SCHOOL_ADMIN → admin profile, role/type, live school stats
 *   STUDENT      → enrollment, class, active subjects, recent grade snapshot
 *
 * A per-school LoisConfig row can inject custom greeting, tone notes, and
 * restricted-topic guidance without requiring a code change.
 */
@Injectable()
export class AiChatPromptService {
  private readonly logger = new Logger(AiChatPromptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contextRag: AiContextRagService,
    private readonly systemPromptConfig: SystemPromptConfigService,
    private readonly loisSkills: LoisSkillsService,
  ) {}

  async getChatPrompt(
    messages: { role: string; content: string }[],
    userId?: string,
    schoolId?: string,
    pageContext?: LoisPageContextInput | null,
  ): Promise<{ systemPrompt: string; contextText: string; userRole: string; schoolName: string }> {
    let contextText = '';
    let userRole = 'USER';
    let schoolName = '';
    let directContext = '';

    // Real-time clock (WAT)
    const now = new Date();
    const formatterConfig = { timeZone: 'Africa/Lagos', hour12: false } as any;
    const currentDay = now.toLocaleString('en-US', { ...formatterConfig, weekday: 'long' }).toUpperCase();
    const currentTime = now.toLocaleString('en-US', { ...formatterConfig, hour: '2-digit', minute: '2-digit' });
    directContext += `[REAL-TIME CLOCK] Today is ${currentDay}. The current time is ${currentTime} (WAT).\n`;

    // ── Per-school LOIS configuration ─────────────────────────────────────────
    let loisConfig: { customGreeting?: string | null; toneNote?: string | null; restrictedTopics?: string | null; schoolContext?: string | null } | null = null;
    if (schoolId) {
      loisConfig = await (this.prisma as any).loisConfig?.findUnique?.({ where: { schoolId } }).catch(() => null) ?? null;
    }

    // ── Global system prompt config (super admin overrides) ───────────────────
    const sysConfig = await this.systemPromptConfig.get().catch(() => null);

    if (!schoolId || !userId) {
      return { systemPrompt: this.buildPrompt(schoolName, directContext, contextText, userRole, loisConfig, schoolId, sysConfig, []), contextText, userRole, schoolName };
    }

    // ── Shared queries — always needed ─────────────────────────────────────
    const [user, school] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, firstName: true, lastName: true },
      }),
      this.prisma.school.findUnique({
        where: { id: schoolId },
        select: {
          name: true, address: true, city: true, state: true,
          hasPrimary: true, hasSecondary: true, hasTertiary: true,
          academicSessions: {
            where: { status: 'ACTIVE' },
            take: 1,
            orderBy: { startDate: 'desc' },
            select: {
              name: true, startDate: true, endDate: true,
              terms: {
                where: { status: 'ACTIVE' }, take: 1,
                select: { name: true, number: true, startDate: true, endDate: true },
              },
            },
          },
        },
      }),
    ]);

    if (!user) return { systemPrompt: this.buildPrompt(schoolName, directContext, contextText, userRole, loisConfig, schoolId, sysConfig, []), contextText, userRole, schoolName };

    userRole = user.role;

    if (school) {
      schoolName = school.name;
      directContext += `Current School: ${schoolName}`;
      if (school.city || school.state) directContext += ` (${[school.city, school.state].filter(Boolean).join(', ')})`;
      directContext += '.\n';

      const levels = [school.hasPrimary && 'Primary', school.hasSecondary && 'Secondary', school.hasTertiary && 'Tertiary'].filter(Boolean);
      if (levels.length) directContext += `School levels offered: ${levels.join(', ')}.\n`;

      const activeSession = school.academicSessions?.[0];
      if (activeSession) {
        directContext += `Active academic session: ${activeSession.name} (${activeSession.startDate.toDateString()} – ${activeSession.endDate.toDateString()}).\n`;
        const activeTerm = activeSession.terms?.[0];
        if (activeTerm) {
          directContext += `Current term: ${activeTerm.name} (term ${activeTerm.number}, ${activeTerm.startDate.toDateString()} – ${activeTerm.endDate.toDateString()}).\n`;
        }
      }
    }

    // ── Role-specific context ────────────────────────────────────────────────
    if (userRole === 'TEACHER') {
      await this.buildTeacherContext(userId, schoolId, user, directContext).then(ctx => { directContext = ctx; });
    } else if (userRole === 'SCHOOL_ADMIN') {
      await this.buildAdminContext(userId, schoolId, user, directContext).then(ctx => { directContext = ctx; });
    } else if (userRole === 'STUDENT') {
      await this.buildStudentContext(userId, schoolId, user, directContext).then(ctx => { directContext = ctx; });
    } else {
      // SUPER_ADMIN or unknown — just name
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
      directContext += `Current User: ${name} (Role: ${userRole}).\n`;
    }

    const focusBlock = await this.describeVerifiedFocus(pageContext, schoolId, userRole);
    if (focusBlock) {
      directContext += `\n${focusBlock}\n`;
    }

    // ── RAG context — scoped by role ────────────────────────────────────────
    const lastUserMessage = messages.slice().reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      const ragResult = await this.contextRag.findRelevantContext(
        lastUserMessage.content, schoolId, userRole, 5, { userId },
      );
      contextText = ragResult.text;
    }

    this.logger.debug(`[Prompt] Role=${userRole}, School=${schoolName}`);

    // ── Active skills for this role ──────────────────────────────────────────
    const activeSkills = await this.loisSkills.getActiveForRole(userRole).catch(() => []);

    return {
      systemPrompt: this.buildPrompt(schoolName, directContext, contextText, userRole, loisConfig, schoolId, sysConfig, activeSkills),
      contextText,
      userRole,
      schoolName,
    };
  }

  // ── Teacher context ──────────────────────────────────────────────────────────
  private async buildTeacherContext(userId: string, schoolId: string, user: any, ctx: string): Promise<string> {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId, schoolId },
      include: {
        classTeachers: {
          include: {
            class: true,
            classArm: { include: { classLevel: true } },
            subjectRef: true,
          },
        },
        classArms: { include: { classLevel: true } },
        timetablePeriods: {
          where: { term: { status: 'ACTIVE' } },
          include: {
            class: true,
            classArm: { include: { classLevel: true } },
            subject: true,
          },
        },
      },
    });

    const displayName = teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : name || 'Teacher';
    ctx += `Current User: ${displayName} (Role: TEACHER).\n`;

    if (!teacher) {
      this.logger.warn(`No teacher record for user ${userId} in school ${schoolId}`);
      return ctx;
    }

    if (teacher.schoolType) ctx += `Teacher's Environment: ${teacher.schoolType} school level.\n`;

    const assignments: string[] = [];

    if (teacher.classTeachers?.length) {
      teacher.classTeachers.forEach(ct => {
        const subject = ct.subject || ct.subjectRef?.name || 'Subject';
        const levelName = ct.classArm?.classLevel?.name || '';
        const armName = ct.classArm?.name || '';
        const className = ct.class?.name || (levelName ? `${levelName} ${armName}`.trim() : armName) || 'Class';
        assignments.push(`- [Registry] ${subject} for ${className}${ct.isPrimary ? ' (Lead Teacher)' : ''}`);
      });
    }

    if (teacher.classArms?.length) {
      teacher.classArms.forEach(arm => {
        assignments.push(`- [Registry] Form Teacher for ${arm.classLevel?.name || 'Class'} ${arm.name}`);
      });
    }

    if (teacher.timetablePeriods?.length) {
      const map = new Map<string, Set<string>>();
      teacher.timetablePeriods.forEach(p => {
        const levelName = p.classArm?.classLevel?.name || '';
        const armName = p.classArm?.name || '';
        const cn = p.class?.name || (levelName ? `${levelName} ${armName}`.trim() : armName) || 'Unknown';
        if (!map.has(cn)) map.set(cn, new Set());
        map.get(cn)!.add(p.subject?.name || 'Subject');
      });
      map.forEach((subjects, cn) => {
        assignments.push(`- [Weekly Schedule] teaches ${[...subjects].join(', ')} for ${cn}`);
      });
    }

    const unique = [...new Set(assignments)];
    ctx += unique.length
      ? `Teacher's Active Assignments:\n${unique.join('\n')}\n`
      : `Teacher's Active Assignments: No class or subject assignments found yet.\n`;

    if (teacher.subject) ctx += `Teacher's Primary Specialisation: ${teacher.subject}\n`;

    return ctx;
  }

  // ── School admin context ─────────────────────────────────────────────────────
  private async buildAdminContext(userId: string, schoolId: string, user: any, ctx: string): Promise<string> {
    const [admin, studentCount, teacherCount, classCount] = await Promise.all([
      this.prisma.schoolAdmin.findFirst({
        where: { userId, schoolId },
        select: { firstName: true, lastName: true, role: true, schoolType: true },
      }),
      this.prisma.enrollment.count({ where: { schoolId, isActive: true } }),
      this.prisma.teacher.count({ where: { schoolId } }),
      this.prisma.class.count({ where: { schoolId } }),
    ]);

    const displayName = admin ? `${admin.firstName} ${admin.lastName}`.trim()
      : [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Administrator';

    ctx += `Current User: ${displayName} (Role: SCHOOL_ADMIN).\n`;

    if (admin) {
      const role = admin.role || 'Administrator';
      const scope = admin.schoolType ? ` — scoped to ${admin.schoolType} level` : '';
      ctx += `Admin Role: ${role}${scope}.\n`;
    }

    ctx += `School Statistics (live):\n`;
    ctx += `- Active student enrolments: ${studentCount}\n`;
    ctx += `- Teachers: ${teacherCount}\n`;
    ctx += `- Classes: ${classCount}\n`;

    return ctx;
  }

  // ── Student context ──────────────────────────────────────────────────────────
  private async buildStudentContext(userId: string, schoolId: string, user: any, ctx: string): Promise<string> {
    const student = await this.prisma.student.findFirst({
      where: { userId },
      include: {
        enrollments: {
          where: { schoolId, isActive: true },
          take: 1,
          orderBy: { enrollmentDate: 'desc' },
          include: {
            class: true,
            classArm: { include: { classLevel: true } },
            term: true,
          },
        },
      },
    });

    const displayName = student
      ? `${student.firstName} ${student.lastName}`.trim()
      : [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Student';

    ctx += `Current User: ${displayName} (Role: STUDENT).\n`;

    if (!student) return ctx;

    const enr = student.enrollments?.[0];
    if (enr) {
      const levelName = enr.classArm?.classLevel?.name || enr.classLevel || '';
      const armName = enr.classArm?.name || '';
      const className = enr.class?.name || (levelName ? `${levelName} ${armName}`.trim() : 'their class');
      ctx += `Student's Class: ${className}.\n`;
      if (enr.term) ctx += `Current Term: ${enr.term.name}.\n`;

      // Recent grade snapshot — last 5 published grades for context
      const recentGrades = await this.prisma.grade.findMany({
        where: { enrollmentId: enr.id, isPublished: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { subject: true, score: true, maxScore: true, gradeType: true },
      });

      if (recentGrades.length) {
        const gradeLines = recentGrades.map(g => {
          const pct = Number(g.maxScore) > 0 ? Math.round((Number(g.score) / Number(g.maxScore)) * 100) : 0;
          return `  - ${g.subject} (${g.gradeType}): ${Number(g.score)}/${Number(g.maxScore)} (${pct}%)`;
        });
        ctx += `Recent published grades:\n${gradeLines.join('\n')}\n`;
      }
    }

    return ctx;
  }

  /**
   * Re-loads the on-screen entity and ignores ids that do not belong to this school.
   */
  private async describeVerifiedFocus(
    pageContext: LoisPageContextInput | null | undefined,
    schoolId: string,
    userRole: string,
  ): Promise<string> {
    if (!pageContext?.type) return '';
    if (pageContext.schoolId && pageContext.schoolId !== schoolId) return '';

    try {
      if (pageContext.type === 'student' && pageContext.studentId) {
        const enrollment = await this.prisma.enrollment.findFirst({
          where: { schoolId, studentId: pageContext.studentId, isActive: true },
          select: {
            studentId: true,
            classLevel: true,
            class: { select: { id: true, name: true } },
            classArm: { select: { name: true, classLevel: { select: { name: true } } } },
            student: { select: { firstName: true, lastName: true } },
          },
        });
        if (!enrollment) return '';
        const name = `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim();
        const className =
          enrollment.class?.name ||
          `${enrollment.classArm?.classLevel?.name || enrollment.classLevel || ''} ${enrollment.classArm?.name || ''}`.trim();
        return `Current Screen Focus: Student ${name} (studentId=${enrollment.studentId}${className ? `, class=${className}` : ''}). Prefer this student unless the user asks about someone else.`;
      }

      if ((pageContext.type === 'class' || pageContext.type === 'level') && (pageContext.classId || pageContext.classArmId)) {
        if (pageContext.classId) {
          const klass = await this.prisma.class.findFirst({
            where: { id: pageContext.classId, schoolId },
            select: { id: true, name: true },
          });
          if (klass) {
            return `Current Screen Focus: Class ${klass.name} (classId=${klass.id}).`;
          }
        }
        if (pageContext.classArmId) {
          const arm = await this.prisma.classArm.findFirst({
            where: { id: pageContext.classArmId, classLevel: { schoolId } },
            select: { id: true, name: true, classLevel: { select: { name: true } } },
          });
          if (arm) {
            return `Current Screen Focus: ${arm.classLevel?.name || ''} ${arm.name} (classArmId=${arm.id}).`.trim();
          }
        }
      }

      if (pageContext.type === 'scheme' && pageContext.schemeId) {
        const scheme = await this.prisma.schemeOfWork.findFirst({
          where: { id: pageContext.schemeId, schoolId },
          select: { id: true, classLevel: { select: { name: true } } },
        });
        if (scheme) {
          const week = pageContext.weekNumber ? ` week ${pageContext.weekNumber}` : '';
          return `Current Screen Focus: Scheme of work${scheme.classLevel?.name ? ` for ${scheme.classLevel.name}` : ''}${week} (schemeId=${scheme.id}).`;
        }
      }

      if (pageContext.type === 'timetable') {
        const bits = ['Current Screen Focus: Class timetables'];
        if (pageContext.label) bits.push(`(${pageContext.label})`);
        if (pageContext.classId) bits.push(`classId=${pageContext.classId}`);
        if (pageContext.classArmId) bits.push(`classArmId=${pageContext.classArmId}`);
        return `${bits.join(' ')}. For Auto-Fill, inspect_scheduling_context first, then propose_timetable. Do not invent period rows.`;
      }

      if (pageContext.type === 'staff' && pageContext.teacherId) {
        const teacher = await this.prisma.teacher.findFirst({
          where: { id: pageContext.teacherId, schoolId },
          select: { id: true, firstName: true, lastName: true },
        });
        if (teacher) {
          return `Current Screen Focus: Staff ${teacher.firstName} ${teacher.lastName} (teacherId=${teacher.id}).`;
        }
      }

      if (pageContext.type === 'school' || pageContext.type === 'overview') {
        return 'Current Screen Focus: School overview (whole school).';
      }

      if (pageContext.label) {
        return `Current Screen Focus: ${pageContext.label}${userRole === 'SCHOOL_ADMIN' ? '' : ''}.`;
      }
    } catch (err) {
      this.logger.warn(`Focus verification failed: ${err}`);
    }
    return '';
  }

  // ── System prompt assembly ────────────────────────────────────────────────────
  private buildPrompt(
    schoolName: string,
    directContext: string,
    contextText: string,
    userRole: string,
    loisConfig: { customGreeting?: string | null; toneNote?: string | null; restrictedTopics?: string | null; schoolContext?: string | null } | null,
    schoolId?: string,
    sysConfig?: { identityOverride?: string | null; additionalRules?: string | null; teacherRulesOverride?: string | null; adminRulesOverride?: string | null; studentRulesOverride?: string | null } | null,
    activeSkills: { name: string; content: string; category: string }[] = [],
  ): string {
    // Role-specific behavioural rules — use DB override or hardcoded default
    const roleRules = this.getRoleRules(userRole, sysConfig);

    // School-level customisations from LoisConfig (if set)
    const customisation = [
      loisConfig?.schoolContext ? `School Context: ${loisConfig.schoolContext}` : '',
      loisConfig?.toneNote ? `Tone Guidance: ${loisConfig.toneNote}` : '',
      loisConfig?.restrictedTopics ? `Restricted Topics: Do not discuss ${loisConfig.restrictedTopics}.` : '',
    ].filter(Boolean).join('\n');

    // Identity block — use DB override or default
    const identityBlock = sysConfig?.identityOverride?.trim()
      ? sysConfig.identityOverride.trim()
      : `Your identity: You are Lois, the Myschoolbud AI Assistant assigned to ${schoolName || 'the school'}.

Introduction rule:
- At the start of a new conversation, you may mention you are Lois.
- If asked your name or who you are: say "I am Lois, the AI assistant for ${schoolName || 'this school'} on Myschoolbud."
- Otherwise do NOT open every reply with a formal introduction — answer directly.`;

    // Additional rules from DB (appended after core rules)
    const extraRules = sysConfig?.additionalRules?.trim()
      ? `\n${sysConfig.additionalRules.trim()}`
      : '';

    // Skills block — injected after role rules, before routing instructions
    const skillsBlock = activeSkills.length > 0
      ? `\nSKILLS & CAPABILITIES:\nThe following skills have been activated for your role. Follow their instructions precisely.\n\n${
          activeSkills.map((s) => `[${s.name.toUpperCase()} — ${s.category}]\n${s.content}`).join('\n\n')
        }\n`
      : '';

    return `
${identityBlock}

IMPORTANT: Use the following details to answer questions about the current user and school.
Current Identity Context:
${directContext || 'Basic school assistant context.'}

Relevant Knowledge Base Context (from RAG search):
${contextText || 'No specific knowledge base context found for this query.'}

User Role: ${userRole}
${customisation ? `\nSchool Customisations:\n${customisation}\n` : ''}

Core Operational Rules:
1. Always refer to yourself as Lois.
2. IDENTITY RULE: If the user asks who they are or what they teach/study, use "Current Identity Context" exactly — mention assigned classes, subjects, or grades as provided.
3. No Empty Promises: Do NOT say "Let me check that" or "I'll get back to you" unless you are making a tool call in the same turn.
4. Decisive Interaction: If a tool returns an error, inform the user and try a refined approach. Don't give up silently.
5. Use natural, conversational language — do not say "According to the context..."; state answers plainly.
6. Never reveal passwords or internal IDs.
7. Format responses with markdown for readability.
8. MEMORY: You have access to prior messages in this conversation. Reference them naturally when relevant — do not ask for information the user already gave.${extraRules}

${roleRules}
${skillsBlock}
TOOL ROUTING (typed tools only — never invent SQL):
- list_classes: resolve names like "JSS 2A" into classArmId/classId, or list all classes/arms.
- list_students: find or list students by name or class. Pass classQuery when you only have a class name.
- get_student_overview: one student's published grades and recent attendance.
- get_class_performance: class averages and who is below threshold. Pass classQuery if you lack ids.
- get_academic_risk_summary: school-wide (or teacher roster) students below threshold.
- get_scheme_of_work: published weeks, delivery status, missing lesson notes.
- get_now_in_class: what is on the timetable right now (Africa/Lagos).
- get_timetable: full day for a class (not just now). Pass day (e.g. Thursday) and classQuery.
- list_staff: teachers and admins by name.
- who_teaches: who teaches a subject in a class, plus form/class teacher.
- get_attendance_summary: present/absent/late counts.
- list_fee_debtors: outstanding school fees (does not take payment).
- list_admissions: application inbox by status.
- get_calendar: events and holidays in a date range.
- get_guardians: parent/guardian contacts for one student. Does not send.
- get_school_stats: headline counts only.
- list_lois_insights: issues already flagged in the background (academic risk, drops, SoW gaps, attendance, fees, admissions) — only types this admin can see.
- search_semantic: policies, handbooks, qualitative knowledge.
- draft_parent_message: draft only — never claim you sent it.
- inspect_scheduling_context: class timetable context (periods, subjects, teachers, missing teachers, schemes). Call this BEFORE propose_timetable. Never invent classId/teacherId.
- inspect_curriculum_options: Bud library weeks vs this term’s teachable weeks, live schemes, whether a timetable exists. Call BEFORE propose_scheme.
- propose_timetable: preview only. Returns planId. Does NOT save. Fill-empty unless the user asked to replace.
- propose_scheme: stores a scheme plan (planId). Does NOT generate until Apply on the card. If the user needs to upload a file, send them to the curriculum modal.
- Never call propose_timetable and propose_scheme in the same reply. Never apply two domains in one turn.
- Never claim a timetable or scheme is saved. The admin applies from the card (HTTP). If they type "proceed", tell them to use Apply on the card unless you already returned a planId — still do not invent apply calls.
- If teachers are missing, say slots can be created unassigned.
- Do not invent numbers. Quote figures from the latest tool result. If a tool errors, say so.

SCREEN FOCUS:
If "Current Screen Focus" is set, prefer that student/class/scheme unless the user clearly asks about someone else.
When asked who is teaching a class right now, call get_now_in_class (primary returns the class teacher).
When asked who teaches a subject, or who the form teacher is, call who_teaches.
If the user names a class without an id, call list_classes or pass classQuery — never guess ids.
    `.trim();
  }

  // ── Role-specific rule blocks ─────────────────────────────────────────────────
  private getRoleRules(
    userRole: string,
    sysConfig?: { teacherRulesOverride?: string | null; adminRulesOverride?: string | null; studentRulesOverride?: string | null } | null,
  ): string {
    switch (userRole) {
      case 'TEACHER':
        return sysConfig?.teacherRulesOverride?.trim() || `
TEACHER-SPECIFIC RULES:
- Tone: Be a helpful professional AI colleague to teachers.
- SECONDARY TEACHER GUARD: If the school type is SECONDARY, check "Teacher's Active Assignments". If a teacher asks to generate content for a subject NOT in their assignments, ask for confirmation before proceeding.
- CLASS CLARIFICATION: If the teacher teaches MULTIPLE classes and asks for class-specific content without naming the class, ask which class first. If they teach only ONE class, proceed directly.
- You can help with: lesson plans, quiz generation, essay grading, flashcards, summaries, student performance analysis, timetable queries.`;

      case 'SCHOOL_ADMIN':
        return sysConfig?.adminRulesOverride?.trim() || `
SCHOOL ADMIN-SPECIFIC RULES:
- Tone: Be a high-level strategic assistant to the school leadership.
- Tool access follows this admin's staff permissions. If a tool returns a permission error, explain they do not have access — do not invent the data.
- You can help with: school statistics, classes, staff coverage, student performance, attendance, fees outstanding, admissions, calendar, scheme of work, timetable, guardians, and the Lois insights inbox.
- TIMETABLE / CURRICULUM WORKFLOW: inspect first. Explain the snapshot. Propose stores a planId — it is not saved. Never apply without that planId. The admin clicks Apply on the card. If the class has no timetable, say so and offer a timetable before a scheme. If a timetable exists without schemes, list subjects and library vs calendar weeks. Never auto-chain apply across timetable and curriculum in one turn.
- For sensitive actions (e.g. suspending a student, emailing parents, taking a fee payment), you may draft text but MUST say it was not sent. They use the dashboard to send.
- Never invent student ids. Use list_students or the Current Screen Focus first.
- Never invent class ids. Use list_classes or classQuery first.`;

      case 'STUDENT':
        return sysConfig?.studentRulesOverride?.trim() || `
STUDENT-SPECIFIC RULES:
- Tone: Be encouraging, clear, and student-friendly. Avoid administrative or staffing discussions.
- You can help with: study guides, flashcards, summaries, quiz practice, subject explanations, homework help, understanding their grades.
- You CANNOT generate formal assessments, access other students' data, or perform administrative actions.
- If a student asks about another student's grades or personal details, politely decline.
- Use simple, age-appropriate language unless the student signals otherwise.`;

      default:
        return `
GENERAL RULES:
- Be helpful and professional.
- You can answer questions about the school and assist with educational content.`;
    }
  }
}
