import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { OpenObserveLogger } from './openobserve-logger.service';
import { QueueMonitorService } from './queue-monitor.service';
import { RedisHealthService } from './redis-health.service';
import { JobEventsService } from './job-events.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    // Register the queue tokens this module injects —
    // the actual BullMQ root connection is already configured in VectorQueueModule.
    BullModule.registerQueue(
      { name: '{vector}' },
      { name: 'curriculum-processing' },
      { name: 'curriculum-consolidation' },
      { name: 'retention-queue' },
    ),
  ],
  providers: [
    OpenObserveLogger,
    QueueMonitorService,
    RedisHealthService,
    JobEventsService,
  ],
  exports: [OpenObserveLogger],
})
export class LoggerModule {}
