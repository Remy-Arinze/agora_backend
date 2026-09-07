import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationModule } from '../notification/notification.module';
import { BudService } from './bud.service';
import { BudController } from './bud.controller';
import { BudReviewScheduler } from './bud-review.scheduler';

@Module({
  imports: [DatabaseModule, AiModule, PaymentsModule, NotificationModule],
  controllers: [BudController],
  providers: [BudService, BudReviewScheduler],
  exports: [BudService],
})
export class BudModule {}
