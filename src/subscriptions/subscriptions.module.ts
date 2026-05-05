import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlansController } from './plans/plans.controller';
import { SubscriptionPlansService } from './plans/plans.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { SubscriptionBillingService } from './subscription-billing.service';
import { SubscriptionBillingScheduler } from './subscription-billing.scheduler';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [SubscriptionsController, SubscriptionPlansController],
  providers: [
    SubscriptionsService,
    SubscriptionPlansService,
    SubscriptionBillingService,
    SubscriptionBillingScheduler,
  ],
  exports: [SubscriptionsService, SubscriptionPlansService, SubscriptionBillingService],
})
export class SubscriptionsModule { }

