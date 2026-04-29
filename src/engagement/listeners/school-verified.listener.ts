import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EngagementService } from '../engagement.service';

@Injectable()
export class SchoolVerifiedListener {
  private readonly logger = new Logger(SchoolVerifiedListener.name);

  constructor(private readonly engagementService: EngagementService) {}

  @OnEvent('school.verified', { async: true })
  async handleSchoolVerifiedEvent(schoolId: string) {
    this.logger.log(`Received school.verified event for ${schoolId}`);
    await this.engagementService.scheduleOnboardingPlaybook(schoolId);
  }

  @OnEvent('campaign.activated', { async: true })
  async handleCampaignActivatedEvent(campaignId: string) {
    this.logger.log(`Received campaign.activated event for ${campaignId}`);
    await this.engagementService.dispatchCampaign(campaignId);
  }
}
