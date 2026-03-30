import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LiveStatusService } from './live-status.service';

@Module({
  imports: [DatabaseModule],
  providers: [LiveStatusService],
  exports: [LiveStatusService],
})
export class LiveStatusModule {}
