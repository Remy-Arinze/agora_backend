/** Calendar days after paid `endDate` before the school enters admin-action-required (locked) mode. */
export const SUBSCRIPTION_GRACE_DAYS = 14;

/** Send in-app admin reminders on these 1-based days after paid period ends (during grace). */
export const SUBSCRIPTION_GRACE_REMINDER_DAYS = [1, 3, 7, 10, 14] as const;
