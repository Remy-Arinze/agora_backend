import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    @InjectQueue('retention-queue') private readonly retentionQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Schedule the Playbook A onboarding checks
   */
  async scheduleOnboardingPlaybook(schoolId: string) {
    this.logger.log(`Scheduling onboarding playbook for school ${schoolId}`);
    
    // Day 1 Check: Session created?
    await this.retentionQueue.add(
      'check-onboarding-session',
      { schoolId },
      { delay: 24 * 60 * 60 * 1000, jobId: `session-check-${schoolId}` }
    );

    // Day 2 Check: Teachers invited?
    await this.retentionQueue.add(
      'check-onboarding-teachers',
      { schoolId },
      { delay: 48 * 60 * 60 * 1000, jobId: `teacher-check-${schoolId}` }
    );

    // Day 3 Check: Students enrolled?
    await this.retentionQueue.add(
      'check-onboarding-students',
      { schoolId },
      { delay: 72 * 60 * 60 * 1000, jobId: `student-check-${schoolId}` }
    );
  }

  /**
   * Schedule campaign email blast
   */
  async dispatchCampaign(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) return;

    await this.retentionQueue.add('dispatch-campaign', { campaignId }, {
      jobId: `dispatch-campaign-${campaignId}`
    });
  }
}
