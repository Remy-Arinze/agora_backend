import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  EssayGrade,
  Flashcard,
  GenerateFlashcardsOptions,
  GenerateLessonPlanOptions,
  GenerateQuestionsOptions,
  GenerateQuizOptions,
  GenerateSummaryOptions,
  GradeEssayOptions,
  LessonPlan,
  QuizQuestion,
} from './ai.types';
import { AiLlmClientService } from './ai-llm-client.service';

/**
 * OpenAI-backed content generators (quiz, lesson plan, assessment, grading, etc.).
 * Used by HTTP controllers and by Lois agent tools.
 */
@Injectable()
export class AiContentGeneratorsService {
  private readonly logger = new Logger(AiContentGeneratorsService.name);

  constructor(private readonly llm: AiLlmClientService) {}

  async generateFlashcards(options: GenerateFlashcardsOptions): Promise<{ data: Flashcard[]; usage: any }> {
    this.llm.ensureConfigured();
    const openai = this.llm.getOpenai();
    const model = this.llm.getModel();

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
      const response = await openai.chat.completions.create({
        model,
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

  async generateSummary(options: GenerateSummaryOptions): Promise<{ data: string; usage: any }> {
    this.llm.ensureConfigured();
    const openai = this.llm.getOpenai();
    const model = this.llm.getModel();

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
      const response = await openai.chat.completions.create({
        model,
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

  async generateQuiz(options: GenerateQuizOptions): Promise<{ data: QuizQuestion[]; usage: any }> {
    this.llm.ensureConfigured();
    const openai = this.llm.getOpenai();
    const model = this.llm.getModel();

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
      const response = await openai.chat.completions.create({
        model,
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

  async generateLessonPlan(options: GenerateLessonPlanOptions): Promise<{ data: LessonPlan; usage: any }> {
    this.llm.ensureConfigured();
    const openai = this.llm.getOpenai();
    const model = this.llm.getModel();

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
      const response = await openai.chat.completions.create({
        model,
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

  async gradeShortAnswers(
    items: { question: string; studentAnswer: string; sampleAnswer: string; maxPoints: number }[],
  ): Promise<{ data: { score: number; feedback: string; isCorrect: boolean }[]; usage: any }> {
    if (items.length === 0) return { data: [], usage: null };
    this.llm.ensureConfigured();
    const openai = this.llm.getOpenai();
    const model = this.llm.getModel();

    const gradingPrompt = `You are an expert examiner. Grade the following short-answer responses by comparing the student's answer against the sample answer. 
Award points based on semantic meaning and concept capture, not exact word matching.

Questions and Answers:
${items
  .map(
    (it, i) => `
ID: ${i}
Question: ${it.question}
Sample Answer: ${it.sampleAnswer}
Student Answer: ${it.studentAnswer}
Max Points: ${it.maxPoints}
`,
  )
  .join('\n---\n')}

Return a JSON object with a 'results' array where each item matches the input order:
{"results": [{"id": number, "score": number, "isCorrect": boolean, "feedback": "short explanation"}]} `;

    try {
      const response = await openai.chat.completions.create({
        model,
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

  async gradeEssay(options: GradeEssayOptions): Promise<{ data: EssayGrade; usage: any }> {
    this.llm.ensureConfigured();
    const openai = this.llm.getOpenai();
    const model = this.llm.getModel();

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
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an experienced, fair teacher grading student work. Return only valid JSON.',
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

  async generateAssessmentQuestions(
    options: GenerateQuestionsOptions,
  ): Promise<{ data: QuizQuestion[]; usage: any }> {
    this.llm.ensureConfigured();
    const openai = this.llm.getOpenai();
    const model = this.llm.getModel();

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
      const response = await openai.chat.completions.create({
        model,
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
}
