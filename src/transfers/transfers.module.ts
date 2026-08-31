import { Module, forwardRef } from '@nestjs/common';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { NotificationModule } from '../notification/notification.module';
import { SchoolSettingsModule } from '../school-settings/school-settings.module';

@Module({
  imports: [DatabaseModule, EmailModule, NotificationModule, SchoolSettingsModule],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
