import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import { StaffRepository } from '../schools/domain/repositories/staff.repository';

import { AiModule } from '../ai/ai.module';

@Module({
  imports: [DatabaseModule, AiModule],
  controllers: [GradesController],
  providers: [GradesService, SchoolRepository, StaffRepository],
  exports: [GradesService],
})
export class GradesModule {}
