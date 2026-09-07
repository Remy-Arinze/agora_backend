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

export type PackedWeek = {
  weekNumber: number;
  calendarStartDate: Date;
  calendarEndDate: Date;
  slotKind: 'CONTENT' | 'REVISION' | 'EXAM';
  topics: PackableTopic[];
};

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

export function flattenPackedWeekTopic(week: PackedWeek): {
  topic: string;
  subTopics: string[];
  learningOutcomes: string[];
  studentFriendlyOutcomes: string[];
  suggestedActivities: string[];
  resources: string[];
  assessmentType: string | null;
} {
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
