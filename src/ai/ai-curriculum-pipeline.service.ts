import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AgoraCurriculumSourceStatus, SchoolCurriculumDocStatus, SchemeOfWorkStatus } from '@prisma/client';
import { DocumentExtractor } from '../common/utils/document-extractor';
import {
  allocateUniqueStableKey,
  buildTopicStableKey,
} from '../common/utils/topic-stable-key.util';
import {
  DEFAULT_WORKING_DAYS,
  WorkingDay,
  buildHalfTermRange,
  holidayRangesFromEvents,
} from '../common/utils/instructional-day.util';
import {
  PackableTopic,
  buildInstructionalWeekRanges,
  flattenPackedWeekTopic,
  packTopicsOntoCalendar,
} from '../schools/curriculum/scheme-calendar-packer.util';
import { MetricsService } from '../common/metrics/metrics.service';
import { PrismaService } from '../database/prisma.service';
import {
  ConsolidateCurriculumResult,
  MultiGradeParseResult,
  SchemeOfWorkGenerationResult,
  VerificationResult,
} from './ai.types';
import { AiLlmClientService } from './ai-llm-client.service';
import { NotificationService } from '../notification/notification.service';

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
    private readonly notificationService: NotificationService,
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
      } else if (source.fileUrl && (source.fileType === 'DOCX' || source.fileType === 'DOC')) {
        this.logger.log(`Performing real DOCX text extraction for source: ${sourceId}`);
        if (onProgress) await onProgress('AI is extracting text from DOCX...');
        rawText = await DocumentExtractor.extractTextFromDocxUrl(source.fileUrl);
      } else if (source.fileUrl) {
        rawText = await DocumentExtractor.extractTextFromUrl(source.fileUrl, source.fileType);
      }

      const cleanedText = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();

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
            Each term has a configurable week template (default 13 weeks):
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

      if (result.terms && Array.isArray(result.terms)) {
        const existing = await this.prisma.agoraCurriculumTopic.findMany({
          where: { curriculumId },
        });
        const existingBySlot = new Map(
          existing.map((t) => [`${t.term}:${t.weekNumber}`, t]),
        );
        const usedKeys = new Set(existing.map((t) => t.stableKey).filter(Boolean));
        const seenIds = new Set<string>();
        const subjectCode = curriculum.subject?.code || curriculum.subject?.name || 'SUB';

        const upsertOps = [];
        for (const termBlock of result.terms) {
          if (!termBlock.topics) continue;
          for (const [index, t] of termBlock.topics.entries()) {
            const term = termBlock.term || 1;
            const weekNumber = index + 1;
            const slot = existingBySlot.get(`${term}:${weekNumber}`);
            const payload = {
              title: t.title || 'Untitled Topic',
              description: t.description,
              weekNumber,
              topic: t.title,
              subTopics: t.subTopics || [],
              learningOutcomes: t.learningOutcomes || [],
              studentFriendlyOutcomes: t.studentFriendlyOutcomes || [],
              suggestedActivities: t.suggestedActivities || [],
              resources: t.resources || [],
              assessmentType: t.assessmentType,
              order: t.order || weekNumber,
              deprecatedAt: null,
            };
            if (slot) {
              seenIds.add(slot.id);
              upsertOps.push(
                this.prisma.agoraCurriculumTopic.update({
                  where: { id: slot.id },
                  data: payload,
                }),
              );
            } else {
              const preferred = buildTopicStableKey({
                subjectCode,
                gradeLevel,
                term,
                weekNumber,
                title: t.title || 'Untitled Topic',
              });
              const stableKey = allocateUniqueStableKey(preferred, usedKeys);
              upsertOps.push(
                this.prisma.agoraCurriculumTopic.create({
                  data: {
                    curriculumId,
                    stableKey,
                    term,
                    ...payload,
                  },
                }),
              );
            }
          }
        }

        const staleIds = existing.filter((t) => !seenIds.has(t.id)).map((t) => t.id);
        if (staleIds.length) {
          upsertOps.push(
            this.prisma.agoraCurriculumTopic.updateMany({
              where: { id: { in: staleIds } },
              data: { deprecatedAt: new Date() },
            }) as any,
          );
        }

        await this.prisma.$transaction(upsertOps);
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
            try {
              contentToVerify = await DocumentExtractor.extractTextFromUrl(doc.fileUrl, doc.fileType);
            } catch {
              contentToVerify = JSON.stringify(doc.parsedData || {});
            }
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
        agoraTopics: (scheme.agoraCurriculum?.topics || []).map((t: any) => ({
          stableKey: t.stableKey,
          title: t.title,
          weekNumber: t.weekNumber,
          term: t.term,
          subTopics: t.subTopics,
          learningOutcomes: t.learningOutcomes,
          studentFriendlyOutcomes: t.studentFriendlyOutcomes,
          assessmentType: t.assessmentType,
        })),
        customSchoolGuidance: scheme.schoolCurriculum?.parsedData || null,
        mergeWeightAgora: scheme.mergeWeightAgora ?? 70,
        mergeWeightSchool: scheme.mergeWeightSchool ?? 30,
        subject: subjectName,
        gradeLevel: gradeName,
      };

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an expert master teacher. Propose an ordered list of topics for ${subjectName} (${gradeName}) from the provided sources. Do NOT invent a calendar grid. If generationMode is MERGED, prefer Agora coverage (weight ${modelInput.mergeWeightAgora}%) and overlay school-local content (weight ${modelInput.mergeWeightSchool}%). When a topic maps to an Agora library topic you MUST copy its stableKey. Output JSON { "topics": [{ "stableKey", "title", "subTopics", "learningOutcomes", "studentFriendlyOutcomes", "suggestedActivities", "resources", "assessmentType", "order" }] }.`,
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
                      stableKey: { type: 'string' },
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
                      'stableKey',
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
        const weekNumbers = result.weeks.map((w) => w.weekNumber);
        if (new Set(weekNumbers).size !== weekNumbers.length) {
          throw new Error('Invalid scheme: duplicate week numbers');
        }
        if (result.weeks.some((w) => !w.topic || !(w.learningOutcomes || []).length)) {
          throw new Error('Invalid scheme: each week needs a topic and learning outcomes');
        }

        const agoraTopics = (scheme.agoraCurriculum?.topics || []).filter((t: any) => !t.deprecatedAt);
        const agoraByKey = new Map<string, any>();
        const agoraByTitle = new Map<string, any>();
        for (const t of agoraTopics) {
          agoraByKey.set(t.stableKey, t);
          agoraByTitle.set(String(t.title || '').toLowerCase(), t);
        }
        const schoolTopics = await this.prisma.schoolCurriculumTopic.findMany({
          where: {
            schoolId: scheme.schoolId,
            subjectId: scheme.subjectId,
          },
        });
        const schoolByTitle = new Map(
          schoolTopics.map((t) => [String(t.title || '').toLowerCase(), t]),
        );

        if (scheme.generationMode === 'MERGED' && agoraTopics.length) {
          const keepCount = Math.max(
            1,
            Math.ceil((agoraTopics.length * (scheme.mergeWeightAgora ?? 70)) / 100),
          );
          const required = [...agoraTopics]
            .sort((a: any, b: any) => (a.order || a.weekNumber) - (b.order || b.weekNumber))
            .slice(0, keepCount);
          const have = new Set(result.weeks.map((w) => w.stableKey).filter(Boolean));
          for (const req of required) {
            if (!have.has(req.stableKey)) {
              result.weeks.push({
                weekNumber: result.weeks.length + 1,
                stableKey: req.stableKey,
                topic: req.title,
                subTopics: req.subTopics || [],
                learningOutcomes: req.learningOutcomes || [],
                studentFriendlyOutcomes: req.studentFriendlyOutcomes || [],
                suggestedActivities: req.suggestedActivities || [],
                resources: req.resources || [],
                assessmentType: req.assessmentType || '',
              });
              have.add(req.stableKey);
            }
          }
        }

        const packable: PackableTopic[] = result.weeks.map((w, i) => {
          const matched =
            (w.stableKey && agoraByKey.get(w.stableKey)) ||
            agoraByTitle.get(String(w.topic || '').toLowerCase());
          const schoolMatched = schoolByTitle.get(String(w.topic || '').toLowerCase());
          const stableKey =
            w.stableKey ||
            matched?.stableKey ||
            schoolMatched?.stableKey ||
            buildTopicStableKey({
              subjectCode: subjectName,
              gradeLevel: gradeName,
              title: w.topic,
              weekNumber: w.weekNumber || i + 1,
            });
          return {
            stableKey,
            agoraTopicId: matched?.id || null,
            schoolTopicId: schoolMatched?.id || null,
            title: w.topic,
            subTopics: w.subTopics || [],
            learningOutcomes: w.learningOutcomes || [],
            studentFriendlyOutcomes: w.studentFriendlyOutcomes || [],
            suggestedActivities: w.suggestedActivities || [],
            resources: w.resources || [],
            assessmentType: w.assessmentType,
            weekNumber: w.weekNumber || i + 1,
            order: i + 1,
          };
        });

        const term = await this.prisma.term.findUnique({ where: { id: scheme.termId } });
        if (!term) throw new Error('Invalid scheme term');
        const schoolRow = await this.prisma.school.findUnique({
          where: { id: scheme.schoolId },
          select: { workingDays: true },
        });
        const events = await this.prisma.event.findMany({
          where: {
            schoolId: scheme.schoolId,
            type: 'HOLIDAY',
            startDate: { lte: term.endDate },
            endDate: { gte: term.startDate },
          },
          select: { type: true, startDate: true, endDate: true },
        });
        const ranges = buildInstructionalWeekRanges(term.startDate, term.endDate, {
          workingDays: (schoolRow?.workingDays?.length
            ? schoolRow.workingDays
            : DEFAULT_WORKING_DAYS) as WorkingDay[],
          nonInstructionalRanges: [
            buildHalfTermRange(term.halfTermStart, term.halfTermEnd),
            ...holidayRangesFromEvents(events),
          ],
        });
        if (!ranges.length) throw new Error('This term has no instructional weeks to pack a scheme onto.');
        const packed = packTopicsOntoCalendar(packable, ranges);

        await this.prisma.schemeOfWorkWeek.deleteMany({ where: { schemeOfWorkId: schemeId } });
        for (const week of packed) {
          const flat = flattenPackedWeekTopic(week);
          const created = await this.prisma.schemeOfWorkWeek.create({
            data: {
              schemeOfWorkId: schemeId,
              weekNumber: week.weekNumber,
              calendarStartDate: week.calendarStartDate,
              calendarEndDate: week.calendarEndDate,
              topic: flat.topic,
              subTopics: flat.subTopics,
              learningOutcomes: flat.learningOutcomes,
              studentFriendlyOutcomes: flat.studentFriendlyOutcomes,
              suggestedActivities: flat.suggestedActivities,
              resources: flat.resources,
              assessmentType: flat.assessmentType,
              order: week.weekNumber,
            },
          });
          if (week.topics.length) {
            await this.prisma.schemeOfWorkWeekTopic.createMany({
              data: week.topics.map((t, i) => ({
                schemeOfWorkWeekId: created.id,
                agoraTopicId: t.agoraTopicId || null,
                schoolTopicId: t.schoolTopicId || null,
                stableKey: t.stableKey,
                order: i,
              })),
            });
          }
        }

        await this.prisma.schemeOfWork.update({
          where: { id: schemeId },
          data: {
            status: SchemeOfWorkStatus.DRAFT,
            generatedAt: new Date(),
          },
        });

        void this.notifyCurriculumReady(schemeId, scheme?.schoolId, true);
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
        void this.notifyCurriculumReady(schemeId, undefined, false);
      }
      throw error;
    }
  }

  private async notifyCurriculumReady(schemeId: string, schoolId?: string, success = true) {
    try {
      let sid = schoolId;
      let classLevelId: string | undefined;
      if (!sid) {
        const scheme = await (this.prisma as any).schemeOfWork.findUnique({
          where: { id: schemeId },
          select: { schoolId: true, classLevelId: true },
        });
        sid = scheme?.schoolId;
        classLevelId = scheme?.classLevelId;
      } else {
        const scheme = await (this.prisma as any).schemeOfWork.findUnique({
          where: { id: schemeId },
          select: { classLevelId: true },
        });
        classLevelId = scheme?.classLevelId;
      }
      if (!sid) return;
      await this.notificationService.notifySchoolAdmins(sid, {
        type: success ? 'CURRICULUM_READY' : 'CURRICULUM_FAILED',
        title: success ? 'Curriculum ready' : 'Curriculum generation failed',
        body: success
          ? 'A scheme of work is ready for review'
          : 'Scheme of work generation failed — please try again',
        link: '/dashboard/school/courses',
        metadata: { schemeId, classLevelId },
      });
    } catch (err: any) {
      this.logger.warn(`Curriculum notify failed: ${err?.message || err}`);
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
        As Lois, the Myschoolbud Intelligent Curriculum Architect, analyze this school's private curriculum document for the subject: ${doc.subject?.name || 'Unknown'}.
        
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
            data: { status: SchoolCurriculumDocStatus.PARSED, parsedData },
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
              status: SchoolCurriculumDocStatus.PARSED,
              parsedData,
              uploadedBy: doc.uploadedBy,
            },
          });
        }
      }

      await this.persistSchoolTopicsFromParsed(doc, resultsArray);
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

  private async persistSchoolTopicsFromParsed(
    doc: { id: string; schoolId: string; subjectId: string; gradeLevel: string },
    resultsArray: Array<{ gradeLevel?: string; topics?: any[] }>,
  ) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: doc.subjectId },
      select: { code: true, name: true },
    });
    const used = new Set<string>();
    const existing = await this.prisma.schoolCurriculumTopic.findMany({
      where: { schoolId: doc.schoolId },
      select: { stableKey: true },
    });
    existing.forEach((t) => used.add(t.stableKey));

    for (const gradeResult of resultsArray) {
      const grade = gradeResult.gradeLevel || doc.gradeLevel;
      for (const [index, t] of (gradeResult.topics || []).entries()) {
        const preferred = buildTopicStableKey({
          subjectCode: subject?.code || subject?.name || 'SCH',
          gradeLevel: grade,
          weekNumber: index + 1,
          title: t.title || 'Untitled',
        });
        const stableKey = allocateUniqueStableKey(preferred, used);
        await this.prisma.schoolCurriculumTopic.create({
          data: {
            schoolId: doc.schoolId,
            schoolCurriculumDocId: doc.id,
            subjectId: doc.subjectId,
            gradeLevel: grade,
            termNumber: 1,
            stableKey,
            title: t.title || 'Untitled',
            weekNumber: index + 1,
            subTopics: t.subTopics || [],
            learningOutcomes: t.learningOutcomes || [],
            studentFriendlyOutcomes: t.studentFriendlyOutcomes || [],
            suggestedActivities: t.suggestedActivities || [],
            resources: t.resources || [],
            assessmentType: t.assessmentType,
            order: index + 1,
          },
        });
      }
    }
  }
}
