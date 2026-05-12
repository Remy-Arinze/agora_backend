import { Injectable } from '@nestjs/common';
import { AiChatStreamService } from './ai-chat-stream.service';
import { AiContentGeneratorsService } from './ai-content-generators.service';
import { AiContextRagService } from './ai-context-rag.service';
import { AiCurriculumPipelineService } from './ai-curriculum-pipeline.service';
import { AiLlmClientService } from './ai-llm-client.service';
import { AiSchoolChatService } from './ai-school-chat.service';

/** Re-export shared types so `import { X } from './ai.service'` keeps working. */
export * from './ai.types';

/**
 * Public entry for Lois / OpenAI features. Delegates to focused Nest services.
 */
@Injectable()
export class AiService {
  constructor(
    private readonly llm: AiLlmClientService,
    private readonly contextRag: AiContextRagService,
    private readonly generators: AiContentGeneratorsService,
    private readonly chatStream: AiChatStreamService,
    private readonly schoolChat: AiSchoolChatService,
    private readonly curriculum: AiCurriculumPipelineService,
  ) {}

  isConfigured(): boolean {
    return this.llm.isConfigured();
  }

  createEmbedding(...args: Parameters<AiContextRagService['createEmbedding']>) {
    return this.contextRag.createEmbedding(...args);
  }

  findRelevantContext(...args: Parameters<AiContextRagService['findRelevantContext']>) {
    return this.contextRag.findRelevantContext(...args);
  }

  chatStreamSSE(...args: Parameters<AiChatStreamService['chatStreamSSE']>) {
    return this.chatStream.chatStreamSSE(...args);
  }

  generateFlashcards(...args: Parameters<AiContentGeneratorsService['generateFlashcards']>) {
    return this.generators.generateFlashcards(...args);
  }

  generateSummary(...args: Parameters<AiContentGeneratorsService['generateSummary']>) {
    return this.generators.generateSummary(...args);
  }

  generateQuiz(...args: Parameters<AiContentGeneratorsService['generateQuiz']>) {
    return this.generators.generateQuiz(...args);
  }

  generateLessonPlan(...args: Parameters<AiContentGeneratorsService['generateLessonPlan']>) {
    return this.generators.generateLessonPlan(...args);
  }

  gradeShortAnswers(...args: Parameters<AiContentGeneratorsService['gradeShortAnswers']>) {
    return this.generators.gradeShortAnswers(...args);
  }

  gradeEssay(...args: Parameters<AiContentGeneratorsService['gradeEssay']>) {
    return this.generators.gradeEssay(...args);
  }

  generateAssessmentQuestions(...args: Parameters<AiContentGeneratorsService['generateAssessmentQuestions']>) {
    return this.generators.generateAssessmentQuestions(...args);
  }

  chat(...args: Parameters<AiSchoolChatService['chat']>) {
    return this.schoolChat.chat(...args);
  }

  getConversations(...args: Parameters<AiSchoolChatService['getConversations']>) {
    return this.schoolChat.getConversations(...args);
  }

  getConversationMessages(...args: Parameters<AiSchoolChatService['getConversationMessages']>) {
    return this.schoolChat.getConversationMessages(...args);
  }

  deleteConversation(...args: Parameters<AiSchoolChatService['deleteConversation']>) {
    return this.schoolChat.deleteConversation(...args);
  }

  verifyCurriculumDocument(...args: Parameters<AiCurriculumPipelineService['verifyCurriculumDocument']>) {
    return this.curriculum.verifyCurriculumDocument(...args);
  }

  parseCurriculumDocument(...args: Parameters<AiCurriculumPipelineService['parseCurriculumDocument']>) {
    return this.curriculum.parseCurriculumDocument(...args);
  }

  consolidateAgoraCurriculum(...args: Parameters<AiCurriculumPipelineService['consolidateAgoraCurriculum']>) {
    return this.curriculum.consolidateAgoraCurriculum(...args);
  }

  generateSchemeOfWork(...args: Parameters<AiCurriculumPipelineService['generateSchemeOfWork']>) {
    return this.curriculum.generateSchemeOfWork(...args);
  }

  generateYearlySchemeOfWork(...args: Parameters<AiCurriculumPipelineService['generateYearlySchemeOfWork']>) {
    return this.curriculum.generateYearlySchemeOfWork(...args);
  }

  parseSchoolCurriculumDocument(...args: Parameters<AiCurriculumPipelineService['parseSchoolCurriculumDocument']>) {
    return this.curriculum.parseSchoolCurriculumDocument(...args);
  }
}
