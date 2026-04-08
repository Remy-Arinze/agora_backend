import { Module } from '@nestjs/common';
import { AgoraCurriculumController } from './agora-curriculum.controller';
import { AgoraCurriculumService } from './agora-curriculum.service';

import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { CloudinaryModule } from '../storage/cloudinary/cloudinary.module';

import { VectorQueueModule } from '../ai/vector-queue.module';
import { NotificationModule } from '../notification/notification.module';
import { CurriculumProcessor, ConsolidationProcessor } from './curriculum.processor';

@Module({
  imports: [
    DatabaseModule,
    AiModule,
    CloudinaryModule,
    VectorQueueModule,
    NotificationModule,
  ],
  controllers: [AgoraCurriculumController],
  providers: [
    AgoraCurriculumService,
    CurriculumProcessor,
    ConsolidationProcessor,
  ],
  exports: [AgoraCurriculumService],
})
export class AgoraCurriculumModule {}
