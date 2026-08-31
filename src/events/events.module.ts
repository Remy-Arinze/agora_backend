import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { SchoolsModule } from '../schools/schools.module';
import { GoogleCalendarModule } from '../integrations/google-calendar/google-calendar.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [DatabaseModule, SchoolsModule, GoogleCalendarModule, NotificationModule],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventsModule {}
