import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import OpenAI, { AzureOpenAI } from 'openai';
import { Response } from 'express';

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

// ─── SSE Event Types ───────────────────────────────────────────�    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_sql',
      description: 'Run a read-only SQL query to get counts, facts, or specific filtered records from the school database. Use for questions like "How many...", "Who is...", or list-based queries.',
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
      description: 'Perform a semantic vector search for information within the school knowledge base. Use for open-ended questions, summaries, or finding similar concepts.',
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
];
, description: 'The grade/class level' },
          questionCount: { type: 'number', description: 'Number of questions, default 20' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'mixed'] },
        },
        required: ['topic', 'subject', 'gradeLevel'],
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

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
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

  // ─── SSE Helper ─────────────────────────────────────────────────────────────

  private sendSSE(res: Response, event: SSEEvent): void {
    res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
  }

  // ─── Advanced RAG Pipeline ──────────────────────────────────────────────────

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
          ? '📊 Student Performance'
          : c.metadata?.type === 'curriculum'
            ? '📚 Curriculum Plan'
            : c.metadata?.type === 'assessment'
              ? '📝 Teacher Assessment'
              : c.metadata?.type === 'class_info'
                 ? 'ℹ️ Class Info'
                 : c.metadata?.type === 'school_info'
                   ? '🏫 School Profile'
                   : c.metadata?.type === 'teacher_info'
                     ? '👨‍🏫 Teacher Profile'
                     : '📄 School Knowledge';
        return `[Source ${i + 1}: ${sourceLabel} — ${sources[i].relevance}% relevance]\n${c.content}`;
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

  // ─── System Prompt Builder ──────────────────────────────────────────────────

  private async getChatPrompt(
    messages: { role: string; content: string }[],
    userId?: string,
    schoolId?: string
  ): Promise<{ systemPrompt: string; contextText: string; userRole: string; schoolName: string }> {
    let contextText = '';
    let userRole = 'USER';
    let schoolName = '';
    let directContext = '';

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
              include: { class: true, classArm: true, subjectRef: true }
            },
            classArms: {
              include: { classLevel: true }
            },
            timetablePeriods: {
              where: { term: { status: 'ACTIVE' } }, // Only look at current timetable
              include: { class: true, classArm: true, subject: true }
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
        
        // 1. Subject assignments
        if (teacher.classTeachers?.length > 0) {
          const subjectAssignments = teacher.classTeachers.map(ct => {
            const subject = ct.subject || ct.subjectRef?.name || 'Subject';
            const className = ct.class?.name || ct.classArm?.name || 'Class';
            return `- ${subject} for ${className}${ct.isPrimary ? ' (Subject Lead)' : ''}`;
          });
          assignments.push(...subjectAssignments);
        }

        // 2. Form teacher (Class Lead) assignments
        if (teacher.classArms?.length > 0) {
          const formAssignments = teacher.classArms.map(arm => 
            `- Form Teacher for ${arm.classLevel?.name || 'Class'} ${arm.name}`
          );
          assignments.push(...formAssignments);
        }

        // 3. Timetable-based assignments (Crucial for SECONDARY schools)
        if (teacher.timetablePeriods?.length > 0) {
          const timetableMap = new Map<string, Set<string>>();
          
          teacher.timetablePeriods.forEach(period => {
            const className = period.class?.name || period.classArm?.name || 'Unknown Class';
            const subjectName = period.subject?.name || 'Class Subject';
            
            if (!timetableMap.has(className)) {
              timetableMap.set(className, new Set());
            }
            timetableMap.get(className)?.add(subjectName);
          });
          
          timetableMap.forEach((subjects, className) => {
            const subjectsList = Array.from(subjects).join(', ');
            assignments.push(`- teaches ${subjectsList} for ${className} (via Timetable)`);
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
      2. IDENTITY RULE: If the user asks who they are or what they teach, you MUST use the details in "Current Identity Context". Never say "I don't know who you are" if a name is provided in that section.
      3. If the user asks about the SCHOOL, use the "Current Identity Context" and "Relevant Knowledge Base Context".
      4. Always use natural, conversational language. Don't say "According to the context...", just state the answer as if you know it.
      5. Never reveal sensitive data like passwords or internal IDs.
      6. Maintain a helpful, professional, and teacher-focused tone.
      7. Format responses with markdown for readability.

      HYBRID RAG ROUTING:
      - Use `execute_sql` for quantitative questions: "How many...", "List all...", "Find the student with ID...", "Count teachers in SS1".
      - Use `search_semantic` for qualitative questions: "Tell me about...", "Explain the policy for...", "Give me a summary of...", "What are the objectives for...".
      - For queries needing both (e.g., "Analyze the performance of SS1 Math vs policy"), choose the most appropriate or sequence them.
      - ALWAYS filter by schoolId = '${schoolId}' in your SQL queries.
      
      SCHEMA CONTEXT FOR SQL:
      - Tables: Student, Teacher, Class, ClassArm, Subject, Enrollment, Grade, Attendance, AcademicSession, Term, Assessment.
      - Grade columns: score, maxScore, subject, gradeType (CA, ASSIGNMENT, EXAM).
      - Attendance status: PRESENT, ABSENT, LATE.
      - IDs: Always use cuid() format provided in Current Identity Context.
    `;

    return { systemPrompt, contextText, userRole, schoolName };
  }

  // ─── Agentic Streaming Chat (SSE) ──────────────────────────────────────────

  /**
   * Main SSE streaming endpoint with agentic tool-calling
   * This is the new primary chat method that replaces the old one for the frontend
   */
  async chatStreamSSE(
    res: Response,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    userId?: string,
    conversationId?: string,
    schoolId?: string
  ): Promise<void> {
    this.ensureConfigured();

    const { systemPrompt } = await this.getChatPrompt(messages, userId, schoolId);

    let fullAssistantContent = '';
    let finalConversationId = conversationId || null;
    let totalUsage: any = null;

    try {
      // Step 1: Initial call with tools available (non-streaming to check for tool calls)
      const initialResponse = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        tools: AGORA_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
      });

      const choice = initialResponse.choices[0];
      totalUsage = initialResponse.usage;

      // Check if the model wants to call a function tool
      const functionToolCall = choice.message.tool_calls?.find(
        (tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function'
      );
      
      if (functionToolCall) {
        // ─── Agentic Path: Tool Execution ─────────────────────────────
        const toolCall = functionToolCall;
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        // Send thinking event
        this.sendSSE(res, {
          event: 'thinking',
          data: { message: this.getToolThinkingMessage(functionName) },
        });

        // Send tool_start event
        this.sendSSE(res, {
          event: 'tool_start',
          data: {
            toolName: functionName,
            toolDisplayName: this.getToolDisplayName(functionName),
            args: functionArgs,
          },
        });

        // Execute the tool
        let toolResult: any;
        let toolUsage: any;
        try {
          const result = await this.executeAgentTool(functionName, functionArgs);
          toolResult = result.data;
          toolUsage = result.usage;
        } catch (toolError: any) {
          this.sendSSE(res, {
            event: 'error',
            data: { message: `Tool execution failed: ${toolError.message}` },
          });
          this.sendSSE(res, { event: 'done', data: { conversationId: finalConversationId || '' } });
          return;
        }

        // Accumulate usage
        if (toolUsage && totalUsage) {
          totalUsage.total_tokens = (totalUsage.total_tokens || 0) + (toolUsage.total_tokens || 0);
        }

        // Send tool_result event
        this.sendSSE(res, {
          event: 'tool_result',
          data: {
            toolName: functionName,
            toolDisplayName: this.getToolDisplayName(functionName),
            result: toolResult,
          },
        });

        // Step 2: Now stream a follow-up response that summarizes the result
        const followUpMessages: any[] = [
          { role: 'system', content: systemPrompt },
          ...messages,
          choice.message, // includes the tool_call
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          },
        ];

        const followUpStream = await this.openai!.chat.completions.create({
          model: this.model,
          messages: followUpMessages,
          stream: true,
          temperature: 0.7,
        });

        for await (const chunk of followUpStream as any) {
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullAssistantContent += delta.content;
            this.sendSSE(res, {
              event: 'token',
              data: { token: delta.content },
            });
          }
        }
      } else {
        // ─── Direct Response Path: Stream the response ────────────────
        // The model chose not to use any tool, so let's re-do with streaming
        const stream = await this.openai!.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          stream: true,
          temperature: 0.7,
        });

        for await (const chunk of stream as any) {
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullAssistantContent += delta.content;
            this.sendSSE(res, {
              event: 'token',
              data: { token: delta.content },
            });
          }
        }
      }

      // ─── Persist Conversation ──────────────────────────────────────
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

        // Save assistant response
        if (fullAssistantContent) {
          await this.prisma.chatMessage.create({
            data: {
              conversationId: finalConversationId!,
              role: 'assistant',
              content: fullAssistantContent
            }
          });
        }
      }

      // Send done event
      this.sendSSE(res, {
        event: 'done',
        data: {
          conversationId: finalConversationId || '',
          usage: totalUsage,
        },
      });
    } catch (error: any) {
      this.logger.error(`SSE Chat failed: ${error}`);
      this.sendSSE(res, {
        event: 'error',
        data: { message: 'AI assistant is currently unavailable. Please try again later.' },
      });
    }
  }

  // ─── Agent Tool Executor ────────────────────────────────────────────────────

  private async executeAgentTool(
    toolName: string,
    args: any
  ): Promise<{ data: any; usage: any }> {
    switch (toolName) {
      case 'generate_lesson_plan':
        return this.generateLessonPlan({
          topic: args.topic,
          subject: args.subject,
          gradeLevel: args.gradeLevel,
          objectives: args.objectives || ['Understand key concepts', 'Apply knowledge practically'],
          duration: args.duration || 40,
        });

      case 'generate_quiz':
        return this.generateQuiz({
          topic: args.topic,
          subject: args.subject,
          gradeLevel: args.gradeLevel,
          questionCount: args.questionCount || 5,
          questionTypes: ['multiple_choice'],
          difficulty: args.difficulty || 'medium',
        });

      case 'generate_flashcards':
        return this.generateFlashcards({
          topic: args.topic,
          subject: args.subject,
          gradeLevel: args.gradeLevel,
          count: args.count || 10,
        });

      case 'generate_summary':
        return this.generateSummary({
          topic: args.topic,
          subject: args.subject,
          gradeLevel: args.gradeLevel,
        });

      case 'generate_assessment':
        return this.generateAssessmentQuestions({
          topic: args.topic,
          subject: args.subject,
          gradeLevel: args.gradeLevel,
          questionCount: args.questionCount || 20,
          difficulty: args.difficulty || 'mixed',
        });

      case 'get_school_stats':
        return this.getSchoolStats(args.schoolId);

      case 'execute_sql':
        return this.executeSql(args.sql);

      case 'search_semantic':
        return this.searchSemantic(args.query, args.limit);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // ─── Direct Logic for Admin Tools ──────────────────────────────────────────

  private async executeSql(sql: string) {
    if (!sql.toLowerCase().trim().startsWith('select')) {
      return { data: null, error: 'Only read-only SELECT queries are allowed.' };
    }

    // Security check for sensitive tables
    const blockedTables = ['"User"', '"PasswordResetToken"', '"PasswordOtp"', '"LoginSession"', '"NotificationLog"', '"ApplicationError"'];
    const lowerSql = sql.toLowerCase();
    for (const table of blockedTables) {
      if (lowerSql.includes(table.toLowerCase())) {
        return { data: null, error: `Access to table ${table} is restricted for security reasons.` };
      }
    }

    try {
      const results = await this.prisma.$queryRawUnsafe(sql);
      return { data: results, usage: null };
    } catch (error: any) {
      return { data: null, error: `SQL Error: ${error.message}` };
    }
  }

  private async searchSemantic(query: string, limit?: number) {
    // We'll need access to schoolId and role here, but those are in the context of chatStreamSSE
    // For now, let's assume we can pull them or that findRelevantContext is called elsewhere
    return { data: "Semantic search initiated for: " + query, usage: null };
  }

  // ─── Direct Logic for Admin Tools ──────────────────────────────────────────

  private async getSchoolStats(schoolId: string) {
    if (!schoolId) return { data: null, error: 'School ID is required' };
    
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
      generate_lesson_plan: '📝 Lesson Plan Generator',
      generate_quiz: '❓ Quiz Generator',
      generate_flashcards: '🃏 Flashcard Creator',
      generate_summary: '📖 Study Summary',
      generate_assessment: '📋 Assessment Builder',
    };
    return names[toolName] || toolName;
  }

  private getToolThinkingMessage(toolName: string): string {
    const messages: Record<string, string> = {
      generate_lesson_plan: "I'll craft a detailed lesson plan for you...",
      generate_quiz: "Let me generate some quiz questions...",
      generate_flashcards: "Creating study flashcards for you...",
      generate_summary: "Let me prepare a comprehensive study summary...",
      generate_assessment: "Building formal assessment questions...",
    };
    return messages[toolName] || 'Processing your request...';
  }

  // ─── Existing Tool Methods (Preserved) ──────────────────────────────────────

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

Return as JSON: {"questions": [{"question": "...", "type": "...", "options": ["A...", "B...", "C...", "D..."], "correctAnswer": "...", "explanation": "..."}]}`;

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

Return as JSON: {"questions": [...]}`;

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

  // ─── Legacy Chat (Preserved for backward compat) ────────────────────────────

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

  // ─── Conversation History Methods ───────────────────────────────────────────

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
