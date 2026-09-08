import {
  packTopicsOntoCalendar,
  packLibraryTopicsPreserveWeeks,
  restampContentWeeksOntoCalendar,
  coverageFromStoredWeeks,
  CATCH_UP_ASSESSMENT,
  PackableTopic,
  RestampableContentWeek,
} from './scheme-calendar-packer.util';

function ranges(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const start = new Date('2026-01-05');
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 4);
    return { weekNumber: i + 1, start, end };
  });
}

function topic(title: string, weekNumber: number, extra: Partial<PackableTopic> = {}): PackableTopic {
  return {
    stableKey: `KEY-${title}`,
    title,
    subTopics: [],
    learningOutcomes: ['Know it'],
    studentFriendlyOutcomes: ['I can'],
    suggestedActivities: [],
    resources: [],
    weekNumber,
    order: weekNumber,
    ...extra,
  };
}

const thirteen = () => Array.from({ length: 13 }, (_, i) => topic(`Week ${i + 1}`, i + 1));

describe('packTopicsOntoCalendar', () => {
  it('pins exam topic to the last week', () => {
    const packed = packTopicsOntoCalendar(
      [topic('Fractions', 1), topic('Examination', 13, { isExam: true })],
      ranges(11),
    );
    expect(packed[packed.length - 1].slotKind).toBe('EXAM');
    expect(packed[packed.length - 1].topics.some((t) => t.title === 'Examination')).toBe(true);
  });

  it('combines overflow topics onto the last content week', () => {
    const topics = Array.from({ length: 8 }, (_, i) => topic(`T${i + 1}`, i + 1));
    const packed = packTopicsOntoCalendar(topics, ranges(5));
    const lastContent = [...packed].reverse().find((w) => w.slotKind === 'CONTENT');
    expect(lastContent && lastContent.topics.length >= 1).toBe(true);
    const total = packed.reduce((n, w) => n + w.topics.length, 0);
    expect(total).toBe(8);
  });
});

describe('packLibraryTopicsPreserveWeeks', () => {
  const termEnd = new Date('2026-04-20');

  it('keeps all 13 plan weeks undated past a 7-week calendar', () => {
    const packed = packLibraryTopicsPreserveWeeks(thirteen(), ranges(7), { termEnd });
    expect(packed).toHaveLength(13);
    expect(packed.filter((w) => w.calendarStartDate)).toHaveLength(7);
    expect(packed.filter((w) => !w.calendarStartDate).map((w) => w.weekNumber)).toEqual([
      8, 9, 10, 11, 12, 13,
    ]);
    expect(packed.every((w) => w.slotKind !== 'CATCH_UP')).toBe(true);
  });

  it('maps 13 plan weeks 1:1 onto a 13-week calendar', () => {
    const packed = packLibraryTopicsPreserveWeeks(thirteen(), ranges(13), { termEnd });
    expect(packed).toHaveLength(13);
    expect(packed.every((w) => w.calendarStartDate)).toBe(true);
    expect(packed.every((w) => w.topics.length === 1)).toBe(true);
  });

  it('appends catch-up weeks when the calendar is longer than the plan', () => {
    const packed = packLibraryTopicsPreserveWeeks(thirteen(), ranges(15), { termEnd });
    expect(packed).toHaveLength(15);
    expect(packed.filter((w) => w.slotKind === 'CATCH_UP').map((w) => w.weekNumber)).toEqual([14, 15]);
    expect(packed.filter((w) => w.slotKind !== 'CATCH_UP')).toHaveLength(13);
  });

  it('never attaches a start date after term end', () => {
    const earlyEnd = new Date('2026-01-20');
    const packed = packLibraryTopicsPreserveWeeks(thirteen(), ranges(13), { termEnd: earlyEnd });
    for (const week of packed) {
      if (week.calendarStartDate) {
        expect(week.calendarStartDate.getTime()).toBeLessThanOrEqual(earlyEnd.getTime());
      }
    }
    expect(packed.filter((w) => w.calendarStartDate).length).toBeLessThan(13);
  });
});

describe('coverageFromStoredWeeks', () => {
  it('flags SHORT when plan weeks lack dates', () => {
    const weeks = [
      ...Array.from({ length: 7 }, () => ({ assessmentType: null, calendarStartDate: new Date() })),
      ...Array.from({ length: 6 }, () => ({ assessmentType: null, calendarStartDate: null })),
    ];
    const coverage = coverageFromStoredWeeks(weeks, 7);
    expect(coverage).toMatchObject({
      instructionalWeeks: 7,
      planWeeks: 13,
      unscheduledWeeks: 6,
      bufferWeeks: 0,
      mismatch: 'SHORT',
    });
  });

  it('flags LONG when catch-up rows exist', () => {
    const weeks = [
      ...Array.from({ length: 13 }, () => ({ assessmentType: null, calendarStartDate: new Date() })),
      { assessmentType: CATCH_UP_ASSESSMENT, calendarStartDate: new Date() },
      { assessmentType: CATCH_UP_ASSESSMENT, calendarStartDate: new Date() },
    ];
    expect(coverageFromStoredWeeks(weeks, 15).mismatch).toBe('LONG');
    expect(coverageFromStoredWeeks(weeks, 15).bufferWeeks).toBe(2);
    expect(coverageFromStoredWeeks(weeks, 15).planWeeks).toBe(13);
  });
});

describe('restampContentWeeksOntoCalendar', () => {
  const termEnd = new Date('2026-05-31');
  const content = (n: number): RestampableContentWeek[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `w${i + 1}`,
      topic: `Topic ${i + 1}`,
    }));

  it('keeps 13 content weeks and appends catch-up 14–16 on a 16-week calendar', () => {
    const packed = restampContentWeeksOntoCalendar(content(13), ranges(16), { termEnd });
    expect(packed.filter((w) => w.slotKind !== 'CATCH_UP')).toHaveLength(13);
    expect(packed.filter((w) => w.slotKind === 'CATCH_UP').map((w) => w.weekNumber)).toEqual([
      14, 15, 16,
    ]);
    expect(packed.filter((w) => w.slotKind !== 'CATCH_UP').every((w) => w.calendarStartDate)).toBe(
      true,
    );
  });

  it('insert at front of 13 on a 16-week calendar yields 14 content + catch-up 15–16', () => {
    const inserted = [{ topic: 'New opener' }, ...content(13)];
    const packed = restampContentWeeksOntoCalendar(inserted, ranges(16), { termEnd });
    expect(packed.filter((w) => w.slotKind !== 'CATCH_UP')).toHaveLength(14);
    expect(packed[0].topics[0].title).toBe('New opener');
    expect(packed.filter((w) => w.slotKind === 'CATCH_UP').map((w) => w.weekNumber)).toEqual([
      15, 16,
    ]);
  });

  it('leaves overflow undated on a 7-week calendar with no catch-up', () => {
    const packed = restampContentWeeksOntoCalendar(content(13), ranges(7), { termEnd });
    expect(packed).toHaveLength(13);
    expect(packed.filter((w) => w.calendarStartDate)).toHaveLength(7);
    expect(packed.filter((w) => !w.calendarStartDate).map((w) => w.weekNumber)).toEqual([
      8, 9, 10, 11, 12, 13,
    ]);
    expect(packed.every((w) => w.slotKind !== 'CATCH_UP')).toBe(true);
  });

  it('delete one of 13 on a 16-week calendar yields catch-up 13–16', () => {
    const packed = restampContentWeeksOntoCalendar(content(12), ranges(16), { termEnd });
    expect(packed.filter((w) => w.slotKind !== 'CATCH_UP')).toHaveLength(12);
    expect(packed.filter((w) => w.slotKind === 'CATCH_UP').map((w) => w.weekNumber)).toEqual([
      13, 14, 15, 16,
    ]);
  });

  it('preserves source ids on content weeks', () => {
    const packed = restampContentWeeksOntoCalendar(content(3), ranges(16), { termEnd });
    expect(packed[0].sourceId).toBe('w1');
    expect(packed[2].sourceId).toBe('w3');
  });
});
