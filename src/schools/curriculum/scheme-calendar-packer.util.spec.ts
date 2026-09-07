import { packTopicsOntoCalendar, PackableTopic } from './scheme-calendar-packer.util';

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
