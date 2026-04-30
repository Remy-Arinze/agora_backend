import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { EngagementService } from './engagement.service';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { EngagementQueueProcessor } from './engagement-queue.processor';
import { SchoolVerifiedListener } from './listeners/school-verified.listener';

@Module({
  imports: [
    DatabaseModule,
    EmailModule,
    BullModule.registerQueue({
      name: 'retention-queue',
    }),
  ],
  controllers: [CampaignController],
  providers: [
    EngagementService,
    CampaignService,
    EngagementQueueProcessor,
    SchoolVerifiedListener,
  ],
  exports: [EngagementService, CampaignService],
})
export class EngagementModule { }
