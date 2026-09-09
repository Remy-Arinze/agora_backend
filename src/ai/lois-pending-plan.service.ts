import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LOIS_CURATOR_PLAN_TTL_MS } from '../timetable/timetable-curator.constants';

export type PendingPlanKind = 'TIMETABLE' | 'SCHEME';

@Injectable()
export class LoisPendingPlanService {
  constructor(private readonly prisma: PrismaService) {}

  private get model() {
    return (this.prisma as any).loisPendingPlan;
  }

  async create(params: {
    userId: string;
    schoolId: string;
    conversationId?: string | null;
    kind: PendingPlanKind;
    payload: unknown;
    summary: string;
  }) {
    const expiresAt = new Date(Date.now() + LOIS_CURATOR_PLAN_TTL_MS);
    return this.model.create({
      data: {
        userId: params.userId,
        schoolId: params.schoolId,
        conversationId: params.conversationId || null,
        kind: params.kind,
        payload: params.payload as object,
        summary: params.summary,
        expiresAt,
        status: 'PROPOSED',
      },
    });
  }

  async peek(planId: string, userId: string, schoolId: string) {
    const plan = await this.model.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('That plan is no longer available. Ask Lois to propose again.');
    if (plan.userId !== userId || plan.schoolId !== schoolId) {
      throw new ForbiddenException('This plan belongs to another session.');
    }
    return plan;
  }

  async getActive(planId: string, userId: string, schoolId: string, conversationId?: string | null) {
    const plan = await this.peek(planId, userId, schoolId);
    if (conversationId && plan.conversationId && plan.conversationId !== conversationId) {
      throw new ForbiddenException('This plan belongs to another conversation.');
    }
    if (plan.status === 'APPLIED') {
      throw new BadRequestException('This plan was already applied.');
    }
    if (plan.status === 'CANCELLED') {
      throw new BadRequestException('This plan was cancelled.');
    }
    if (plan.status !== 'PROPOSED' || new Date(plan.expiresAt).getTime() < Date.now()) {
      await this.model.update({ where: { id: planId }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('This plan expired. Ask Lois to propose again.');
    }
    return plan;
  }

  async markApplied(planId: string) {
    return this.model.update({ where: { id: planId }, data: { status: 'APPLIED' } });
  }

  async cancel(planId: string, userId: string, schoolId: string) {
    const plan = await this.getActive(planId, userId, schoolId).catch(() => null);
    if (!plan) return { cancelled: false };
    await this.model.update({ where: { id: planId }, data: { status: 'CANCELLED' } });
    return { cancelled: true };
  }
}
