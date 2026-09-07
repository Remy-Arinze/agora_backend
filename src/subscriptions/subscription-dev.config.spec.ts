import {
  addPaidPeriod,
  applyDevPlanOverrides,
  applyDevStudentCap,
  DEFAULT_DEV_FREE_MAX_STUDENTS,
  DEFAULT_DEV_PRO_MAX_STUDENTS,
  getDevFreeMaxStudents,
  getDevProMaxStudents,
  getSubscriptionGraceDays,
  getSubscriptionGraceReminderDays,
  getSubscriptionPeriodDays,
  isFastSubscriptionMode,
  parsePeriodToDays,
  PRODUCTION_FREE_MAX_STUDENTS,
  PRODUCTION_PRO_MAX_STUDENTS,
} from './subscription-dev.config';

const KEYS = [
  'NODE_ENV',
  'DEV_FAST_SUBSCRIPTION',
  'DEV_SUBSCRIPTION_PERIOD',
  'DEV_SUBSCRIPTION_PERIOD_DAYS',
  'DEV_SUBSCRIPTION_PERIOD_WEEKS',
  'DEV_SUBSCRIPTION_GRACE_DAYS',
  'DEV_PRO_MAX_STUDENTS',
  'DEV_FREE_MAX_STUDENTS',
] as const;

describe('subscription-dev.config', () => {
  const previous: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  });

  it('is off by default and keeps production Pro cap, month-long periods, and 14-day grace', () => {
    expect(isFastSubscriptionMode()).toBe(false);
    expect(getDevProMaxStudents()).toBe(PRODUCTION_PRO_MAX_STUDENTS);
    expect(getDevFreeMaxStudents()).toBe(PRODUCTION_FREE_MAX_STUDENTS);
    expect(applyDevStudentCap('PRO', 800)).toBe(800);
    expect(applyDevStudentCap('FREE', 100)).toBe(100);
    expect(getSubscriptionPeriodDays()).toBe(0);
    expect(getSubscriptionGraceDays()).toBe(14);
    expect(getSubscriptionGraceReminderDays()).toEqual([1, 3, 7, 10, 14]);

    const base = new Date('2026-09-07T10:00:00.000Z');
    const monthly = addPaidPeriod(base, false);
    expect(monthly.getUTCMonth()).toBe(9);
    expect(monthly.getUTCFullYear()).toBe(2026);

    const yearly = addPaidPeriod(base, true);
    expect(yearly.getUTCFullYear()).toBe(2027);
  });

  it('shortens Pro paid period, grace, and student cap when the flag is on', () => {
    process.env.DEV_FAST_SUBSCRIPTION = 'true';

    expect(isFastSubscriptionMode()).toBe(true);
    expect(getSubscriptionPeriodDays()).toBe(1);
    expect(getSubscriptionGraceDays()).toBe(1);
    expect(getSubscriptionGraceReminderDays()).toEqual([1]);
    expect(getDevProMaxStudents()).toBe(DEFAULT_DEV_PRO_MAX_STUDENTS);
    expect(getDevFreeMaxStudents()).toBe(DEFAULT_DEV_FREE_MAX_STUDENTS);
    expect(applyDevStudentCap('PRO', 800)).toBe(5);
    expect(applyDevStudentCap('FREE', 100)).toBe(2);
    expect(applyDevStudentCap('PRO_PLUS', 2000)).toBe(2000);

    const base = new Date('2026-09-07T10:00:00.000Z');
    expect(addPaidPeriod(base, false).toISOString()).toBe('2026-09-08T10:00:00.000Z');
    expect(addPaidPeriod(base, true).toISOString()).toBe('2026-09-08T10:00:00.000Z');
  });

  it('honours custom period, grace, and Pro/Free student cap env values', () => {
    process.env.DEV_FAST_SUBSCRIPTION = 'on';
    process.env.DEV_SUBSCRIPTION_PERIOD_DAYS = '2';
    process.env.DEV_SUBSCRIPTION_GRACE_DAYS = '3';
    process.env.DEV_PRO_MAX_STUDENTS = '8';
    process.env.DEV_FREE_MAX_STUDENTS = '3';

    expect(getSubscriptionPeriodDays()).toBe(2);
    expect(getSubscriptionGraceDays()).toBe(3);
    expect(getSubscriptionGraceReminderDays()).toEqual([1, 3]);
    expect(getDevProMaxStudents()).toBe(8);
    expect(getDevFreeMaxStudents()).toBe(3);
    expect(applyDevStudentCap('FREE', 100)).toBe(3);

    const base = new Date('2026-09-07T10:00:00.000Z');
    expect(addPaidPeriod(base, false).toISOString()).toBe('2026-09-09T10:00:00.000Z');
  });

  it('accepts a paid period in weeks, independently of grace days', () => {
    process.env.DEV_FAST_SUBSCRIPTION = 'true';
    process.env.DEV_SUBSCRIPTION_PERIOD_WEEKS = '2';
    process.env.DEV_SUBSCRIPTION_GRACE_DAYS = '4';

    expect(getSubscriptionPeriodDays()).toBe(14);
    expect(getSubscriptionGraceDays()).toBe(4);
    expect(getSubscriptionGraceReminderDays()).toEqual([1, 4]);

    const base = new Date('2026-09-07T10:00:00.000Z');
    expect(addPaidPeriod(base, false).toISOString()).toBe('2026-09-21T10:00:00.000Z');
  });

  it('parses DEV_SUBSCRIPTION_PERIOD shorthand and prefers it over weeks/days', () => {
    expect(parsePeriodToDays('1w')).toBe(7);
    expect(parsePeriodToDays('2 weeks')).toBe(14);
    expect(parsePeriodToDays('3d')).toBe(3);
    expect(parsePeriodToDays('5 days')).toBe(5);
    expect(parsePeriodToDays('1')).toBe(1);

    process.env.DEV_FAST_SUBSCRIPTION = 'true';
    process.env.DEV_SUBSCRIPTION_PERIOD = '1w';
    process.env.DEV_SUBSCRIPTION_PERIOD_WEEKS = '3';
    process.env.DEV_SUBSCRIPTION_PERIOD_DAYS = '2';
    process.env.DEV_SUBSCRIPTION_GRACE_DAYS = '2';

    expect(getSubscriptionPeriodDays()).toBe(7);
    expect(getSubscriptionGraceDays()).toBe(2);
  });

  it('never activates in production even if the flag is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_FAST_SUBSCRIPTION = 'true';
    process.env.DEV_PRO_MAX_STUDENTS = '5';
    process.env.DEV_FREE_MAX_STUDENTS = '2';
    process.env.DEV_SUBSCRIPTION_PERIOD_DAYS = '1';

    expect(isFastSubscriptionMode()).toBe(false);
    expect(getDevProMaxStudents()).toBe(PRODUCTION_PRO_MAX_STUDENTS);
    expect(getDevFreeMaxStudents()).toBe(PRODUCTION_FREE_MAX_STUDENTS);
    expect(getSubscriptionGraceDays()).toBe(14);
    expect(applyDevStudentCap('PRO', 800)).toBe(800);
    expect(applyDevStudentCap('FREE', 100)).toBe(100);

    const base = new Date('2026-09-07T10:00:00.000Z');
    expect(addPaidPeriod(base, false).getUTCMonth()).toBe(9);
  });

  it('overlays Pro and Free plan student copy for pricing UI', () => {
    process.env.DEV_FAST_SUBSCRIPTION = 'true';
    process.env.DEV_PRO_MAX_STUDENTS = '5';
    process.env.DEV_FREE_MAX_STUDENTS = '2';

    const overlaid = applyDevPlanOverrides({
      tierCode: 'PRO',
      maxStudents: 800,
      features: [{ text: '800 Students', included: true }],
    });
    expect(overlaid.maxStudents).toBe(5);
    expect(overlaid.features).toEqual([{ text: '5 Students', included: true }]);

    const free = applyDevPlanOverrides({
      tierCode: 'FREE',
      maxStudents: 100,
      features: [{ text: '100 Students', included: true }],
    });
    expect(free.maxStudents).toBe(2);
    expect(free.features).toEqual([{ text: '2 Students', included: true }]);
  });
});
