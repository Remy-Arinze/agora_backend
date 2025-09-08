'use client';

import { useMemo } from 'react';
import {
  useGetMyStudentProfileQuery,
  useGetMyStudentEnrollmentsQuery,
  useGetMyStudentClassesQuery,
  useGetMyStudentTimetableQuery,
  useGetMyStudentGradesQuery,
  useGetActiveSessionQuery,
  TimetablePeriod,
} from '@/lib/store/api/schoolAdminApi';

export type StudentSchoolType = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;

interface Enrollment {
  id: string;
  isActive: boolean;
  classLevel?: string;
  school?: {
    id: string;
    name: string;
    hasPrimary?: boolean;
    hasSecondary?: boolean;
    hasTertiary?: boolean;
  };
  classArm?: {
    id: string;
    name: string;
    classLevel?: {
      name: string;
      type: string;
    };
  };
  class?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface ClassData {
  id: string;
  name: string;
  type?: string;
  code?: string | null;
  classLevel?: string;
  classLevelId?: string;
  academicYear?: string;
  description?: string | null;
  classArmId?: string;
  classArm?: {
    id: string;
    name: string;
    classLevel?: {
      name: string;
      type: string;
    };
  };
  enrollment?: {
    enrollmentDate: string;
  };
  resources?: Array<{
    id: string;
    name: string;
    description?: string;
    url?: string;
  }>;
  teachers?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    subject?: string;
    isPrimary?: boolean;
    profileImage?: string | null;
  }>;
}

export interface StudentDashboardData {
  // Core data
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    studentId?: string;
  } | null;
  
  // School data (from active enrollment)
  school: {
    id: string;
    name: string;
  } | null;
  
  // Derived school type (from student's enrollment, not localStorage)
  schoolType: StudentSchoolType;
  
  // Enrollments
  enrollments: Enrollment[];
  activeEnrollment: Enrollment | null;
  
  // Class data
  classes: ClassData[];
  activeClass: ClassData | null;
  
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
  
  // Grades data
  grades: any[];
  publishedGrades: any[];
  
  // Stats (computed)
  stats: {
    averageScore: number;
    totalGrades: number;
    recentGradesCount: number;
    activeClassesCount: number;
  };
  
  // Loading states
  isLoading: boolean;
  isLoadingTimetable: boolean;
  isLoadingGrades: boolean;
  
  // Error states
  hasError: boolean;
  errorMessage: string | null;
  
  // Ready state - all essential data is loaded
  isReady: boolean;
}

/**
 * Unified hook for student dashboard data
 * 
 * This hook:
 * 1. Fetches student profile and enrollments
 * 2. DERIVES school type from student's actual enrollment (not localStorage)
 * 3. Fetches the correct active session for that school type
 * 4. Fetches timetable and grades with correct parameters
 * 
 * Benefits:
 * - Single source of truth for all student dashboard data
 * - Correct loading sequence (no race conditions)
 * - School type is derived from actual enrollment data, not stale localStorage
 * - Clean, predictable state for UI components
 */
export function useStudentDashboard(): StudentDashboardData {
  // Step 1: Fetch student profile
  const { 
    data: profileResponse, 
    isLoading: isLoadingProfile,
    error: profileError 
  } = useGetMyStudentProfileQuery();
  
  // Step 2: Fetch student enrollments
  const { 
    data: enrollmentsResponse, 
    isLoading: isLoadingEnrollments,
    error: enrollmentsError 
  } = useGetMyStudentEnrollmentsQuery();
  
  // Step 3: Fetch student's classes
  const { 
    data: classesResponse, 
    isLoading: isLoadingClasses,
    error: classesError 
  } = useGetMyStudentClassesQuery();
  
  const student = profileResponse?.data || null;
  const enrollments = (enrollmentsResponse?.data || []) as Enrollment[];
  const classes = (classesResponse?.data || []) as ClassData[];
  
  // Find active enrollment
  const activeEnrollment = useMemo((): Enrollment | null => {
    return enrollments.find((e) => e.isActive) || enrollments[0] || null;
  }, [enrollments]);
  
  // Find active class
  const activeClass = useMemo((): ClassData | null => {
    return classes[0] || null;
  }, [classes]);
  
  // Get school from active enrollment
  const school = useMemo(() => {
    if (!activeEnrollment?.school) return null;
    return {
      id: activeEnrollment.school.id,
      name: activeEnrollment.school.name,
    };
  }, [activeEnrollment]);
  
  const schoolId = school?.id;
  
  // Step 4: Derive school type from enrollment data (NOT localStorage)
  const derivedSchoolType = useMemo((): StudentSchoolType => {
    // First priority: Check active class type
    if (activeClass?.type) {
      const type = activeClass.type;
      if (type === 'PRIMARY' || type === 'SECONDARY' || type === 'TERTIARY') {
        return type;
      }
    }
    
    // Second priority: Check classArm's classLevel type
    if (activeClass?.classArm?.classLevel?.type) {
      const type = activeClass.classArm.classLevel.type;
      if (type === 'PRIMARY' || type === 'SECONDARY' || type === 'TERTIARY') {
        return type;
      }
    }
    
    // Third priority: Check active enrollment's classArm
    if (activeEnrollment?.classArm?.classLevel?.type) {
      const type = activeEnrollment.classArm.classLevel.type;
      if (type === 'PRIMARY' || type === 'SECONDARY' || type === 'TERTIARY') {
        return type;
      }
    }
    
    // Fourth priority: Check active enrollment's class
    if (activeEnrollment?.class?.type) {
      const type = activeEnrollment.class.type;
      if (type === 'PRIMARY' || type === 'SECONDARY' || type === 'TERTIARY') {
        return type;
      }
    }
    
    // Fallback: Use school's primary type if only one type
    if (activeEnrollment?.school) {
      const school = activeEnrollment.school;
      const types: StudentSchoolType[] = [];
      if (school.hasPrimary) types.push('PRIMARY');
      if (school.hasSecondary) types.push('SECONDARY');
      if (school.hasTertiary) types.push('TERTIARY');
      
      if (types.length === 1) {
        return types[0];
      }
    }
    
    return null;
  }, [activeClass, activeEnrollment]);
  
  // Step 5: Fetch active session
  // Pass schoolType if available for correct session, but don't block on it
  // Backend now handles schoolType derivation as fallback
  const { 
    data: sessionResponse, 
    isLoading: isLoadingSession,
    error: sessionError 
  } = useGetActiveSessionQuery(
    { 
      schoolId: schoolId!, 
      schoolType: derivedSchoolType || undefined 
    },
    { skip: !schoolId }
  );
  
  const activeSession = sessionResponse?.data?.session || null;
  const activeTerm = sessionResponse?.data?.term || null;
  const termId = activeTerm?.id;
  
  // Step 6: Fetch timetable
  const { 
    data: timetableResponse, 
    isLoading: isLoadingTimetable,
    error: timetableError 
  } = useGetMyStudentTimetableQuery(
    { termId },
    { skip: !termId || !activeClass }
  );
  
  const timetable = (timetableResponse?.data || []) as TimetablePeriod[];
  
  // Step 7: Fetch grades
  const { 
    data: gradesResponse, 
    isLoading: isLoadingGrades,
    error: gradesError 
  } = useGetMyStudentGradesQuery(
    { termId },
    { skip: !termId }
  );
  
  const grades = gradesResponse?.data || [];
  
  // Filter to only published grades
  const publishedGrades = useMemo(() => {
    return grades.filter((g: any) => g.isPublished !== false);
  }, [grades]);
  
  // Calculate stats
  const stats = useMemo(() => {
    let totalScore = 0;
    let totalMaxScore = 0;
    publishedGrades.forEach((grade: any) => {
      totalScore += grade.score || 0;
      totalMaxScore += grade.maxScore || 0;
    });
    const averageScore = totalMaxScore > 0 
      ? Math.round((totalScore / totalMaxScore) * 100) 
      : 0;
    
    // Count recent grades (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentGrades = publishedGrades.filter((g: any) => {
      const date = new Date(g.updatedAt || g.createdAt);
      return date >= sevenDaysAgo;
    });
    
    // Count active enrollments
    const activeClassesCount = enrollments.filter((e) => e.isActive).length;
    
    return {
      averageScore,
      totalGrades: publishedGrades.length,
      recentGradesCount: recentGrades.length,
      activeClassesCount,
    };
  }, [publishedGrades, enrollments]);
  
  // Aggregate loading and error states
  const isLoading = isLoadingProfile || isLoadingEnrollments || isLoadingClasses || isLoadingSession;
  const hasError = !!(profileError || enrollmentsError || classesError || sessionError || timetableError || gradesError);
  const errorMessage = hasError 
    ? 'Failed to load dashboard data. Please try refreshing.'
    : null;
  
  // Ready when we have essential data
  const isReady = !isLoading && !!student && !!activeEnrollment;
  
  return {
    student: student ? {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      studentId: student.studentId,
    } : null,
    school,
    schoolType: derivedSchoolType,
    enrollments,
    activeEnrollment,
    classes,
    activeClass,
    activeSession: activeSession ? {
      id: activeSession.id,
      name: activeSession.name,
    } : null,
    activeTerm: activeTerm ? {
      id: activeTerm.id,
      name: activeTerm.name,
    } : null,
    timetable,
    grades,
    publishedGrades,
    stats,
    isLoading,
    isLoadingTimetable,
    isLoadingGrades,
    hasError,
    errorMessage,
    isReady,
  };
}

/**
 * Helper to get today's schedule from timetable
 */
export function getStudentTodaySchedule(timetable: TimetablePeriod[]): TimetablePeriod[] {
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
 * Helper to get terminology based on school type
 */
export function getStudentTerminology(schoolType: StudentSchoolType) {
  if (schoolType === 'TERTIARY') {
    return {
      courses: 'Courses',
      courseSingular: 'Course',
      staff: 'Lecturers',
      staffSingular: 'Lecturer',
      periods: 'Semesters',
      periodSingular: 'Semester',
      subjects: 'Courses',
      subjectSingular: 'Course',
      classLabel: 'Level',
    };
  }
  
  return {
    courses: 'Classes',
    courseSingular: 'Class',
    staff: 'Teachers',
    staffSingular: 'Teacher',
    periods: 'Terms',
    periodSingular: 'Term',
    subjects: 'Subjects',
    subjectSingular: 'Subject',
    classLabel: 'Class',
  };
}

/**
 * Lightweight hook for student school type
 * Use this when you only need school type and basic data, not full dashboard
 */
export function useStudentSchoolType(): {
  schoolType: StudentSchoolType;
  schoolId: string | undefined;
  isLoading: boolean;
} {
  const { 
    data: enrollmentsResponse, 
    isLoading: isLoadingEnrollments,
  } = useGetMyStudentEnrollmentsQuery();
  
  const { 
    data: classesResponse, 
    isLoading: isLoadingClasses,
  } = useGetMyStudentClassesQuery();
  
  const enrollments = (enrollmentsResponse?.data || []) as Enrollment[];
  const classes = (classesResponse?.data || []) as ClassData[];
  
  const activeEnrollment = useMemo((): Enrollment | null => {
    return enrollments.find((e) => e.isActive) || enrollments[0] || null;
  }, [enrollments]);
  
  const activeClass = useMemo((): ClassData | null => {
    return classes[0] || null;
  }, [classes]);
  
  const schoolId = activeEnrollment?.school?.id;
  
  const schoolType = useMemo((): StudentSchoolType => {
    // First priority: Check active class type
    if (activeClass?.type) {
      const type = activeClass.type;
      if (type === 'PRIMARY' || type === 'SECONDARY' || type === 'TERTIARY') {
        return type;
      }
    }
    
    // Second priority: Check classArm's classLevel type
    if (activeClass?.classArm?.classLevel?.type) {
      const type = activeClass.classArm.classLevel.type;
      if (type === 'PRIMARY' || type === 'SECONDARY' || type === 'TERTIARY') {
        return type;
      }
    }
    
    // Third priority: Check active enrollment's classArm
    if (activeEnrollment?.classArm?.classLevel?.type) {
      const type = activeEnrollment.classArm.classLevel.type;
      if (type === 'PRIMARY' || type === 'SECONDARY' || type === 'TERTIARY') {
        return type;
      }
    }
    
    // Fourth priority: Check active enrollment's class
    if (activeEnrollment?.class?.type) {
      const type = activeEnrollment.class.type;
      if (type === 'PRIMARY' || type === 'SECONDARY' || type === 'TERTIARY') {
        return type;
      }
    }
    
    // Fallback: Use school's primary type if only one type
    if (activeEnrollment?.school) {
      const school = activeEnrollment.school;
      const types: StudentSchoolType[] = [];
      if (school.hasPrimary) types.push('PRIMARY');
      if (school.hasSecondary) types.push('SECONDARY');
      if (school.hasTertiary) types.push('TERTIARY');
      
      if (types.length === 1) {
        return types[0];
      }
    }
    
    return null;
  }, [activeClass, activeEnrollment]);
  
  return {
    schoolType,
    schoolId,
    isLoading: isLoadingEnrollments || isLoadingClasses,
  };
}

