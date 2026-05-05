import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AiSchoolInsightsService } from './ai-school-insights.service';

/**
 * Daily digest: notify connected school admins when students fall below grade threshold.
 */
@Injectable()
export class AiAcademicRiskDigestScheduler {
  private readonly logger = new Logger(AiAcademicRiskDigestScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: AiSchoolInsightsService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyDigest(): Promise<void> {
    try {
      const schools = await this.prisma.school.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      for (const school of schools) {
        const termId = await this.insights.getActiveTermId(school.id);
        const students = await this.insights.findAtRiskStudents(school.id, {
          termId,
          thresholdPercent: 45,
          limit: 20,
          useActiveTermWhenMissing: false,
        });

        if (students.length === 0) continue;

        this.notifications.emitAcademicRiskDigest({
          schoolId: school.id,
          schoolName: school.name,
          atRiskCount: students.length,
          preview: students.slice(0, 8).map((s) => ({
            studentName: `${s.firstName} ${s.lastName}`.trim(),
            avgPercent: Math.round(s.avgPercent * 10) / 10,
          })),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      this.logger.error(`Academic risk digest failed: ${e}`);
    }
  }
}
