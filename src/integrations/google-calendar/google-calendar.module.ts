import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import {
  GoogleCalendarController,
  GoogleCalendarSchoolController,
} from './google-calendar.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [GoogleCalendarController, GoogleCalendarSchoolController],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
