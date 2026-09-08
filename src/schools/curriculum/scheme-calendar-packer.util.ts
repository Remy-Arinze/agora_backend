import {
  DEFAULT_WORKING_DAYS,
  WorkingDay,
  isInstructionalDay,
  startOfLocalDay,
} from '../../common/utils/instructional-day.util';

export type PackableTopic = {
  stableKey: string;
  agoraTopicId?: string | null;
  schoolTopicId?: string | null;
  title: string;
  topic?: string | null;
  description?: string | null;
  subTopics: string[];
  learningOutcomes: string[];
  studentFriendlyOutcomes: string[];
  suggestedActivities: string[];
  resources: string[];
  assessmentType?: string | null;
  weekNumber?: number;
  order?: number;
  isRevision?: boolean;
  isExam?: boolean;
};

export const CATCH_UP_ASSESSMENT = 'CATCH_UP';

export type PackedWeekSlotKind = 'CONTENT' | 'REVISION' | 'EXAM' | 'CATCH_UP';

export type PackedWeek = {
  weekNumber: number;
  calendarStartDate: Date | null;
  calendarEndDate: Date | null;
  slotKind: PackedWeekSlotKind;
  topics: PackableTopic[];
  /** Existing SchemeOfWorkWeek id when restamping an edited scheme. */
  sourceId?: string | null;
};

export type RestampableContentWeek = {
  id?: string | null;
  topic: string;
  subTopics?: string[];
  learningOutcomes?: string[];
  studentFriendlyOutcomes?: string[];
  suggestedActivities?: string[];
  resources?: string[];
  assessmentType?: string | null;
  topics?: PackableTopic[];
};

export type CalendarMismatch = 'ALIGNED' | 'SHORT' | 'LONG';

export type CalendarCoverage = {
  instructionalWeeks: number;
  planWeeks: number;
  unscheduledWeeks: number;
  bufferWeeks: number;
  mismatch: CalendarMismatch;
};

export function isCatchUpAssessment(assessmentType?: string | null) {
  return (assessmentType || '').toUpperCase() === CATCH_UP_ASSESSMENT;
}

export function computeCalendarCoverage(input: {
  instructionalWeeks: number;
  planWeeks: number;
  unscheduledWeeks: number;
  bufferWeeks: number;
}): CalendarCoverage {
  const { instructionalWeeks, planWeeks, unscheduledWeeks, bufferWeeks } = input;
  const mismatch: CalendarMismatch =
    unscheduledWeeks > 0 ? 'SHORT' : bufferWeeks > 0 ? 'LONG' : 'ALIGNED';
  return { instructionalWeeks, planWeeks, unscheduledWeeks, bufferWeeks, mismatch };
}

export function coverageFromStoredWeeks(
  weeks: Array<{
    assessmentType?: string | null;
    calendarStartDate?: Date | string | null;
  }>,
  instructionalWeeks?: number,
): CalendarCoverage {
  const bufferWeeks = weeks.filter((w) => isCatchUpAssessment(w.assessmentType)).length;
  const planWeeks = weeks.length - bufferWeeks;
  const unscheduledWeeks = weeks.filter(
    (w) => !isCatchUpAssessment(w.assessmentType) && !w.calendarStartDate,
  ).length;
  const dated = weeks.filter((w) => !!w.calendarStartDate).length;
  return computeCalendarCoverage({
    instructionalWeeks: instructionalWeeks ?? dated,
    planWeeks,
    unscheduledWeeks,
    bufferWeeks,
  });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function buildInstructionalWeekRanges(
  termStart: Date,
  termEnd: Date,
  options: {
    workingDays?: WorkingDay[];
    nonInstructionalRanges?: Array<{ start: Date; end: Date } | null | undefined>;
  } = {},
): Array<{ weekNumber: number; start: Date; end: Date }> {
  const workingDays = options.workingDays?.length
    ? options.workingDays
    : DEFAULT_WORKING_DAYS;
  const start = startOfLocalDay(termStart);
  const end = startOfLocalDay(termEnd);
  const buckets = new Map<number, { start: Date; end: Date; has: boolean }>();

  for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const bucket = Math.floor(
      (startOfLocalDay(d).getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    const instructional = isInstructionalDay(d, {
      workingDays,
      termRange: { start, end },
      nonInstructionalRanges: options.nonInstructionalRanges,
    });
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, { start: startOfLocalDay(d), end: startOfLocalDay(d), has: instructional });
    } else {
      existing.end = startOfLocalDay(d);
      existing.has = existing.has || instructional;
    }
  }

  return [...buckets.entries()]
    .filter(([, v]) => v.has)
    .sort((a, b) => a[0] - b[0])
    .map(([, v], i) => ({
      weekNumber: i + 1,
      start: v.start,
      end: v.end,
    }));
}

function looksLikeRevision(topic: PackableTopic): boolean {
  if (topic.isRevision) return true;
  const t = `${topic.title} ${topic.topic || ''}`.toLowerCase();
  return /\b(revision|review|recap|mid[- ]?term)\b/.test(t);
}

function looksLikeExam(topic: PackableTopic): boolean {
  if (topic.isExam) return true;
  const t = `${topic.title} ${topic.topic || ''}`.toLowerCase();
  return /\b(exam|examination)\b/.test(t);
}

/**
 * Deterministic mapper: school instructional weeks own the grid.
 * Library topics are packed in order. Revision/exam topics pin to matching slots
 * when possible. Extra topics combine onto the last content weeks.
 */
export function packTopicsOntoCalendar(
  topics: PackableTopic[],
  weekRanges: Array<{ weekNumber: number; start: Date; end: Date }>,
): PackedWeek[] {
  if (!weekRanges.length) {
    throw new Error('TERM_HAS_NO_INSTRUCTIONAL_WEEKS');
  }

  const ordered = [...topics].sort(
    (a, b) => (a.order ?? a.weekNumber ?? 0) - (b.order ?? b.weekNumber ?? 0),
  );
  const examTopics = ordered.filter(looksLikeExam);
  const revisionTopics = ordered.filter((t) => looksLikeRevision(t) && !looksLikeExam(t));
  const contentTopics = ordered.filter((t) => !looksLikeExam(t) && !looksLikeRevision(t));

  const packed: PackedWeek[] = weekRanges.map((w) => ({
    weekNumber: w.weekNumber,
    calendarStartDate: w.start,
    calendarEndDate: w.end,
    slotKind: 'CONTENT' as const,
    topics: [] as PackableTopic[],
  }));

  if (packed.length >= 1 && examTopics.length) {
    packed[packed.length - 1].slotKind = 'EXAM';
  }
  if (packed.length >= 2 && revisionTopics.length) {
    const revIdx = packed.length >= 7 ? Math.min(6, packed.length - 2) : packed.length - 2;
    if (packed[revIdx].slotKind === 'CONTENT') packed[revIdx].slotKind = 'REVISION';
  }

  const contentSlots = packed.filter((w) => w.slotKind === 'CONTENT');
  const revisionSlots = packed.filter((w) => w.slotKind === 'REVISION');
  const examSlots = packed.filter((w) => w.slotKind === 'EXAM');

  const place = (items: PackableTopic[], slots: PackedWeek[]) => {
    if (!slots.length) {
      const fallback = contentSlots.length ? contentSlots : packed;
      items.forEach((t, i) => fallback[Math.min(i, fallback.length - 1)].topics.push(t));
      return;
    }
    if (items.length <= slots.length) {
      items.forEach((t, i) => slots[i].topics.push(t));
      return;
    }
    const extra = items.length - slots.length;
    items.forEach((t, i) => {
      if (i < slots.length) {
        slots[i].topics.push(t);
      } else {
        const dest = slots[Math.max(0, slots.length - 1 - ((i - slots.length) % Math.max(1, extra)))];
        dest.topics.push(t);
      }
    });
    // Overflow: attach remaining extras onto last content slots
    for (let i = slots.length; i < items.length; i++) {
      slots[slots.length - 1].topics.push(items[i]);
    }
  };

  // First pass: one per slot, extras onto last slot
  if (contentTopics.length && contentSlots.length) {
    contentTopics.forEach((t, i) => {
      if (i < contentSlots.length) contentSlots[i].topics.push(t);
      else contentSlots[contentSlots.length - 1].topics.push(t);
    });
  } else if (contentTopics.length) {
    contentTopics.forEach((t, i) => packed[Math.min(i, packed.length - 1)].topics.push(t));
  }

  place(revisionTopics, revisionSlots);
  place(examTopics, examSlots);

  return packed;
}

function datesWithinTerm(
  start: Date | undefined,
  end: Date | undefined,
  termEnd?: Date,
): { start: Date; end: Date } | null {
  if (!start || !end) return null;
  if (termEnd && startOfLocalDay(start).getTime() > startOfLocalDay(termEnd).getTime()) {
    return null;
  }
  return { start, end };
}

/**
 * Bud library import: keep one scheme week per source topic (typically 13).
 * Dates attach only when the term has a matching instructional week that starts
 * on or before term end. Extra calendar weeks become catch-up rows.
 */
export function packLibraryTopicsPreserveWeeks(
  topics: PackableTopic[],
  weekRanges: Array<{ weekNumber: number; start: Date; end: Date }>,
  options: { termEnd?: Date } = {},
): PackedWeek[] {
  const ordered = [...topics].sort(
    (a, b) => (a.weekNumber ?? a.order ?? 0) - (b.weekNumber ?? b.order ?? 0),
  );
  const rangeByNumber = new Map(weekRanges.map((w) => [w.weekNumber, w]));
  const used = new Set<number>();

  const packed: PackedWeek[] = ordered.map((topic, i) => {
    let weekNumber = topic.weekNumber && topic.weekNumber > 0 ? topic.weekNumber : i + 1;
    if (used.has(weekNumber)) {
      weekNumber = i + 1;
      while (used.has(weekNumber)) weekNumber += 1;
    }
    used.add(weekNumber);

    const range = rangeByNumber.get(weekNumber);
    const bounded = datesWithinTerm(range?.start, range?.end, options.termEnd);

    return {
      weekNumber,
      calendarStartDate: bounded?.start ?? null,
      calendarEndDate: bounded?.end ?? null,
      slotKind: looksLikeExam(topic) ? 'EXAM' : looksLikeRevision(topic) ? 'REVISION' : 'CONTENT',
      topics: [topic],
    };
  });

  const leftover = weekRanges.filter((w) => !used.has(w.weekNumber));
  for (const range of leftover) {
    const bounded = datesWithinTerm(range.start, range.end, options.termEnd);
    if (!bounded) continue;
    packed.push({
      weekNumber: range.weekNumber,
      calendarStartDate: bounded.start,
      calendarEndDate: bounded.end,
      slotKind: 'CATCH_UP',
      topics: [],
    });
    used.add(range.weekNumber);
  }

  return packed.sort((a, b) => a.weekNumber - b.weekNumber);
}

/**
 * Admin editor: content weeks occupy slots 1…N. Dates attach from instructional
 * range N when it starts on or before term end. Leftover calendar slots become
 * catch-up. Extra content past the calendar stays undated.
 */
export function restampContentWeeksOntoCalendar(
  contentWeeks: RestampableContentWeek[],
  weekRanges: Array<{ weekNumber: number; start: Date; end: Date }>,
  options: { termEnd?: Date } = {},
): PackedWeek[] {
  if (!contentWeeks.length) {
    throw new Error('SCHEME_HAS_NO_CONTENT_WEEKS');
  }

  const rangeByNumber = new Map(weekRanges.map((w) => [w.weekNumber, w]));
  const packed: PackedWeek[] = contentWeeks.map((week, i) => {
    const weekNumber = i + 1;
    const range = rangeByNumber.get(weekNumber);
    const bounded = datesWithinTerm(range?.start, range?.end, options.termEnd);
    const stub: PackableTopic = {
      stableKey: week.id ? `keep:${week.id}` : `new:${i}`,
      agoraTopicId: week.topics?.[0]?.agoraTopicId,
      schoolTopicId: week.topics?.[0]?.schoolTopicId,
      title: week.topic,
      subTopics: week.subTopics || [],
      learningOutcomes: week.learningOutcomes || [],
      studentFriendlyOutcomes: week.studentFriendlyOutcomes || [],
      suggestedActivities: week.suggestedActivities || [],
      resources: week.resources || [],
      assessmentType: isCatchUpAssessment(week.assessmentType) ? null : week.assessmentType || null,
    };
    return {
      weekNumber,
      calendarStartDate: bounded?.start ?? null,
      calendarEndDate: bounded?.end ?? null,
      slotKind: looksLikeExam(stub) ? 'EXAM' : looksLikeRevision(stub) ? 'REVISION' : 'CONTENT',
      topics: week.topics?.length ? week.topics : [stub],
      sourceId: week.id || null,
    };
  });

  const used = new Set(packed.map((w) => w.weekNumber));
  for (const range of weekRanges) {
    if (used.has(range.weekNumber)) continue;
    const bounded = datesWithinTerm(range.start, range.end, options.termEnd);
    if (!bounded) continue;
    packed.push({
      weekNumber: range.weekNumber,
      calendarStartDate: bounded.start,
      calendarEndDate: bounded.end,
      slotKind: 'CATCH_UP',
      topics: [],
      sourceId: null,
    });
    used.add(range.weekNumber);
  }

  return packed.sort((a, b) => a.weekNumber - b.weekNumber);
}

export function flattenContentWeek(week: RestampableContentWeek): {
  topic: string;
  subTopics: string[];
  learningOutcomes: string[];
  studentFriendlyOutcomes: string[];
  suggestedActivities: string[];
  resources: string[];
  assessmentType: string | null;
} {
  const outcomes = week.learningOutcomes || [];
  return {
    topic: (week.topic || '').trim() || 'Untitled topic',
    subTopics: week.subTopics || [],
    learningOutcomes: outcomes,
    studentFriendlyOutcomes: week.studentFriendlyOutcomes?.length
      ? week.studentFriendlyOutcomes
      : outcomes,
    suggestedActivities: week.suggestedActivities || [],
    resources: week.resources || [],
    assessmentType: isCatchUpAssessment(week.assessmentType) ? null : week.assessmentType || null,
  };
}

export function flattenPackedWeekTopic(week: PackedWeek): {
  topic: string;
  subTopics: string[];
  learningOutcomes: string[];
  studentFriendlyOutcomes: string[];
  suggestedActivities: string[];
  resources: string[];
  assessmentType: string | null;
} {
  if (week.slotKind === 'CATCH_UP') {
    return {
      topic: 'Catch-up / revision',
      subTopics: [],
      learningOutcomes: ['Use this week to finish outstanding topics, revise, or sit remaining assessments.'],
      studentFriendlyOutcomes: ['I can catch up on work from earlier weeks.'],
      suggestedActivities: ['Review incomplete topics', 'Targeted practice', 'Past-question drill'],
      resources: [],
      assessmentType: CATCH_UP_ASSESSMENT,
    };
  }
  const titles = week.topics.map((t) => t.title).filter(Boolean);
  return {
    topic: titles.join(' / ') || `Week ${week.weekNumber}`,
    subTopics: week.topics.flatMap((t) => t.subTopics || []),
    learningOutcomes: week.topics.flatMap((t) => t.learningOutcomes || []),
    studentFriendlyOutcomes: week.topics.flatMap((t) => t.studentFriendlyOutcomes || []),
    suggestedActivities: week.topics.flatMap((t) => t.suggestedActivities || []),
    resources: week.topics.flatMap((t) => t.resources || []),
    assessmentType: week.topics[0]?.assessmentType || null,
  };
}
