import { Injectable, Logger, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { Prisma, SchoolBillingPhase, SubscriptionTier } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionAuditService } from './subscription-audit.service';
import { SubscriptionTier as SubTierDto } from './dto/subscription.dto';
import { SUBSCRIPTION_GRACE_DAYS, SUBSCRIPTION_GRACE_REMINDER_DAYS } from './subscription-billing.constants';
import { operationalEnrollmentWhere } from './enrollment-operational';
import { NotificationService } from '../notification/notification.service';

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function calendarDaysAfter(from: Date, to: Date): number {
  const a = startOfUtcDay(from).getTime();
  const b = startOfUtcDay(to).getTime();
  return Math.floor((b - a) / 86400000);
}

const PAID_TIERS: SubscriptionTier[] = [SubscriptionTier.PRO, SubscriptionTier.PRO_PLUS, SubscriptionTier.CUSTOM];

@Injectable()
export class SubscriptionBillingService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationService,
    private readonly audit: SubscriptionAuditService,
  ) {}

  /** On startup, reconcile any stale billing phases (e.g. if the cron job failed or the server
   *  was down during a phase transition). This ensures the DB is the source of truth and the
   *  system self-heals after a restart.
   */
  async onModuleInit() {
    try {
      this.logger.log('Running startup billing phase reconciliation...');
      await this.runDailyBillingLifecycle();
      this.logger.log('Startup billing phase reconciliation complete');
    } catch (error) {
      this.logger.error(`Startup billing phase reconciliation failed: ${error}`);
      // Don't throw — allow the app to start even if reconciliation fails
    }
  }

  private caps(tier: SubscriptionTier) {
    return this.subscriptions.getTierLimitCaps(tier as SubTierDto);
  }

  async appendAuditLog(schoolId: string, action: string, actorUserId?: string | null, payload?: Record<string, unknown>) {
    await this.audit.logChange({
      schoolId,
      action,
      actorUserId: actorUserId ?? undefined,
      payload,
    });
  }

  /** After successful Paystack payment — atomically update subscription fields, clear grace,
   *  unlock billing-locked enrollments, and unsuspend staff in a single transaction.
   *
   *  @param schoolId  The school whose subscription was just paid.
   *  @param subscriptionUpdate  Optional subscription field overrides (tier, endDate, limits, credits).
   *                             When provided the subscription row is updated inside the same transaction
   *                             so there is never a window where endDate is updated but billingPhase is stale.
   */
  async onSuccessfulPaidRenewal(
    schoolId: string,
    subscriptionUpdate?: {
      tier?: SubscriptionTier;
      endDate?: Date;
      isActive?: boolean;
      maxStudents?: number;
      maxTeachers?: number;
      maxAdmins?: number;
      aiCredits?: number;
      aiCreditsUsed?: number;
      lastCreditReset?: Date;
      paystackSubscriptionCode?: string;
      paystackEmailToken?: string;
      paystackCustomerId?: string;
      isRecurring?: boolean;
    },
    actorUserId?: string,
  ): Promise<void> {
    const currentSub = await this.prisma.subscription.findUnique({
      where: { schoolId },
    });

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { schoolId },
        data: {
          // Apply any subscription field updates first, then always reset billing phase
          ...(subscriptionUpdate ?? {}),
          billingPhase: SchoolBillingPhase.OK,
          gracePeriodEndsAt: null,
          billingGraceReminderLastAt: null,
        },
      }),
      this.prisma.enrollment.updateMany({
        where: { schoolId, billingLocked: true },
        data: { billingLocked: false, isActive: true },
      }),
      this.prisma.teacher.updateMany({
        where: { schoolId, billingSuspended: true },
        data: { billingSuspended: false },
      }),
      this.prisma.schoolAdmin.updateMany({
        where: { schoolId, billingSuspended: true },
        data: { billingSuspended: false },
      }),
    ]);

    await this.audit.logChange({
      schoolId,
      action: 'RENEWAL_SUCCESS',
      actorUserId,
      previousTier: currentSub?.tier,
      newTier: subscriptionUpdate?.tier ?? currentSub?.tier,
      previousEndDate: currentSub?.endDate ?? undefined,
      newEndDate: subscriptionUpdate?.endDate ?? currentSub?.endDate ?? undefined,
      payload: { ...subscriptionUpdate },
    });
    
    this.logger.log(`Billing: renewal cleared billing locks for school ${schoolId}`);
  }

  async runDailyBillingLifecycle(): Promise<void> {
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({
      where: {
        tier: { in: PAID_TIERS },
        endDate: { not: null },
      },
      include: { school: { select: { id: true, name: true } } },
    });

    for (const sub of subs) {
      const end = sub.endDate!;
      if (now.getTime() <= end.getTime()) {
        if (sub.billingPhase !== SchoolBillingPhase.OK) {
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              billingPhase: SchoolBillingPhase.OK,
              gracePeriodEndsAt: null,
            },
          });
        }
        continue;
      }

      const graceEnd = addUtcDays(end, SUBSCRIPTION_GRACE_DAYS);

      if (now.getTime() <= graceEnd.getTime()) {
        const graceDay = calendarDaysAfter(end, now) + 1;
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            billingPhase: SchoolBillingPhase.GRACE_PERIOD,
            gracePeriodEndsAt: graceEnd,
          },
        });

        const shouldRemind =
          (SUBSCRIPTION_GRACE_REMINDER_DAYS as readonly number[]).includes(graceDay) &&
          (!sub.billingGraceReminderLastAt ||
            startOfUtcDay(sub.billingGraceReminderLastAt).getTime() < startOfUtcDay(now).getTime());

        if (shouldRemind) {
          this.notifications.emitSubscriptionBillingReminder({
            schoolId: sub.schoolId,
            schoolName: sub.school?.name ?? 'Your school',
            kind: 'GRACE_PERIOD',
            graceEndsAt: graceEnd.toISOString(),
            graceDay,
            timestamp: now.toISOString(),
          });
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: { billingGraceReminderLastAt: now },
          });
        }
      } else if (sub.billingPhase !== SchoolBillingPhase.ADMIN_ACTION_REQUIRED) {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { billingPhase: SchoolBillingPhase.ADMIN_ACTION_REQUIRED },
        });
        this.notifications.emitSubscriptionBillingReminder({
          schoolId: sub.schoolId,
          schoolName: sub.school?.name ?? 'Your school',
          kind: 'ADMIN_ACTION_REQUIRED',
          graceEndsAt: graceEnd.toISOString(),
          graceDay: SUBSCRIPTION_GRACE_DAYS + 1,
          timestamp: now.toISOString(),
        });
        await this.appendAuditLog(sub.schoolId, 'billing_phase_admin_action_required', null, {
          previousPhase: sub.billingPhase,
        });
        this.logger.warn(`Billing: school ${sub.schoolId} requires admin renewal or downgrade`);
      }
    }
  }

  async getAdminBillingState(schoolId: string) {
    const sub = await this.subscriptions.getOrCreateSubscription(schoolId);
    const row = await this.prisma.subscription.findUnique({
      where: { schoolId },
      select: {
        billingPhase: true,
        gracePeriodEndsAt: true,
        endDate: true,
        tier: true,
      },
    });

    const opStudentCount = await this.prisma.student.count({
      where: {
        enrollments: { some: { schoolId, ...operationalEnrollmentWhere } },
      },
    });
    const freeCap = this.caps(SubscriptionTier.FREE).maxStudents;

    return {
      phase: row?.billingPhase ?? SchoolBillingPhase.OK,
      tier: sub.tier,
      paidEndDate: row?.endDate ?? null,
      graceEndsAt: row?.gracePeriodEndsAt ?? null,
      operationalStudentCount: opStudentCount,
      freeTierStudentCap: freeCap,
      graceDaysTotal: SUBSCRIPTION_GRACE_DAYS,
    };
  }

  async getUiBillingFlags(
    schoolId: string,
    role: string,
    profileId: string | null | undefined,
    adminIsPrincipal: boolean,
  ) {
    const row = await this.prisma.subscription.findUnique({
      where: { schoolId },
      select: { billingPhase: true, endDate: true, tier: true },
    });

    // Self-heal: if the DB phase says blocked/grace but endDate is in the future (e.g. payment
    // succeeded but the cron hasn't run yet, or the phase was never reset after renewal), treat
    // the subscription as OK so the blocking modal doesn't persist after a successful payment.
    let phase = row?.billingPhase ?? SchoolBillingPhase.OK;
    if (
      phase !== SchoolBillingPhase.OK &&
      row?.endDate &&
      row.endDate.getTime() > Date.now()
    ) {
      // Phase is stale — the paid period is still active. Correct it in the background so the
      // cron doesn't have to run before the UI recovers.
      phase = SchoolBillingPhase.OK;
      this.prisma.subscription
        .update({
          where: { schoolId },
          data: {
            billingPhase: SchoolBillingPhase.OK,
            gracePeriodEndsAt: null,
            billingGraceReminderLastAt: null,
          },
        })
        .catch((err) =>
          this.logger.error(`Failed to self-heal stale billingPhase for school ${schoolId}: ${err}`),
        );
    }

    if (role === 'SCHOOL_ADMIN') {
      if (!adminIsPrincipal) {
        return {
          showGraceBanner: false,
          blockAdminDashboard: false,
          teacherBillingLimited: false,
        };
      }
      return {
        showGraceBanner: phase === SchoolBillingPhase.GRACE_PERIOD,
        blockAdminDashboard: phase === SchoolBillingPhase.ADMIN_ACTION_REQUIRED,
        teacherBillingLimited: false,
      };
    }

    if (role === 'TEACHER' && profileId) {
      const t = await this.prisma.teacher.findFirst({
        where: { id: profileId, schoolId },
        select: { billingSuspended: true },
      });
      return {
        showGraceBanner: false,
        blockAdminDashboard: false,
        teacherBillingLimited: !!t?.billingSuspended,
      };
    }

    return { showGraceBanner: false, blockAdminDashboard: false, teacherBillingLimited: false };
  }

  async getDowngradePreview(schoolId: string) {
    const subRow = await this.prisma.subscription.findUnique({
      where: { schoolId },
      select: { billingPhase: true, tier: true },
    });
    if (subRow?.billingPhase !== SchoolBillingPhase.ADMIN_ACTION_REQUIRED) {
      throw new BadRequestException('Downgrade is only available after your grace period ends.');
    }

    const free = this.caps(SubscriptionTier.FREE);
    const opEnrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, ...operationalEnrollmentWhere },
      orderBy: { enrollmentDate: 'desc' },
      select: {
        id: true,
        studentId: true,
        enrollmentDate: true,
        student: { select: { firstName: true, lastName: true, publicId: true } },
      },
    });

    const teacherCount = await this.prisma.teacher.count({
      where: { schoolId, billingSuspended: false },
    });
    const adminCount = await this.prisma.schoolAdmin.count({
      where: { schoolId, billingSuspended: false },
    });

    return {
      operationalStudentCount: opEnrollments.length,
      freeMaxStudents: free.maxStudents,
      freeMaxTeachers: free.maxTeachers,
      freeMaxAdmins: free.maxAdmins,
      studentsToLockIfNoSelection:
        opEnrollments.length > free.maxStudents ? opEnrollments.length - free.maxStudents : 0,
      teachersToSuspendIfNoAction: Math.max(0, teacherCount - free.maxTeachers),
      adminsToSuspendIfNoAction: Math.max(0, adminCount - free.maxAdmins),
      enrollments: opEnrollments.map((e) => ({
        enrollmentId: e.id,
        studentId: e.studentId,
        name: `${e.student.firstName} ${e.student.lastName}`.trim(),
        publicId: e.student.publicId,
        enrollmentDate: e.enrollmentDate,
      })),
      requiresStudentPick: opEnrollments.length > free.maxStudents,
      pickExactly: free.maxStudents,
    };
  }

  async executeDowngradeToFree(schoolId: string, keepEnrollmentIds: string[], actorUserId: string) {
    const subRow = await this.prisma.subscription.findUnique({
      where: { schoolId },
      select: { id: true, billingPhase: true },
    });
    if (subRow?.billingPhase !== SchoolBillingPhase.ADMIN_ACTION_REQUIRED) {
      throw new BadRequestException('Downgrade is only available when billing requires admin action.');
    }

    const free = this.caps(SubscriptionTier.FREE);
    const op = await this.prisma.enrollment.findMany({
      where: { schoolId, ...operationalEnrollmentWhere },
      select: { id: true },
    });
    const opIds = new Set(op.map((e) => e.id));

    if (op.length > free.maxStudents) {
      if (keepEnrollmentIds.length !== free.maxStudents) {
        throw new BadRequestException(
          `Select exactly ${free.maxStudents} student enrollments to remain active. You provided ${keepEnrollmentIds.length}.`,
        );
      }
      for (const id of keepEnrollmentIds) {
        if (!opIds.has(id)) {
          throw new BadRequestException('Invalid enrollment selection.');
        }
      }
    } else if (keepEnrollmentIds.length > 0) {
      throw new BadRequestException('Student selection is not required for your current headcount.');
    }

    const freePlan = await this.prisma.subscriptionPlan.findFirst({
      where: { tierCode: SubscriptionTier.FREE, isPublic: true },
    });

    const toLock = op.length > free.maxStudents ? [...opIds].filter((id) => !keepEnrollmentIds.includes(id)) : [];

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (toLock.length > 0) {
        await tx.enrollment.updateMany({
          where: { id: { in: toLock } },
          data: { billingLocked: true, isActive: false },
        });
      }

      await tx.subscription.update({
        where: { schoolId },
        data: {
          tier: SubscriptionTier.FREE,
          planId: freePlan?.id,
          endDate: null,
          billingPhase: SchoolBillingPhase.OK,
          gracePeriodEndsAt: null,
          billingGraceReminderLastAt: null,
          maxStudents: free.maxStudents,
          maxTeachers: free.maxTeachers,
          maxAdmins: free.maxAdmins,
          aiCredits: free.aiCredits,
          aiCreditsUsed: 0,
          lastCreditReset: new Date(),
        },
      });

      await this.suspendExcessTeachersAdminsTx(tx, schoolId, free.maxTeachers, free.maxAdmins);
    });

    const sub = await this.prisma.subscription.findUnique({ where: { schoolId } });
    if (sub) {
      await this.subscriptions.syncToolAccessForTier(schoolId, sub.id, SubTierDto.FREE);
    }

    await this.appendAuditLog(schoolId, 'downgrade_to_free', actorUserId, {
      keepEnrollmentIds,
      lockedCount: toLock.length,
    });
  }

  private async suspendExcessTeachersAdminsTx(
    tx: Prisma.TransactionClient,
    schoolId: string,
    maxTeachers: number,
    maxAdmins: number,
  ) {
    const teachers = await tx.teacher.findMany({
      where: { schoolId, billingSuspended: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (teachers.length > maxTeachers) {
      const surplus = teachers.length - maxTeachers;
      const ids = teachers.slice(0, surplus).map((t) => t.id);
      await tx.teacher.updateMany({
        where: { id: { in: ids } },
        data: { billingSuspended: true },
      });
    }

    const admins = await tx.schoolAdmin.findMany({
      where: { schoolId, billingSuspended: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (admins.length > maxAdmins) {
      const surplus = admins.length - maxAdmins;
      const ids = admins.slice(0, surplus).map((a) => a.id);
      await tx.schoolAdmin.updateMany({
        where: { id: { in: ids } },
        data: { billingSuspended: true },
      });
    }
  }

  async assertTeacherMayWrite(schoolId: string, teacherId: string): Promise<void> {
    const t = await this.prisma.teacher.findFirst({
      where: { id: teacherId, schoolId },
      select: { billingSuspended: true },
    });
    if (t?.billingSuspended) {
      throw new ForbiddenException(
        'Your staff access is limited until your school completes a subscription update. Please contact your administrator.',
      );
    }
  }

  async assertSchoolAdminNotBillingSuspended(schoolId: string, schoolAdminId: string): Promise<void> {
    const a = await this.prisma.schoolAdmin.findFirst({
      where: { id: schoolAdminId, schoolId },
      select: { billingSuspended: true },
    });
    if (a?.billingSuspended) {
      throw new ForbiddenException(
        'Your staff access is limited until your school completes a subscription update. Please contact your administrator.',
      );
    }
  }

  async assertStudentEnrollmentOperational(studentId: string, schoolId: string): Promise<void> {
    const ok = await this.prisma.enrollment.findFirst({
      where: { studentId, schoolId, ...operationalEnrollmentWhere },
    });
    if (!ok) {
      const locked = await this.prisma.enrollment.findFirst({
        where: { studentId, schoolId, billingLocked: true },
      });
      if (locked) {
        throw new ForbiddenException('Your account is temporarily unavailable. Please contact your school.');
      }
      throw new ForbiddenException('No active enrollment for this school.');
    }
  }

  /**
   * Handle a failed renewal payment
   */
  async handleFailedRenewal(schoolId: string, reason?: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { schoolId },
    });

    if (!sub) return;

    // If already in a worse phase, don't upgrade to grace period
    if (sub.billingPhase === SchoolBillingPhase.ADMIN_ACTION_REQUIRED) return;

    const graceEnd = addUtcDays(new Date(), SUBSCRIPTION_GRACE_DAYS);

    await this.prisma.subscription.update({
      where: { schoolId },
      data: {
        billingPhase: SchoolBillingPhase.GRACE_PERIOD,
        gracePeriodEndsAt: graceEnd,
      },
    });

    await this.audit.logChange({
      schoolId,
      action: 'PAYMENT_FAILED_GRACE_PERIOD',
      payload: { reason, graceEndsAt: graceEnd },
    });

    this.notifications.emitSubscriptionBillingReminder({
      schoolId,
      schoolName: 'Your school',
      kind: 'GRACE_PERIOD',
      graceEndsAt: graceEnd.toISOString(),
      graceDay: 1,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Lock a school due to total subscription failure
   */
  async lockSchoolDueToPayment(schoolId: string, reason?: string) {
    await this.prisma.subscription.update({
      where: { schoolId },
      data: {
        billingPhase: SchoolBillingPhase.ADMIN_ACTION_REQUIRED,
        isActive: false,
      },
    });

    await this.audit.logChange({
      schoolId,
      action: 'SUBSCRIPTION_LOCKED',
      payload: { reason },
    });

    this.notifications.emitSubscriptionBillingReminder({
      schoolId,
      schoolName: 'Your school',
      kind: 'ADMIN_ACTION_REQUIRED',
      graceEndsAt: new Date().toISOString(),
      graceDay: SUBSCRIPTION_GRACE_DAYS + 1,
      timestamp: new Date().toISOString(),
    });
  }
}
