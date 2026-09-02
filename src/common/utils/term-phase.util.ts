/**
 * Term lifecycle phases — mirrors real school calendar flow.
 */

export interface TermPhaseInput {
  startDate: Date | string;
  endDate: Date | string;
  status?: string;
  examStart?: Date | string | null;
  examEnd?: Date | string | null;
  examTimetablePublishedAt?: Date | string | null;
}

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isDateInRange(
  date: Date,
  start: Date | string,
  end: Date | string,
): boolean {
  const t = startOfLocalDay(date).getTime();
  return (
    t >= startOfLocalDay(new Date(start)).getTime() &&
    t <= startOfLocalDay(new Date(end)).getTime()
  );
}

export function isTermInSession(term: TermPhaseInput, today = new Date()): boolean {
  if (term.status && term.status !== 'ACTIVE') return false;
  return isDateInRange(today, term.startDate, term.endDate);
}

export function isTermPastEndDate(term: TermPhaseInput, today = new Date()): boolean {
  return startOfLocalDay(today).getTime() > startOfLocalDay(new Date(term.endDate)).getTime();
}

export function isExamTimetablePublished(term: TermPhaseInput): boolean {
  return !!term.examTimetablePublishedAt;
}

/** Today falls within the admin-set exam window. */
export function isTermInExamPeriod(term: TermPhaseInput, today = new Date()): boolean {
  if (!term.examStart || !term.examEnd) return false;
  return isDateInRange(today, term.examStart, term.examEnd);
}

/**
 * Regular lesson timetable is live: term in session, not past end, and not in published exam period.
 */
export function isLessonScheduleActive(
  term: TermPhaseInput,
  today = new Date(),
  examBlackoutEnabled = true,
): boolean {
  if (!isTermInSession(term, today)) return false;
  if (
    examBlackoutEnabled &&
    isTermInExamPeriod(term, today) &&
    isExamTimetablePublished(term)
  ) {
    return false;
  }
  return true;
}

/**
 * Exam timetable replaces lessons during the published exam window.
 */
export function isExamScheduleActive(term: TermPhaseInput, today = new Date()): boolean {
  return isTermInExamPeriod(term, today) && isExamTimetablePublished(term);
}

export type TermPhase =
  | 'NOT_STARTED'
  | 'IN_SESSION'
  | 'EXAM_PERIOD'
  | 'OVERDUE'
  | 'ENDED';

export function getTermPhase(term: TermPhaseInput, today = new Date()): TermPhase {
  if (term.status === 'COMPLETED' || term.status === 'ARCHIVED') return 'ENDED';
  if (isTermBeforeStart(term, today)) return 'NOT_STARTED';
  if (isTermPastEndDate(term, today)) return 'OVERDUE';
  if (isExamScheduleActive(term, today)) return 'EXAM_PERIOD';
  return 'IN_SESSION';
}

function isTermBeforeStart(term: TermPhaseInput, today = new Date()): boolean {
  return startOfLocalDay(today).getTime() < startOfLocalDay(new Date(term.startDate)).getTime();
}
