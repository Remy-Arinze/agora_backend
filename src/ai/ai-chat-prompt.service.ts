import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiContextRagService } from './ai-context-rag.service';

/**
 * Builds Lois system prompt + identity context for chat (streaming and legacy).
 */
@Injectable()
export class AiChatPromptService {
  private readonly logger = new Logger(AiChatPromptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contextRag: AiContextRagService,
  ) {}

  async getChatPrompt(
    messages: { role: string; content: string }[],
    userId?: string,
    schoolId?: string,
  ): Promise<{ systemPrompt: string; contextText: string; userRole: string; schoolName: string }> {
    let contextText = '';
    let userRole = 'USER';
    let schoolName = '';
    let directContext = '';

    const now = new Date();
    const formatterConfig = { timeZone: 'Africa/Lagos', hour12: false } as any;
    const currentDay = now.toLocaleString('en-US', { ...formatterConfig, weekday: 'long' }).toUpperCase();
    const currentTime = now.toLocaleString('en-US', { ...formatterConfig, hour: '2-digit', minute: '2-digit' });

    directContext += `[REAL-TIME CLOCK] Today is ${currentDay}. The current time is ${currentTime} (WAT).\n`;

    if (schoolId && userId) {
      const [user, school, teacher] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, firstName: true, lastName: true },
        }),
        this.prisma.school.findUnique({
          where: { id: schoolId },
          select: {
            name: true,
            address: true,
            city: true,
            state: true,
            academicSessions: {
              where: { status: 'ACTIVE' },
              take: 1,
              orderBy: { startDate: 'desc' },
              select: {
                name: true,
                startDate: true,
                endDate: true,
                terms: {
                  where: { status: 'ACTIVE' },
                  take: 1,
                  select: { name: true, number: true, startDate: true, endDate: true },
                },
              },
            },
          },
        }),
        this.prisma.teacher.findFirst({
          where: { userId, schoolId },
          include: {
            classTeachers: {
              include: {
                class: true,
                classArm: {
                  include: { classLevel: true },
                },
                subjectRef: true,
              },
            },
            classArms: {
              include: { classLevel: true },
            },
            timetablePeriods: {
              where: { term: { status: 'ACTIVE' } },
              include: {
                class: true,
                classArm: {
                  include: { classLevel: true },
                },
                subject: true,
              },
            },
          },
        }),
      ]);

      if (user) {
        userRole = user.role;
        const name =
          user.firstName || user.lastName
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
            : teacher
              ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim()
              : 'User';

        directContext += `Current User: ${name} (Role: ${userRole}).\n`;
        this.logger.log(`[AI Context] Identity: ${name}, Role: ${userRole}, School: ${schoolId}`);

        const lastUserMessage = messages.slice().reverse().find((m) => m.role === 'user');
        if (lastUserMessage) {
          const ragResult = await this.contextRag.findRelevantContext(
            lastUserMessage.content,
            schoolId,
            userRole,
            5,
            { userId },
          );
          contextText = ragResult.text;
        }
      }

      if (school) {
        schoolName = school.name;
        directContext += `Current School: ${schoolName} located in ${school.address || ''}, ${school.city || ''}, ${school.state || ''}.\n`;

        const activeSession = school.academicSessions?.[0];
        if (activeSession) {
          directContext += `Active academic session: ${activeSession.name} (${activeSession.startDate.toDateString()} – ${activeSession.endDate.toDateString()}).\n`;
          const activeTerm = activeSession.terms?.[0];
          if (activeTerm) {
            directContext += `Current term: ${activeTerm.name} (term ${activeTerm.number}, ${activeTerm.startDate.toDateString()} – ${activeTerm.endDate.toDateString()}).\n`;
          }
        }
      }

      if (teacher) {
        this.logger.log(`Found teacher record for user ${userId} in school ${schoolId}.`);

        const assignments: string[] = [];

        if (teacher.schoolType) {
          directContext += `Teacher's Environment: ${teacher.schoolType} School level.\n`;
        }

        if (teacher.classTeachers?.length > 0) {
          const subjectAssignments = teacher.classTeachers.map((ct) => {
            const subject = ct.subject || ct.subjectRef?.name || 'Subject';
            const levelName = ct.classArm?.classLevel?.name || '';
            const armName = ct.classArm?.name || '';
            const className =
              ct.class?.name || (levelName ? `${levelName} ${armName}`.trim() : armName) || 'Class';
            return `- [Registry] ${subject} for ${className}${ct.isPrimary ? ' (Lead Teacher)' : ''}`;
          });
          assignments.push(...subjectAssignments);
        }

        if (teacher.classArms?.length > 0) {
          const formAssignments = teacher.classArms.map(
            (arm) => `- [Registry] Form Teacher for ${arm.classLevel?.name || 'Class'} ${arm.name}`,
          );
          assignments.push(...formAssignments);
        }

        if (teacher.timetablePeriods?.length > 0) {
          const timetableMap = new Map<string, Set<string>>();

          teacher.timetablePeriods.forEach((period) => {
            const levelName = period.classArm?.classLevel?.name || '';
            const armName = period.classArm?.name || '';
            const className =
              period.class?.name || (levelName ? `${levelName} ${armName}`.trim() : armName) || 'Unknown Class';
            const subjectName = period.subject?.name || 'Class Subject';

            if (!timetableMap.has(className)) {
              timetableMap.set(className, new Set());
            }
            timetableMap.get(className)?.add(subjectName);
          });

          timetableMap.forEach((subjects, className) => {
            const subjectsList = Array.from(subjects).join(', ');
            assignments.push(`- [Weekly Schedule] teaches ${subjectsList} for ${className}`);
          });
        }

        const uniqueAssignments = [...new Set(assignments)];

        if (uniqueAssignments.length > 0) {
          directContext += `Teacher's Active Assignments:\n${uniqueAssignments.join('\n')}\n`;
        } else {
          directContext += `Teacher's Active Assignments: No specific class or subject assignments found in the official registry or current timetable yet.\n`;
        }

        if (teacher.subject) {
          directContext += `Teacher's Primary Specialization: ${teacher.subject}\n`;
        }
      } else {
        this.logger.warn(`No teacher record found for user ${userId} in school ${schoolId}`);
      }
    }

    this.logger.debug(`Final Direct Context for AI: ${directContext}`);

    const systemPrompt = `
      Your identity: You are Lois, the Agora Open Schools AI Assistant assigned to ${schoolName || 'the school'}.
      Introduction rule: 
      - If it is the start of a conversation, you can mention you are Lois.
      - If the user asks for your name or who you are: Must say "I am Lois, the AI assistant for ${schoolName || 'this school'} on Agora Open Schools."
      - Otherwise, do NOT start every message with a formal introduction. Just answer the user's question directly.
      
      IMPORTANT: Use the following details to answer questions about the current user and school.
      Current Identity Context:
      ${directContext || 'Basic school assistant context.'}
      
      Relevant Knowledge Base Context (from RAG search): 
      ${contextText || 'No specific knowledge base context found for this query.'} 
      
      User Role: ${userRole}
      
      Operational Rules:
      1. Always refer to yourself as Lois.
      2. IDENTITY RULE: If the user asks who they are or what they teach, you MUST use the details in "Current Identity Context". Specifically mention their assigned classes (e.g., JSS 1A, SS 2B, etc.) and subjects exactly as provided in that section.
      3. No "Empty Promises": Do NOT say "One moment please", "Let me check that", or "I'll get back to you" UNLESS you are making a tool call in the same turn. If you finish your response with a promise to find more info, users expect that info to appear immediately in the same message stream.
      4. Decisive Interaction: If a tool returns an error (e.g., SQL Execution failed), inform the user that you are refining the approach and try a different query if it makes sense. Don't simply give up without explaining the refined attempt.
      5. Tone: Be helpful, professional, and slightly conversational as an AI colleague to teachers and staff.
      6. SECONDARY TEACHER SPECIALIZATION: If the user role is TEACHER and the school type is SECONDARY, check "Teacher's Active Assignments". If they ask to generate an assessment, quiz, or lesson plan for a subject NOT in those assignments, ask for confirmation first. Only proceed if they confirm or clearly stated permission in the initial prompt.
      7. CLASS CLARIFICATION: If the teacher handles MULTIPLE classes and asks for class-specific content (assessment, lesson plan, quiz) WITHOUT naming the class, ask which class it is for before calling generation tools. If they have only ONE class, proceed without asking.
      8. School questions: Use "Current Identity Context" and "Relevant Knowledge Base Context" together when answering about the school.
      9. Use natural, conversational language—do not say "According to the context..."; state answers plainly.
      10. Never reveal passwords or internal IDs.
      11. Maintain a helpful, professional, teacher-focused tone.
      12. Format responses with markdown for readability.

      HYBRID RAG ROUTING:
      - Use execute_sql for quantitative questions: "How many...", "List all...", "Find the student with ID...", "Count teachers in SS1".
      - Use search_semantic for qualitative questions: "Tell me about...", "Explain the policy for...", "Give me a summary of...", "What are the objectives for...".
      - Use get_academic_risk_summary when the user asks who is struggling, at risk, failing, below average, or needs academic intervention (uses published grades; school admins see school-wide, teachers only their classes).
      - For queries needing both (e.g., "Analyze the performance of SS1 Math vs policy"), choose the most appropriate or sequence them.
      
      TIMETABLE AND CLASS TEACHER RESOLUTION (CRITICAL):
      You have access to the real-world time in the "Current Identity Context".
      When a user asks "What class is going on in [Class] right now?" or "Who is taking [Class]?":
      1. Primary Schools: Primary classes ALWAYS have one main class teacher. Do NOT look up subject teachers. If asked who is taking the class, inform them of the main Class Teacher.
      2. Secondary Schools: Classes are subject-based. FIRST, execute_sql on "TimetablePeriod" using the current "dayOfWeek" (e.g., 'MONDAY') and time ("startTime" <= 'HH:MM' AND "endTime" >= 'HH:MM') to find the active subject. THEN, resolve the teacher assigned to that subject.
      3. Free Period: If the "TimetablePeriod" query returns no records for the current time in Secondary, inform the user they are on a free period.
      
      SCHEMA CONTEXT FOR SQL (CRITICAL):
      - Tables (MUST use double quotes): "Student", "Teacher", "Class", "ClassLevel", "ClassArm", "ClassTeacher", "Subject", "Enrollment", "Grade", "Attendance", "AcademicSession", "Term", "TimetablePeriod", "Assessment".
      - "TimetablePeriod" has "termId", "dayOfWeek", "startTime", "endTime", "classId", "classArmId", "teacherId", "subjectId". Join "Term" on "TimetablePeriod"."termId" = "Term"."id", then "AcademicSession" on "Term"."academicSessionId" = "AcademicSession"."id", and require "AcademicSession"."schoolId" = '${schoolId}' (in addition to any "schoolId" filter on other tables).
      - Relationships: "ClassTeacher" links "Teacher" to "Class" (tertiary) or "ClassArm" (secondary).
      - "ClassArm" links to "ClassLevel" (e.g., JSS 1) and has a "name" (e.g., A).
      - Columns (MUST use double quotes if camelCase): "id", "schoolId", "firstName", "lastName", "email", "phone", "role", "score", "maxScore", "gradeType", "name", "code", "teacherId", "classId", "classArmId".
      - Example Query: SELECT count(*) FROM "Teacher" WHERE "schoolId" = '${schoolId}';
      - Grade types: CA, ASSIGNMENT, EXAM.
      - Attendance status: PRESENT, ABSENT, LATE.
      - ALWAYS filter by "schoolId" = '${schoolId}' to ensure data separation.
    `;

    return { systemPrompt, contextText, userRole, schoolName };
  }
}
