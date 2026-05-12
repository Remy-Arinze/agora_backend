import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionTier, Prisma } from '@prisma/client';

@Injectable()
export class SubscriptionAuditService {
  private readonly logger = new Logger(SubscriptionAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a subscription change
   */
  async logChange(options: {
    schoolId: string;
    action: string;
    actorUserId?: string;
    previousTier?: SubscriptionTier;
    newTier?: SubscriptionTier;
    previousEndDate?: Date;
    newEndDate?: Date;
    payload?: Record<string, any>;
  }) {
    const {
      schoolId,
      action,
      actorUserId,
      previousTier,
      newTier,
      previousEndDate,
      newEndDate,
      payload,
    } = options;

    try {
      await (this.prisma.subscriptionBillingAuditLog as any).create({
        data: {
          schoolId,
          action,
          actorUserId,
          previousTier,
          newTier,
          previousEndDate,
          newEndDate,
          payload: payload ? (payload as Prisma.InputJsonValue) : undefined,
        },
      });
      
      this.logger.log(`Subscription Audit: [${action}] for school ${schoolId}`);
    } catch (error) {
      this.logger.error(`Failed to create subscription audit log: ${error.message}`);
    }
  }

  /**
   * Record idempotency key to prevent duplicate processing
   */
  async recordIdempotency(eventKey: string, status: 'PROCESSED' | 'FAILED', metadata?: any) {
    return (this.prisma as any).paymentIdempotency.upsert({
      where: { eventKey },
      update: {
        status,
        processedAt: new Date(),
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
      create: {
        eventKey,
        status,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  /**
   * Check if an event has already been processed
   */
  async isProcessed(eventKey: string): Promise<boolean> {
    const record = await (this.prisma as any).paymentIdempotency.findUnique({
      where: { eventKey },
    });
    return record?.status === 'PROCESSED';
  }
}
