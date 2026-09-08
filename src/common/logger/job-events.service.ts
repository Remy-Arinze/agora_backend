import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { OpenObserveLogger } from './openobserve-logger.service';

/**
 * Attaches a BullMQ QueueEvents listener to every queue.
 *
 * Each job lifecycle event is shipped to OpenObserve as a structured log:
 *
 *  { event: "job.completed", queue: "curriculum-processing", jobId: "42",
 *    jobName: "process-source", duration_ms: 1234 }
 *
 *  { event: "job.failed", queue: "{vector}", jobId: "7",
 *    jobName: "generate-embedding", reason: "OpenAI rate limit" }
 *
 *  { event: "job.stalled", queue: "retention-queue", jobId: "3" }
 *
 * These events are queryable in OpenObserve by `event`, `queue`, `jobName`,
 * allowing you to build dashboards and alert rules.
 */
@Injectable()
export class JobEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobEventsService.name);
  private queueEvents: QueueEvents[] = [];

  // Track job start times so we can emit duration on completion
  private readonly startTimes = new Map<string, number>();

  constructor(
    @InjectQueue('{vector}') private readonly vectorQueue: Queue,
    @InjectQueue('curriculum-processing') private readonly curriculumQueue: Queue,
    @InjectQueue('curriculum-consolidation') private readonly consolidationQueue: Queue,
    @InjectQueue('scheme-generation') private readonly schemeQueue: Queue,
    @InjectQueue('retention-queue') private readonly retentionQueue: Queue,
    private readonly oo: OpenObserveLogger,
  ) {}

  onModuleInit() {
    const queues: Array<{ name: string; queue: Queue }> = [
      { name: '{vector}',                 queue: this.vectorQueue },
      { name: 'curriculum-processing',    queue: this.curriculumQueue },
      { name: 'curriculum-consolidation', queue: this.consolidationQueue },
      { name: 'scheme-generation',        queue: this.schemeQueue },
      { name: 'retention-queue',          queue: this.retentionQueue },
    ];

    for (const { name, queue } of queues) {
      // QueueEvents uses the same Redis connection opts as the queue itself
      const qe = new QueueEvents(name, {
        connection: (queue as any).opts?.connection ?? {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: null,
        },
      });

      this.attachListeners(qe, name);
      this.queueEvents.push(qe);
    }

    this.logger.log(`Job event listeners attached to ${queues.length} queues`);
  }

  async onModuleDestroy() {
    await Promise.all(this.queueEvents.map((qe) => qe.close()));
  }

  private attachListeners(qe: QueueEvents, queueName: string) {
    qe.on('waiting', ({ jobId }) => {
      this.oo.log(
        JSON.stringify({ event: 'job.waiting', queue: queueName, jobId }),
        'JobEvents',
      );
    });

    qe.on('active', ({ jobId, prev }) => {
      this.startTimes.set(`${queueName}:${jobId}`, Date.now());
      this.oo.log(
        JSON.stringify({ event: 'job.active', queue: queueName, jobId, prev }),
        'JobEvents',
      );
    });

    qe.on('completed', ({ jobId, returnvalue }) => {
      const key = `${queueName}:${jobId}`;
      const startTime = this.startTimes.get(key);
      const duration_ms = startTime ? Date.now() - startTime : undefined;
      this.startTimes.delete(key);

      this.oo.log(
        JSON.stringify({
          event: 'job.completed',
          queue: queueName,
          jobId,
          duration_ms,
          returnvalue: returnvalue ?? null,
        }),
        'JobEvents',
      );
    });

    qe.on('failed', ({ jobId, failedReason }) => {
      const key = `${queueName}:${jobId}`;
      const startTime = this.startTimes.get(key);
      const duration_ms = startTime ? Date.now() - startTime : undefined;
      this.startTimes.delete(key);

      this.oo.error(
        JSON.stringify({
          event:         'job.failed',
          queue:         queueName,
          jobId,
          duration_ms,
          reason:        failedReason,
        }),
        undefined,
        'JobEvents',
      );
    });

    qe.on('stalled', ({ jobId }) => {
      this.oo.warn(
        JSON.stringify({ event: 'job.stalled', queue: queueName, jobId }),
        'JobEvents',
      );
    });

    qe.on('delayed', ({ jobId, delay }) => {
      this.oo.log(
        JSON.stringify({ event: 'job.delayed', queue: queueName, jobId, delay_ms: delay }),
        'JobEvents',
      );
    });

    qe.on('retries-exhausted', ({ jobId, attemptsMade }) => {
      this.oo.error(
        JSON.stringify({
          event:        'job.retries_exhausted',
          queue:        queueName,
          jobId,
          attempts_made: attemptsMade,
        }),
        undefined,
        'JobEvents',
      );
    });

    qe.on('error', (err: Error) => {
      this.oo.error(
        `QueueEvents error on ${queueName}: ${err.message}`,
        err.stack,
        'JobEvents',
      );
    });
  }
}
