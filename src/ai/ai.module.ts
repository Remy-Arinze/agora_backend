import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [ConfigModule, SubscriptionsModule, DatabaseModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule { }
