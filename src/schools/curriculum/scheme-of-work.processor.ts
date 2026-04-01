import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CURRICULUM_PROCESSING_QUEUE } from '../../agora-curriculum/curriculum.processor';
import { AiService } from '../../ai/ai.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { PrismaService } from '../../database/prisma.service';

export interface GenerateSchemePayload {
  schemeId: string;
  schoolId: string;
  userId: string;
  creditsUsed: number;
}

@Processor(CURRICULUM_PROCESSING_QUEUE, {
  concurrency: 1, // AI generation is heavy, keep it serial for now
})
export class SchemeOfWorkProcessor extends WorkerHost {
  private readonly logger = new Logger(SchemeOfWorkProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<GenerateSchemePayload, void, string>): Promise<void> {
    if (job.name !== 'generate-scheme') return;

    const { schemeId, schoolId, userId, creditsUsed } = job.data;
    this.logger.log(`Processing scheme generation: ${schemeId} for school ${schoolId}`);

    try {
      // Logic is already implemented in AiService
      await this.aiService.generateSchemeOfWork(schemeId);
    } catch (error) {
      this.logger.error(`Failed to generate scheme ${schemeId}:`, error);
      
      // Check if we should refund (only on final attempt)
      // job.attemptsMade starts at 0. If attempts=3, final job.attemptsMade will be 2.
      // But we can also use OnWorkerEvent('failed') or check here.
      throw error; // Let BullMQ handle retries
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<GenerateSchemePayload>, error: Error) {
    const { schemeId, schoolId, userId, creditsUsed } = job.data;
    
    const isVerificationFailure = error.message.includes('VERIFICATION_FAILED');
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts || 1);

    // 1. Re-check current status to avoid double-refunding if manually cancelled
    const scheme = await (this.prisma as any).schemeOfWork.findUnique({
      where: { id: schemeId },
      select: { status: true },
    });

    if (!scheme || scheme.status === 'CANCELLED') {
      this.logger.log(`Scheme ${schemeId} was already cancelled or removed. Skipping processor refund.`);
      return;
    }

    // 2. If verification failed OR all attempts failed, refund credits
    if (isVerificationFailure || isFinalAttempt) {
      const reason = isVerificationFailure ? 'VERIFICATION_FAILED' : 'MAX_RETRIES_EXCEEDED';
      
      // Calculate refund: Keep 5 credits for verification tokens if verification failure
      // Otherwise, if it's a platform failure, refund 100% (or as preferred)
      let refundAmount = creditsUsed;
      if (isVerificationFailure) {
        refundAmount = Math.max(0, creditsUsed - 5); // Verification fee
      }

      this.logger.warn(`Scheme generation ${schemeId} failed (${reason}). Refunding ${refundAmount} credits.`);
      
      try {
        if (refundAmount > 0) {
          await this.subscriptionsService.refundAiCredits(
            schoolId,
            refundAmount,
            userId,
            `${reason}: ${schemeId}`
          );
        }

        // 3. Update status to FAILED in DB
        await (this.prisma as any).schemeOfWork.update({
          where: { id: schemeId },
          data: { status: 'FAILED' },
        });

        // 4. Discard job if verification failed (No retries needed for bad documents)
        if (isVerificationFailure) {
          await job.discard();
        }
      } catch (refundError) {
        this.logger.error(`CRITICAL: Failed to handle failure for scheme ${schemeId}:`, refundError);
      }
    }
  }
}
