export type WorkingDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export const DEFAULT_WORKING_DAYS: WorkingDay[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
];

export interface DateRange {
  start: Date;
  end: Date;
}

const DAY_NAMES: WorkingDay[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getWorkingDayName(date: Date): WorkingDay {
  return DAY_NAMES[date.getDay()];
}

export function isWorkingDay(
  date: Date,
  workingDays: WorkingDay[] = DEFAULT_WORKING_DAYS,
): boolean {
  return workingDays.includes(getWorkingDayName(date));
}

export function isDateInRange(date: Date, range: DateRange | null | undefined): boolean {
  if (!range?.start || !range?.end) return false;
  const t = startOfLocalDay(date).getTime();
  return (
    t >= startOfLocalDay(range.start).getTime() &&
    t <= startOfLocalDay(range.end).getTime()
  );
}

export function isInAnyRange(
  date: Date,
  ranges: Array<DateRange | null | undefined>,
): boolean {
  return ranges.some((r) => isDateInRange(date, r));
}

export function isInstructionalDay(
  date: Date,
  options: {
    workingDays?: WorkingDay[];
    termRange?: DateRange | null;
    nonInstructionalRanges?: Array<DateRange | null | undefined>;
  } = {},
): boolean {
  const workingDays = options.workingDays?.length
    ? options.workingDays
    : DEFAULT_WORKING_DAYS;

  if (options.termRange && !isDateInRange(date, options.termRange)) {
    return false;
  }

  if (!isWorkingDay(date, workingDays)) return false;

  if (
    options.nonInstructionalRanges?.length &&
    isInAnyRange(date, options.nonInstructionalRanges)
  ) {
    return false;
  }

  return true;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getTeachingWeekInfo(
  termStart: Date,
  termEnd: Date,
  asOf: Date,
  options: {
    workingDays?: WorkingDay[];
    nonInstructionalRanges?: Array<DateRange | null | undefined>;
  } = {},
): { currentTeachingWeek?: number; totalTeachingWeeks: number } {
  const workingDays = options.workingDays?.length
    ? options.workingDays
    : DEFAULT_WORKING_DAYS;
  const ranges = options.nonInstructionalRanges || [];

  const start = startOfLocalDay(termStart);
  const end = startOfLocalDay(termEnd);
  const asOfDay = startOfLocalDay(asOf);

  const instructionalByWeek = new Map<number, boolean>();

  for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const bucket = Math.floor(
      (startOfLocalDay(d).getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    const instructional = isInstructionalDay(d, {
      workingDays,
      termRange: { start, end },
      nonInstructionalRanges: ranges,
    });

    if (instructional) {
      instructionalByWeek.set(bucket, true);
    } else if (!instructionalByWeek.has(bucket)) {
      instructionalByWeek.set(bucket, false);
    }
  }

  const teachingBuckets = [...instructionalByWeek.entries()]
    .filter(([, has]) => has)
    .map(([bucket]) => bucket)
    .sort((a, b) => a - b);

  const totalTeachingWeeks = Math.max(1, teachingBuckets.length);

  let currentTeachingWeek: number | undefined;
  if (asOfDay.getTime() >= start.getTime()) {
    const asOfBucket = Math.floor(
      (asOfDay.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    const idx = teachingBuckets.filter((b) => b <= asOfBucket).length;
    if (idx > 0) {
      currentTeachingWeek = Math.min(idx, totalTeachingWeeks);
    }
  }

  return { currentTeachingWeek, totalTeachingWeeks };
}

export function buildHalfTermRange(
  halfTermStart?: Date | string | null,
  halfTermEnd?: Date | string | null,
): DateRange | null {
  if (!halfTermStart || !halfTermEnd) return null;
  return {
    start: startOfLocalDay(new Date(halfTermStart)),
    end: endOfLocalDay(new Date(halfTermEnd)),
  };
}

/** Collect HOLIDAY event date ranges for instructional-day checks. */
export function holidayRangesFromEvents(
  events: Array<{ type: string; startDate: string | Date; endDate: string | Date }>,
): DateRange[] {
  return events
    .filter((e) => e.type === 'HOLIDAY')
    .map((e) => ({
      start: startOfLocalDay(new Date(e.startDate)),
      end: endOfLocalDay(new Date(e.endDate)),
    }));
}
