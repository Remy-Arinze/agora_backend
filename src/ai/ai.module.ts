import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { KnowledgeIndexingService } from './knowledge-indexing.service';
import { AiController } from './ai.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DatabaseModule } from '../database/database.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ConfigModule, SubscriptionsModule, DatabaseModule, ScheduleModule.forRoot()],
  controllers: [AiController],
  providers: [AiService, KnowledgeIndexingService],
  exports: [AiService, KnowledgeIndexingService],
})
export class AiModule { }
