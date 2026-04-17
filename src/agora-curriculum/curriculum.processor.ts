import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgoraCurriculumSourceStatus } from '@prisma/client';

import { MetricsService } from '../common/metrics/metrics.service';

export const CURRICULUM_PROCESSING_QUEUE = 'curriculum-processing';
export const CURRICULUM_CONSOLIDATION_QUEUE = 'curriculum-consolidation';

export const JOB_PROCESS_SOURCE = 'process-source';
export const JOB_CONSOLIDATE_BATCH = 'consolidate-batch';

export interface ProcessSourcePayload {
  sourceId: string;
  batchId?: string;
}

export interface ConsolidateBatchPayload {
  batchId: string;
  subjectId: string;
  gradeLevel: string;
  uploadedBy: string;
}

@Processor(CURRICULUM_PROCESSING_QUEUE, {
  concurrency: 1,
})
export class CurriculumProcessor extends WorkerHost {
  private readonly logger = new Logger(CurriculumProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly metricsService: MetricsService,
    @InjectQueue(CURRICULUM_CONSOLIDATION_QUEUE) private readonly consolidationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ProcessSourcePayload, void, string>): Promise<void> {
    const startTime = Date.now();
    const { sourceId, batchId } = job.data;

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

      // 4. Batch completion check
      if (finalCheck?.status === AgoraCurriculumSourceStatus.PARSED && batchId) {
        await this.checkBatchCompletion(batchId);
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

      try {
        await this.prisma.agoraCurriculumSource.update({
          where: { id: sourceId },
          data: {
            status: AgoraCurriculumSourceStatus.FAILED,
            parseErrors: error instanceof Error ? error.message : String(error)
          },
        });
      } catch (dbError) {
        this.logger.error(`Failed to update failure status in DB for ${sourceId}:`, dbError);
      }

      throw error; // Essential for BullMQ state tracking
    }
  }

  private async checkBatchCompletion(batchId: string) {
    const sources = await (this.prisma as any).agoraCurriculumSource.findMany({
      where: { batchId },
    });

    const allSuccessful = sources.every((s: any) => s.status === AgoraCurriculumSourceStatus.PARSED);
    const anyFailed = sources.some((s: any) => s.status === AgoraCurriculumSourceStatus.FAILED);

    if (allSuccessful) {
      this.logger.log(`Batch ${batchId} complete. Triggering consolidation.`);

      // Group sources by grade level
      const groups = sources.reduce((acc: any, source: any) => {
        if (!acc[source.gradeLevel]) acc[source.gradeLevel] = [];
        acc[source.gradeLevel].push(source);
        return acc;
      }, {});

      for (const gradeLevel of Object.keys(groups)) {
        const gradeSources = groups[gradeLevel];
        await this.consolidationQueue.add(JOB_CONSOLIDATE_BATCH, {
          batchId,
          subjectId: gradeSources[0].subjectId,
          gradeLevel: gradeLevel,
          uploadedBy: gradeSources[0].createdBy,
        }, { priority: 1 });
      }
    } else if (anyFailed) {
      this.logger.warn(`Batch ${batchId} has failures. Consolidation will not trigger automatically.`);
    }
  }
}

@Processor(CURRICULUM_CONSOLIDATION_QUEUE, {
  concurrency: 1,
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
    const { batchId, subjectId, gradeLevel, uploadedBy } = job.data;

    this.logger.log(`Consolidating batch: ${batchId}`);

    try {
      // 1. Find or create the AgoraCurriculum record for this subject/grade
      // (This follows the pattern of having a master curriculum per subject/grade)
      let curriculum = await (this.prisma as any).agoraCurriculum.findFirst({
        where: { subjectId, gradeLevel },
      });

      if (!curriculum) {
        curriculum = await (this.prisma as any).agoraCurriculum.create({
          data: {
            subjectId,
            gradeLevel,
            createdBy: uploadedBy,
            status: 'DRAFT',
            version: 1,
            sourceIds: [], // Will be filled by consolidation logic
          },
        });
      }

      // 2. Gather all source IDs in this batch and gradeLevel
      const sources = await (this.prisma as any).agoraCurriculumSource.findMany({
        where: { batchId, gradeLevel, status: AgoraCurriculumSourceStatus.PARSED },
        select: { id: true },
      });

      const sourceIds = sources.map((s: any) => s.id);

      // 3. Update the curriculum's sources
      await (this.prisma as any).agoraCurriculum.update({
        where: { id: curriculum!.id },
        data: { sourceIds },
      });

      // 4. Call AI Service to consolidate
      // Note: Reusing existing AiService.consolidateAgoraCurriculum logic
      await this.aiService.consolidateAgoraCurriculum(curriculum!.id);

      const durationSec = (Date.now() - startTime) / 1000;
      this.metricsService.bullmqJobsCompletedTotal.inc({ queue: CURRICULUM_CONSOLIDATION_QUEUE, job_name: job.name });
      this.metricsService.bullmqJobDurationSeconds.observe({ queue: CURRICULUM_CONSOLIDATION_QUEUE, job_name: job.name }, durationSec);

      this.logger.log(`Consolidation complete for batch ${batchId}. Master Curriculum: ${curriculum.id}`);

    } catch (error) {
      this.metricsService.bullmqJobsFailedTotal.inc({ queue: CURRICULUM_CONSOLIDATION_QUEUE, job_name: job.name });
      this.logger.error(`Failed to consolidate batch ${batchId}:`, error);
      throw error;
    }
  }
}
