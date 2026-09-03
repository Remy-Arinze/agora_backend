import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { AiInsightsService } from './ai-insights.service';

/**
 * Daily loops: academic risk, drops, SoW gaps, attendance, fees, and admissions backlog.
 */
@Injectable()
export class AiAcademicRiskDigestScheduler {
  private readonly logger = new Logger(AiAcademicRiskDigestScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: AiInsightsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyDigest(): Promise<void> {
    try {
      const schools = await this.prisma.school.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      for (const school of schools) {
        try {
          await this.insights.runDailyForSchool(school.id, school.name);
        } catch (inner) {
          this.logger.error(`Insights failed for school ${school.id}: ${inner}`);
        }
      }
    } catch (e) {
      this.logger.error(`Academic risk digest failed: ${e}`);
    }
  }
}
