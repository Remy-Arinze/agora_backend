import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import { StaffRepository } from '../schools/domain/repositories/staff.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [GradesController],
  providers: [GradesService, SchoolRepository, StaffRepository],
  exports: [GradesService],
})
export class GradesModule {}
