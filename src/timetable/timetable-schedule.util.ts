import type { CuratorSchoolType, CuratorSchedulePeriod } from './timetable-curator.types';

const PRIMARY_SCHEDULE: CuratorSchedulePeriod[] = [
  { startTime: '07:30', endTime: '07:45', type: 'ASSEMBLY', label: 'Assembly' },
  { startTime: '07:45', endTime: '08:25', type: 'LESSON', label: 'Period 1' },
  { startTime: '08:25', endTime: '09:05', type: 'LESSON', label: 'Period 2' },
  { startTime: '09:05', endTime: '09:45', type: 'LESSON', label: 'Period 3' },
  { startTime: '09:45', endTime: '10:25', type: 'LESSON', label: 'Period 4' },
  { startTime: '10:25', endTime: '11:00', type: 'LESSON', label: 'Period 5' },
  { startTime: '11:00', endTime: '11:40', type: 'BREAK', label: 'Break' },
  { startTime: '11:40', endTime: '12:20', type: 'LESSON', label: 'Period 6' },
  { startTime: '12:20', endTime: '12:30', type: 'LESSON', label: 'Period 7' },
  { startTime: '12:30', endTime: '13:00', type: 'LUNCH', label: 'Lunch' },
  { startTime: '13:00', endTime: '13:40', type: 'LESSON', label: 'Period 8' },
  { startTime: '13:40', endTime: '14:10', type: 'LESSON', label: 'Period 9' },
];

const SECONDARY_SCHEDULE: CuratorSchedulePeriod[] = [
  { startTime: '08:00', endTime: '08:15', type: 'ASSEMBLY', label: 'Assembly' },
  { startTime: '08:15', endTime: '09:00', type: 'LESSON', label: 'Period 1' },
  { startTime: '09:00', endTime: '09:45', type: 'LESSON', label: 'Period 2' },
  { startTime: '09:45', endTime: '10:30', type: 'LESSON', label: 'Period 3' },
  { startTime: '10:30', endTime: '11:00', type: 'BREAK', label: 'Break' },
  { startTime: '11:00', endTime: '11:45', type: 'LESSON', label: 'Period 4' },
  { startTime: '11:45', endTime: '12:30', type: 'LESSON', label: 'Period 5' },
  { startTime: '12:30', endTime: '13:15', type: 'LUNCH', label: 'Lunch' },
  { startTime: '13:15', endTime: '14:00', type: 'LESSON', label: 'Period 6' },
  { startTime: '14:00', endTime: '14:35', type: 'LESSON', label: 'Period 7' },
];

const TERTIARY_SCHEDULE: CuratorSchedulePeriod[] = [
  { startTime: '08:00', endTime: '09:00', type: 'LESSON', label: 'Period 1' },
  { startTime: '09:00', endTime: '10:00', type: 'LESSON', label: 'Period 2' },
  { startTime: '10:00', endTime: '10:30', type: 'LESSON', label: 'Period 3' },
  { startTime: '10:30', endTime: '11:00', type: 'BREAK', label: 'Break' },
  { startTime: '11:00', endTime: '12:00', type: 'LESSON', label: 'Period 4' },
  { startTime: '12:00', endTime: '13:00', type: 'LESSON', label: 'Period 5' },
  { startTime: '13:00', endTime: '14:00', type: 'LUNCH', label: 'Lunch' },
  { startTime: '14:00', endTime: '15:00', type: 'LESSON', label: 'Period 6' },
  { startTime: '15:00', endTime: '16:00', type: 'LESSON', label: 'Period 7' },
];

function isSchedulePeriod(value: unknown): value is CuratorSchedulePeriod {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.startTime === 'string' && typeof p.endTime === 'string';
}

export function defaultScheduleForSchoolType(schoolType: CuratorSchoolType): CuratorSchedulePeriod[] {
  if (schoolType === 'PRIMARY') return PRIMARY_SCHEDULE;
  if (schoolType === 'TERTIARY') return TERTIARY_SCHEDULE;
  return SECONDARY_SCHEDULE;
}

export function scheduleFromBellTemplates(
  schoolType: CuratorSchoolType,
  templates?: Array<{ schoolType: string; periods: unknown; isDefault?: boolean }> | null,
): CuratorSchedulePeriod[] {
  if (templates?.length) {
    const match =
      templates.find((t) => t.schoolType === schoolType && t.isDefault !== false) ??
      templates.find((t) => t.schoolType === schoolType);
    const periods = Array.isArray(match?.periods) ? match.periods.filter(isSchedulePeriod) : [];
    if (periods.length > 0) {
      return periods.map((p) => ({
        startTime: p.startTime,
        endTime: p.endTime,
        type: (p.type as CuratorSchedulePeriod['type']) || 'LESSON',
        label: p.label,
      }));
    }
  }
  return defaultScheduleForSchoolType(schoolType);
}
