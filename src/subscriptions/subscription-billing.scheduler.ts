import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionBillingService } from './subscription-billing.service';
import { isFastSubscriptionMode } from './subscription-dev.config';

@Injectable()
export class SubscriptionBillingScheduler {
  private readonly logger = new Logger(SubscriptionBillingScheduler.name);

  constructor(private readonly billing: SubscriptionBillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDaily(): Promise<void> {
    await this.runLifecycle('daily');
  }

  /** In fast-dev mode, pick up 1-day expiry / grace without waiting for 08:00 or a restart. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runFastDevTick(): Promise<void> {
    if (!isFastSubscriptionMode()) return;
    await this.runLifecycle('fast-dev');
  }

  private async runLifecycle(label: string): Promise<void> {
    const start = Date.now();
    if (label === 'daily') {
      this.logger.log('Starting daily subscription billing lifecycle...');
    }
    try {
      await this.billing.runDailyBillingLifecycle();
      if (label === 'daily') {
        this.logger.log(`Daily subscription billing lifecycle completed in ${Date.now() - start}ms`);
      }
    } catch (e) {
      this.logger.error(
        `${label} subscription billing lifecycle FAILED after ${Date.now() - start}ms: ${e}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }
}
