import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiAgentToolsService } from './ai-agent-tools.service';
import { AiChatPromptService } from './ai-chat-prompt.service';
import { AiChatStreamService } from './ai-chat-stream.service';
import { AiContentGeneratorsService } from './ai-content-generators.service';
import { AiContextRagService } from './ai-context-rag.service';
import { AiCurriculumPipelineService } from './ai-curriculum-pipeline.service';
import { AiLlmClientService } from './ai-llm-client.service';
import { AiSchoolChatService } from './ai-school-chat.service';
import { AiService } from './ai.service';
import { KnowledgeIndexingService } from './knowledge-indexing.service';
import { AiController } from './ai.controller';
import { VectorProcessor } from './vector.processor';
import { VectorQueueModule } from './vector-queue.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notification/notification.module';

import { KnowledgeEventService } from './knowledge-event.service';
import { AiSchoolInsightsService } from './ai-school-insights.service';
import { AiAcademicRiskDigestScheduler } from './ai-academic-risk-digest.scheduler';
import { AiStaffPermissionCheckerService } from './ai-staff-permission-checker.service';
import { PermissionGuard } from '../common/guards/permission.guard';

@Module({
  imports: [
    ConfigModule,
    SubscriptionsModule,
    DatabaseModule,
    VectorQueueModule,
    NotificationModule,
  ],
  controllers: [AiController],
  providers: [
    PermissionGuard,
    AiLlmClientService,
    AiSchoolInsightsService,
    AiStaffPermissionCheckerService,
    AiContextRagService,
    AiContentGeneratorsService,
    AiAgentToolsService,
    AiChatPromptService,
    AiSchoolChatService,
    AiChatStreamService,
    AiCurriculumPipelineService,
    AiService,
    KnowledgeIndexingService,
    VectorProcessor,
    KnowledgeEventService,
    AiAcademicRiskDigestScheduler,
  ],
  exports: [AiService, KnowledgeIndexingService],
})
export class AiModule {}
