import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationInboxService } from './notification-inbox.service';
import { NotificationInboxController } from './notification-inbox.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [NotificationController, NotificationInboxController],
  providers: [NotificationService, NotificationInboxService],
  exports: [NotificationService, NotificationInboxService],
})
export class NotificationModule {}
