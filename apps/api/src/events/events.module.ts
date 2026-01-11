import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { SchoolsModule } from '../schools/schools.module';
import { GoogleCalendarModule } from '../integrations/google-calendar/google-calendar.module';

@Module({
  imports: [DatabaseModule, SchoolsModule, GoogleCalendarModule],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventsModule {}
