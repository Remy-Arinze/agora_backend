import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BudSubscriptionStatus, StudySessionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';

const RENAME_RE =
  /(?:call you|name you|rename you(?: to)?|your name is|i(?:'| a)?ll call you)\s+["']?([A-Za-z][A-Za-z0-9 _-]{1,30})/i;

@Injectable()
export class BudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async getOrCreateProfile(userId: string) {
    const student = await this.requireStudent(userId);
    let profile = await this.prisma.budProfile.findUnique({ where: { studentId: student.id } });
    if (!profile) {
      profile = await this.prisma.budProfile.create({ data: { studentId: student.id } });
    }
    let subscription = await this.prisma.budSubscription.findUnique({
      where: { studentId: student.id },
      include: { plan: true },
    });
    if (!subscription) {
      subscription = await this.startTrial(userId, student.id);
    }
    const dueCards = await this.countDueCards(student.id);
    const todayPlan = await this.getOrBuildTodayPlan(student.id);
    return { profile, subscription, dueCards, todayPlan };
  }

  async chat(userId: string, message: string) {
    const student = await this.requireStudent(userId);
    const rename = await this.maybeRenameFromChat(userId, message);
    const { profile } = await this.getOrCreateProfile(userId);
    if (rename && !rename.confirmed) {
      return {
        type: 'rename-confirm',
        companionName: rename.companionName,
        reply: `You can call me ${rename.companionName}. Confirm and I’ll use that name from now on.`,
      };
    }
    if (rename?.confirmed) {
      return {
        type: 'rename-done',
        companionName: rename.companionName,
        reply: `Got it — I’m ${rename.companionName} now. What should we review?`,
      };
    }
    await this.assertCanStudy(student.id, { requirePaidChat: true });
    await this.deductBudCredits(student.id, 1);
    const plan = await this.getOrBuildTodayPlan(student.id);
    const reply = await this.ai.generateBudReply({
      companionName: profile.companionName || 'Bud',
      message,
      topics: plan.stableKeys,
      studentName: student.firstName,
    });
    await this.recordSession(userId, StudySessionType.CHAT, plan.stableKeys, 30);
    return { type: 'chat', companionName: profile.companionName, reply };
  }

  async maybeRenameFromChat(userId: string, message: string) {
    const match = message.match(RENAME_RE);
    if (!match) return null;
    const name = match[1].trim();
    const { profile } = await this.getOrCreateProfile(userId);
    if (profile.pendingRename === name) {
      const updated = await this.prisma.budProfile.update({
        where: { id: profile.id },
        data: { companionName: name, pendingRename: null },
      });
      return { confirmed: true, companionName: updated.companionName };
    }
    await this.prisma.budProfile.update({
      where: { id: profile.id },
      data: { pendingRename: name },
    });
    return { confirmed: false, companionName: name };
  }

  async confirmRename(userId: string) {
    const { profile } = await this.getOrCreateProfile(userId);
    if (!profile.pendingRename) throw new BadRequestException('No pending rename');
    return this.prisma.budProfile.update({
      where: { id: profile.id },
      data: { companionName: profile.pendingRename, pendingRename: null },
    });
  }

  async getTodayReview(userId: string) {
    const student = await this.requireStudent(userId);
    await this.assertCanStudy(student.id, { allowFreeCards: true });
    const plan = await this.getOrBuildTodayPlan(student.id);
    const decks = await this.prisma.studyDeck.findMany({
      where: { studentId: student.id, stableKey: { in: plan.stableKeys } },
      include: { cards: { include: { reviews: true } } },
    });
    return { plan, decks };
  }

  async rateCard(userId: string, cardId: string, rating: number) {
    const student = await this.requireStudent(userId);
    await this.assertCanStudy(student.id, { allowFreeCards: true });
    const card = await this.prisma.studyCard.findFirst({
      where: { id: cardId, deck: { studentId: student.id } },
      include: { reviews: true },
    });
    if (!card) throw new NotFoundException('Card not found');
    const prev = card.reviews[0];
    const next = this.fsrs(prev, rating);
    const review = await this.prisma.cardReview.upsert({
      where: { cardId },
      create: { cardId, ...next, lastRating: rating, lastReviewedAt: new Date() },
      update: { ...next, lastRating: rating, lastReviewedAt: new Date() },
    });
    await this.touchStreak(student.id);
    await this.prisma.studySession.create({
      data: {
        studentId: student.id,
        type: StudySessionType.FLASHCARDS,
        durationSec: 20,
        stableKeys: card.stableKey ? [card.stableKey] : [],
      },
    });
    return review;
  }

  async generateDeckForWeek(userId: string, weekId: string) {
    const student = await this.requireStudent(userId);
    await this.assertCanStudy(student.id, { requirePaidChat: false });
    const paid = await this.prisma.budSubscription.findUnique({ where: { studentId: student.id } });
    if (
      paid &&
      (paid.status === BudSubscriptionStatus.ACTIVE || paid.status === BudSubscriptionStatus.TRIAL)
    ) {
      await this.deductBudCredits(student.id, 1);
    }
    const week = await this.prisma.schemeOfWorkWeek.findUnique({
      where: { id: weekId },
      include: { topics: true, schemeOfWork: true },
    });
    if (!week) throw new NotFoundException('Week not found');
    const outcomes = week.studentFriendlyOutcomes?.length
      ? week.studentFriendlyOutcomes
      : week.learningOutcomes;
    const topic = `${week.topic}. Outcomes: ${outcomes.join('; ')}`;
    const { data } = await this.ai.generateFlashcards({
      topic,
      subject: 'Scheme of work',
      gradeLevel: 'student',
      count: 12,
    });
    const raw: any = data;
    const cards = Array.isArray(raw) ? raw : raw?.cards || raw?.flashcards || [];
    const deck = await this.prisma.studyDeck.create({
      data: {
        studentId: student.id,
        subjectId: week.schemeOfWork.subjectId,
        schemeWeekId: week.id,
        stableKey: week.topics[0]?.stableKey,
        title: week.topic,
        cards: {
          create: cards.slice(0, 15).map((c: any) => ({
            front: c.front || c.question || c.term || String(c),
            back: c.back || c.answer || c.definition || '',
            stableKey: week.topics[0]?.stableKey,
          })),
        },
      },
      include: { cards: true },
    });
    for (const card of deck.cards) {
      await this.prisma.cardReview.create({
        data: { cardId: card.id, dueAt: new Date() },
      });
    }
    return deck;
  }

  async recordSession(userId: string, type: StudySessionType, stableKeys: string[], durationSec = 60) {
    const student = await this.requireStudent(userId);
    await this.touchStreak(student.id);
    return this.prisma.studySession.create({
      data: { studentId: student.id, type, stableKeys, durationSec },
    });
  }

  async deductBudCredits(studentId: string, credits: number) {
    const sub = await this.prisma.budSubscription.findUnique({ where: { studentId } });
    if (!sub || (sub.status !== BudSubscriptionStatus.ACTIVE && sub.status !== BudSubscriptionStatus.TRIAL)) {
      throw new ForbiddenException('Bud subscription required');
    }
    if (sub.aiCredits >= 0 && sub.aiCreditsUsed + credits > sub.aiCredits) {
      throw new ForbiddenException('Bud credits exhausted');
    }
    return this.prisma.budSubscription.update({
      where: { id: sub.id },
      data: { aiCreditsUsed: { increment: credits } },
    });
  }

  private fsrs(prev: { stability: number; difficulty: number; reps: number; lapses: number } | undefined, rating: number) {
    const reps = (prev?.reps || 0) + 1;
    const lapses = rating === 1 ? (prev?.lapses || 0) + 1 : prev?.lapses || 0;
    const difficulty = Math.min(10, Math.max(1, (prev?.difficulty || 5) + (rating <= 2 ? 0.8 : -0.3)));
    const stability = Math.max(0.3, (prev?.stability || 0.5) * (rating >= 3 ? 1.8 : 0.6));
    const days = rating === 1 ? 0.01 : rating === 2 ? 1 : rating === 3 ? Math.max(1, stability) : Math.max(2, stability * 2);
    const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return { stability, difficulty, reps, lapses, dueAt };
  }

  private async countDueCards(studentId: string) {
    return this.prisma.cardReview.count({
      where: { card: { deck: { studentId } }, dueAt: { lte: new Date() } },
    });
  }

  private async getOrBuildTodayPlan(studentId: string) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const existing = await this.prisma.dailyReviewPlan.findUnique({
      where: { studentId_date: { studentId, date: day } },
    });
    if (existing) return existing;

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { enrollments: { where: { isActive: true }, take: 1 } },
    });
    const armId = student?.enrollments[0]?.classArmId;
    const schoolId = student?.enrollments[0]?.schoolId;
    const keys: string[] = [];
    if (armId && schoolId) {
      const deliveries = await this.prisma.schemeOfWorkWeekDelivery.findMany({
        where: { classArmId: armId, status: { in: ['DELIVERED', 'IN_PROGRESS'] } },
        include: { week: { include: { topics: true, schemeOfWork: true } } },
        take: 12,
        orderBy: { updatedAt: 'desc' },
      });
      for (const d of deliveries) {
        if (d.week.schemeOfWork.schoolId === schoolId) {
          keys.push(...d.week.topics.map((t) => t.stableKey));
        }
      }
    }
    return this.prisma.dailyReviewPlan.create({
      data: { studentId, date: day, stableKeys: [...new Set(keys)] },
    });
  }

  private async touchStreak(studentId: string) {
    const profile = await this.prisma.budProfile.findUnique({ where: { studentId } });
    if (!profile) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = profile.lastStudyDate ? new Date(profile.lastStudyDate) : null;
    last?.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const streak =
      last && last.getTime() === today.getTime()
        ? profile.streakCount
        : last && last.getTime() === yesterday.getTime()
          ? profile.streakCount + 1
          : 1;
    await this.prisma.budProfile.update({
      where: { id: profile.id },
      data: { streakCount: streak, lastStudyDate: new Date() },
    });
  }

  private async startTrial(userId: string, studentId: string) {
    const trial = await this.prisma.budPlan.findUnique({ where: { slug: 'bud-trial' } });
    if (!trial) return null;
    const end = new Date();
    end.setDate(end.getDate() + 7);
    return this.prisma.budSubscription.create({
      data: {
        userId,
        studentId,
        planId: trial.id,
        status: BudSubscriptionStatus.TRIAL,
        endDate: end,
        aiCredits: trial.aiCredits,
      },
      include: { plan: true },
    });
  }

  private async assertCanStudy(studentId: string, opts: { allowFreeCards?: boolean; requirePaidChat?: boolean }) {
    const sub = await this.prisma.budSubscription.findUnique({
      where: { studentId },
      include: { plan: true },
    });
    const active =
      sub &&
      (sub.status === BudSubscriptionStatus.ACTIVE || sub.status === BudSubscriptionStatus.TRIAL) &&
      (!sub.endDate || sub.endDate > new Date());
    if (opts.requirePaidChat) {
      if (active && sub.plan?.chatEnabled) return;
      throw new ForbiddenException('Subscribe to Bud to chat. Trial is cards-only.');
    }
    if (active) return;
    if (opts.allowFreeCards) {
      const todayCount = await this.prisma.studySession.count({
        where: {
          studentId,
          type: StudySessionType.FLASHCARDS,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      });
      if (todayCount >= 5) throw new ForbiddenException('Free daily review limit reached. Subscribe to continue.');
      return;
    }
    throw new ForbiddenException('Subscribe to Bud to continue');
  }

  private async requireStudent(userId: string) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new ForbiddenException('Student profile required');
    return student;
  }
}
