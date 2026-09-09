import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module';
import { VectorQueueModule } from '../../ai/vector-queue.module';
import { AiModule } from '../../ai/ai.module';
import { CloudinaryModule } from '../../storage/cloudinary/cloudinary.module';
import { CurriculumService } from './curriculum.service';
import { CurriculumController } from './curriculum.controller';
import { NerdcCurriculumService } from './nerdc-curriculum.service';
import { SchoolRepository } from '../domain/repositories/school.repository';
import { StaffRepository } from '../domain/repositories/staff.repository';
import { SchemeOfWorkProcessor } from './scheme-of-work.processor';
import { SchemeSpineService } from './scheme-spine.service';
import { SchoolSettingsModule } from '../../school-settings/school-settings.module';

@Module({
  imports: [
    DatabaseModule,
    SubscriptionsModule,
    VectorQueueModule,
    forwardRef(() => AiModule),
    CloudinaryModule,
    SchoolSettingsModule,
  ],
  controllers: [CurriculumController],
  providers: [
    CurriculumService,
    NerdcCurriculumService,
    SchoolRepository,
    StaffRepository,
    SchemeOfWorkProcessor,
    SchemeSpineService,
  ],
  exports: [CurriculumService, NerdcCurriculumService, SchemeSpineService],
})
export class CurriculumModule { }
