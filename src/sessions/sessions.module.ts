import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { SchoolsModule } from '../schools/schools.module';
import { EmailModule } from '../email/email.module';
import { NotificationModule } from '../notification/notification.module';
import { SchoolSettingsModule } from '../school-settings/school-settings.module';

@Module({
  imports: [DatabaseModule, SchoolsModule, EmailModule, NotificationModule, SchoolSettingsModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionsModule {}
