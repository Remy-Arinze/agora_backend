import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../database/database.module';
import { EmailModule } from '../../email/email.module';
import { TransfersModule } from '../../transfers/transfers.module';
import { SchoolMapper } from '../domain/mappers/school.mapper';
import { SchoolLifecycleService } from './school-lifecycle.service';
import { SchoolLifecycleProcessor } from './school-lifecycle.processor';

@Module({
  imports: [
    DatabaseModule,
    EmailModule,
    forwardRef(() => TransfersModule),
    BullModule.registerQueue({ name: 'school-lifecycle-queue' }),
  ],
  providers: [SchoolLifecycleService, SchoolLifecycleProcessor, SchoolMapper],
  exports: [SchoolLifecycleService],
})
export class SchoolLifecycleModule {}
