import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OpenObserveLogger } from './openobserve-logger.service';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Polls every BullMQ queue on a fixed interval and ships structured
 * queue-depth / health snapshots to OpenObserve as structured log entries.
 *
 * Each snapshot looks like:
 * {
 *   event:   "queue.snapshot",
 *   queue:   "curriculum-processing",
 *   waiting: 3, active: 1, completed: 142, failed: 2, delayed: 0, paused: false
 * }
 *
 * You can build dashboards / alerts in OpenObserve on these fields.
 */
@Injectable()
export class QueueMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMonitorService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(
    @InjectQueue('{vector}') private readonly vectorQueue: Queue,
    @InjectQueue('curriculum-processing') private readonly curriculumQueue: Queue,
    @InjectQueue('curriculum-consolidation') private readonly consolidationQueue: Queue,
    @InjectQueue('scheme-generation') private readonly schemeQueue: Queue,
    @InjectQueue('retention-queue') private readonly retentionQueue: Queue,
    private readonly oo: OpenObserveLogger,
  ) {}

  onModuleInit() {
    // Fire once immediately so the first data point appears on startup
    this.poll();
    this.interval = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.logger.log('Queue monitor started (30s interval)');
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private async poll() {
    const queues: Array<{ name: string; queue: Queue }> = [
      { name: '{vector}',                queue: this.vectorQueue },
      { name: 'curriculum-processing',    queue: this.curriculumQueue },
      { name: 'curriculum-consolidation', queue: this.consolidationQueue },
      { name: 'scheme-generation',        queue: this.schemeQueue },
      { name: 'retention-queue',          queue: this.retentionQueue },
    ];

    await Promise.all(queues.map(({ name, queue }) => this.snapshotQueue(name, queue)));
  }

  private async snapshotQueue(name: string, queue: Queue) {
    try {
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

      this.oo.log(
        JSON.stringify({
          event:     'queue.snapshot',
          queue:     name,
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused,
        }),
        'QueueMonitor',
      );

      // Warn if there are failed jobs accumulating
      if (failed > 0) {
        this.oo.warn(
          JSON.stringify({
            event:  'queue.failed_jobs_present',
            queue:  name,
            failed,
          }),
          'QueueMonitor',
        );
      }

      // Warn if queue is growing and nothing is active (possible stall)
      if (waiting > 10 && active === 0) {
        this.oo.warn(
          JSON.stringify({
            event:   'queue.possible_stall',
            queue:   name,
            waiting,
            active,
          }),
          'QueueMonitor',
        );
      }
    } catch (err: any) {
      // Redis might be temporarily unreachable — log but don't crash
      this.oo.error(
        `Failed to snapshot queue ${name}: ${err?.message}`,
        err?.stack,
        'QueueMonitor',
      );
    }
  }
}
