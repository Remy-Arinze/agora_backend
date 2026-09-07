/**
 * Dev-only subscription shortcuts so Pro expiry, grace, and student caps
 * can be exercised without waiting a month.
 *
 * Enable with DEV_FAST_SUBSCRIPTION=true. Always ignored when NODE_ENV=production.
 *
 *   DEV_FAST_SUBSCRIPTION=true
 *   DEV_SUBSCRIPTION_PERIOD=1w        # shorthand: 1w, 2w, 3d, 5 days
 *   DEV_SUBSCRIPTION_PERIOD_WEEKS=1   # or set weeks directly
 *   DEV_SUBSCRIPTION_PERIOD_DAYS=3    # or set days directly
 *   DEV_SUBSCRIPTION_GRACE_DAYS=3     # waiting window after expiry (any day count)
 *   DEV_PRO_MAX_STUDENTS=5            # Pro student cap (easy to fill)
 *   DEV_FREE_MAX_STUDENTS=2           # Free cap after downgrade (must be below Pro to test lock/pick)
 *
 * Paid-period precedence: PERIOD shorthand, then PERIOD_WEEKS, then PERIOD_DAYS (default 1 day).
 * Grace is always an independent day count and does not follow the paid period.
 */
import {
  SUBSCRIPTION_GRACE_DAYS as PRODUCTION_GRACE_DAYS,
  SUBSCRIPTION_GRACE_REMINDER_DAYS as PRODUCTION_GRACE_REMINDERS,
} from './subscription-billing.constants';

export const PRODUCTION_PRO_MAX_STUDENTS = 800;
export const PRODUCTION_FREE_MAX_STUDENTS = 100;
export const DEFAULT_DEV_PERIOD_DAYS = 1;
export const DEFAULT_DEV_GRACE_DAYS = 1;
export const DEFAULT_DEV_PRO_MAX_STUDENTS = 5;
export const DEFAULT_DEV_FREE_MAX_STUDENTS = 2;

function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function envPositiveInt(name: string, fallback: number): number {
  return envOptionalPositiveInt(name) ?? fallback;
}

function envOptionalPositiveInt(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

/** `1w`, `2 weeks`, `3d`, `5 days`, or a bare number (days). */
export function parsePeriodToDays(raw: string): number | undefined {
  const match = raw.trim().toLowerCase().match(/^(\d+)\s*(d|day|days|w|wk|week|weeks)?$/);
  if (!match) return undefined;
  const n = Number.parseInt(match[1], 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  const unit = match[2];
  if (unit === 'w' || unit === 'wk' || unit === 'week' || unit === 'weeks') {
    return n * 7;
  }
  return n;
}

/** Fast cycle is never honoured in production, even if the env flag is set. */
export function isFastSubscriptionMode(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return envFlag('DEV_FAST_SUBSCRIPTION');
}

export function getSubscriptionPeriodDays(): number {
  if (!isFastSubscriptionMode()) {
    return 0;
  }

  const shorthand = process.env.DEV_SUBSCRIPTION_PERIOD?.trim();
  if (shorthand) {
    const parsed = parsePeriodToDays(shorthand);
    if (parsed) return parsed;
  }

  const weeks = envOptionalPositiveInt('DEV_SUBSCRIPTION_PERIOD_WEEKS');
  if (weeks) return weeks * 7;

  return envPositiveInt('DEV_SUBSCRIPTION_PERIOD_DAYS', DEFAULT_DEV_PERIOD_DAYS);
}

export function getSubscriptionGraceDays(): number {
  if (!isFastSubscriptionMode()) return PRODUCTION_GRACE_DAYS;
  return envPositiveInt('DEV_SUBSCRIPTION_GRACE_DAYS', DEFAULT_DEV_GRACE_DAYS);
}

export function getSubscriptionGraceReminderDays(): number[] {
  const grace = getSubscriptionGraceDays();
  if (!isFastSubscriptionMode()) {
    return [...PRODUCTION_GRACE_REMINDERS];
  }
  const days = [1];
  if (grace > 1) days.push(grace);
  return days.filter((d, i, arr) => d <= grace && arr.indexOf(d) === i);
}

export function getDevProMaxStudents(): number {
  if (!isFastSubscriptionMode()) return PRODUCTION_PRO_MAX_STUDENTS;
  return envPositiveInt('DEV_PRO_MAX_STUDENTS', DEFAULT_DEV_PRO_MAX_STUDENTS);
}

export function getDevFreeMaxStudents(): number {
  if (!isFastSubscriptionMode()) return PRODUCTION_FREE_MAX_STUDENTS;
  return envPositiveInt('DEV_FREE_MAX_STUDENTS', DEFAULT_DEV_FREE_MAX_STUDENTS);
}

function getDevStudentCapForTier(tier: string | undefined): number | undefined {
  if (!isFastSubscriptionMode()) return undefined;
  if (tier === 'PRO') return getDevProMaxStudents();
  if (tier === 'FREE') return getDevFreeMaxStudents();
  return undefined;
}

/** Overlay the short Pro / Free student caps when fast mode is on. Other tiers are unchanged. */
export function applyDevStudentCap(tier: string | undefined, maxStudents: number): number {
  return getDevStudentCapForTier(tier) ?? maxStudents;
}

/**
 * After a successful payment, extend `base` by a calendar month/year,
 * or by the configured fast-mode period (days or weeks) for monthly and yearly.
 */
export function addPaidPeriod(base: Date, isYearly: boolean): Date {
  const end = new Date(base);
  if (isFastSubscriptionMode()) {
    end.setUTCDate(end.getUTCDate() + getSubscriptionPeriodDays());
    return end;
  }
  if (isYearly) {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export function applyDevPlanOverrides<T extends { tierCode: string; maxStudents: number; features?: unknown }>(
  plan: T,
): T {
  const maxStudents = getDevStudentCapForTier(plan.tierCode);
  if (maxStudents === undefined) return plan;
  const features = Array.isArray(plan.features)
    ? plan.features.map((feature: { text?: string }) => {
        if (typeof feature?.text === 'string' && /^\d[\d,]*\s+students$/i.test(feature.text.trim())) {
          return { ...feature, text: `${maxStudents} Students` };
        }
        return feature;
      })
    : plan.features;
  return { ...plan, maxStudents, features };
}

export function describeFastSubscriptionMode(): string {
  const periodDays = getSubscriptionPeriodDays();
  const weeks = periodDays % 7 === 0 ? ` (${periodDays / 7}w)` : '';
  return (
    `DEV_FAST_SUBSCRIPTION is ON: paid period=${periodDays}d${weeks}, ` +
    `grace=${getSubscriptionGraceDays()}d, Pro max students=${getDevProMaxStudents()}, ` +
    `Free max students=${getDevFreeMaxStudents()}. ` +
    'Ignored when NODE_ENV=production.'
  );
}
