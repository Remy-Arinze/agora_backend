/**
 * Nigerian School Schedule Templates
 * Based on typical Nigerian school schedules with break times
 */

export interface SchedulePeriod {
  startTime: string;
  endTime: string;
  type: 'LESSON' | 'BREAK' | 'ASSEMBLY' | 'LUNCH';
  label?: string;
}

export interface SchoolSchedule {
  periods: SchedulePeriod[];
  assemblyTime?: string;
  breakTime?: string;
  lunchTime?: string;
}

/**
 * Primary School Schedule (7:30 AM - 2:10 PM)
 * - Assembly: 7:30 AM - 7:45 AM
 * - Break: 11:00 AM - 11:40 AM
 * - Lunch: 12:30 PM - 1:00 PM
 */
export const PRIMARY_SCHEDULE: SchoolSchedule = {
  assemblyTime: '07:30',
  breakTime: '11:00',
  lunchTime: '12:30',
  periods: [
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
  ],
};

/**
 * Secondary School Schedule (8:00 AM - 2:35 PM)
 * - Assembly: 8:00 AM - 8:15 AM
 * - Break: 10:30 AM - 11:00 AM
 * - Lunch: 12:30 PM - 1:15 PM
 */
export const SECONDARY_SCHEDULE: SchoolSchedule = {
  assemblyTime: '08:00',
  breakTime: '10:30',
  lunchTime: '12:30',
  periods: [
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
  ],
};

/**
 * University Schedule (8:00 AM - 4:00 PM)
 * - No assembly (varies by institution)
 * - Break: 10:30 AM - 11:00 AM
 * - Lunch: 1:00 PM - 2:00 PM
 */
export const UNIVERSITY_SCHEDULE: SchoolSchedule = {
  breakTime: '10:30',
  lunchTime: '13:00',
  periods: [
    { startTime: '08:00', endTime: '09:00', type: 'LESSON', label: 'Period 1' },
    { startTime: '09:00', endTime: '10:00', type: 'LESSON', label: 'Period 2' },
    { startTime: '10:00', endTime: '10:30', type: 'LESSON', label: 'Period 3' },
    { startTime: '10:30', endTime: '11:00', type: 'BREAK', label: 'Break' },
    { startTime: '11:00', endTime: '12:00', type: 'LESSON', label: 'Period 4' },
    { startTime: '12:00', endTime: '13:00', type: 'LESSON', label: 'Period 5' },
    { startTime: '13:00', endTime: '14:00', type: 'LUNCH', label: 'Lunch' },
    { startTime: '14:00', endTime: '15:00', type: 'LESSON', label: 'Period 6' },
    { startTime: '15:00', endTime: '16:00', type: 'LESSON', label: 'Period 7' },
  ],
};

/**
 * Get schedule based on school type
 */
export function getScheduleForSchoolType(
  schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null
): SchoolSchedule {
  switch (schoolType) {
    case 'PRIMARY':
      return PRIMARY_SCHEDULE;
    case 'SECONDARY':
      return SECONDARY_SCHEDULE;
    case 'TERTIARY':
      return UNIVERSITY_SCHEDULE;
    default:
      return SECONDARY_SCHEDULE; // Default to secondary
  }
}

/**
 * Get only lesson periods (excluding breaks, lunch, assembly)
 */
export function getLessonPeriods(schedule: SchoolSchedule): SchedulePeriod[] {
  return schedule.periods.filter((p) => p.type === 'LESSON');
}

