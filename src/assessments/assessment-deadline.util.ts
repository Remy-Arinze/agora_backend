export const TIMER_GRACE_MINUTES = 2;

/** End of the due-date calendar day (UTC). */
export function getDueDateDeadline(dueDate: Date): Date {
    const deadline = new Date(dueDate);
    deadline.setUTCHours(23, 59, 59, 999);
    return deadline;
}

export function isPastDueDate(dueDate: Date | null | undefined, now: Date = new Date()): boolean {
    if (!dueDate) return false;
    return now.getTime() > getDueDateDeadline(dueDate).getTime();
}

export function getTimerExpiry(startedAt: Date, durationMinutes: number): Date {
    return new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
}

export function isTimerExpired(
    startedAt: Date | null | undefined,
    durationMinutes: number | null | undefined,
    now: Date = new Date(),
    graceMinutes: number = TIMER_GRACE_MINUTES,
): boolean {
    if (!startedAt || !durationMinutes) return false;
    const expiryWithGrace =
        getTimerExpiry(startedAt, durationMinutes).getTime() + graceMinutes * 60 * 1000;
    return now.getTime() > expiryWithGrace;
}

export type SubmissionStatus = 'STARTED' | 'SUBMITTED' | 'GRADED' | string;

export interface DeadlineAssessment {
    dueDate: Date | null;
    allowLateSubmissionAfterDue: boolean;
    isTimed: boolean;
    duration: number | null;
    allowLateSubmissionAfterTimer: boolean;
}

export interface DeadlineSubmission {
    status?: SubmissionStatus | null;
    startedAt?: Date | null;
}

export interface StartDeadlineResult {
    allowed: boolean;
    reason?: string;
}

export function evaluateStartDeadline(
    assessment: DeadlineAssessment,
    submission: DeadlineSubmission | null,
    now: Date = new Date(),
): StartDeadlineResult {
    if (submission?.status === 'SUBMITTED' || submission?.status === 'GRADED') {
        return { allowed: false, reason: 'You have already submitted this assessment.' };
    }

    if (!isPastDueDate(assessment.dueDate, now)) {
        return { allowed: true };
    }

    if (assessment.allowLateSubmissionAfterDue) {
        return { allowed: true };
    }

    if (submission?.status === 'STARTED') {
        return { allowed: true };
    }

    return {
        allowed: false,
        reason: 'The submission deadline has passed. Late submissions are not allowed.',
    };
}

export interface SubmitDeadlineResult {
    allowed: boolean;
    isLateDue: boolean;
    isLateTimer: boolean;
    isAutoSubmitted: boolean;
    reason?: string;
}

export function evaluateSubmitDeadline(
    assessment: DeadlineAssessment,
    submission: DeadlineSubmission,
    now: Date = new Date(),
    options?: { isAutoSubmitRequest?: boolean },
): SubmitDeadlineResult {
    const pastDue = isPastDueDate(assessment.dueDate, now);
    const timerExpired =
        assessment.isTimed &&
        isTimerExpired(submission.startedAt ?? null, assessment.duration, now);

    const isLateDue = pastDue;
    const isLateTimer = timerExpired;
    const isAutoSubmitted = Boolean(options?.isAutoSubmitRequest && timerExpired);

    if (pastDue && !assessment.allowLateSubmissionAfterDue) {
        const startedOnTime =
            submission.startedAt &&
            assessment.dueDate &&
            submission.startedAt.getTime() <= getDueDateDeadline(assessment.dueDate).getTime();

        if (!startedOnTime) {
            return {
                allowed: false,
                isLateDue,
                isLateTimer,
                isAutoSubmitted,
                reason: 'The submission deadline has passed. Late submissions are not allowed.',
            };
        }
    }

    if (timerExpired && !assessment.allowLateSubmissionAfterTimer && !isAutoSubmitted) {
        return {
            allowed: false,
            isLateDue,
            isLateTimer,
            isAutoSubmitted: false,
            reason: 'The exam time limit has expired. Late submissions are not allowed.',
        };
    }

    return { allowed: true, isLateDue, isLateTimer, isAutoSubmitted };
}
