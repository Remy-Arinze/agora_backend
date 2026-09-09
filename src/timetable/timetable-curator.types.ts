export type CuratorSchoolType = 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
export type CuratorDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';
export type CuratorPeriodType = 'LESSON' | 'BREAK' | 'LUNCH' | 'ASSEMBLY';
export type CuratorApplyMode = 'FILL_EMPTY' | 'REPLACE';
export type CuratorWorkloadStatus = 'LOW' | 'NORMAL' | 'HIGH' | 'OVERLOADED';

export type CuratorSchedulePeriod = {
  startTime: string;
  endTime: string;
  type: CuratorPeriodType;
  label?: string;
};

export type CuratorTeacher = {
  id: string;
  firstName: string;
  lastName: string;
  periodCount?: number;
};

export type CuratorSubject = {
  id: string;
  name: string;
  code?: string;
  teachers?: CuratorTeacher[];
  /** Optional scheme-informed frequency weight (defaults to core 3 / other 2). */
  weight?: number;
};

export type CuratorExistingPeriod = {
  dayOfWeek: CuratorDay;
  startTime: string;
  endTime: string;
  type?: string;
  subjectId?: string | null;
  subjectName?: string | null;
  courseId?: string | null;
  courseName?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
};

export type CuratorGeneratedPeriod = {
  dayOfWeek: CuratorDay;
  startTime: string;
  endTime: string;
  type: CuratorPeriodType;
  subjectId?: string;
  subjectName?: string;
  courseId?: string;
  courseName?: string;
  teacherId?: string;
  teacherName?: string;
  hasTeacherWarning?: boolean;
  warningMessage?: string;
};

export type CuratorTeacherAssignment = {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  periodCount: number;
  totalLoad: number;
  status: CuratorWorkloadStatus;
};

export type CuratorAnalysis = {
  totalPeriods: number;
  assignedWithTeacher: number;
  unassignedTeacher: number;
  freePeriods: number;
  subjectsUsed: number;
  teachersInvolved: number;
  teacherAssignments: CuratorTeacherAssignment[];
  subjectsWithoutTeachers: Array<{ id: string; name: string; periodCount: number }>;
  warnings: string[];
};

export type CuratorSolveInput = {
  schoolType: CuratorSchoolType;
  subjects: CuratorSubject[];
  existingPeriods: CuratorExistingPeriod[];
  schedule: CuratorSchedulePeriod[];
  workingDays: CuratorDay[];
  maxSameSubjectPerDay?: number;
  freePeriodsPerDay?: number;
  maxPeriodsPerTeacherPerDay?: number;
  primaryClassTeacher?: CuratorTeacher | null;
  random?: () => number;
};

export const CURATOR_WORKLOAD_THRESHOLDS = {
  LOW: 10,
  NORMAL: 25,
  HIGH: 30,
};

export const CURATOR_CORE_SUBJECTS = [
  'english',
  'mathematics',
  'math',
  'basic science',
  'science',
];
