import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';

@Processor('retention-queue')
export class EngagementQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EngagementQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`Processing retention job ${job.name} [${job.id}]`);

    switch (job.name) {
      case 'check-onboarding-session':
        return this.handleSessionCheck(job.data.schoolId);
      case 'check-onboarding-teachers':
        return this.handleTeacherCheck(job.data.schoolId);
      case 'check-onboarding-students':
        return this.handleStudentCheck(job.data.schoolId);
      case 'dispatch-campaign':
        return this.handleDispatchCampaign(job.data.campaignId);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleSessionCheck(schoolId: string) {
    const sessionCount = await this.prisma.academicSession.count({ where: { schoolId } });
    if (sessionCount === 0) {
      this.logger.log(`School ${schoolId} has no sessions after 24h. Sending nudge.`);
      await this.sendNudge(schoolId, 'SESSION_SETUP_NUDGE', 'Quick guide to setting up your first Academic Term');
    }
  }

  private async handleTeacherCheck(schoolId: string) {
    const teacherCount = await this.prisma.teacher.count({ where: { schoolId } });
    if (teacherCount === 0) {
      this.logger.log(`School ${schoolId} has no teachers after 48h. Sending nudge.`);
      await this.sendNudge(schoolId, 'TEACHER_SETUP_NUDGE', 'Delegation is key: How to invite your teachers');
    }
  }

  private async handleStudentCheck(schoolId: string) {
    const studentCount = await this.prisma.enrollment.count({ where: { schoolId } });
    if (studentCount === 0) {
      this.logger.log(`School ${schoolId} has no students after 72h. Sending nudge.`);
      await this.sendNudge(schoolId, 'STUDENT_SETUP_NUDGE', 'Ready for students? Bulk import your roster');
    }
  }

  private async handleDispatchCampaign(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== 'ACTIVE') return;

    this.logger.log(`Dispatching campaign: ${campaign.name}`);

    let targetSchoolIds: string[] = [];

    if (campaign.target === 'ALL_SCHOOLS') {
      const schools = await this.prisma.school.findMany({ select: { id: true } });
      targetSchoolIds = schools.map(s => s.id);
    } else if (campaign.target === 'SPECIFIC_SCHOOLS') {
      targetSchoolIds = campaign.targetSchools;
    }

    let sentCount = 0;
    for (const schoolId of targetSchoolIds) {
      // Find school owner
      const owner = await this.prisma.schoolAdmin.findFirst({
        where: { schoolId, role: 'school_owner' },
        include: { user: true }
      });

      if (owner && owner.user?.email) {
        // Here you would use the EmailService to send the actual email using campaign.subject and campaign.content
        // await this.emailService.sendCampaignEmail(owner.user.email, campaign.subject, campaign.content);

        // Log it to prevent duplicate spam
        await this.prisma.notificationLog.create({
          data: {
            userId: owner.userId,
            type: 'CAMPAIGN',
            channel: 'EMAIL',
            recipient: owner.user.email,
            subject: campaign.subject,
            body: campaign.content,
            status: 'SENT',
          }
        });
        sentCount++;
      }
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'COMPLETED',
        sentAt: new Date(),
        metrics: { sent: sentCount }
      }
    });
  }

  private async sendNudge(schoolId: string, type: string, subject: string) {
    // Prevent duplicate nudges
    const existing = await this.prisma.notificationLog.findFirst({
      where: {
        type,
        user: { schoolAdmins: { some: { schoolId, role: 'school_owner' } } }
      }
    });

    if (existing) return;

    const owner = await this.prisma.schoolAdmin.findFirst({
      where: { schoolId, role: 'school_owner' },
      include: { user: true }
    });

    if (owner && owner.user?.email) {
      // await this.emailService.sendNudgeEmail(owner.user.email, subject);

      await this.prisma.notificationLog.create({
        data: {
          userId: owner.userId,
          type,
          channel: 'EMAIL',
          recipient: owner.user.email,
          subject,
          body: 'Automated nudge content...',
          status: 'SENT',
        }
      });
    }
  }
}
