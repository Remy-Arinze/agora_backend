import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ExamTimetableController } from './exam-timetable.controller';
import { ExamTimetableService } from './exam-timetable.service';
import { SchoolsModule } from '../schools/schools.module';

@Module({
  imports: [DatabaseModule, SchoolsModule],
  controllers: [ExamTimetableController],
  providers: [ExamTimetableService],
  exports: [ExamTimetableService],
})
export class ExamTimetableModule {}
