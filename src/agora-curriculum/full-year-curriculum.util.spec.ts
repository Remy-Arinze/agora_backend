import {
  FULL_YEAR_WEEKS,
  assertFullYearCurriculum,
  buildMappedYearSlots,
  formatParseCoverage,
  groupParsedTopicsIntoTerms,
  isCompleteFullYearSlots,
  mergeParsedTerms,
  normalizeConsolidateResult,
  normalizeSourceParsedData,
  preserveExtractedText,
  summarizeParseCoverage,
} from './full-year-curriculum.util';

function validYear() {
  return {
    terms: [1, 2, 3].map((term) => ({
      term,
      topics: Array.from({ length: 13 }, (_, index) => ({
        weekNumber: index + 1,
        title:
          index + 1 === 7
            ? 'Mid-term revision'
            : index + 1 === 12
              ? 'End-of-term revision'
              : index + 1 === 13
                ? 'Examination'
                : `Topic ${index + 1}`,
      })),
    })),
  };
}

describe('full-year-curriculum.util', () => {
  it('keeps line breaks when cleaning extracted text', () => {
    const text = preserveExtractedText('Term 1\n\n\nWeek 1   Algebra\r\nWeek 2');
    expect(text).toContain('\n');
    expect(text).not.toMatch(/\r/);
    expect(text).toContain('Week 1 Algebra');
  });

  it('groups flat topics by term and week', () => {
    const terms = groupParsedTopicsIntoTerms([
      { term: 2, weekNumber: 3, title: 'Fractions' },
      { term: 1, weekNumber: 1, title: 'Numbers' },
      { term: 1, weekNumber: 1, title: 'Duplicate ignored' },
    ]);
    expect(terms.map((term) => term.term)).toEqual([1, 2]);
    expect(terms[0].weeks[0].title).toBe('Numbers');
    expect(terms[1].weeks[0].title).toBe('Fractions');
  });

  it('merges chunked terms without dropping earlier weeks', () => {
    const merged = mergeParsedTerms(
      [{ term: 1, weeks: [{ weekNumber: 1, title: 'A', subTopics: [], learningOutcomes: [], studentFriendlyOutcomes: [], suggestedActivities: [], resources: [], assessmentType: '' }] }],
      [{ term: 1, weeks: [{ weekNumber: 2, title: 'B', subTopics: [], learningOutcomes: [], studentFriendlyOutcomes: [], suggestedActivities: [], resources: [], assessmentType: '' }] }],
    );
    expect(merged[0].weeks.map((week) => week.weekNumber)).toEqual([1, 2]);
  });

  it('reads both structured terms and legacy topic bags', () => {
    expect(normalizeSourceParsedData({ terms: [{ term: 1, weeks: [{ weekNumber: 1, title: 'A' }] }] })[0].weeks[0].title).toBe('A');
    expect(normalizeSourceParsedData({ topics: [{ term: 3, weekNumber: 4, title: 'B' }] })[0].term).toBe(3);
  });

  it('flags thin parse coverage and maps empty slots for generate', () => {
    const terms = groupParsedTopicsIntoTerms([
      { term: 1, weekNumber: 1, title: 'Only week' },
    ]);
    const coverage = summarizeParseCoverage(terms);
    expect(coverage.isThin).toBe(true);
    expect(formatParseCoverage(coverage)).toContain('T1=1');
    const slots = buildMappedYearSlots(terms);
    expect(slots).toHaveLength(FULL_YEAR_WEEKS);
    expect(slots[0].status).toBe('MAP_FROM_SOURCE');
    expect(slots.find((slot) => slot.term === 1 && slot.weekNumber === 7)?.status).toBe('GENERATE');
    expect(slots.find((slot) => slot.term === 1 && slot.weekNumber === 7)?.title).toBe('Mid-term revision');
  });

  it('accepts a complete 3×13 year and rejects short or mis-titled weeks', () => {
    expect(() => assertFullYearCurriculum(validYear())).not.toThrow();
    expect(() => assertFullYearCurriculum({ terms: validYear().terms.slice(0, 2) })).toThrow(/requires 3 terms/);
    const short = validYear();
    short.terms[0].topics.pop();
    expect(() => assertFullYearCurriculum(short)).toThrow(/requires 13 weeks/);
    const badExam = validYear();
    badExam.terms[0].topics[12].title = 'More algebra';
    expect(() => assertFullYearCurriculum(badExam)).toThrow(/week 13 must be examination/);
  });

  it('pads short terms and prefixes reserved week titles so a near-miss year validates', () => {
    const raw = {
      terms: [1, 2, 3].map((term) => ({
        term,
        topics: Array.from({ length: term === 2 ? 11 : 12 }, (_, index) => ({
          weekNumber: index + 1,
          title: index + 1 === 7 ? 'Water around us' : `Topic ${index + 1}`,
        })),
      })),
    };
    const normalized = normalizeConsolidateResult(raw);
    expect(() => assertFullYearCurriculum(normalized)).not.toThrow();
    expect(normalized.terms[0].topics).toHaveLength(13);
    expect(normalized.terms[0].topics[6].title).toMatch(/Mid-term revision/i);
    expect(normalized.terms[0].topics[6].title).toContain('Water around us');
    expect(normalized.terms[1].topics[12].title).toMatch(/Exam/i);
  });

  it('requires 39 unique term/week slots before publish', () => {
    const slots = [1, 2, 3].flatMap((term) =>
      Array.from({ length: 13 }, (_, week) => ({ term, weekNumber: week + 1 })),
    );
    expect(isCompleteFullYearSlots(slots)).toBe(true);
    expect(isCompleteFullYearSlots(slots.slice(0, 23))).toBe(false);
  });
});
