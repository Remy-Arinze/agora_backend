import { useMemo, useCallback } from 'react';
import { getScheduleForSchoolType, type SchedulePeriod } from '@/lib/utils/nigerianSchoolSchedule';
import type { TimetablePeriod, DayOfWeek } from '@/lib/store/api/schoolAdminApi';

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

// Core subjects that should appear more frequently
const CORE_SUBJECTS = ['english', 'mathematics', 'math', 'basic science', 'science'];

interface Subject {
  id: string;
  name: string;
  code?: string;
}

interface GeneratedPeriod {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  subjectId?: string;
  subjectName?: string;
  courseId?: string;
  courseName?: string;
  type: 'LESSON' | 'BREAK' | 'LUNCH' | 'ASSEMBLY';
}

interface UseAutoGenerateTimetableOptions {
  schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
  subjects: Subject[];
  courses?: Subject[];
  existingPeriods: TimetablePeriod[];
  maxSameSubjectPerDay?: number; // Default: 2
  freePeriodsPerDay?: number; // Default: 1-2
}

interface UseAutoGenerateTimetableReturn {
  generateTimetable: () => GeneratedPeriod[];
  canGenerate: boolean;
  schedule: SchedulePeriod[];
}

/**
 * Hook for auto-generating timetable with smart subject distribution
 * - Respects existing assignments (slots with actual subjects)
 * - Adds breaks/assembly if missing
 * - Distributes subjects randomly with weighting for core subjects
 * - Includes free periods
 */
export function useAutoGenerateTimetable({
  schoolType,
  subjects,
  courses = [],
  existingPeriods,
  maxSameSubjectPerDay = 2,
  freePeriodsPerDay = 1,
}: UseAutoGenerateTimetableOptions): UseAutoGenerateTimetableReturn {
  
  const schedule = useMemo(() => getScheduleForSchoolType(schoolType), [schoolType]);
  
  const items = useMemo(() => {
    return schoolType === 'TERTIARY' ? courses : subjects;
  }, [schoolType, subjects, courses]);

  // Can generate if we have subjects/courses available
  const canGenerate = items.length > 0;

  const generateTimetable = useCallback((): GeneratedPeriod[] => {
    const result: GeneratedPeriod[] = [];
    
    // Check if timetable already has periods (not empty)
    const hasExistingTimetable = existingPeriods.length > 0;
    
    // Convert existing periods to our format
    existingPeriods.forEach((p) => {
      result.push({
        dayOfWeek: p.dayOfWeek,
        startTime: p.startTime,
        endTime: p.endTime,
        subjectId: p.subjectId || undefined,
        subjectName: p.subjectName || undefined,
        courseId: p.courseId || undefined,
        courseName: p.courseName || undefined,
        type: (p.type as 'LESSON' | 'BREAK' | 'LUNCH' | 'ASSEMBLY') || 'LESSON',
      });
    });
    
    // Helper to check if a slot has an actual subject assigned
    const hasSubjectAssigned = (day: DayOfWeek, startTime: string, endTime: string): boolean => {
      return result.some(
        (p) => p.dayOfWeek === day && 
               p.startTime === startTime && 
               p.endTime === endTime &&
               (p.subjectId || p.courseId)
      );
    };

    // Helper to check if a period exists at this time slot
    const hasPeriodAtTime = (day: DayOfWeek, startTime: string, endTime: string): boolean => {
      return result.some(
        (p) => p.dayOfWeek === day && 
               p.startTime === startTime && 
               p.endTime === endTime
      );
    };

    // Helper to check if a break/lunch/assembly already exists at this time
    const hasBreakAtTime = (startTime: string, endTime: string): boolean => {
      return result.some(
        (p) => p.startTime === startTime && 
               p.endTime === endTime && 
               (p.type === 'BREAK' || p.type === 'LUNCH' || p.type === 'ASSEMBLY')
      );
    };

    // Helper to count subject occurrences per day
    const countSubjectOnDay = (day: DayOfWeek, subjectId: string): number => {
      return result.filter(
        (p) => p.dayOfWeek === day && 
        (p.subjectId === subjectId || p.courseId === subjectId)
      ).length;
    };

    // Helper to get the previous period's subject for a day
    const getPreviousSubject = (day: DayOfWeek, startTime: string): string | undefined => {
      const sortedPeriods = result
        .filter((p) => p.dayOfWeek === day && p.type === 'LESSON' && (p.subjectId || p.courseId))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      // Find periods before this start time
      const previousPeriods = sortedPeriods.filter((p) => p.startTime < startTime);
      if (previousPeriods.length > 0) {
        const prev = previousPeriods[previousPeriods.length - 1];
        return prev.subjectId || prev.courseId;
      }
      return undefined;
    };

    // Step 1: Only add breaks/assembly from schedule if timetable is EMPTY
    // If timetable already exists, respect its structure
    if (!hasExistingTimetable) {
      schedule.periods.forEach((period) => {
        if (period.type !== 'LESSON') {
          // Add break/lunch/assembly for all days
          DAYS.forEach((day) => {
            result.push({
              dayOfWeek: day,
              startTime: period.startTime,
              endTime: period.endTime,
              type: period.type,
            });
          });
        }
      });
    }

    // Step 2: Get lesson periods - either from existing timetable or schedule template
    // Get unique lesson time slots from existing periods
    const existingLessonSlots = new Map<string, { startTime: string; endTime: string }>();
    existingPeriods
      .filter((p) => p.type === 'LESSON' || !p.type)
      .forEach((p) => {
        const key = `${p.startTime}-${p.endTime}`;
        if (!existingLessonSlots.has(key)) {
          existingLessonSlots.set(key, { startTime: p.startTime, endTime: p.endTime });
        }
      });
    
    // Use existing slots if timetable exists, otherwise use schedule template
    const lessonPeriods = hasExistingTimetable 
      ? Array.from(existingLessonSlots.values()).sort((a, b) => a.startTime.localeCompare(b.startTime))
      : schedule.periods.filter((p) => p.type === 'LESSON');

    // Step 3: Create weighted subject pool (without free periods initially)
    const createWeightedPool = (): { id: string; name: string }[] => {
      const pool: { id: string; name: string }[] = [];
      
      if (items.length === 0) {
        console.warn('No subjects/courses available for auto-generation');
        return pool;
      }
      
      items.forEach((item) => {
        const isCore = CORE_SUBJECTS.some((core) => 
          item.name.toLowerCase().includes(core)
        );
        // Core subjects get 3x weight, others get 2x
        const weight = isCore ? 3 : 2;
        for (let i = 0; i < weight; i++) {
          pool.push({ id: item.id, name: item.name });
        }
      });
      
      return pool;
    };

    // Helper to update an existing period in result
    const updatePeriodInResult = (day: DayOfWeek, startTime: string, endTime: string, updates: Partial<GeneratedPeriod>) => {
      const index = result.findIndex(
        (p) => p.dayOfWeek === day && p.startTime === startTime && p.endTime === endTime
      );
      if (index !== -1) {
        result[index] = { ...result[index], ...updates };
        return true;
      }
      return false;
    };

    // Step 4: Fill empty lesson slots
    DAYS.forEach((day) => {
      let freePeriodsAddedToday = 0;
      const maxFreeToday = freePeriodsPerDay + (Math.random() > 0.5 ? 1 : 0); // 1-2 free periods
      const totalLessonsToday = lessonPeriods.length;
      
      lessonPeriods.forEach((period, periodIndex) => {
        // Skip if slot already has an actual subject assigned
        if (hasSubjectAssigned(day, period.startTime, period.endTime)) {
          return;
        }

        // Check if period exists but has no subject (for existing timetables)
        const periodExists = hasPeriodAtTime(day, period.startTime, period.endTime);

        // Create fresh pool for each slot selection
        const pool = createWeightedPool();
        
        if (pool.length === 0) {
          // No subjects available - leave as is or mark as free period
          if (!periodExists) {
            result.push({
              dayOfWeek: day,
              startTime: period.startTime,
              endTime: period.endTime,
              type: 'LESSON',
              subjectName: 'Free Period',
            });
          }
          return;
        }
        
        // Shuffle pool
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        // Decide if this should be a free period
        // Spread free periods throughout the day
        const shouldBeFree = freePeriodsAddedToday < maxFreeToday && 
                            Math.random() < (maxFreeToday / (totalLessonsToday - periodIndex));

        if (shouldBeFree) {
          freePeriodsAddedToday++;
          // For existing periods, just leave them as-is (free)
          // For new timetables, add the period
          if (!periodExists) {
            result.push({
              dayOfWeek: day,
              startTime: period.startTime,
              endTime: period.endTime,
              type: 'LESSON',
              subjectName: 'Free Period',
            });
          }
          return;
        }

        // Find a suitable subject
        let selected: { id: string; name: string } | undefined;
        const previousSubject = getPreviousSubject(day, period.startTime);

        for (const candidate of pool) {
          // Skip if it's the same as previous period (avoid back-to-back)
          if (candidate.id === previousSubject) {
            continue;
          }

          // Skip if we've already used this subject max times today
          if (countSubjectOnDay(day, candidate.id) >= maxSameSubjectPerDay) {
            continue;
          }

          selected = candidate;
          break;
        }

        // Fallback: if no suitable subject found, pick any from pool
        if (!selected && pool.length > 0) {
          selected = pool[0];
        }

        // Update or add the period
        if (selected) {
          const isTertiary = schoolType === 'TERTIARY';
          const periodData = {
            type: 'LESSON' as const,
            subjectId: !isTertiary ? selected.id : undefined,
            subjectName: !isTertiary ? selected.name : undefined,
            courseId: isTertiary ? selected.id : undefined,
            courseName: isTertiary ? selected.name : undefined,
          };
          
          if (periodExists) {
            // Update existing period
            updatePeriodInResult(day, period.startTime, period.endTime, periodData);
          } else {
            // Add new period
            result.push({
              dayOfWeek: day,
              startTime: period.startTime,
              endTime: period.endTime,
              ...periodData,
            });
          }
        } else if (!periodExists) {
          // No subjects available, add as free period (only for new timetables)
          result.push({
            dayOfWeek: day,
            startTime: period.startTime,
            endTime: period.endTime,
            type: 'LESSON',
            subjectName: 'Free Period',
          });
        }
      });
    });

    // Sort result by day and time for consistency
    return result.sort((a, b) => {
      const dayOrder = DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek);
      if (dayOrder !== 0) return dayOrder;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [schedule, items, schoolType, existingPeriods, maxSameSubjectPerDay, freePeriodsPerDay]);

  return {
    generateTimetable,
    canGenerate,
    schedule: schedule.periods,
  };
}
