import type { SchoolType } from '@/lib/store/api/schoolAdminApi';

export interface Terminology {
  staff: string; // Teachers or Lecturers
  staffSingular: string; // Teacher or Lecturer
  courses: string; // Classes or Courses
  courseSingular: string; // Class or Course
  periods: string; // Terms or Semesters
  periodSingular: string; // Term or Semester
  subjects: string; // Subjects or Courses
  subjectSingular: string; // Subject or Course
}

/**
 * Get terminology based on school type
 * Tertiary schools use university terminology, Primary/Secondary use school terminology
 */
export function getTerminology(schoolType: SchoolType | 'MIXED' | null): Terminology {
  const isTertiary = schoolType === 'TERTIARY';

  if (isTertiary) {
    return {
      staff: 'Lecturers',
      staffSingular: 'Lecturer',
      courses: 'Courses',
      courseSingular: 'Course',
      periods: 'Semesters',
      periodSingular: 'Semester',
      subjects: 'Courses',
      subjectSingular: 'Course',
    };
  }

  // Primary and Secondary use same terminology
  return {
    staff: 'Teachers',
    staffSingular: 'Teacher',
    courses: 'Classes',
    courseSingular: 'Class',
    periods: 'Terms',
    periodSingular: 'Term',
    subjects: 'Subjects',
    subjectSingular: 'Subject',
  };
}

/**
 * Get display name for school type
 */
export function getSchoolTypeDisplayName(type: SchoolType): string {
  const names: Record<SchoolType, string> = {
    PRIMARY: 'Primary',
    SECONDARY: 'Secondary',
    TERTIARY: 'Tertiary',
  };
  return names[type] || type;
}

