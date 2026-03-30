import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { PrismaClient, Prisma } from '@prisma/client';
import OpenAI, { AzureOpenAI } from 'openai';
import { Response } from 'express';

// ??? Interfaces ???????????????????????????????????????????????????????????????

export interface GenerateFlashcardsOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  count?: number;
  curriculum?: string;
}

export interface Flashcard {
  front: string;
  back: string;
  hint?: string;
}

export interface GenerateSummaryOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  weekContent?: string;
  curriculum?: string;
}

export interface GenerateQuizOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  questionCount?: number;
  questionTypes?: ('multiple_choice' | 'true_false' | 'short_answer')[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface QuizQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface GenerateLessonPlanOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  objectives: string[];
  duration?: number;
  curriculum?: string;
}

export interface LessonPlan {
  title: string;
  objectives: string[];
  materials: string[];
  introduction: string;
  mainContent: { activity: string; duration: string; description: string }[];
  assessment: string;
  homework?: string;
  differentiation?: string;
}

export interface GradeEssayOptions {
  essay: string;
  prompt: string;
  rubric?: string;
  maxScore?: number;
  subject: string;
  gradeLevel: string;
}

export interface EssayGrade {
  score: number;
  maxScore: number;
  feedback: string;
  strengths: string[];
  areasForImprovement: string[];
  suggestions: string[];
}

export interface GenerateQuestionsOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  questionCount?: number;
  questionTypes?: ('multiple_choice' | 'true_false' | 'short_answer' | 'essay')[];
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  curriculum?: string;
}

// Agora Chat Tools (Hybrid RAG: SQL + Semantic)
const AGORA_TOOLS: Array<{ type: 'function'; function: { name: string; description: string; parameters: object } }> = [
  {
    type: 'function',
    function: {
      name: 'execute_sql',
      description: 'Run a read-only SQL query to get counts, facts, or specific filtered records from the school database. Available tables: Student, Teacher, Class, ClassArm, Subject, Enrollment, Grade, Attendance. Use for quantitative questions like "How many...", "List all...", or "Find the student with ID...". ALWAYS filter by schoolId.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'The SELECT SQL query to execute. Must be read-only.' },
        },
        required: ['sql'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_semantic',
      description: 'Perform a semantic vector search for information within the school knowledge base. Use for open-ended questions, summaries, or finding similar concepts in handbooks or policies.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The natural language search query' },
          limit: { type: 'number', description: 'Max number of results to return, default 5' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_school_stats',
      description: 'Get real-time statistics for a school including total counts of students, teachers, and classes. Use when the user asks for high-level numbers about the school.',
      parameters: {
        type: 'object',
        properties: {
          schoolId: { type: 'string', description: 'The unique ID of the school' },
        },
        required: ['schoolId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grade_essay',
      description: 'Grade a student essay based on a prompt and optional rubric. Returns score, feedback, strengths, and areas for improvement.',
      parameters: {
        type: 'object',
        properties: {
          essay: { type: 'string', description: 'The full text of the student essay' },
          prompt: { type: 'string', description: 'The prompt or question the student was answering' },
          subject: { type: 'string', description: 'The subject of the essay' },
          gradeLevel: { type: 'string', description: 'The grade level of the student' },
          rubric: { type: 'string', description: 'Optional grading rubric or criteria' },
          maxScore: { type: 'number', description: 'Maximum possible score, default 100' },
        },
        required: ['essay', 'prompt', 'subject', 'gradeLevel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_lesson_plan',
      description: 'Generate a detailed lesson plan. Use this tool even if optional details are missing; LOIS will infer them from context.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The lesson topic' }, 
          subject: { type: 'string', description: 'The academic subject' }, 
          gradeLevel: { type: 'string', description: 'e.g., JSS 1, SS 3' },
          objectives: { type: 'array', items: { type: 'string' } }, 
          duration: { type: 'number', description: 'Duration in minutes' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_quiz',
      description: 'Generate quick quiz questions. Use this tool for ALL quiz requests to ensure the interactive builder appears.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The quiz topic' }, 
          subject: { type: 'string', description: 'The academic subject' }, 
          gradeLevel: { type: 'string', description: 'e.g., JSS 1' },
          questionCount: { type: 'number' }, 
          questionTypes: { 
            type: 'array', 
            items: { type: 'string', enum: ['multiple_choice', 'true_false', 'short_answer'] },
            description: 'Types of questions to include'
          },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
        required: ['topic', 'subject', 'gradeLevel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_flashcards',
      description: 'Create study flashcards for a topic.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' }, subject: { type: 'string' }, gradeLevel: { type: 'string' }, count: { type: 'number' },
        },
        required: ['topic', 'subject', 'gradeLevel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_summary',
      description: 'Generate a study summary for a topic.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' }, subject: { type: 'string' }, gradeLevel: { type: 'string' },
        },
        required: ['topic', 'subject', 'gradeLevel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_assessment',
      description: 'Generate formal assessment questions. MANDATORY: ALWAYS use this tool if the user wants to create an assessment/exam so they can access the full-screen editor.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Assessment topic' }, 
          subject: { type: 'string', description: 'The academic subject' }, 
          gradeLevel: { type: 'string', description: 'e.g., SS 2' },
          questionCount: { type: 'number' }, 
          questionTypes: { 
            type: 'array', 
            items: { type: 'string', enum: ['multiple_choice', 'short_answer', 'essay'] },
            description: 'Types of questions to include'
          },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'mixed'] },
        },
        required: ['topic', 'subject', 'gradeLevel'],
      },
    },
  },
];


/**
 * AI Service - Wrapper around OpenAI for all AI-powered features
 * Supports SSE streaming, agentic tool-calling, and advanced RAG
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;
  private embeddingsClient: OpenAI | null = null;
  private readonly model: string;
  private readOnlyPrisma: PrismaClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const readOnlyUrl = this.configService.get<string>('READONLY_DATABASE_URL') || this.configService.get<string>('DATABASE_URL') || this.configService.get<string>('DB_URL');
    this.readOnlyPrisma = new PrismaClient({
      datasources: { db: { url: readOnlyUrl } }
    });

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const azureApiKey = this.configService.get<string>('AZURE_OPENAI_API_KEY');
    const azureEndpoint = this.configService.get<string>('AZURE_OPENAI_ENDPOINT');
    const azureDeployment = this.configService.get<string>('AZURE_OPENAI_DEPLOYMENT');
    const azureApiVersion = this.configService.get<string>('AZURE_OPENAI_API_VERSION');

    const azureEmbedKey = this.configService.get<string>('AZURE_OPENAI_EMBEDDING_API_KEY');
    const azureEmbedEndpoint = this.configService.get<string>('Azure_OPENAI_EMBEDDING_ENDPOINT') || this.configService.get<string>('AZURE_OPENAI_EMBEDDING_ENDPOINT');
    const azureEmbedDeployment = this.configService.get<string>('AZURE_OPENAI_EMBEDDING_DEPLOYMENT');
    const azureEmbedApiVersion = this.configService.get<string>('AZURE_OPENAI_EMBEDDING_API_VERSION');

    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o';

    if (azureApiKey && azureEndpoint && azureDeployment) {
      this.openai = new AzureOpenAI({
        apiKey: azureApiKey,
        endpoint: azureEndpoint,
        apiVersion: azureApiVersion || '2025-01-01-preview',
        deployment: azureDeployment,
      }) as any;
      this.logger.log(`Azure OpenAI initialized with deployment: ${azureDeployment}`);
    } else if (apiKey && apiKey !== 'your_openai_api_key_here') {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('Standard OpenAI client initialized');
    } else {
      this.logger.warn('AI services are not configured (neither OpenAI nor Azure)');
    }

    // Initialize Embeddings Client
    if (azureEmbedKey && azureEmbedEndpoint && azureEmbedDeployment) {
      this.embeddingsClient = new AzureOpenAI({
        apiKey: azureEmbedKey,
        endpoint: azureEmbedEndpoint,
        apiVersion: azureEmbedApiVersion || '2023-05-15',
        deployment: azureEmbedDeployment,
      }) as any;
      this.logger.log(`Azure OpenAI Embeddings initialized with deployment: ${azureEmbedDeployment}`);
    } else {
      this.embeddingsClient = this.openai;
      if (this.openai) {
        this.logger.log('Using default OpenAI client for embeddings fallback');
      }
    }
  }

  /**
   * Check if OpenAI is configured
   */
  isConfigured(): boolean {
    return this.openai !== null;
  }

  /**
   * Ensure OpenAI is configured before making calls
   */
  private ensureConfigured(): void {
    if (!this.openai) {
      throw new BadRequestException(
        'AI features are not configured. Please contact your administrator.'
      );
    }
  }

  // ??? SSE Helper ?????????????????????????????????????????????????????????????

  private sendSSE(res: Response, event: { event: string; data: unknown }): void {
    res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
  }

  // ??? Advanced RAG Pipeline ??????????????????????????????????????????????????

  /**
   * Create vector embedding for text
   */
  async createEmbedding(text: string): Promise<number[]> {
    this.ensureConfigured();
    if (!this.embeddingsClient) {
      throw new BadRequestException('Embeddings client is not configured.');
    }
    try {
      const modelName = this.configService.get<string>('AZURE_OPENAI_EMBEDDIGN_MODEL_NAME')
        || this.configService.get<string>('AZURE_OPENAI_EMBEDDING_MODEL_NAME')
        || 'text-embedding-3-small';

      const response = await this.embeddingsClient.embeddings.create({
        model: modelName,
        input: text.substring(0, 8192),
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Embedding failed: ${error}`);
      throw new BadRequestException('Failed to process context for search');
    }
  }

  /**
   * Advanced context retrieval with relevance scoring and re-ranking
   */
  async findRelevantContext(
    query: string,
    schoolId: string,
    role: string,
    limit: number = 5
  ): Promise<{ text: string; sources: { type: string; relevance: number }[] }> {
    try {
      const embedding = await this.createEmbedding(query);
      const vectorString = `[${embedding.join(',')}]`;

      // Enhanced query with cosine distance scoring and metadata
      const chunks: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT content, metadata, (embedding <=> $3::vector) as distance
        FROM "KnowledgeChunk"
        WHERE "schoolId" = $1
        AND (
          (metadata->'permissions'->'roles')::jsonb ? $2
          OR (metadata->'permissions'->'isPublic')::boolean = true
        )
        ORDER BY embedding <=> $3::vector
        LIMIT $4
      `, schoolId, role, vectorString, limit);

      if (!chunks || chunks.length === 0) {
        return { text: '', sources: [] };
      }

      // Filter by relevance threshold (cosine distance < 0.85)
      const relevantChunks = chunks.filter(c => c.distance < 0.85);

      if (relevantChunks.length === 0) {
        return { text: '', sources: [] };
      }

      // Build enriched context with source attribution
      const sources = relevantChunks.map(c => ({
        type: c.metadata?.type || 'unknown',
        relevance: Math.round((1 - c.distance) * 100),
      }));

      const contextParts = relevantChunks.map((c, i) => {
        const sourceLabel = c.metadata?.type === 'student_progress'
          ? '?? Student Performance'
          : c.metadata?.type === 'curriculum'
            ? '?? Curriculum Plan'
            : c.metadata?.type === 'assessment'
              ? '?? Teacher Assessment'
              : c.metadata?.type === 'class_info'
                ? '?? Class Info'
                : c.metadata?.type === 'school_info'
                  ? '?? School Profile'
                  : c.metadata?.type === 'teacher_info'
                    ? '????? Teacher Profile'
                    : '?? School Knowledge';
        return `[Source ${i + 1}: ${sourceLabel} ? ${sources[i].relevance}% relevance]\n${c.content}`;
      });

      return {
        text: contextParts.join('\n\n---\n\n'),
        sources,
      };
    } catch (error) {
      this.logger.error(`Context retrieval failed: ${error}`);
      return { text: '', sources: [] };
    }
  }

  // ??? System Prompt Builder ??????????????????????????????????????????????????

  private async getChatPrompt(
    messages: { role: string; content: string }[],
    userId?: string,
    schoolId?: string
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
          select: { role: true, firstName: true, lastName: true }
        }),
        this.prisma.school.findUnique({
          where: { id: schoolId },
          select: { name: true, address: true, city: true, state: true }
        }),
        this.prisma.teacher.findFirst({
          where: { userId, schoolId },
          include: {
            classTeachers: {
              include: {
                class: true,
                classArm: {
                  include: { classLevel: true }
                },
                subjectRef: true
              }
            },
            classArms: {
              include: { classLevel: true }
            },
            timetablePeriods: {
              where: { term: { status: 'ACTIVE' } }, // Only look at current timetable
              include: {
                class: true,
                classArm: {
                  include: { classLevel: true }
                },
                subject: true
              }
            }
          }
        })
      ]);

      if (user) {
        userRole = user.role;
        const name = (user.firstName || user.lastName)
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
          : (teacher ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() : 'User');

        directContext += `Current User: ${name} (Role: ${userRole}).\n`;
        this.logger.log(`[AI Context] Identity: ${name}, Role: ${userRole}, School: ${schoolId}`);

        const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user');
        if (lastUserMessage) {
          const ragResult = await this.findRelevantContext(lastUserMessage.content, schoolId, userRole);
          contextText = ragResult.text;
        }
      }

      if (school) {
        schoolName = school.name;
        directContext += `Current School: ${schoolName} located in ${school.address || ''}, ${school.city || ''}, ${school.state || ''}.\n`;
      }

      if (teacher) {
        this.logger.log(`Found teacher record for user ${userId} in school ${schoolId}.`);

        let assignments = [];

        // 4. Primary Specialization & School Type
        if (teacher.schoolType) {
          directContext += `Teacher's Environment: ${teacher.schoolType} School level.\n`;
        }

        // 1. Subject assignments (Official Registry)
        if (teacher.classTeachers?.length > 0) {
          const subjectAssignments = teacher.classTeachers.map(ct => {
            const subject = ct.subject || ct.subjectRef?.name || 'Subject';
            const levelName = ct.classArm?.classLevel?.name || '';
            const armName = ct.classArm?.name || '';
            const className = ct.class?.name || (levelName ? `${levelName} ${armName}`.trim() : armName) || 'Class';
            return `- [Registry] ${subject} for ${className}${ct.isPrimary ? ' (Lead Teacher)' : ''}`;
          });
          assignments.push(...subjectAssignments);
        }

        // 2. Form teacher (Class Lead) assignments
        if (teacher.classArms?.length > 0) {
          const formAssignments = teacher.classArms.map(arm =>
            `- [Registry] Form Teacher for ${arm.classLevel?.name || 'Class'} ${arm.name}`
          );
          assignments.push(...formAssignments);
        }

        // 3. Timetable-based assignments (Current Schedule)
        if (teacher.timetablePeriods?.length > 0) {
          const timetableMap = new Map<string, Set<string>>();

          teacher.timetablePeriods.forEach(period => {
            const levelName = period.classArm?.classLevel?.name || '';
            const armName = period.classArm?.name || '';
            const className = period.class?.name || (levelName ? `${levelName} ${armName}`.trim() : armName) || 'Unknown Class';
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

        // Unique assignments only
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

    const isNewConversation = messages.filter(m => m.role === 'user').length <= 1;

    const systemPrompt = `
      Your identity: You are Lois, the Agora School Space AI Assistant assigned to ${schoolName || 'the school'}.
      Introduction rule: 
      - If it is the start of a conversation, you can mention you are Lois.
      - If the user asks for your name or who you are: Must say "I am Lois, the AI assistant for ${schoolName || 'this school'} on Agora School Space."
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
      5. Tone: Be helpful, professional, and slightly conversational as an AI colleague to the teachers.      3. SECONDARY TEACHER SPECIALIZATION RULE:
         - If the user role is TEACHER and the school type is SECONDARY:
         - Check the "Teacher's Active Assignments" in the context.
         - If the user asks to generate an assessment, quiz, or lesson plan for a subject that is NOT in their active assignments, you MUST ask for confirmation first.
         - Example: "I see you're registered as a Chemistry teacher for JSS 1A. Since you're asking for a Mathematics assessment, would you like me to proceed with that, or is there a specific reason for the change?"
         - Only proceed with generating if they confirm or if they explicitly stated they have permission/need for it in the initial prompt.

      4. CLASS CLARIFICATION RULE:
         - If the teacher handles MULTIPLE classes (e.g., JSS 1A and JSS 1B) and asks for class-specific content (Assessment, Lesson Plan, Quiz) WITHOUT specifying the target class, you MUST ask which class they are preparing for before calling any generation tools.
         - Example: "I can help with that! Which class is this quiz for: JSS 1A or JSS 1B?"
         - If they only have ONE class, do NOT ask; just proceed using that class context.

      5. If the user asks about the SCHOOL, use the "Current Identity Context" and "Relevant Knowledge Base Context".
      5. Always use natural, conversational language. Don't say "According to the context...", just state the answer as if you know it.
      6. Never reveal sensitive data like passwords or internal IDs.
      7. Maintain a helpful, professional, and teacher-focused tone.
      8. Format responses with markdown for readability.

      HYBRID RAG ROUTING:
      - Use execute_sql for quantitative questions: "How many...", "List all...", "Find the student with ID...", "Count teachers in SS1".
      - Use search_semantic for qualitative questions: "Tell me about...", "Explain the policy for...", "Give me a summary of...", "What are the objectives for...".
      - For queries needing both (e.g., "Analyze the performance of SS1 Math vs policy"), choose the most appropriate or sequence them.
      
      TIMETABLE AND CLASS TEACHER RESOLUTION (CRITICAL):
      You have access to the real-world time in the "Current Identity Context".
      When a user asks "What class is going on in [Class] right now?" or "Who is taking [Class]?":
      1. Primary Schools: Primary classes ALWAYS have one main class teacher. Do NOT look up subject teachers. If asked who is taking the class, inform them of the main Class Teacher.
      2. Secondary Schools: Classes are subject-based. FIRST, execute_sql on "TimetablePeriod" using the current "dayOfWeek" (e.g., 'MONDAY') and time ("startTime" <= 'HH:MM' AND "endTime" >= 'HH:MM') to find the active subject. THEN, resolve the teacher assigned to that subject.
      3. Free Period: If the "TimetablePeriod" query returns no records for the current time in Secondary, inform the user they are on a free period.
      
      SCHEMA CONTEXT FOR SQL (CRITICAL):
      - Tables (MUST use double quotes): "Student", "Teacher", "Class", "ClassLevel", "ClassArm", "ClassTeacher", "Subject", "Enrollment", "Grade", "Attendance", "AcademicSession", "Term", "Assessment".
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

  // ??? Agentic Streaming Chat (SSE) ??????????????????????????????????????????

  /**
   * Main SSE streaming endpoint with agentic tool-calling
   * This is the new primary chat method that replaces the old one for the frontend
   */
  async chatStreamSSE(
    res: Response,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    userId?: string,
    conversationId?: string,
    schoolId?: string,
    remainingTokens: number = Infinity
  ): Promise<any> {
    this.ensureConfigured();

    const { systemPrompt, userRole } = await this.getChatPrompt(messages, userId, schoolId);

    let fullAssistantContent = '';
    let finalConversationId = conversationId || null;
    let totalUsage: any = null;
    let estimatedTokens = 0;
    const toolEvents: any[] = [];

    // Pre-create conversation if new to ensure frontend has ID for URL sync immediately
    if (userId && !finalConversationId) {
      try {
        const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user');
        const title = lastUserMessage?.content
          ? (lastUserMessage.content.substring(0, 40) + (lastUserMessage.content.length > 40 ? '...' : ''))
          : 'New Chat';

        const conversation = await this.prisma.chatConversation.create({
          data: {
            userId,
            schoolId,
            title,
            messages: {
              create: messages
                .filter(m => m.role.toLowerCase() !== 'system') // Fix: Filter out 'system' messages case-insensitively
                .map(m => ({
                  role: m.role as 'user' | 'assistant', // Ensure role is 'user' or 'assistant' for creation
                  content: m.content
                }))
            }
          }
        });
        finalConversationId = conversation.id;
        
        // Send immediate ID sync to frontend
        this.sendSSE(res, {
            event: 'conversation_id',
            data: { conversationId: finalConversationId }
        });
      } catch (err) {
        this.logger.error(`Failed to pre-create conversation: ${err}`);
      }
    }

    try {
      let currentMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      let turn = 0;
      const MAX_TURNS = 3;

      while (turn < MAX_TURNS) {
        turn++;
        const response = await this.openai!.chat.completions.create({
          model: this.model,
          messages: currentMessages,
          tools: AGORA_TOOLS as OpenAI.Chat.Completions.ChatCompletionTool[],
          tool_choice: 'auto',
          temperature: 0.7,
        });

        const choice = response.choices[0];
        totalUsage = response.usage || totalUsage;

        const toolCalls = choice.message.tool_calls?.filter(
          (tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function'
        );

        if (!toolCalls || toolCalls.length === 0) {
          // Final iteration: stream the final content to the user
          const finalStream = await this.openai!.chat.completions.create({
            model: this.model,
            messages: currentMessages,
            stream: true,
            temperature: 0.7,
          });

          for await (const chunk of finalStream as any) {
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              fullAssistantContent += delta.content;
              estimatedTokens += Math.ceil(delta.content.length / 3.5);

              if (estimatedTokens > remainingTokens) {
                finalStream.controller.abort();
                this.sendSSE(res, {
                  event: 'error',
                  data: { message: 'Credit limit reached. Please top up to continue.' },
                });
                break;
              }

              this.sendSSE(res, {
                event: 'token',
                data: { token: delta.content },
              });
            }
          }
          break; // Done with all turns
        }

        // TOOL EXECUTION TURN
        currentMessages.push(choice.message);
        
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          // Send thinking event
          const thinkingEvent = { message: this.getToolThinkingMessage(functionName) };
          this.sendSSE(res, { event: 'thinking', data: thinkingEvent });
          toolEvents.push({ type: 'thinking', ...thinkingEvent });

          // Send tool_start event
          const toolStartEvent = {
            toolName: functionName,
            toolDisplayName: this.getToolDisplayName(functionName),
            args: functionArgs,
          };
          this.sendSSE(res, { event: 'tool_start', data: toolStartEvent });
          toolEvents.push({ type: 'tool_start', ...toolStartEvent });

          let toolResult: any;
          try {
            const result = await this.executeAgentTool(functionName, functionArgs, { schoolId, userRole });
            toolResult = result.data;
          } catch (tErr: any) {
            this.logger.error(`Tool execution error: ${tErr}`);
            toolResult = { error: tErr?.message || 'Tool failed' };
          }
          
          const toolResultEvent = {
            toolName: functionName,
            toolDisplayName: this.getToolDisplayName(functionName),
            result: toolResult,
          };
          this.sendSSE(res, { event: 'tool_result', data: toolResultEvent });
          toolEvents.push({ type: 'tool_result', ...toolResultEvent });

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }
        
        // Loop back and let AI react to tool results
      }

      // ??? Persist Final State ??????????????????????????????????????
      if (userId && finalConversationId) {
        // 1. If this was a follow-up, ensure the latest user message is saved
        if (conversationId) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.role === 'user') {
            await this.prisma.chatMessage.create({
              data: {
                conversationId: finalConversationId,
                role: 'user',
                content: lastMessage.content
              }
            });
          }
        }

        // 2. Save the assistant's final response and all tool events
        await this.prisma.chatMessage.create({
          data: {
            conversationId: finalConversationId,
            role: 'assistant',
            content: fullAssistantContent || 'No response generated.',
            toolEvents: toolEvents.length > 0 ? toolEvents : undefined
          }
        });
      }

      // Send done event
      this.sendSSE(res, {
        event: 'done',
        data: {
          conversationId: finalConversationId || '',
          usage: totalUsage,
        },
      });

      return { total_tokens: (totalUsage?.total_tokens || 0) + estimatedTokens };
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.logger.error(`SSE Chat failed: ${error}`);
        this.sendSSE(res, {
          event: 'error',
          data: { message: 'AI assistant is currently unavailable. Please try again later.' },
        });
      }
      return { total_tokens: (totalUsage?.total_tokens || 0) + estimatedTokens };
    }
  }

  // ??? Agent Tool Executor ????????????????????????????????????????????????????

  private async executeAgentTool(
    toolName: string,
    args: any,
    context?: { schoolId?: string; userRole?: string }
  ): Promise<{ data: any; usage: any }> {
    switch (toolName) {
      case 'generate_lesson_plan':
        return this.generateLessonPlan({
          topic: args.topic || 'General Topic',
          subject: args.subject || 'General Studies',
          gradeLevel: args.gradeLevel || 'Any',
          objectives: args.objectives || ['Understand key concepts', 'Apply knowledge practically'],
          duration: args.duration || 40,
        });

      case 'generate_quiz': {
        const res = await this.generateQuiz({
          topic: args.topic || 'Quick Quiz',
          subject: args.subject || 'General',
          gradeLevel: args.gradeLevel || 'Any',
          questionCount: args.questionCount || 5,
          questionTypes: args.questionTypes || ['multiple_choice'],
          difficulty: args.difficulty || 'medium',
        });

        // Resolve subjectId from name
        if (context?.schoolId && args.subject) {
          const subject = await this.prisma.subject.findFirst({
            where: {
              schoolId: context.schoolId,
              name: { contains: args.subject, mode: 'insensitive' },
              isActive: true
            },
            select: { id: true }
          });
          if (subject) {
            (res.data as any).subjectId = subject.id;
          }
        }
        return res;
      }

      case 'generate_flashcards':
        return this.generateFlashcards({
          topic: args.topic || 'General Revision',
          subject: args.subject || 'General',
          gradeLevel: args.gradeLevel || 'Any',
          count: args.count || 10,
        });

      case 'generate_summary':
        return this.generateSummary({
          topic: args.topic || 'Content Summary',
          subject: args.subject || 'General',
          gradeLevel: args.gradeLevel || 'Any',
        });

      case 'generate_assessment': {
        const res = await this.generateAssessmentQuestions({
          topic: args.topic || 'Assessment',
          subject: args.subject || 'General',
          gradeLevel: args.gradeLevel || 'Any',
          questionCount: args.questionCount || 20,
          questionTypes: args.questionTypes || ['multiple_choice', 'short_answer', 'essay'],
          difficulty: args.difficulty || 'mixed',
        });

        // Resolve subjectId from name
        if (context?.schoolId && args.subject) {
          const subject = await this.prisma.subject.findFirst({
            where: {
              schoolId: context.schoolId,
              name: { contains: args.subject, mode: 'insensitive' },
              isActive: true
            },
            select: { id: true }
          });
          if (subject) {
            (res.data as any).subjectId = subject.id;
          }
        }
        return res;
      }

      case 'grade_essay':
        return this.gradeEssay({
          essay: args.essay,
          prompt: args.prompt,
          subject: args.subject,
          gradeLevel: args.gradeLevel,
          rubric: args.rubric,
          maxScore: args.maxScore || 100,
        });

      case 'get_school_stats':
        return this.getSchoolStats(args.schoolId);

      case 'execute_sql':
        return this.executeSql(args.sql, context?.schoolId);

      case 'search_semantic':
        return this.searchSemantic(
          args.query,
          args.limit,
          context?.schoolId,
          context?.userRole,
        );

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // ??? Direct Logic for Admin Tools ??????????????????????????????????????????

  private async executeSql(sql: string, schoolId?: string): Promise<{ data: any; usage: any }> {
    if (!schoolId) {
      return { data: { error: 'School ID context is required for secure querying.' }, usage: null };
    }

    const trimmedSql = sql.trim();
    const lowerSql = trimmedSql.toLowerCase();

    // 1. Basic Read-Only check (kept for prompt clarity)
    if (!lowerSql.startsWith('select')) {
      return { data: { error: 'Only read-only SELECT queries are allowed.' }, usage: null };
    }

    try {
      // Enforce RLS by executing inside a transaction and setting the local tenant config
      // Ensure the postgres read-only user respects RLS
      const results = await this.readOnlyPrisma.$transaction(async (tx) => {
        // Enforce physical Row Level Security in Postgres:
        await tx.$executeRawUnsafe(`SET LOCAL row_security = on;`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_school_id = '${schoolId}';`);

        // Execute the AI-generated query
        const results = await tx.$queryRawUnsafe(sql);

        // Handle BigInt serialization for JSON (NestJS/JSON.stringify doesn't support it)
        return JSON.parse(
          JSON.stringify(results, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
          )
        );
      });

      return { data: results, usage: null };
    } catch (error: any) {
      return { data: { error: `SQL Execution failed: ${error?.message || 'Invalid query'}. Please refine your query.` }, usage: null };
    }
  }

  private async searchSemantic(
    query: string,
    limit?: number,
    schoolId?: string,
    role?: string,
  ) {
    const effectiveLimit = limit ?? 5;
    if (schoolId && role) {
      const { text, sources } = await this.findRelevantContext(
        query,
        schoolId,
        role,
        effectiveLimit,
      );
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

  // ??? Direct Logic for Admin Tools ??????????????????????????????????????????

  private async getSchoolStats(schoolId: string): Promise<{ data: any; usage: any }> {
    if (!schoolId) return { data: { error: 'School ID is required' }, usage: null };

    const [classCount, teacherCount, studentCount] = await Promise.all([
      this.prisma.class.count({ where: { schoolId } }),
      this.prisma.teacher.count({ where: { schoolId } }),
      this.prisma.enrollment.count({ where: { schoolId } })
    ]);

    return {
      data: {
        classes: classCount,
        teachers: teacherCount,
        students: studentCount,
        totalPopulation: studentCount + teacherCount
      },
      usage: null
    };
  }

  private getToolDisplayName(toolName: string): string {
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
    };
    return names[toolName] || toolName.replace(/_/g, ' ');
  }

  private getToolThinkingMessage(toolName: string): string {
    const messages: Record<string, string> = {
      generate_lesson_plan: "I'll craft a detailed lesson plan for you...",
      generate_quiz: "Let me generate some quiz questions...",
      generate_flashcards: "Creating study flashcards for you...",
      generate_summary: "Let me prepare a comprehensive study summary...",
      generate_assessment: "Building formal assessment questions...",
      grade_essay: "Analyzing the essay for grading...",
      execute_sql: "I'm searching the school records for the information you requested...",
      search_semantic: "Let me check the school's knowledge base and policies...",
      get_school_stats: "Gathering the latest school statistics...",
    };
    return messages[toolName] || 'Processing your request...';
  }

  // ??? Existing Tool Methods (Preserved) ??????????????????????????????????????

  /**
   * Generate flashcards for a topic
   */
  async generateFlashcards(options: GenerateFlashcardsOptions): Promise<{ data: Flashcard[]; usage: any }> {
    this.ensureConfigured();

    const { topic, subject, gradeLevel, count = 10, curriculum = 'NERDC' } = options;

    const prompt = `Generate ${count} educational flashcards for studying.

Subject: ${subject}
Topic: ${topic}
Grade Level: ${gradeLevel}
Curriculum: ${curriculum}

Create flashcards that help students learn and memorize key concepts. Each flashcard should have:
- A clear question or term on the front
- A comprehensive answer or definition on the back
- An optional hint to help students recall

Return as JSON array: [{"front": "...", "back": "...", "hint": "..."}]

Focus on key concepts, definitions, formulas, and facts that students need to remember.`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert educational content creator specializing in Nigerian curriculum. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      const parsed = JSON.parse(content);
      return { data: parsed.flashcards || parsed, usage: response.usage };
    } catch (error) {
      this.logger.error(`Failed to generate flashcards: ${error}`);
      throw new BadRequestException('Failed to generate flashcards. Please try again.');
    }
  }

  /**
   * Generate study summary
   */
  async generateSummary(options: GenerateSummaryOptions): Promise<{ data: string; usage: any }> {
    this.ensureConfigured();

    const { topic, subject, gradeLevel, weekContent, curriculum = 'NERDC' } = options;

    const prompt = `Create a comprehensive study summary for students.

Subject: ${subject}
Topic: ${topic}
Grade Level: ${gradeLevel}
Curriculum: ${curriculum}
${weekContent ? `Week Content:\n${weekContent}` : ''}

Create a clear, well-organized summary that:
1. Explains key concepts in simple terms
2. Highlights important definitions
3. Includes relevant examples
4. Notes formulas or key facts to remember
5. Uses bullet points and clear headings

Write in a student-friendly tone appropriate for ${gradeLevel} level.`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert educational content creator specializing in Nigerian curriculum.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });

      return { data: response.choices[0]?.message?.content || '', usage: response.usage };
    } catch (error) {
      this.logger.error(`Failed to generate summary: ${error}`);
      throw new BadRequestException('Failed to generate summary. Please try again.');
    }
  }

  /**
   * Generate quiz questions
   */
  async generateQuiz(options: GenerateQuizOptions): Promise<{ data: QuizQuestion[]; usage: any }> {
    this.ensureConfigured();

    const {
      topic,
      subject,
      gradeLevel,
      questionCount = 10,
      questionTypes = ['multiple_choice', 'true_false'],
      difficulty = 'medium',
    } = options;

    const prompt = `Generate a quiz for students.

Subject: ${subject}
Topic: ${topic}
Grade Level: ${gradeLevel}
Number of Questions: ${questionCount}
Question Types: ${questionTypes.join(', ')}
Difficulty: ${difficulty}

Create questions that test understanding of the topic. For each question include:
- The question text
- Question type (multiple_choice, true_false, or short_answer)
- Options (for multiple choice - 4 options labeled A, B, C, D)
- Correct answer
- Brief explanation of why the answer is correct

Return as JSON: {"questions": [{"text": "...", "type": "MULTIPLE_CHOICE", "options": ["...", "...", "...", "..."], "correctAnswer": "...", "explanation": "..."}]}`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational assessment creator. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      const parsed = JSON.parse(content);
      return { data: parsed.questions || parsed, usage: response.usage };
    } catch (error) {
      this.logger.error(`Failed to generate quiz: ${error}`);
      throw new BadRequestException('Failed to generate quiz. Please try again.');
    }
  }

  /**
   * Generate lesson plan (Socrates)
   */
  async generateLessonPlan(options: GenerateLessonPlanOptions): Promise<{ data: LessonPlan; usage: any }> {
    this.ensureConfigured();

    const { topic, subject, gradeLevel, objectives, duration = 40, curriculum = 'NERDC' } = options;

    const prompt = `Create a detailed lesson plan.

Subject: ${subject}
Topic: ${topic}
Grade Level: ${gradeLevel}
Duration: ${duration} minutes
Curriculum: ${curriculum}
Learning Objectives:
${objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

Create a comprehensive lesson plan including:
1. Title
2. Clear, measurable learning objectives
3. Required materials
4. Introduction/Hook (engaging opener)
5. Main content activities with timing
6. Assessment method
7. Homework assignment
8. Differentiation strategies for different learner needs

Return as JSON with this structure:
{
  "title": "...",
  "objectives": ["..."],
  "materials": ["..."],
  "introduction": "...",
  "mainContent": [{"activity": "...", "duration": "...", "description": "..."}],
  "assessment": "...",
  "homework": "...",
  "differentiation": "..."
}`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert teacher and curriculum developer specializing in Nigerian education. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      return { data: JSON.parse(content), usage: response.usage };
    } catch (error) {
      this.logger.error(`Failed to generate lesson plan: ${error}`);
      throw new BadRequestException('Failed to generate lesson plan. Please try again.');
    }
  }

  /**
   * Batch grade short answer questions using semantic similarity
   */
  async gradeShortAnswers(items: { question: string; studentAnswer: string; sampleAnswer: string; maxPoints: number }[]): Promise<{ data: { score: number; feedback: string; isCorrect: boolean }[]; usage: any }> {
    if (items.length === 0) return { data: [], usage: null };
    this.ensureConfigured();

    const gradingPrompt = `You are an expert examiner. Grade the following short-answer responses by comparing the student's answer against the sample answer. 
Award points based on semantic meaning and concept capture, not exact word matching.

Questions and Answers:
${items.map((it, i) => `
ID: ${i}
Question: ${it.question}
Sample Answer: ${it.sampleAnswer}
Student Answer: ${it.studentAnswer}
Max Points: ${it.maxPoints}
`).join('\n---\n')}

Return a JSON object with a 'results' array where each item matches the input order:
{"results": [{"id": number, "score": number, "isCorrect": boolean, "feedback": "short explanation"}]} `;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a fair, expert teacher. Return only valid JSON.' },
          { role: 'user', content: gradingPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      const parsed = JSON.parse(content);
      return { data: parsed.results || [], usage: response.usage };
    } catch (error) {
      this.logger.error(`Failed batch short answer grading: ${error}`);
      return { data: items.map(() => ({ score: 0, feedback: 'Grading failed', isCorrect: false })), usage: null };
    }
  }

  /**
   * Grade an essay with AI assistance (Socrates)
   */
  async gradeEssay(options: GradeEssayOptions): Promise<{ data: EssayGrade; usage: any }> {
    this.ensureConfigured();

    const { essay, prompt: essayPrompt, rubric, maxScore = 100, subject, gradeLevel } = options;

    const gradingPrompt = `Grade the following student essay.

Subject: ${subject}
Grade Level: ${gradeLevel}
Essay Prompt: ${essayPrompt}
Maximum Score: ${maxScore}
${rubric ? `Grading Rubric:\n${rubric}` : ''}

Student's Essay:
---
${essay}
---

Provide a fair and constructive assessment including:
1. Score out of ${maxScore}
2. Overall feedback
3. Strengths (what the student did well)
4. Areas for improvement
5. Specific suggestions for improvement

Be encouraging but honest. Grade appropriately for a ${gradeLevel} student.

Return as JSON:
{
  "score": number,
  "maxScore": ${maxScore},
  "feedback": "overall assessment",
  "strengths": ["..."],
  "areasForImprovement": ["..."],
  "suggestions": ["..."]
}`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an experienced, fair teacher grading student work. Return only valid JSON.',
          },
          { role: 'user', content: gradingPrompt },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      return { data: JSON.parse(content), usage: response.usage };
    } catch (error) {
      this.logger.error(`Failed to grade essay: ${error}`);
      throw new BadRequestException('Failed to grade essay. Please try again.');
    }
  }

  /**
   * Generate assessment questions for tests/exams (Socrates)
   */
  async generateAssessmentQuestions(options: GenerateQuestionsOptions): Promise<{ data: QuizQuestion[]; usage: any }> {
    this.ensureConfigured();

    const {
      topic,
      subject,
      gradeLevel,
      questionCount = 20,
      questionTypes = ['multiple_choice', 'short_answer', 'essay'],
      difficulty = 'mixed',
      curriculum = 'NERDC',
    } = options;

    const prompt = `Generate assessment questions for a formal test/exam.

Subject: ${subject}
Topic: ${topic}
Grade Level: ${gradeLevel}
Curriculum: ${curriculum}
Number of Questions: ${questionCount}
Question Types: ${questionTypes.join(', ')}
Difficulty Distribution: ${difficulty}

Create well-crafted questions suitable for formal assessment:
- Multiple choice: 4 options (A, B, C, D), one correct answer
- Short answer: Requires 1-3 sentence response
- Essay: Open-ended, tests deeper understanding

For each question include:
- Question text
- Type
- Options (for multiple choice)
- Correct answer or sample answer
- Point value suggestion

Return as JSON: {"questions": [{"text": "...", "type": "MULTIPLE_CHOICE | SHORT_ANSWER | ESSAY", "options": ["...", "..."], "correctAnswer": "...", "points": number}]}`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert assessment creator aligned with Nigerian curriculum standards. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      const parsed = JSON.parse(content);
      return { data: parsed.questions || parsed, usage: response.usage };
    } catch (error) {
      this.logger.error(`Failed to generate assessment questions: ${error}`);
      throw new BadRequestException('Failed to generate questions. Please try again.');
    }
  }

  // ??? Legacy Chat (Preserved for backward compat) ????????????????????????????

  async chat(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    userId?: string,
    conversationId?: string,
    schoolId?: string
  ): Promise<{ data: { response: string; conversationId: string }; usage: any }> {
    this.ensureConfigured();

    const { systemPrompt } = await this.getChatPrompt(messages, userId, schoolId);

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...messages,
        ],
        temperature: 0.7,
      });

      const assistantContent = response.choices[0]?.message?.content || '';

      let finalConversationId = conversationId;

      if (userId) {
        if (!finalConversationId) {
          const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user');
          const title = lastUserMessage?.content
            ? (lastUserMessage.content.substring(0, 40) + (lastUserMessage.content.length > 40 ? '...' : ''))
            : 'New Chat';

          const conversation = await this.prisma.chatConversation.create({
            data: {
              userId,
              schoolId,
              title,
              messages: {
                create: messages.map(m => ({
                  role: m.role,
                  content: m.content
                }))
              }
            }
          });
          finalConversationId = conversation.id;
        }

        if (conversationId) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.role === 'user') {
            await this.prisma.chatMessage.create({
              data: {
                conversationId: finalConversationId!,
                role: 'user',
                content: lastMessage.content
              }
            });
          }
        }

        await this.prisma.chatMessage.create({
          data: {
            conversationId: finalConversationId!,
            role: 'assistant',
            content: assistantContent
          }
        });
      }

      return {
        data: {
          response: assistantContent,
          conversationId: finalConversationId || ''
        },
        usage: response.usage
      };
    } catch (error) {
      this.logger.error(`AI Chat failed: ${error}`);
      throw new BadRequestException('AI assistant is currently unavailable. Please try again later.');
    }
  }

  // ??? Conversation History Methods ???????????????????????????????????????????

  async getConversations(userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: {
          select: { messages: true }
        }
      }
    });
  }

  async getConversationMessages(conversationId: string, userId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conversation || conversation.userId !== userId) {
      throw new BadRequestException('Conversation not found');
    }

    return conversation.messages;
  }

  async deleteConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation || conversation.userId !== userId) {
      throw new BadRequestException('Conversation not found');
    }

    await this.prisma.chatConversation.delete({
      where: { id: conversationId }
    });

    return { success: true };
  }
}
