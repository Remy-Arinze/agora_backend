import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionBillingService } from './subscription-billing.service';

@Injectable()
export class SubscriptionBillingScheduler {
  private readonly logger = new Logger(SubscriptionBillingScheduler.name);

  constructor(private readonly billing: SubscriptionBillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDaily(): Promise<void> {
    try {
      await this.billing.runDailyBillingLifecycle();
    } catch (e) {
      this.logger.error(`Subscription billing lifecycle failed: ${e}`);
    }
  }
}
