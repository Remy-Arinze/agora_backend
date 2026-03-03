import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlansController } from './plans/plans.controller';
import { SubscriptionPlansService } from './plans/plans.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SubscriptionsController, SubscriptionPlansController],
  providers: [SubscriptionsService, SubscriptionPlansService],
  exports: [SubscriptionsService, SubscriptionPlansService],
})
export class SubscriptionsModule { }

