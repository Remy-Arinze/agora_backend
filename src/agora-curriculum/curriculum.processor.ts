import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { AgoraCurriculumSourceStatus } from '@prisma/client';
import { AgoraCurriculumService } from './agora-curriculum.service';
import { MetricsService } from '../common/metrics/metrics.service';
import {
  CURRICULUM_CONSOLIDATION_QUEUE,
  CURRICULUM_PROCESSING_QUEUE,
  JOB_PROCESS_SOURCE,
  ConsolidateBatchPayload,
  ProcessSourcePayload,
} from './curriculum-queues';

@Processor(CURRICULUM_PROCESSING_QUEUE, {
  concurrency: 1,
})
export class CurriculumProcessor extends WorkerHost {
  private readonly logger = new Logger(CurriculumProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly metricsService: MetricsService,
    private readonly agoraCurriculumService: AgoraCurriculumService,
  ) {
    super();
  }

  async process(job: Job<ProcessSourcePayload, void, string>): Promise<void> {
    if (job.name !== JOB_PROCESS_SOURCE) {
      this.logger.warn(`Skipping unexpected job ${job.name} on ${CURRICULUM_PROCESSING_QUEUE}`);
      return;
    }

    const startTime = Date.now();
    const { sourceId } = job.data;

    this.logger.log(`[Queue] Picking up job ${job.id} for source ${sourceId}`);

    try {
      // 0. Pre-flight check: Is the job still valid?
      const source = await this.prisma.agoraCurriculumSource.findUnique({
        where: { id: sourceId },
      });

      if (!source || source.status === AgoraCurriculumSourceStatus.FAILED || source.status === AgoraCurriculumSourceStatus.PARSED) {
        // Skip: already finished, failed, or not found.
        this.logger.warn(`Source ${sourceId} status is ${source?.status || 'NOT_FOUND'}. Skipping duplicate or invalid processing.`);
        return;
      }

      /**
       * 1. Update status to PARSING so the frontend can show progress
       */
      await this.prisma.agoraCurriculumSource.update({
        where: { id: sourceId },
        data: { status: AgoraCurriculumSourceStatus.PARSING },
      });

      await this.aiService.parseCurriculumDocument(sourceId, async (step) => {
        await job.updateProgress({ step });
      });

      // 3. Mid-flight check: Was it successful?
      const finalCheck = await this.prisma.agoraCurriculumSource.findUnique({ where: { id: sourceId } });

      // 4. Each parsed source consolidates on its own subject + class — do not wait for the rest of the batch
      if (finalCheck?.status === AgoraCurriculumSourceStatus.PARSED) {
        await this.agoraCurriculumService.autoConsolidateParsedSource(finalCheck);
      }

      const durationSec = (Date.now() - startTime) / 1000;
      this.metricsService.bullmqJobsCompletedTotal.inc({ queue: CURRICULUM_PROCESSING_QUEUE, job_name: job.name });
      this.logger.log(`[Queue] Successfully completed job ${job.id} in ${durationSec}s`);

      // 5. RESTING PERIOD: Give the system 2 seconds to breathe before picking up the next job.
      // This prevents back-to-back CPU/Memory spikes that cause Redis ECONNRESET on Windows/WSL.
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      this.metricsService.bullmqJobsFailedTotal.inc({ queue: CURRICULUM_PROCESSING_QUEUE, job_name: job.name });
      this.logger.error(`[Queue] Job ${job.id} failed:`, error);

      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      const message = error instanceof Error ? error.message : String(error);

      if (isFinalAttempt) {
        try {
          await this.prisma.agoraCurriculumSource.update({
            where: { id: sourceId },
            data: {
              status: AgoraCurriculumSourceStatus.FAILED,
              parseErrors: message,
            },
          });
        } catch (dbError) {
          this.logger.error(`Failed to update failure status in DB for ${sourceId}:`, dbError);
        }
      } else {
        this.logger.warn(
          `Parse attempt ${job.attemptsMade + 1}/${maxAttempts} failed for ${sourceId}; will retry. ${message}`,
        );
        await this.prisma.agoraCurriculumSource.update({
          where: { id: sourceId },
          data: { parseErrors: `Attempt ${job.attemptsMade + 1} failed; retrying. ${message}` },
        }).catch(() => undefined);
      }

      throw error; // Essential for BullMQ state tracking
    }
  }

}

@Processor(CURRICULUM_CONSOLIDATION_QUEUE, {
  concurrency: 1,
  lockDuration: 15 * 60 * 1000,
})
export class ConsolidationProcessor extends WorkerHost {
  private readonly logger = new Logger(ConsolidationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly metricsService: MetricsService,
  ) {
    super();
  }

  async process(job: Job<ConsolidateBatchPayload, void, string>): Promise<void> {
    const startTime = Date.now();
    const { batchId, curriculumId, subjectId, gradeLevel, uploadedBy } = job.data;

    this.logger.log(`Consolidating ${curriculumId || `subject ${subjectId} / ${gradeLevel}`}`);

    try {
      let curriculum = curriculumId
        ? await this.prisma.agoraCurriculum.findUnique({ where: { id: curriculumId } })
        : await this.prisma.agoraCurriculum.findFirst({
            where: { subjectId, gradeLevel },
            orderBy: { version: 'desc' },
          });

      if (!curriculum) {
        curriculum = await this.prisma.agoraCurriculum.create({
          data: {
            subjectId,
            gradeLevel,
            createdBy: uploadedBy,
            status: 'DRAFT',
            version: 1,
            sourceIds: job.data.sourceIds ?? [],
          },
        });
      }

      let sourceIds = (job.data.sourceIds ?? []).filter(Boolean);
      if (sourceIds.length === 0 && batchId) {
        const sources = await this.prisma.agoraCurriculumSource.findMany({
          where: { batchId, gradeLevel, status: AgoraCurriculumSourceStatus.PARSED },
          select: { id: true },
        });
        sourceIds = sources.map((s) => s.id);
      }

      if (sourceIds.length > 0) {
        await this.prisma.agoraCurriculum.update({
          where: { id: curriculum.id },
          data: { sourceIds },
        });
      }

      await this.aiService.consolidateAgoraCurriculum(curriculum.id);

      const durationSec = (Date.now() - startTime) / 1000;
      this.metricsService.bullmqJobsCompletedTotal.inc({ queue: CURRICULUM_CONSOLIDATION_QUEUE, job_name: job.name });
      this.metricsService.bullmqJobDurationSeconds.observe({ queue: CURRICULUM_CONSOLIDATION_QUEUE, job_name: job.name }, durationSec);

      this.logger.log(`Consolidation complete. Master Curriculum: ${curriculum.id}`);

    } catch (error) {
      this.metricsService.bullmqJobsFailedTotal.inc({ queue: CURRICULUM_CONSOLIDATION_QUEUE, job_name: job.name });
      this.logger.error(`Failed to consolidate ${curriculumId || batchId}:`, error);
      throw error;
    }
  }
}
