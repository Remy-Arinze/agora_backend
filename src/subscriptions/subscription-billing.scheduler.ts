import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionBillingService } from './subscription-billing.service';

@Injectable()
export class SubscriptionBillingScheduler {
  private readonly logger = new Logger(SubscriptionBillingScheduler.name);

  constructor(private readonly billing: SubscriptionBillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDaily(): Promise<void> {
    this.logger.log('Starting daily subscription billing lifecycle...');
    const start = Date.now();
    try {
      await this.billing.runDailyBillingLifecycle();
      this.logger.log(`Daily subscription billing lifecycle completed in ${Date.now() - start}ms`);
    } catch (e) {
      // Log the full error so it surfaces in monitoring/alerting
      this.logger.error(
        `Daily subscription billing lifecycle FAILED after ${Date.now() - start}ms: ${e}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }
}
