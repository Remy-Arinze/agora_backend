import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { KnowledgeIndexingService } from './knowledge-indexing.service';
import { AiController } from './ai.controller';
import { VectorProcessor } from './vector.processor';
import { VectorQueueModule } from './vector-queue.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DatabaseModule } from '../database/database.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule,
    SubscriptionsModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    VectorQueueModule,
  ],
  controllers: [AiController],
  providers: [AiService, KnowledgeIndexingService, VectorProcessor],
  exports: [AiService, KnowledgeIndexingService],
})
export class AiModule {}
