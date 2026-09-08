/** Nigerian master-curriculum year: 3 terms × 13 weeks. */

export const FULL_YEAR_TERMS = 3;
export const WEEKS_PER_TERM = 13;
export const FULL_YEAR_WEEKS = FULL_YEAR_TERMS * WEEKS_PER_TERM;
/** Warn when a parsed term is well short of 13 teaching/revision weeks. */
export const PARSE_THIN_TERM_WEEKS = 10;

export const STANDARD_WEEK_TITLES: Record<number, string> = {
  7: 'Mid-term revision',
  12: 'End-of-term revision',
  13: 'Examination',
};

const WEEK_7_TITLE = /mid[- ]?term|revision/i;
const WEEK_12_TITLE = /revision|end[- ]?of[- ]?term/i;
const WEEK_13_TITLE = /exam/i;
const RESERVED_WEEK_PATTERNS: Record<number, RegExp> = {
  7: WEEK_7_TITLE,
  12: WEEK_12_TITLE,
  13: WEEK_13_TITLE,
};

export const CONSOLIDATION_FAILED_PREFIX = 'CONSOLIDATION_FAILED:';

export interface ParsedWeek {
  weekNumber: number;
  title: string;
  description?: string;
  subTopics: string[];
  learningOutcomes: string[];
  studentFriendlyOutcomes: string[];
  suggestedActivities: string[];
  resources: string[];
  assessmentType: string;
}

export interface ParsedTerm {
  term: number;
  weeks: ParsedWeek[];
}

export interface StructuredParsedData {
  terms: ParsedTerm[];
  topics: Array<ParsedWeek & { term: number }>;
}

export interface ParseCoverage {
  termCount: number;
  weekCounts: Record<number, number>;
  extractedWeeks: number;
  isThin: boolean;
  lastTerm?: number;
  lastWeek?: number;
}

export interface MappedYearSlot {
  term: number;
  weekNumber: number;
  title: string | null;
  status: 'MAP_FROM_SOURCE' | 'GENERATE';
}

type LooseWeek = {
  weekNumber?: number;
  title?: string;
  topic?: string;
  description?: string;
  subTopics?: string[];
  learningOutcomes?: string[];
  objectives?: string[];
  studentFriendlyOutcomes?: string[];
  suggestedActivities?: string[];
  resources?: string[];
  assessmentType?: string;
  term?: number;
};

/**
 * Strip control characters but keep newlines so term/week tables stay readable.
 */
export function preserveExtractedText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function asParsedWeek(raw: LooseWeek, fallbackWeek: number): ParsedWeek {
  const weekNumber = Number(raw.weekNumber) > 0 ? Number(raw.weekNumber) : fallbackWeek;
  return {
    weekNumber,
    title: raw.title || raw.topic || 'Untitled topic',
    description: raw.description,
    subTopics: raw.subTopics || [],
    learningOutcomes: raw.learningOutcomes || raw.objectives || [],
    studentFriendlyOutcomes: raw.studentFriendlyOutcomes || [],
    suggestedActivities: raw.suggestedActivities || [],
    resources: raw.resources || [],
    assessmentType: raw.assessmentType || '',
  };
}

export function groupParsedTopicsIntoTerms(topics: LooseWeek[]): ParsedTerm[] {
  const byTerm = new Map<number, ParsedWeek[]>();
  topics.forEach((topic, index) => {
    const term = Number(topic.term) >= 1 && Number(topic.term) <= FULL_YEAR_TERMS ? Number(topic.term) : 1;
    const list = byTerm.get(term) || [];
    list.push(asParsedWeek(topic, list.length + 1 || index + 1));
    byTerm.set(term, list);
  });

  return [...byTerm.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([term, weeks]) => ({
      term,
      weeks: dedupeWeeks(weeks),
    }));
}

export function mergeParsedTerms(base: ParsedTerm[], incoming: ParsedTerm[]): ParsedTerm[] {
  const byTerm = new Map<number, ParsedWeek[]>();
  for (const term of [...base, ...incoming]) {
    if (!term || !Number.isFinite(Number(term.term))) continue;
    const key = Number(term.term);
    const existing = byTerm.get(key) || [];
    byTerm.set(key, [...existing, ...(term.weeks || []).map((week, i) => asParsedWeek(week, i + 1))]);
  }

  return [...byTerm.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([term, weeks]) => ({
      term,
      weeks: dedupeWeeks(weeks),
    }));
}

export function flattenParsedTerms(terms: ParsedTerm[]): Array<ParsedWeek & { term: number }> {
  return terms.flatMap((term) => term.weeks.map((week) => ({ ...week, term: term.term })));
}

export function structuredParsedData(terms: ParsedTerm[]): StructuredParsedData {
  return {
    terms,
    topics: flattenParsedTerms(terms),
  };
}

export function normalizeSourceParsedData(data: unknown): ParsedTerm[] {
  const parsed = typeof data === 'string' ? safeJson(data) : data;
  if (!parsed || typeof parsed !== 'object') return [];
  const record = parsed as { terms?: ParsedTerm[]; topics?: LooseWeek[] };
  if (Array.isArray(record.terms) && record.terms.length > 0) {
    return mergeParsedTerms([], record.terms);
  }
  if (Array.isArray(record.topics) && record.topics.length > 0) {
    return groupParsedTopicsIntoTerms(record.topics);
  }
  return [];
}

export function summarizeParseCoverage(terms: ParsedTerm[]): ParseCoverage {
  const weekCounts: Record<number, number> = {};
  let extractedWeeks = 0;
  let lastTerm: number | undefined;
  let lastWeek: number | undefined;

  for (const term of terms) {
    const count = term.weeks?.length || 0;
    weekCounts[term.term] = count;
    extractedWeeks += count;
    if (count > 0) {
      lastTerm = term.term;
      lastWeek = Math.max(...term.weeks.map((week) => week.weekNumber));
    }
  }

  const termCount = terms.filter((term) => (term.weeks?.length || 0) > 0).length;
  const isThin = termCount < FULL_YEAR_TERMS || Object.values(weekCounts).some((count) => count < PARSE_THIN_TERM_WEEKS);

  return { termCount, weekCounts, extractedWeeks, isThin, lastTerm, lastWeek };
}

export function formatParseCoverage(coverage: ParseCoverage): string {
  const weeks = [1, 2, 3].map((term) => `T${term}=${coverage.weekCounts[term] || 0}`).join(' ');
  return `terms=${coverage.termCount} weeks=${coverage.extractedWeeks} (${weeks})`;
}

export function buildMappedYearSlots(terms: ParsedTerm[]): MappedYearSlot[] {
  const bySlot = new Map<string, ParsedWeek>();
  for (const term of terms) {
    for (const week of term.weeks || []) {
      bySlot.set(`${term.term}:${week.weekNumber}`, week);
    }
  }

  const slots: MappedYearSlot[] = [];
  for (let term = 1; term <= FULL_YEAR_TERMS; term++) {
    for (let weekNumber = 1; weekNumber <= WEEKS_PER_TERM; weekNumber++) {
      const source = bySlot.get(`${term}:${weekNumber}`);
      slots.push({
        term,
        weekNumber,
        title: source?.title || STANDARD_WEEK_TITLES[weekNumber] || null,
        status: source ? 'MAP_FROM_SOURCE' : 'GENERATE',
      });
    }
  }
  return slots;
}

export function assertFullYearCurriculum(result: {
  terms?: Array<{
    term: number;
    topics?: Array<{ title?: string; weekNumber?: number }>;
  }>;
}): void {
  if (!result?.terms || !Array.isArray(result.terms)) {
    throw new Error('Full-year curriculum missing terms');
  }
  if (result.terms.length !== FULL_YEAR_TERMS) {
    throw new Error(`Full-year curriculum requires ${FULL_YEAR_TERMS} terms, got ${result.terms.length}`);
  }

  const terms = [...result.terms].sort((a, b) => Number(a.term) - Number(b.term));
  const numbers = terms.map((term) => Number(term.term));
  if (numbers.join(',') !== '1,2,3') {
    throw new Error(`Full-year curriculum requires terms 1, 2, 3; got ${numbers.join(', ')}`);
  }

  for (const term of terms) {
    const topics = term.topics || [];
    if (topics.length !== WEEKS_PER_TERM) {
      throw new Error(`Term ${term.term} requires ${WEEKS_PER_TERM} weeks, got ${topics.length}`);
    }

    const weeks = topics.map((topic, index) => Number(topic.weekNumber) || index + 1);
    const unique = new Set(weeks);
    if (unique.size !== WEEKS_PER_TERM) {
      throw new Error(`Term ${term.term} has duplicate or missing week numbers`);
    }
    for (let week = 1; week <= WEEKS_PER_TERM; week++) {
      if (!unique.has(week)) {
        throw new Error(`Term ${term.term} is missing week ${week}`);
      }
    }

    const byWeek = new Map(topics.map((topic, index) => [Number(topic.weekNumber) || index + 1, topic]));
    assertStandardWeekTitle(term.term, 7, byWeek.get(7)?.title, WEEK_7_TITLE);
    assertStandardWeekTitle(term.term, 12, byWeek.get(12)?.title, WEEK_12_TITLE);
    assertStandardWeekTitle(term.term, 13, byWeek.get(13)?.title, WEEK_13_TITLE);
  }
}

export function isCompleteFullYearSlots(
  topics: Array<{ term: number; weekNumber: number }>,
): boolean {
  if (topics.length !== FULL_YEAR_WEEKS) return false;
  for (let term = 1; term <= FULL_YEAR_TERMS; term++) {
    const weeks = new Set(topics.filter((topic) => topic.term === term).map((topic) => topic.weekNumber));
    if (weeks.size !== WEEKS_PER_TERM) return false;
    for (let week = 1; week <= WEEKS_PER_TERM; week++) {
      if (!weeks.has(week)) return false;
    }
  }
  return true;
}

type ConsolidatableTopic = {
  title: string;
  description?: string;
  weekNumber?: number;
  subTopics?: string[];
  learningOutcomes?: string[];
  studentFriendlyOutcomes?: string[];
  suggestedActivities?: string[];
  resources?: string[];
  assessmentType?: string;
  order?: number;
};

/**
 * Force each term into 13 weeks and reserved 7/12/13 titles so a near-miss
 * LLM result still saves instead of leaving an empty "Working" draft.
 */
export function normalizeConsolidateResult<T extends { terms?: Array<{ term: number; topics?: ConsolidatableTopic[] }> }>(
  result: T,
): T {
  if (!result?.terms || !Array.isArray(result.terms)) return result;

  const byTerm = new Map(result.terms.map((term) => [Number(term.term), term]));
  const terms = [1, 2, 3].map((termNumber) => {
    const existing = byTerm.get(termNumber) || { term: termNumber, topics: [] };
    return {
      ...existing,
      term: termNumber,
      topics: padTermToThirteen(existing.topics || []),
    };
  });

  return { ...result, terms };
}

function padTermToThirteen(topics: ConsolidatableTopic[]): ConsolidatableTopic[] {
  const byWeek = new Map<number, ConsolidatableTopic>();
  topics.forEach((topic, index) => {
    const week = Number(topic.weekNumber) > 0 ? Number(topic.weekNumber) : index + 1;
    if (week >= 1 && week <= WEEKS_PER_TERM && !byWeek.has(week)) {
      byWeek.set(week, { ...topic, weekNumber: week });
    }
  });

  const padded: ConsolidatableTopic[] = [];
  for (let week = 1; week <= WEEKS_PER_TERM; week++) {
    const existing = byWeek.get(week);
    const previous = padded[padded.length - 1];
    padded.push(existing ? ensureReservedWeek(existing, week) : makeFillerWeek(week, previous));
  }
  return padded;
}

function ensureReservedWeek(topic: ConsolidatableTopic, weekNumber: number): ConsolidatableTopic {
  const standard = STANDARD_WEEK_TITLES[weekNumber];
  const pattern = RESERVED_WEEK_PATTERNS[weekNumber];
  const title = topic.title || `Week ${weekNumber}`;
  const reservedTitle =
    standard && pattern && !pattern.test(title) ? `${standard}: ${title}` : title;
  return {
    ...topic,
    title: reservedTitle,
    weekNumber,
    order: topic.order || weekNumber,
    subTopics: topic.subTopics || [],
    learningOutcomes: topic.learningOutcomes || [],
    studentFriendlyOutcomes: topic.studentFriendlyOutcomes || [],
    suggestedActivities: topic.suggestedActivities || [],
    resources: topic.resources || [],
    assessmentType:
      topic.assessmentType || (weekNumber === 13 ? 'Examination' : weekNumber === 7 || weekNumber === 12 ? 'Revision' : ''),
  };
}

function makeFillerWeek(weekNumber: number, previous?: ConsolidatableTopic): ConsolidatableTopic {
  const standard = STANDARD_WEEK_TITLES[weekNumber];
  const title = standard || (previous?.title ? `Continuation: ${previous.title}` : `Week ${weekNumber}`);
  const isExam = weekNumber === 13;
  const isRevision = weekNumber === 7 || weekNumber === 12;
  return {
    title,
    description: isRevision || isExam
      ? `Standard ${title.toLowerCase()} week.`
      : previous?.description || `Continue work from the previous week.`,
    weekNumber,
    subTopics: previous?.subTopics || [],
    learningOutcomes: isExam
      ? ['Demonstrate mastery of the term’s topics through examination.']
      : isRevision
        ? ['Review and consolidate the term’s topics so far.']
        : previous?.learningOutcomes?.length
          ? previous.learningOutcomes
          : [`Continue learning from ${previous?.title || 'the previous week'}.`],
    studentFriendlyOutcomes: isExam
      ? ['I can show what I learned this term.']
      : isRevision
        ? ['I can recall and practise the topics we have covered.']
        : previous?.studentFriendlyOutcomes || ['I can keep practising this topic.'],
    suggestedActivities: isExam
      ? ['Sit the end-of-term examination.']
      : isRevision
        ? ['Revise notes, past questions, and classwork.']
        : previous?.suggestedActivities || ['Guided practice and class discussion.'],
    resources: previous?.resources || [],
    assessmentType: isExam ? 'Examination' : isRevision ? 'Revision' : previous?.assessmentType || 'Classwork',
    order: weekNumber,
  };
}

function assertStandardWeekTitle(
  term: number,
  weekNumber: number,
  title: string | undefined,
  pattern: RegExp,
): void {
  if (!title || !pattern.test(title)) {
    const expected = STANDARD_WEEK_TITLES[weekNumber];
    throw new Error(
      `Term ${term} week ${weekNumber} must be ${expected.toLowerCase()} (got "${title || 'missing'}")`,
    );
  }
}

function dedupeWeeks(weeks: ParsedWeek[]): ParsedWeek[] {
  const byWeek = new Map<number, ParsedWeek>();
  for (const week of weeks) {
    if (!byWeek.has(week.weekNumber)) {
      byWeek.set(week.weekNumber, week);
    }
  }
  return [...byWeek.values()].sort((a, b) => a.weekNumber - b.weekNumber);
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
