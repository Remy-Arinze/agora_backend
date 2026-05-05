import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AgoraCurriculumSourceStatus, SchemeOfWorkStatus } from '@prisma/client';
import { DocumentExtractor } from '../common/utils/document-extractor';
import { MetricsService } from '../common/metrics/metrics.service';
import { PrismaService } from '../database/prisma.service';
import {
  ConsolidateCurriculumResult,
  MultiGradeParseResult,
  SchemeOfWorkGenerationResult,
  VerificationResult,
} from './ai.types';
import { AiLlmClientService } from './ai-llm-client.service';

/**
 * Curriculum parsing, consolidation, scheme-of-work generation, and school doc parsing.
 */
@Injectable()
export class AiCurriculumPipelineService {
  private readonly logger = new Logger(AiCurriculumPipelineService.name);

  constructor(
    private readonly llm: AiLlmClientService,
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  async verifyCurriculumDocument(
    content: string,
    subject: string,
    gradeLevel: string,
  ): Promise<VerificationResult> {
    this.logger.log(`Verifying curriculum document for ${subject} ${gradeLevel}`);

    try {
      this.llm.ensureConfigured();
      const openai = this.llm.getOpenai();
      const model = this.llm.getModel();

      const prompt = `
        You are an expert academic curriculum analyst. Verify if the provided document content is a legitimate curriculum or scheme of work for the following context:
        Subject: ${subject}
        Grade Level: ${gradeLevel}

        Analyze the content carefully. Look for:
        1. Subject keywords and relevant academic topics.
        2. Complexity level matches the grade level provided.
        3. Structure resembling a curriculum (weeks, topics, objectives, etc.)

        Respond ONLY in structured JSON format:
        {
          "verified": boolean,
          "confidence": "high" | "medium" | "low",
          "reason": "Clear explanation of why it passed or failed",
          "subjectMatch": boolean,
          "gradeLevelMatch": boolean
        }

        Document Content:
        ${content.substring(0, 15000)} 
      `;

      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      this.metricsService.loisVerificationTotal.inc({
        result: result.verified ? 'verified' : 'rejected',
      });
      return {
        verified: result.verified || false,
        confidence: result.confidence || 'low',
        reason: result.reason || 'Verification failed due to inconclusive AI response.',
        subjectMatch: result.subjectMatch || false,
        gradeLevelMatch: result.gradeLevelMatch || false,
      };
    } catch (error) {
      this.logger.error('Error verifying curriculum document:', error);
      return {
        verified: false,
        confidence: 'low',
        reason: 'An error occurred during AI verification.',
        subjectMatch: false,
        gradeLevelMatch: false,
      };
    }
  }

  async parseCurriculumDocument(
    sourceId: string,
    onProgress?: (step: string) => Promise<void>,
  ): Promise<MultiGradeParseResult | null> {
    try {
      this.llm.ensureConfigured();
      const openai = this.llm.getOpenai();
      const model = this.llm.getModel();

      const source = await this.prisma.agoraCurriculumSource.findUnique({
        where: { id: sourceId },
      });

      if (!source) throw new BadRequestException('Source not found');

      await this.prisma.agoraCurriculumSource.update({
        where: { id: sourceId },
        data: { status: AgoraCurriculumSourceStatus.PARSING },
      });

      let rawText = 'No content available for AI to parse.';

      if (source.manualContent) {
        if (onProgress) await onProgress('Preparing manual content...');
        rawText = JSON.stringify(source.manualContent);
      } else if (source.fileUrl && source.fileType === 'PDF') {
        this.logger.log(`Performing real PDF text extraction for source: ${sourceId}`);
        if (onProgress) await onProgress('AI is extracting text from PDF (this might take a minute)...');
        rawText = await DocumentExtractor.extractTextFromPdfUrl(source.fileUrl);
      } else if (source.fileUrl) {
        rawText = `[Simulated text extraction from ${source.fileType} at ${source.fileUrl}]`;
      }

      let cleanedText = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();

      const MAX_CHUNK_LENGTH = 100000;
      const textChunks = [];
      for (let i = 0; i < cleanedText.length; i += MAX_CHUNK_LENGTH) {
        textChunks.push(cleanedText.substring(i, i + MAX_CHUNK_LENGTH));
      }

      this.logger.log(`Invoking AI for curriculum parsing (${textChunks.length} chunks)`);
      if (onProgress) await onProgress('AI is organizing content into structured topics...');

      const allTopics = [];

      for (let i = 0; i < textChunks.length; i++) {
        const textChunk = textChunks[i];
        if (onProgress && textChunks.length > 1) {
          await onProgress(`AI is parsing chunk ${i + 1} of ${textChunks.length}...`);
        }

        const response = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: `You are an expert academic curriculum parser. 
              Your goal is to extract structured topics, subtopics, learning objectives, and suggested resources from the text.
              
              IMPORTANT RULE:
              You must ONLY extract the curriculum data for the target grade: ${source.gradeLevel}.
              If the document contains information for multiple classes or grades, STRICTLY IGNORE everything except ${source.gradeLevel}.
              Do not extract other grades if the target is ${source.gradeLevel}.
              `,
            },
            { role: 'user', content: `Parse the following curriculum material:\n\n${textChunk}` },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'curriculum_extraction',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        gradeLevel: { type: 'string' },
                        topics: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              title: { type: 'string' },
                              subTopics: { type: 'array', items: { type: 'string' } },
                              learningOutcomes: { type: 'array', items: { type: 'string' } },
                              studentFriendlyOutcomes: { type: 'array', items: { type: 'string' } },
                              suggestedActivities: { type: 'array', items: { type: 'string' } },
                              resources: { type: 'array', items: { type: 'string' } },
                              assessmentType: { type: 'string' },
                            },
                            required: [
                              'title',
                              'subTopics',
                              'learningOutcomes',
                              'studentFriendlyOutcomes',
                              'suggestedActivities',
                              'resources',
                              'assessmentType',
                            ],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ['gradeLevel', 'topics'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['results'],
                additionalProperties: false,
              },
            },
          },
          temperature: 0.1,
        });

        const resultText = response.choices[0]?.message?.content || '{}';
        const parsedData = JSON.parse(resultText) as MultiGradeParseResult;

        if (parsedData.results && parsedData.results.length > 0) {
          const primaryGradeResult =
            parsedData.results.find((res) => res.gradeLevel === source.gradeLevel) || parsedData.results[0];
          if (primaryGradeResult && primaryGradeResult.topics) {
            allTopics.push(...primaryGradeResult.topics);
          }
        }
      }

      this.metricsService.curriculumUploadsTotal.inc({
        file_type: source.manualContent ? 'manual' : source.fileType || 'file',
        status: 'success',
      });

      if (allTopics.length === 0) {
        throw new Error('AI returned an empty results array for the curriculum across all chunks.');
      }

      await this.prisma.agoraCurriculumSource.update({
        where: { id: sourceId },
        data: {
          parsedData: { topics: allTopics } as any,
          status: AgoraCurriculumSourceStatus.PARSED,
        },
      });

      this.logger.log(
        `Parsed main Curriculum Source [${sourceId}] successfully using Lois. Target Grade: ${source.gradeLevel}`,
      );

      return { results: [{ gradeLevel: source.gradeLevel, topics: allTopics }] };
    } catch (error) {
      this.logger.error(`Error parsing curriculum: ${error}`);
      throw error;
    }
  }

  async consolidateAgoraCurriculum(curriculumId: string): Promise<void> {
    try {
      this.llm.ensureConfigured();
      const openai = this.llm.getOpenai();
      const model = this.llm.getModel();

      const curriculum = await this.prisma.agoraCurriculum.findUnique({
        where: { id: curriculumId },
        include: { subject: true },
      });

      if (!curriculum) return;

      const sources = await this.prisma.agoraCurriculumSource.findMany({
        where: { id: { in: curriculum.sourceIds } },
      });

      const subjectName = curriculum.subject?.name || 'Unknown Subject';
      const gradeLevel = curriculum.gradeLevel;

      const combinedPayloads = sources
        .map((s: any) => {
          const data = typeof s.parsedData === 'string' ? JSON.parse(s.parsedData) : s.parsedData;
          return `Source Material (as JSON):\n${JSON.stringify(data, null, 2)}`;
        })
        .join('\n\n---\n\n');

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an expert educational planner for ${subjectName} (${gradeLevel}). 
            Your task is to consolidate multiple raw curriculum source materials into a FULL ACADEMIC SESSION curriculum for the Nigerian school year.
            
            The Nigerian school year has 3 terms (1st, 2nd, and 3rd). 
            Each term has approximately 13 weeks:
            - Weeks 1-6: Academic topics
            - Week 7: Mid-term revision/break
            - Weeks 8-12: Academic topics
            - Week 13: Examination week
            
            Produce TWO layers of output:
            1. CURRICULUM OVERVIEW: A comprehensive session-wide strategy including:
                - description: A detailed overview of the curriculum's scope and purpose.
                - themes: The primary thematic units or focus areas.
                - progressionNotes: A narrative describing how leaning progresses across Term 1, 2, and 3.
            2. TERM SCHEMES OF WORK: For each of the 3 terms, produce a detailed week-by-week breakdown.

            CRITICAL RULES:
            1. SUBJECT INTEGRITY: You MUST ONLY produce content related to ${subjectName}.
            2. STRUCTURE: Every term must have topics for all 13 weeks.
            3. OBJECTIVES: Each week MUST have formal "learningOutcomes" and "studentFriendlyOutcomes".
            4. JSON SCHEMA: Return a JSON object with:
                - "curriculumOverview": { "description": string, "themes": string[], "progressionNotes": string }
                - "terms": Array of 3 objects, each with:
                    - "term": number (1, 2, or 3)
                    - "termTitle": string
                    - "termSummary": string
                    - "topics": Array of 13 objects, each with: "title", "subTopics", "learningOutcomes", "studentFriendlyOutcomes", "suggestedActivities", "resources", "assessmentType".
            `,
          },
          {
            role: 'user',
            content: `Consolidate these ${subjectName} (${gradeLevel}) sources into a unified full-year curriculum:\n\n${combinedPayloads}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'consolidate_curriculum',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                curriculumOverview: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' },
                    themes: { type: 'array', items: { type: 'string' } },
                    progressionNotes: { type: 'string' },
                  },
                  required: ['description', 'themes', 'progressionNotes'],
                  additionalProperties: false,
                },
                terms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      term: { type: 'number' },
                      termTitle: { type: 'string' },
                      termSummary: { type: 'string' },
                      topics: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            description: { type: 'string' },
                            subTopics: { type: 'array', items: { type: 'string' } },
                            learningOutcomes: { type: 'array', items: { type: 'string' } },
                            studentFriendlyOutcomes: { type: 'array', items: { type: 'string' } },
                            suggestedActivities: { type: 'array', items: { type: 'string' } },
                            resources: { type: 'array', items: { type: 'string' } },
                            assessmentType: { type: 'string' },
                            order: { type: 'number' },
                          },
                          required: [
                            'title',
                            'description',
                            'subTopics',
                            'learningOutcomes',
                            'studentFriendlyOutcomes',
                            'suggestedActivities',
                            'resources',
                            'assessmentType',
                            'order',
                          ],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['term', 'termTitle', 'termSummary', 'topics'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['curriculumOverview', 'terms'],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.3,
      });

      const resultText = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(resultText) as ConsolidateCurriculumResult;

      const overview = result.curriculumOverview;
      const formattedOverview = `
# Description
${overview.description || ''}

# Themes
${(overview.themes || []).map((t: string) => `- ${t}`).join('\n')}

# Progression Notes
${overview.progressionNotes || ''}
      `.trim();

      await this.prisma.agoraCurriculum.update({
        where: { id: curriculumId },
        data: {
          consolidationNotes: formattedOverview,
        },
      });

      await this.prisma.agoraCurriculumTopic.deleteMany({
        where: { curriculumId },
      });

      if (result.terms && Array.isArray(result.terms)) {
        const createOps = [];

        for (const termBlock of result.terms) {
          if (!termBlock.topics) continue;

          for (const [index, t] of termBlock.topics.entries()) {
            createOps.push(
              this.prisma.agoraCurriculumTopic.create({
                data: {
                  curriculumId,
                  term: termBlock.term || 1,
                  title: t.title || 'Untitled Topic',
                  description: t.description,
                  weekNumber: index + 1,
                  topic: t.title,
                  subTopics: t.subTopics || [],
                  learningOutcomes: t.learningOutcomes || [],
                  studentFriendlyOutcomes: t.studentFriendlyOutcomes || [],
                  suggestedActivities: t.suggestedActivities || [],
                  resources: t.resources || [],
                  assessmentType: t.assessmentType,
                  order: t.order || index + 1,
                },
              }),
            );
          }
        }

        await this.prisma.$transaction(createOps);
      }

      this.metricsService.loisCurationTotal.inc({ status: 'success' });
      this.logger.log(`Lois successfully consolidated Agora Curriculum [${curriculumId}] into 3 terms.`);
    } catch (error) {
      this.metricsService.loisCurationTotal.inc({ status: 'failed' });
      this.logger.error(`Failed to consolidate curriculum ${curriculumId}:`, error);
    }
  }

  async generateSchemeOfWork(schemeId: string): Promise<void> {
    const startTime = Date.now();
    try {
      this.llm.ensureConfigured();
      const openai = this.llm.getOpenai();
      const model = this.llm.getModel();

      const scheme = await (this.prisma as any).schemeOfWork.findUnique({
        where: { id: schemeId },
        include: {
          agoraCurriculum: { include: { topics: { orderBy: { order: 'asc' } } } },
          schoolCurriculum: true,
          classLevel: true,
        },
      });

      if (!scheme) throw new BadRequestException('Scheme not found');

      if (scheme.status === 'CANCELLED') {
        this.logger.warn(`Generation for scheme ${schemeId} was cancelled before starting. Aborting.`);
        return;
      }

      await (this.prisma as any).schemeOfWork.update({
        where: { id: schemeId },
        data: { status: 'VERIFYING' },
      });

      const subject = await this.prisma.subject.findUnique({
        where: { id: scheme.subjectId },
      });

      const subjectName = subject?.name || 'Unknown Subject';
      const gradeName = scheme.classLevel?.name || 'Unknown Grade';

      if (scheme.generationMode === 'SCHOOL_ONLY' || scheme.generationMode === 'MERGED') {
        const doc = scheme.schoolCurriculum;
        if (doc) {
          this.logger.log(`Verifying source document for ${schemeId}...`);

          let contentToVerify = '';
          if (doc.manualContent) {
            contentToVerify = JSON.stringify(doc.manualContent);
          } else if (doc.fileUrl) {
            contentToVerify = `[Extracted Content from ${doc.fileName}]\nSubject: ${subjectName}\nGrade: ${gradeName}\nTopics list...`;
          }

          const verification = await this.verifyCurriculumDocument(contentToVerify, subjectName, gradeName);

          if (!verification.verified) {
            this.logger.warn(`Verification failed for scheme ${schemeId}: ${verification.reason}`);
            await (this.prisma as any).schemeOfWork.update({
              where: { id: schemeId },
              data: { status: 'FAILED' as any },
            });
            throw new Error(`VERIFICATION_FAILED: ${verification.reason}`);
          }
          this.logger.log(`Verification passed for scheme ${schemeId} (Confidence: ${verification.confidence})`);
        }
      }

      const freshScheme = await (this.prisma as any).schemeOfWork.findUnique({ where: { id: schemeId } });
      if (freshScheme.status === 'CANCELLED') return;

      await (this.prisma as any).schemeOfWork.update({
        where: { id: schemeId },
        data: { status: 'GENERATING' },
      });

      const modelInput = {
        generationMode: scheme.generationMode,
        agoraTopics: scheme.agoraCurriculum?.topics || [],
        customSchoolGuidance: scheme.schoolCurriculum?.parsedData || null,
        targetWeeks: 12,
        subject: subjectName,
        gradeLevel: gradeName,
      };

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an expert master teacher. Map the given curriculum topics across a standard ${modelInput.targetWeeks}-week academic term for ${subjectName} (${gradeName}). Group related topics if necessary. Assign one clear topic to each week. ALWAYS Output a JSON object with a "weeks" array (matching weekNumber 1 to 12). Include revision/exams in the final two weeks if appropriate.`,
          },
          { role: 'user', content: JSON.stringify(modelInput) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'scheme_of_work_generation',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                weeks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      weekNumber: { type: 'number' },
                      topic: { type: 'string' },
                      subTopics: { type: 'array', items: { type: 'string' } },
                      learningOutcomes: { type: 'array', items: { type: 'string' } },
                      studentFriendlyOutcomes: { type: 'array', items: { type: 'string' } },
                      suggestedActivities: { type: 'array', items: { type: 'string' } },
                      resources: { type: 'array', items: { type: 'string' } },
                      assessmentType: { type: 'string' },
                    },
                    required: [
                      'weekNumber',
                      'topic',
                      'subTopics',
                      'learningOutcomes',
                      'studentFriendlyOutcomes',
                      'suggestedActivities',
                      'resources',
                      'assessmentType',
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ['weeks'],
              additionalProperties: false,
            },
          },
        },
      });

      const resultText = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(resultText) as SchemeOfWorkGenerationResult;

      if (result.weeks && Array.isArray(result.weeks)) {
        await this.prisma.$transaction(
          result.weeks.map((w) =>
            this.prisma.schemeOfWorkWeek.create({
              data: {
                schemeOfWorkId: schemeId,
                weekNumber: w.weekNumber,
                topic: w.topic,
                subTopics: w.subTopics || [],
                learningOutcomes: w.learningOutcomes || [],
                studentFriendlyOutcomes: w.studentFriendlyOutcomes || [],
                suggestedActivities: w.suggestedActivities || [],
                resources: w.resources || [],
                assessmentType: w.assessmentType,
              },
            }),
          ),
        );

        await (this.prisma as any).schemeOfWork.update({
          where: { id: schemeId },
          data: {
            status: SchemeOfWorkStatus.DRAFT,
            generatedAt: new Date(),
          },
        });
      }

      const durationSec = (Date.now() - startTime) / 1000;
      this.metricsService.curriculumGenerationsTotal.inc({ mode: scheme.generationMode, status: 'success' });
      this.metricsService.curriculumGenerationDurationSeconds.observe({ mode: scheme.generationMode }, durationSec);
      this.logger.log(`Generated automated Scheme of Work [${schemeId}].`);
    } catch (error: any) {
      this.metricsService.curriculumGenerationsTotal.inc({ mode: 'unknown', status: 'failed' });
      this.logger.error(`Failed to generate Scheme of Work ${schemeId}:`, error);

      if (error instanceof Error && error.message.startsWith('VERIFICATION_FAILED')) {
        throw error;
      }

      if (schemeId) {
        await (this.prisma as any).schemeOfWork.update({
          where: { id: schemeId },
          data: { status: SchemeOfWorkStatus.FAILED },
        });
      }
      throw error;
    }
  }

  async generateYearlySchemeOfWork(schemeIds: string[], docIds: string[]): Promise<void> {
    const startTime = Date.now();
    try {
      this.llm.ensureConfigured();
      const openai = this.llm.getOpenai();
      const model = this.llm.getModel();

      await (this.prisma as any).schemeOfWork.updateMany({
        where: { id: { in: schemeIds } },
        data: { status: 'GENERATING' },
      });

      const schemes = await Promise.all(
        schemeIds.map((id) =>
          (this.prisma as any).schemeOfWork.findUnique({
            where: { id },
            include: { classLevel: true, term: true, schoolCurriculum: true },
          }),
        ),
      );

      if (schemes.length === 0 || !schemes[0]) return;

      const subject = await this.prisma.subject.findUnique({
        where: { id: schemes[0].subjectId },
      });

      const subjectName = subject?.name || 'Unknown Subject';
      const gradeName = schemes[0].classLevel?.name || 'Unknown Grade';

      const guidanceDocs = await (this.prisma as any).schoolCurriculumDoc.findMany({
        where: { id: { in: docIds } },
      });

      const customSchoolGuidance = guidanceDocs
        .map((doc: any) => doc.parsedData || `[Simulated content for ${doc.fileName}]`)
        .join('\n\n');

      const termNumbers = schemes.map((s) => s.term.number);
      const targetWeeksPerTerm = 13;

      const modelInput = {
        generationMode: 'SCHOOL_ONLY',
        customSchoolGuidance,
        termsExpected: termNumbers,
        weeksPerTerm: targetWeeksPerTerm,
        subject: subjectName,
        gradeLevel: gradeName,
      };

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an expert master teacher. Map the given curriculum topics across a full academic year for ${subjectName} (${gradeName}). You must split the progression across terms ${termNumbers.join(', ')}. Each term must have up to ${targetWeeksPerTerm} weeks. Group related topics logically for good progression. Output a JSON object with a "terms" array.`,
          },
          { role: 'user', content: JSON.stringify(modelInput) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'yearly_scheme_of_work_generation',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                terms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      termNumber: { type: 'number' },
                      weeks: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            weekNumber: { type: 'number' },
                            topic: { type: 'string' },
                            subTopics: { type: 'array', items: { type: 'string' } },
                            learningOutcomes: { type: 'array', items: { type: 'string' } },
                            studentFriendlyOutcomes: { type: 'array', items: { type: 'string' } },
                            suggestedActivities: { type: 'array', items: { type: 'string' } },
                            resources: { type: 'array', items: { type: 'string' } },
                            assessmentType: { type: 'string' },
                          },
                          required: [
                            'weekNumber',
                            'topic',
                            'subTopics',
                            'learningOutcomes',
                            'studentFriendlyOutcomes',
                            'suggestedActivities',
                            'resources',
                            'assessmentType',
                          ],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['termNumber', 'weeks'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['terms'],
              additionalProperties: false,
            },
          },
        },
      });

      const resultText = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(resultText) as any;

      if (result.terms && Array.isArray(result.terms)) {
        await this.prisma.$transaction(async (tx) => {
          for (const termBlock of result.terms) {
            const matchingScheme = schemes.find((s) => s.term.number === termBlock.termNumber);
            if (!matchingScheme || !termBlock.weeks) continue;

            await Promise.all(
              termBlock.weeks.map((w: any) =>
                (tx as any).schemeOfWorkWeek.create({
                  data: {
                    schemeOfWorkId: matchingScheme.id,
                    weekNumber: w.weekNumber,
                    topic: w.topic,
                    subTopics: w.subTopics || [],
                    learningOutcomes: w.learningOutcomes || [],
                    studentFriendlyOutcomes: w.studentFriendlyOutcomes || [],
                    suggestedActivities: w.suggestedActivities || [],
                    resources: w.resources || [],
                    assessmentType: w.assessmentType,
                  },
                }),
              ),
            );

            await (tx as any).schemeOfWork.update({
              where: { id: matchingScheme.id },
              data: {
                status: 'DRAFT',
                generatedAt: new Date(),
              },
            });
          }
        });
      }

      const durationSec = (Date.now() - startTime) / 1000;
      this.metricsService.curriculumGenerationsTotal.inc({ mode: 'YEARLY', status: 'success' });
      this.metricsService.curriculumGenerationDurationSeconds.observe({ mode: 'YEARLY' }, durationSec);
      this.logger.log(`Generated YEARLY Scheme of Work for schemes: [${schemeIds.join(', ')}].`);
    } catch (error) {
      this.metricsService.curriculumGenerationsTotal.inc({ mode: 'YEARLY', status: 'failed' });
      this.logger.error(`Failed to generate YEARLY Scheme of Work:`, error);

      await (this.prisma as any).schemeOfWork.updateMany({
        where: { id: { in: schemeIds } },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  async parseSchoolCurriculumDocument(docId: string): Promise<any | null> {
    try {
      this.llm.ensureConfigured();
      const openai = this.llm.getOpenai();
      const model = this.llm.getModel();

      const doc = await (this.prisma as any).schoolCurriculumDoc.findUnique({
        where: { id: docId },
        include: { subject: { select: { name: true } } },
      });

      if (!doc) throw new BadRequestException('School curriculum document not found');

      await (this.prisma as any).schoolCurriculumDoc.update({
        where: { id: docId },
        data: { status: 'PARSING' },
      });

      let textToParse = 'No content available.';
      if (doc.fileUrl && doc.fileType === 'PDF') {
        const rawText = await DocumentExtractor.extractTextFromPdfUrl(doc.fileUrl);
        textToParse = DocumentExtractor.prepareTextForLLM(rawText);
      } else if (doc.manualContent) {
        textToParse = JSON.stringify(doc.manualContent);
      }

      const prompt = `
        As Lois, the Agora Intelligent Curriculum Architect, analyze this school's private curriculum document for the subject: ${doc.subject?.name || 'Unknown'}.
        
        DETECT ALL GRADES:
        Scan the text for mentions of Nigeria's standard class levels (e.g. JSS 1, SS 1, Primary 3).
        If the document contains sections for multiple grades, extract them separately.
        
        EXTRACT TOPICS:
        For each grade found, extract the curriculum outline (topics, subtopics, etc).
        
        DOCUMENT TEXT:
        ${textToParse}
      `;

      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'system', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'school_curriculum_extraction',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      gradeLevel: { type: 'string' },
                      topics: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            subTopics: { type: 'array', items: { type: 'string' } },
                            learningOutcomes: { type: 'array', items: { type: 'string' } },
                            studentFriendlyOutcomes: { type: 'array', items: { type: 'string' } },
                            suggestedActivities: { type: 'array', items: { type: 'string' } },
                            resources: { type: 'array', items: { type: 'string' } },
                            assessmentType: { type: 'string' },
                          },
                          required: [
                            'title',
                            'subTopics',
                            'learningOutcomes',
                            'studentFriendlyOutcomes',
                            'suggestedActivities',
                            'resources',
                            'assessmentType',
                          ],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['gradeLevel', 'topics'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['results'],
              additionalProperties: false,
            },
          },
        },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      const resultsArray = result.results || [];
      const grades = resultsArray.map((r: any) => r.gradeLevel);

      if (grades.length === 0) {
        await (this.prisma as any).schoolCurriculumDoc.update({
          where: { id: docId },
          data: { status: 'FAILED', parseErrors: 'No grade levels detected in document.' },
        });
        return null;
      }

      for (const gradeResult of resultsArray) {
        const grade = gradeResult.gradeLevel;
        const parsedData = { topics: gradeResult.topics || [] };

        if (grade === doc.gradeLevel || (resultsArray.length === 1 && doc.gradeLevel)) {
          await (this.prisma as any).schoolCurriculumDoc.update({
            where: { id: docId },
            data: { status: 'COMPLETED', parsedData },
          });
        } else {
          await (this.prisma as any).schoolCurriculumDoc.create({
            data: {
              schoolId: doc.schoolId,
              subjectId: doc.subjectId,
              gradeLevel: grade,
              sourceType: 'FILE_UPLOAD',
              fileName: doc.fileName,
              fileUrl: doc.fileUrl,
              fileType: doc.fileType,
              status: 'COMPLETED',
              parsedData,
              uploadedBy: doc.uploadedBy,
            },
          });
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Error parsing school curriculum doc ${docId}:`, error);
      const msg = error instanceof Error ? error.message : String(error);
      await (this.prisma as any).schoolCurriculumDoc.update({
        where: { id: docId },
        data: { status: 'FAILED', parseErrors: msg },
      });
      return null;
    }
  }
}
