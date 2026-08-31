import {
    evaluateStartDeadline,
    evaluateSubmitDeadline,
    getDueDateDeadline,
    getTimerExpiry,
    isPastDueDate,
    isTimerExpired,
    TIMER_GRACE_MINUTES,
} from './assessment-deadline.util';

describe('assessment-deadline.util', () => {
    const dueDate = new Date('2026-08-10T00:00:00.000Z');
    const beforeDue = new Date('2026-08-10T12:00:00.000Z');
    const afterDue = new Date('2026-08-11T10:00:00.000Z');

    describe('getDueDateDeadline', () => {
        it('returns end of due date UTC day', () => {
            const deadline = getDueDateDeadline(dueDate);
            expect(deadline.toISOString()).toBe('2026-08-10T23:59:59.999Z');
        });
    });

    describe('isPastDueDate', () => {
        it('is false before end of due day', () => {
            expect(isPastDueDate(dueDate, beforeDue)).toBe(false);
        });

        it('is true after end of due day', () => {
            expect(isPastDueDate(dueDate, afterDue)).toBe(true);
        });
    });

    describe('isTimerExpired', () => {
        const startedAt = new Date('2026-08-10T10:00:00.000Z');

        it('is false within duration + grace', () => {
            const now = new Date(startedAt.getTime() + 5 * 60 * 1000);
            expect(isTimerExpired(startedAt, 5, now, TIMER_GRACE_MINUTES)).toBe(false);
        });

        it('is true after duration + grace', () => {
            const now = getTimerExpiry(startedAt, 5).getTime() + (TIMER_GRACE_MINUTES + 1) * 60 * 1000;
            expect(isTimerExpired(startedAt, 5, new Date(now), TIMER_GRACE_MINUTES)).toBe(true);
        });
    });

    describe('evaluateStartDeadline', () => {
        const baseAssessment = {
            dueDate,
            allowLateSubmissionAfterDue: false,
            isTimed: false,
            duration: null,
            allowLateSubmissionAfterTimer: false,
        };

        it('allows start before due date', () => {
            expect(evaluateStartDeadline(baseAssessment, null, beforeDue).allowed).toBe(true);
        });

        it('blocks start after due when late not allowed', () => {
            const result = evaluateStartDeadline(baseAssessment, null, afterDue);
            expect(result.allowed).toBe(false);
            expect(result.reason).toMatch(/deadline has passed/i);
        });

        it('allows start after due when late allowed', () => {
            expect(
                evaluateStartDeadline(
                    { ...baseAssessment, allowLateSubmissionAfterDue: true },
                    null,
                    afterDue,
                ).allowed,
            ).toBe(true);
        });

        it('allows resume in-progress session after due', () => {
            expect(
                evaluateStartDeadline(baseAssessment, { status: 'STARTED', startedAt: beforeDue }, afterDue)
                    .allowed,
            ).toBe(true);
        });

        it('blocks when already submitted', () => {
            expect(
                evaluateStartDeadline(baseAssessment, { status: 'SUBMITTED' }, beforeDue).allowed,
            ).toBe(false);
        });
    });

    describe('evaluateSubmitDeadline', () => {
        const baseAssessment = {
            dueDate,
            allowLateSubmissionAfterDue: false,
            isTimed: true,
            duration: 30,
            allowLateSubmissionAfterTimer: false,
        };

        it('allows submit before due and before timer expiry', () => {
            const startedAt = new Date('2026-08-10T10:00:00.000Z');
            const now = new Date(startedAt.getTime() + 10 * 60 * 1000);
            const result = evaluateSubmitDeadline(
                baseAssessment,
                { status: 'STARTED', startedAt },
                now,
            );
            expect(result.allowed).toBe(true);
            expect(result.isLateDue).toBe(false);
            expect(result.isLateTimer).toBe(false);
        });

        it('allows submit after due if started on time', () => {
            const startedAt = new Date('2026-08-10T20:00:00.000Z');
            const result = evaluateSubmitDeadline(
                { ...baseAssessment, isTimed: false, duration: null },
                { status: 'STARTED', startedAt },
                afterDue,
            );
            expect(result.allowed).toBe(true);
            expect(result.isLateDue).toBe(true);
        });

        it('blocks submit after due if never started on time', () => {
            const result = evaluateSubmitDeadline(baseAssessment, { status: 'STARTED' }, afterDue);
            expect(result.allowed).toBe(false);
        });

        it('blocks manual submit after timer when late timer not allowed', () => {
            const startedAt = new Date('2026-08-10T10:00:00.000Z');
            const now = getTimerExpiry(startedAt, 30).getTime() + (TIMER_GRACE_MINUTES + 1) * 60 * 1000;
            const result = evaluateSubmitDeadline(
                baseAssessment,
                { status: 'STARTED', startedAt },
                new Date(now),
            );
            expect(result.allowed).toBe(false);
            expect(result.isLateTimer).toBe(true);
        });

        it('allows auto-submit after timer even when late timer not allowed', () => {
            const startedAt = new Date('2026-08-10T10:00:00.000Z');
            const now = getTimerExpiry(startedAt, 30).getTime() + (TIMER_GRACE_MINUTES + 1) * 60 * 1000;
            const result = evaluateSubmitDeadline(
                baseAssessment,
                { status: 'STARTED', startedAt },
                new Date(now),
                { isAutoSubmitRequest: true },
            );
            expect(result.allowed).toBe(true);
            expect(result.isAutoSubmitted).toBe(true);
        });

        it('allows late timer submit when teacher allows it', () => {
            const startedAt = new Date('2026-08-10T10:00:00.000Z');
            const now = getTimerExpiry(startedAt, 30).getTime() + (TIMER_GRACE_MINUTES + 1) * 60 * 1000;
            const result = evaluateSubmitDeadline(
                { ...baseAssessment, allowLateSubmissionAfterTimer: true },
                { status: 'STARTED', startedAt },
                new Date(now),
            );
            expect(result.allowed).toBe(true);
            expect(result.isLateTimer).toBe(true);
        });
    });
});
