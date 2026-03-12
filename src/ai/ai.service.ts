import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import OpenAI, { AzureOpenAI } from 'openai';

export interface GenerateFlashcardsOptions {
  topic: string;
  subject: string;
  gradeLevel: string;
  count?: number;
  curriculum?: string; // e.g., "NERDC"
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
  duration?: number; // in minutes
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

/**
 * AI Service - Wrapper around OpenAI for all AI-powered features
 * Used by PrepMaster (student) and Socrates (teacher) tools
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;
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

  /**
   * Generate flashcards for a topic (PrepMaster)
   */
  async generateFlashcards(options: GenerateFlashcardsOptions): Promise<Flashcard[]> {
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
      return parsed.flashcards || parsed;
    } catch (error) {
      this.logger.error(`Failed to generate flashcards: ${error}`);
      throw new BadRequestException('Failed to generate flashcards. Please try again.');
    }
  }

  /**
   * Generate study summary (PrepMaster)
   */
  async generateSummary(options: GenerateSummaryOptions): Promise<string> {
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

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`Failed to generate summary: ${error}`);
      throw new BadRequestException('Failed to generate summary. Please try again.');
    }
  }

  /**
   * Generate quiz questions (PrepMaster & Socrates)
   */
  async generateQuiz(options: GenerateQuizOptions): Promise<QuizQuestion[]> {
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
      return parsed.questions || parsed;
    } catch (error) {
      this.logger.error(`Failed to generate quiz: ${error}`);
      throw new BadRequestException('Failed to generate quiz. Please try again.');
    }
  }

  /**
   * Generate lesson plan (Socrates)
   */
  async generateLessonPlan(options: GenerateLessonPlanOptions): Promise<LessonPlan> {
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

      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to generate lesson plan: ${error}`);
      throw new BadRequestException('Failed to generate lesson plan. Please try again.');
    }
  }

  /**
   * Grade an essay with AI assistance (Socrates)
   */
  async gradeEssay(options: GradeEssayOptions): Promise<EssayGrade> {
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
        temperature: 0.5, // Lower temperature for more consistent grading
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to grade essay: ${error}`);
      throw new BadRequestException('Failed to grade essay. Please try again.');
    }
  }

  /**
   * Generate assessment questions for tests/exams (Socrates)
   */
  async generateAssessmentQuestions(options: GenerateQuestionsOptions): Promise<QuizQuestion[]> {
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
      return parsed.questions || parsed;
    } catch (error) {
      this.logger.error(`Failed to generate assessment questions: ${error}`);
      throw new BadRequestException('Failed to generate questions. Please try again.');
    }
  }

  /**
   * Generic chat with AI
   */
  async chat(messages: { role: 'user' | 'assistant' | 'system'; content: string }[], userId?: string, conversationId?: string, schoolId?: string): Promise<{ content: string; conversationId: string }> {
    this.ensureConfigured();

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are Agora AI, a helpful educational assistant for teachers in Nigeria. You are an expert in the NERDC curriculum and Nigerian educational standards. Provide clear, professional, and pedagogically sound advice and content.',
          },
          ...messages,
        ],
        temperature: 0.7,
      });

      const assistantContent = response.choices[0]?.message?.content || '';

      let finalConversationId = conversationId;

      if (userId) {
        // If we have a userId, we should save the history
        if (!finalConversationId) {
          // Create a new conversation if none exists
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

        // Save the assistant's response to the conversation
        await this.prisma.chatMessage.create({
          data: {
            conversationId: finalConversationId!,
            role: 'assistant',
            content: assistantContent
          }
        });

        // If it was an existing conversation, we also need to save the latest user message
        // (Assuming the caller ONLY sent the new message or the whole history)
        // Actually, the frontend usually sends the whole history. 
        // For simplicity, let's assume we want to sync the latest message if not already saved.
        // But the create above already saved the history.
        // If finalConversationId existed, we only need to save the LATEST user message and assistant message.
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
      }

      return { 
        content: assistantContent, 
        conversationId: finalConversationId || '' 
      };
    } catch (error) {
      this.logger.error(`AI Chat failed: ${error}`);
      throw new BadRequestException('AI assistant is currently unavailable. Please try again later.');
    }
  }

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

