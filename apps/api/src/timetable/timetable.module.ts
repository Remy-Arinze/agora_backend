import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { ResourcesService } from './resources.service';
import { SchoolsModule } from '../schools/schools.module';

@Module({
  imports: [DatabaseModule, SchoolsModule],
  controllers: [TimetableController],
  providers: [TimetableService, ResourcesService],
  exports: [TimetableService, ResourcesService],
})
export class TimetableModule {}
