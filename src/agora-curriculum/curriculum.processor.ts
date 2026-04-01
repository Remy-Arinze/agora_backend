import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgoraCurriculumSourceStatus } from '@prisma/client';

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
  concurrency: 2,
})
export class CurriculumProcessor extends WorkerHost {
  private readonly logger = new Logger(CurriculumProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    @InjectQueue(CURRICULUM_CONSOLIDATION_QUEUE) private readonly consolidationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ProcessSourcePayload, void, string>): Promise<void> {
    const { sourceId, batchId } = job.data;
    
    this.logger.log(`Processing curriculum source: ${sourceId} (Batch: ${batchId || 'N/A'})`);

    try {
      // 1. Update status to PARSING
      await (this.prisma as any).agoraCurriculumSource.update({
        where: { id: sourceId },
        data: { status: AgoraCurriculumSourceStatus.PARSING },
      });

      // 2. Call AI Service to parse
      // Note: We're reusing the existing AiService.parseCurriculumDocument method
      // which internally fetches the source and updates DB status to PARSED.
      await this.aiService.parseCurriculumDocument(sourceId);

      // 3. If in a batch, check for completion
      if (batchId) {
        await this.checkBatchCompletion(batchId);
      }
      
    } catch (error) {
      this.logger.error(`Failed to process curriculum source ${sourceId}:`, error);
      
      await (this.prisma as any).agoraCurriculumSource.update({
        where: { id: sourceId },
        data: { 
          status: AgoraCurriculumSourceStatus.FAILED,
          parseErrors: error instanceof Error ? error.message : 'Unknown parsing error'
        },
      });
      
      throw error;
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
      
      // Trigger consolidation job
      // We take the data from the first source for subject/grade info
      const representative = sources[0];
      
      await this.consolidationQueue.add(JOB_CONSOLIDATE_BATCH, {
        batchId,
        subjectId: representative.subjectId,
        gradeLevel: representative.gradeLevel,
        uploadedBy: representative.createdBy,
      });
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
  ) {
    super();
  }

  async process(job: Job<ConsolidateBatchPayload, void, string>): Promise<void> {
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

      // 2. Gather all source IDs in this batch
      const sources = await (this.prisma as any).agoraCurriculumSource.findMany({
        where: { batchId, status: AgoraCurriculumSourceStatus.PARSED },
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

      this.logger.log(`Consolidation complete for batch ${batchId}. Master Curriculum: ${curriculum.id}`);

    } catch (error) {
      this.logger.error(`Failed to consolidate batch ${batchId}:`, error);
      throw error;
    }
  }
}
