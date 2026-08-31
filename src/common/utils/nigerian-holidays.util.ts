/**
 * Fixed Nigerian public holidays (secular / civic).
 * Islamic holidays (Eid) shift each year and are omitted from the seed —
 * schools can add them manually as HOLIDAY events.
 */
export interface NigerianHolidaySeed {
  title: string;
  /** Month 1–12 */
  month: number;
  /** Day of month */
  day: number;
  /** Inclusive duration in days (default 1) */
  durationDays?: number;
}

export const NIGERIAN_FIXED_HOLIDAYS: NigerianHolidaySeed[] = [
  { title: "New Year's Day", month: 1, day: 1 },
  { title: "Workers' Day", month: 5, day: 1 },
  { title: 'Democracy Day', month: 6, day: 12 },
  { title: 'Independence Day', month: 10, day: 1 },
  { title: 'Christmas Day', month: 12, day: 25 },
  { title: 'Boxing Day', month: 12, day: 26 },
];

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function utcEndOfDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export interface SeededHolidayEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  type: 'HOLIDAY';
  isAllDay: true;
  description: string;
}

/**
 * Build HOLIDAY event payloads for every calendar year touched by [from, to].
 */
export function buildNigerianHolidayEvents(
  from: Date,
  to: Date,
): SeededHolidayEvent[] {
  const startYear = from.getUTCFullYear();
  const endYear = to.getUTCFullYear();
  const events: SeededHolidayEvent[] = [];

  for (let year = startYear; year <= endYear; year++) {
    for (const h of NIGERIAN_FIXED_HOLIDAYS) {
      const start = utcDate(year, h.month, h.day);
      const duration = Math.max(1, h.durationDays ?? 1);
      const lastDay = addUtcDays(start, duration - 1);
      const end = utcEndOfDay(
        lastDay.getUTCFullYear(),
        lastDay.getUTCMonth() + 1,
        lastDay.getUTCDate(),
      );
      // Keep holidays that overlap the requested window
      if (end < from || start > to) continue;
      events.push({
        title: h.title,
        startDate: start,
        endDate: end,
        type: 'HOLIDAY',
        isAllDay: true,
        description: 'Nigerian public holiday (imported)',
      });
    }
  }

  return events;
}
