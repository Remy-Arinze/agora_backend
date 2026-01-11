'use client';

import { useMemo } from 'react';
import {
  useGetMyTeacherSchoolQuery,
  useGetMyTeacherProfileQuery,
  useGetActiveSessionQuery,
  useGetTimetableForTeacherQuery,
  useGetMyClassesQuery,
  TimetablePeriod,
} from '@/lib/store/api/schoolAdminApi';

export type TeacherSchoolType = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;

export interface TeacherDashboardData {
  // Core data
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  school: {
    id: string;
    name: string;
    hasPrimary: boolean;
    hasSecondary: boolean;
    hasTertiary: boolean;
  } | null;
  
  // Derived school type (from teacher's actual class assignments, not localStorage)
  schoolType: TeacherSchoolType;
  
  // Session data
  activeSession: {
    id: string;
    name: string;
  } | null;
  activeTerm: {
    id: string;
    name: string;
  } | null;
  
  // Timetable data
  timetable: TimetablePeriod[];
  
  // Classes the teacher is assigned to (full data from API)
  classes: any[];
  
  // Loading states
  isLoading: boolean;
  isLoadingTimetable: boolean;
  isLoadingClasses: boolean;
  
  // Error states
  hasError: boolean;
  errorMessage: string | null;
  
  // Ready state - all essential data is loaded
  isReady: boolean;
}

/**
 * Unified hook for teacher dashboard data
 * 
 * This hook:
 * 1. Fetches teacher and school data
 * 2. DERIVES school type from teacher's actual class assignments (not localStorage)
 * 3. Fetches the correct active session for that school type
 * 4. Fetches timetable and classes with correct parameters
 * 
 * Benefits:
 * - Single source of truth for all teacher dashboard data
 * - Correct loading sequence (no race conditions)
 * - School type is derived from actual data, not stale localStorage
 * - Clean, predictable state for UI components
 */
export function useTeacherDashboard(): TeacherDashboardData {
  // Step 1: Fetch teacher's school
  const { 
    data: schoolResponse, 
    isLoading: isLoadingSchool,
    error: schoolError 
  } = useGetMyTeacherSchoolQuery();
  
  // Step 2: Fetch teacher's profile
  const { 
    data: teacherResponse, 
    isLoading: isLoadingTeacher,
    error: teacherError 
  } = useGetMyTeacherProfileQuery();
  
  const school = schoolResponse?.data || null;
  const teacher = teacherResponse?.data || null;
  const schoolId = school?.id;
  const teacherId = teacher?.id;
  
  // Step 3: First, fetch classes WITHOUT filtering by type
  // This is crucial - we need to know what classes the teacher is assigned to
  // BEFORE we can determine their school type
  const { 
    data: classesResponse, 
    isLoading: isLoadingClasses,
    error: classesError 
  } = useGetMyClassesQuery(
    {
      schoolId: schoolId || '',
      teacherId: teacherId || '',
      // Don't filter by type - we need ALL classes to determine the teacher's school type
    },
    { skip: !schoolId || !teacherId }
  );
  
  const classes = classesResponse?.data || [];
  
  // Step 4: Determine school type from teacher's ACTUAL class assignments
  // This is the correct approach - derive type from what the teacher actually teaches
  const derivedSchoolType = useMemo((): TeacherSchoolType => {
    // First priority: Check teacher's actual class assignments
    if (classes.length > 0) {
      const classTypes = new Set(classes.map(c => c.type));
      
      // If all classes are the same type, use that
      if (classTypes.size === 1) {
        const type = classes[0].type;
        if (type === 'PRIMARY' || type === 'SECONDARY' || type === 'TERTIARY') {
          return type;
        }
      }
      
      // If mixed classes, prefer in order: PRIMARY > SECONDARY > TERTIARY
      // (Teachers usually have a "primary" assignment)
      if (classTypes.has('PRIMARY')) return 'PRIMARY';
      if (classTypes.has('SECONDARY')) return 'SECONDARY';
      if (classTypes.has('TERTIARY')) return 'TERTIARY';
    }
    
    // Fallback: Use school's available types (only if we don't have class data yet)
    if (!school) return null;
    
    const types: TeacherSchoolType[] = [];
    if (school.hasPrimary) types.push('PRIMARY');
    if (school.hasSecondary) types.push('SECONDARY');
    if (school.hasTertiary) types.push('TERTIARY');
    
    // If only one type, use it
    if (types.length === 1) {
      return types[0];
    }
    
    // For mixed schools without class data, return null and wait
    // This will cause the session query to skip until we have class data
    return null;
  }, [school, classes]);
  
  // Step 5: Fetch active session with the derived school type
  // Skip if we don't have a school type yet (waiting for classes to load)
  const { 
    data: sessionResponse, 
    isLoading: isLoadingSession,
    error: sessionError 
  } = useGetActiveSessionQuery(
    { 
      schoolId: schoolId!, 
      schoolType: derivedSchoolType || undefined 
    },
    { skip: !schoolId || !derivedSchoolType }
  );
  
  const activeSession = sessionResponse?.data?.session || null;
  const activeTerm = sessionResponse?.data?.term || null;
  const termId = activeTerm?.id || '';
  
  // Step 6: Fetch timetable
  const { 
    data: timetableResponse, 
    isLoading: isLoadingTimetable,
    error: timetableError 
  } = useGetTimetableForTeacherQuery(
    {
      schoolId: schoolId!,
      teacherId: teacherId!,
      termId: termId,
    },
    { skip: !schoolId || !teacherId || !termId }
  );
  
  const timetable = timetableResponse?.data || [];
  
  // Use derivedSchoolType directly (no need for refinedSchoolType anymore)
  const refinedSchoolType = derivedSchoolType;
  
  // Aggregate loading and error states
  const isLoading = isLoadingSchool || isLoadingTeacher || isLoadingSession;
  const hasError = !!(schoolError || teacherError || sessionError || timetableError || classesError);
  const errorMessage = hasError 
    ? 'Failed to load dashboard data. Please try refreshing.'
    : null;
  
  // Ready when we have essential data
  const isReady = !isLoading && !!school && !!teacher && !!activeTerm;
  
  return {
    teacher: teacher ? {
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
    } : null,
    school: school ? {
      id: school.id,
      name: school.name,
      hasPrimary: school.hasPrimary,
      hasSecondary: school.hasSecondary,
      hasTertiary: school.hasTertiary,
    } : null,
    schoolType: refinedSchoolType,
    activeSession: activeSession ? {
      id: activeSession.id,
      name: activeSession.name,
    } : null,
    activeTerm: activeTerm ? {
      id: activeTerm.id,
      name: activeTerm.name,
    } : null,
    timetable,
    classes,
    isLoading,
    isLoadingTimetable,
    isLoadingClasses,
    hasError,
    errorMessage,
    isReady,
  };
}

/**
 * Helper to get today's schedule from timetable
 */
export function getTodaySchedule(timetable: TimetablePeriod[]): TimetablePeriod[] {
  const dayMap: Record<number, string> = {
    0: 'SUNDAY',
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: 'SATURDAY',
  };
  const today = dayMap[new Date().getDay()];
  
  return timetable
    .filter((p) => p.dayOfWeek === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Helper to get weekly schedule grouped by day
 */
export function getWeeklySchedule(timetable: TimetablePeriod[]): Record<string, TimetablePeriod[]> {
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const byDay: Record<string, TimetablePeriod[]> = {};
  
  days.forEach((day) => {
    byDay[day] = timetable
      .filter((p) => p.dayOfWeek === day && p.type === 'LESSON')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  });
  
  return byDay;
}

/**
 * Helper to find current and upcoming periods
 */
export function getCurrentAndUpcomingPeriods(
  todaySchedule: TimetablePeriod[],
  currentTime: string = new Date().toTimeString().slice(0, 5)
): {
  currentPeriod: TimetablePeriod | null;
  upcomingPeriods: TimetablePeriod[];
} {
  const currentPeriod = todaySchedule.find(
    (p) => p.startTime <= currentTime && p.endTime > currentTime
  ) || null;
  
  const upcomingPeriods = todaySchedule
    .filter((p) => p.startTime > currentTime)
    .slice(0, 3);
  
  return { currentPeriod, upcomingPeriods };
}

