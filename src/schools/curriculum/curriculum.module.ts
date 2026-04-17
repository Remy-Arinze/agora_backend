import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module';
import { VectorQueueModule } from '../../ai/vector-queue.module';
import { AiModule } from '../../ai/ai.module';
import { CurriculumService } from './curriculum.service';
import { CurriculumController } from './curriculum.controller';
import { NerdcCurriculumService } from './nerdc-curriculum.service';
import { SchoolRepository } from '../domain/repositories/school.repository';
import { StaffRepository } from '../domain/repositories/staff.repository';
import { SchemeOfWorkProcessor } from './scheme-of-work.processor';

@Module({
  imports: [
    DatabaseModule,
    SubscriptionsModule,
    VectorQueueModule,
    AiModule,
  ],
  controllers: [CurriculumController],
  providers: [
    CurriculumService,
    NerdcCurriculumService,
    SchoolRepository,
    StaffRepository,
    SchemeOfWorkProcessor,
  ],
  exports: [CurriculumService, NerdcCurriculumService],
})
export class CurriculumModule {}
