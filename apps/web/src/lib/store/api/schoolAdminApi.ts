import { apiSlice } from './apiSlice';
import type { School } from './schoolsApi';

// Dashboard types (matching backend DTOs)
export interface DashboardStats {
  totalStudents: number;
  studentsChange: number;
  totalTeachers: number;
  teachersChange: number;
  activeCourses: number;
  coursesChange: number;
  pendingAdmissions: number;
  pendingAdmissionsChange: number;
}

export interface GrowthTrendData {
  name: string;
  students: number;
  teachers: number;
  courses: number;
}

export interface WeeklyActivityData {
  name: string;
  admissions: number;
  transfers: number;
}

export interface RecentStudent {
  id: string;
  name: string;
  classLevel: string;
  admissionNumber: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface SchoolDashboard {
  stats: DashboardStats;
  growthTrends: GrowthTrendData[];
  weeklyActivity: WeeklyActivityData[];
  recentStudents: RecentStudent[];
}

// Staff list types
export type AccountStatus = 'SHADOW' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface StaffListItem {
  id: string;
  type: 'teacher' | 'admin';
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  role: string | null;
  subject: string | null;
  employeeId: string | null;
  isTemporary: boolean;
  status: 'active' | 'inactive';
  accountStatus: AccountStatus; // SHADOW=pending activation, ACTIVE=activated
  profileImage: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    accountStatus: AccountStatus;
  };
  userId?: string; // For backward compatibility
}

export interface StaffListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface StaffListResponse {
  items: StaffListItem[];
  meta: StaffListMeta;
  availableRoles: string[];
}

// Teacher Subject Types
export interface TeacherSubject {
  id: string;
  name: string;
  code?: string | null;
  schoolType?: string | null;
  classLevelId?: string | null;
  classLevelName?: string | null;
  assignedClassCount: number;
}

export interface TeacherWithSubjects {
  id: string;
  firstName: string;
  lastName: string;
  subjects: TeacherSubject[];
  totalAssignments: number;
}

export interface AssignableSubject {
  id: string;
  name: string;
  code?: string | null;
  alreadyAssigned: boolean;
}

export interface UpdateTeacherSubjectsDto {
  subjectIds: string[];
}

export interface AddTeacherSubjectDto {
  subjectId: string;
}

export enum PermissionResource {
  OVERVIEW = 'OVERVIEW',
  ANALYTICS = 'ANALYTICS',
  SUBSCRIPTIONS = 'SUBSCRIPTIONS',
  STUDENTS = 'STUDENTS',
  STAFF = 'STAFF',
  CLASSES = 'CLASSES',
  SUBJECTS = 'SUBJECTS',
  TIMETABLES = 'TIMETABLES',
  CALENDAR = 'CALENDAR',
  ADMISSIONS = 'ADMISSIONS',
  SESSIONS = 'SESSIONS',
  EVENTS = 'EVENTS',
  // New resources for complete coverage
  GRADES = 'GRADES',
  CURRICULUM = 'CURRICULUM',
  RESOURCES = 'RESOURCES',
  TRANSFERS = 'TRANSFERS',
  INTEGRATIONS = 'INTEGRATIONS',
}

export enum PermissionType {
  READ = 'READ',
  WRITE = 'WRITE',
  ADMIN = 'ADMIN',
}

export interface Permission {
  id: string;
  resource: PermissionResource;
  type: PermissionType;
  description?: string;
}

export interface StaffPermissions {
  adminId: string;
  adminName: string;
  role: string;
  permissions: Permission[];
}

export interface GetStaffListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  schoolType?: string;
}

export interface ResponseDto<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

// School type types
export type SchoolType = 'PRIMARY' | 'SECONDARY' | 'TERTIARY';

export interface SchoolTypeContext {
  hasPrimary: boolean;
  hasSecondary: boolean;
  hasTertiary: boolean;
  isMixed: boolean;
  availableTypes: SchoolType[];
  primaryType: SchoolType | 'MIXED';
}

// Teacher subjects response (for grading authorization)
export interface TeacherSubject {
  id: string;
  name: string;
  code: string | null;
  source: 'PRIMARY_CLASS_TEACHER' | 'CLASS_TEACHER_ASSIGNMENT' | 'LEGACY_CLASS_TEACHER' | 'TIMETABLE' | 'COURSE_ASSIGNMENT';
}

export interface TeacherSubjectsResponse {
  subjects: TeacherSubject[];
  schoolType: SchoolType;
  isPrimaryTeacher: boolean;
  canGradeAllSubjects: boolean;
}

// Class/Course types
export type ClassType = 'PRIMARY' | 'SECONDARY' | 'TERTIARY';

export interface ClassTeacher {
  id: string;
  teacherId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  subject: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface Class {
  id: string;
  name: string;
  code: string | null;
  classLevel: string | null;
  type: ClassType;
  academicYear: string;
  creditHours: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  teachers: ClassTeacher[];
  studentsCount: number;
  // Optional: Only present for ClassArm-based classes (PRIMARY/SECONDARY)
  classArmId?: string;
  classLevelId?: string;
}

export interface CreateClassDto {
  name: string;
  code?: string;
  classLevel?: string;
  type: ClassType;
  academicYear: string;
  creditHours?: number;
  description?: string;
}

export interface AssignTeacherToClassDto {
  teacherId: string;
  subject?: string;
  isPrimary?: boolean;
}

export interface ClassResource {
  id: string;
  name: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  description: string | null;
  classId: string;
  uploadedBy: string;
  uploadedByName?: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string;
}

export interface CreateClassResourceDto {
  description?: string;
}

// ============================================
// NERDC Curriculum Types
// ============================================

export interface NerdcSubject {
  id: string;
  name: string;
  code: string;
  category: string | null;
  schoolTypes: string[];
  description: string | null;
  isActive: boolean;
}

export interface NerdcCurriculumWeek {
  id: string;
  weekNumber: number;
  topic: string;
  subTopics: string[];
  objectives: string[];
  activities: string[];
  resources: string[];
  assessment: string | null;
  duration: string | null;
}

export interface NerdcCurriculum {
  id: string;
  classLevel: string;
  term: number;
  description: string | null;
  subject: NerdcSubject;
  weeks: NerdcCurriculumWeek[];
}

// ============================================
// Curriculum Item Types (Enhanced)
// ============================================

export type CurriculumStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED';
export type WeekStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface CurriculumItem {
  id: string;
  curriculumId: string;
  weekNumber: number;
  topic: string;
  subTopics: string[];
  objectives: string[];
  activities: string[];
  resources: string[];
  assessment: string | null;
  order: number;
  // Customization tracking
  isCustomized: boolean;
  originalTopic: string | null;
  // Progress tracking
  status: WeekStatus;
  taughtAt: string | null;
  teacherNotes: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Legacy
  week?: number;
}

// ============================================
// Curriculum Types (Enhanced)
// ============================================

export interface Curriculum {
  id: string;
  schoolId: string | null;
  classId: string | null;
  classLevelId: string | null;
  subjectId: string | null;
  subject: string | null;
  teacherId: string;
  teacherName?: string;
  academicYear: string;
  termId: string | null;
  termName?: string;
  // NERDC Integration
  nerdcCurriculumId: string | null;
  isNerdcBased: boolean;
  customizations: number;
  // Status & Approval
  status: CurriculumStatus;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: CurriculumItem[];
  // Computed stats
  totalWeeks?: number;
  completedWeeks?: number;
  progressPercentage?: number;
}

// ============================================
// Curriculum Summary Types
// ============================================

export interface CurriculumSummary {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  isRequired: boolean;
  curriculumId: string | null;
  status: CurriculumStatus | null;
  teacherId: string | null;
  teacherName: string | null;
  weeksTotal: number;
  weeksCompleted: number;
  isNerdcBased: boolean;
  periodsPerWeek: number;
  teachers?: { id: string; name: string }[];
}

export interface TimetableSubject {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  periodsPerWeek: number;
  teachers: { id: string; name: string }[];
}

// ============================================
// Curriculum DTOs
// ============================================

export interface CreateCurriculumItemDto {
  weekNumber: number;
  topic: string;
  subTopics?: string[];
  objectives: string[];
  activities?: string[];
  resources: string[];
  assessment?: string;
  order?: number;
  week?: number; // Legacy
}

export interface CreateCurriculumDto {
  classId: string;
  subjectId?: string;
  subject?: string;
  academicYear: string;
  termId: string;
  nerdcCurriculumId?: string;
  items: CreateCurriculumItemDto[];
}

export interface GenerateCurriculumDto {
  classLevelId: string;
  subjectId: string;
  termId: string;
  teacherId?: string;
}

export interface BulkGenerateCurriculumDto {
  classLevelId: string;
  termId: string;
  subjectIds: string[];
  teacherId: string;
}

export interface UpdateCurriculumDto {
  academicYear?: string;
  termId?: string;
  items?: CreateCurriculumItemDto[];
}

export type GradeType = 'CA' | 'ASSIGNMENT' | 'EXAM';

export interface Grade {
  id: string;
  enrollmentId: string;
  teacherId: string;
  subject: string;
  gradeType: GradeType;
  assessmentName: string | null;
  assessmentDate: string | null;
  sequence: number | null;
  score: number;
  maxScore: number;
  term: string;
  academicYear: string;
  remarks: string | null;
  isPublished: boolean;
  signedAt: string;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    uid: string;
    publicId?: string;
  };
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
    subject: string | null;
  };
  enrollment?: {
    id: string;
    classLevel: string;
    academicYear: string;
  };
}

export interface CreateGradeDto {
  enrollmentId: string;
  subjectId?: string; // NEW: Preferred - links to Subject entity
  subject?: string; // Legacy: Auto-populated if subjectId provided
  gradeType: GradeType;
  assessmentName?: string;
  assessmentDate?: string;
  sequence?: number;
  score: number;
  maxScore: number;
  termId?: string;
  academicYear?: string;
  remarks?: string;
  isPublished?: boolean;
}

export interface UpdateGradeDto {
  score?: number;
  maxScore?: number;
  subject?: string;
  assessmentName?: string;
  assessmentDate?: string;
  sequence?: number;
  remarks?: string;
  isPublished?: boolean;
}

export interface StudentGradeEntryDto {
  enrollmentId: string;
  score: number;
  remarks?: string;
}

export interface BulkGradeEntryDto {
  classId: string;
  subjectId?: string; // NEW: Preferred - links to Subject entity
  subject?: string; // Legacy: Auto-populated if subjectId provided
  gradeType: GradeType;
  assessmentName: string;
  assessmentDate?: string;
  sequence?: number;
  maxScore: number;
  termId?: string;
  academicYear?: string;
  isPublished?: boolean;
  grades: StudentGradeEntryDto[];
}

export interface AddStudentDto {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  phone: string;
  address?: string;
  classLevel?: string; // Optional if classArmId is provided
  classArmId?: string; // Optional for PRIMARY/SECONDARY schools using ClassArms
  academicYear?: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  parentRelationship: string;
  bloodGroup?: string;
  allergies?: string;
  medications?: string;
  emergencyContact?: string;
  emergencyContactPhone?: string;
  medicalNotes?: string;
}

export interface UpdateStudentDto {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  bloodGroup?: string;
  allergies?: string;
  medications?: string;
  emergencyContact?: string;
  emergencyContactPhone?: string;
  medicalNotes?: string;
}

export interface Student {
  id: string;
  uid: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  dateOfBirth: string;
  profileLocked: boolean;
  profileImage: string | null;
  createdAt: string;
  updatedAt: string;
  healthInfo?: {
    bloodGroup?: string;
    allergies?: string;
    medications?: string;
    emergencyContact?: string;
    emergencyContactPhone?: string;
    medicalNotes?: string;
  };
}

export interface StudentWithEnrollment extends Student {
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    accountStatus: 'SHADOW' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  };
  enrollment?: {
    id: string;
    classLevel: string;
    academicYear: string;
    enrollmentDate: string;
    school: {
      id: string;
      name: string;
      subdomain: string;
    };
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Session types
export type SessionType = 'NEW_SESSION' | 'NEW_TERM';
export type SessionStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type TermStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type PeriodType = 'LESSON' | 'BREAK' | 'ASSEMBLY' | 'LUNCH';

export interface Term {
  id: string;
  name: string;
  number: number;
  startDate: string;
  endDate: string;
  halfTermStart?: string;
  halfTermEnd?: string;
  status: TermStatus;
  academicSessionId: string;
  createdAt: string;
}

export interface AcademicSession {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SessionStatus;
  schoolId: string;
  schoolType?: string; // PRIMARY, SECONDARY, TERTIARY
  terms: Term[];
  createdAt: string;
}

export interface ActiveSession {
  session?: AcademicSession;
  term?: Term;
}

export interface InitializeSessionDto {
  name: string;
  startDate: string;
  endDate: string;
  type: SessionType;
  schoolType?: string; // PRIMARY, SECONDARY, TERTIARY
}

export interface CreateTermDto {
  name: string;
  number: string;
  startDate: string;
  endDate: string;
  halfTermStart?: string;
  halfTermEnd?: string;
}

export interface StartTermDto extends InitializeSessionDto {
  termId?: string;
}

export interface StartTermResponse {
  session: AcademicSession;
  term: Term;
  migratedCount: number;
}

export interface MigrateStudentsDto {
  termId: string;
  carryOver: boolean;
}

export interface TimetablePeriod {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  type: PeriodType;
  subjectId?: string;
  subjectName?: string;
  courseId?: string;
  courseName?: string;
  teacherId?: string;
  teacherName?: string;
  // Full teacher details for secondary school class detail pages
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    profileImage?: string | null;
  };
  roomId?: string;
  roomName?: string;
  classArmId?: string;
  classArmName?: string;
  classId?: string;
  className?: string;
  termId: string;
  createdAt: string;
  // Conflict detection fields (for TERTIARY merged timetables)
  hasConflict?: boolean;
  conflictMessage?: string;
  conflictingPeriodIds?: string[];
  // Course registration indicator (for TERTIARY carry-overs)
  isFromCourseRegistration?: boolean;
}

export interface CreateTimetablePeriodDto {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  type?: PeriodType;
  subjectId?: string | null;
  courseId?: string | null;
  teacherId?: string;
  roomId?: string;
  classId?: string;
  classArmId?: string;
  termId: string;
}

export interface CreateMasterScheduleDto {
  termId: string;
  periods: Array<{
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    type?: PeriodType;
  }>;
}

export interface ClassLevel {
  id: string;
  name: string;
  code?: string;
  level: number;
  type: string;
  schoolId: string;
  isActive: boolean;
  nextLevelId?: string;
}

export interface ClassArm {
  id: string;
  name: string;
  capacity?: number;
  classLevelId: string;
  classLevelName: string;
  isActive: boolean;
}

// Teacher with workload information
export interface TeacherWithWorkload {
  id: string;
  firstName: string;
  lastName: string;
  periodCount?: number;  // Periods assigned in current term
  classCount?: number;   // Unique classes teaching
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  schoolId: string;
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  classLevelId?: string;
  classLevelName?: string;
  classLevel?: {
    id: string;
    name: string;
  } | null;
  description?: string;
  isActive: boolean;
  teachers?: TeacherWithWorkload[];
}

// ============================================
// TEACHER WORKLOAD TYPES
// ============================================

export type WorkloadStatus = 'LOW' | 'NORMAL' | 'HIGH' | 'OVERLOADED';

export interface TeacherWorkload {
  teacherId: string;
  firstName: string;
  lastName: string;
  totalPeriods: number;
  classCount: number;
  subjectCount: number;
  periodsBySubject: Record<string, { name: string; count: number }>;
  periodsByClass: Record<string, { name: string; count: number }>;
  status: WorkloadStatus;
}

export interface WorkloadWarning {
  teacherId: string;
  teacherName: string;
  periodCount: number;
  status: string;
  message: string;
}

export interface UnassignedSubjectWarning {
  subjectId: string;
  subjectName: string;
  message: string;
}

export interface TeacherWorkloadSummary {
  teachers: TeacherWorkload[];
  averagePeriods: number;
  warnings: WorkloadWarning[];
  unassignedSubjects: UnassignedSubjectWarning[];
}

// Teacher's class assignments from timetable (for SECONDARY schools)
export interface TeacherTimetableClassSubject {
  subjectId: string;
  subjectName: string;
  periodCount: number;
}

export interface TeacherTimetableClassAssignment {
  classId: string;
  className: string;
  classLevel: string;
  subjects: TeacherTimetableClassSubject[];
  totalPeriods: number;
}

export interface TeacherTimetableClasses {
  classes: TeacherTimetableClassAssignment[];
  totalPeriods: number;
  totalClasses: number;
  totalSubjects: number;
}

// ============================================
// TIMETABLE GENERATION TYPES
// ============================================

export interface GeneratedPeriodWithTeacher {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  type: 'LESSON' | 'BREAK' | 'LUNCH' | 'ASSEMBLY';
  subjectId?: string;
  subjectName?: string;
  courseId?: string;
  courseName?: string;
  teacherId?: string;
  teacherName?: string;
  hasTeacherWarning?: boolean;
  warningMessage?: string;
}

export interface TimetableGenerationStats {
  totalPeriods: number;
  assignedPeriods: number;
  unassignedPeriods: number;
  subjectsUsed: number;
  teachersInvolved: number;
}

export interface SubjectWithoutTeacher {
  subjectId: string;
  subjectName: string;
  periodCount: number;
}

export interface TeacherAssignmentSummary {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  periodCount: number;
}

// Class-Subject-Teacher Assignment Types (for SECONDARY schools)
export interface SubjectClassAssignments {
  subjectId: string;
  subjectName: string;
  schoolType: string;
  classArms: Array<{
    id: string;
    name: string;
    classLevelId: string;
    classLevelName: string;
    fullName: string;
  }>;
  assignments: Record<string, {
    assignmentId: string;
    teacherId: string;
    teacherName: string;
  }>;
  competentTeachers: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
}

export interface ClassAssignmentEntry {
  classArmId: string;
  teacherId?: string;
}

export interface BulkClassSubjectAssignment {
  sessionId?: string;
  assignments: ClassAssignmentEntry[];
}

export interface CreateSubjectDto {
  name: string;
  code?: string;
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  classLevelId?: string;
  description?: string;
}

export interface UpdateSubjectDto {
  name?: string;
  code?: string;
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  classLevelId?: string;
  description?: string;
  isActive?: boolean;
}

export interface Room {
  id: string;
  name: string;
  code?: string;
  capacity?: number;
  roomType?: string;
  schoolId: string;
  isActive: boolean;
}

// Faculty & Department types (Tertiary)
export interface Faculty {
  id: string;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  schoolId: string;
  deanId?: string;
  deanName?: string;
  isActive: boolean;
  departmentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFacultyDto {
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  deanId?: string;
}

export interface UpdateFacultyDto {
  name?: string;
  code?: string;
  description?: string;
  imageUrl?: string;
  deanId?: string;
  isActive?: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  schoolId: string;
  facultyId?: string;
  facultyName?: string;
  isActive: boolean;
  levelsCount: number;
  studentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  facultyId: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  code?: string;
  description?: string;
  imageUrl?: string;
  facultyId?: string;
  isActive?: boolean;
}

export interface GenerateLevelsDto {
  levelCount?: number;
}

export interface DepartmentLevel {
  id: string;
  name: string;
  academicYear?: string;
  studentsCount: number;
  isActive: boolean;
  createdAt: string;
}

// Level Detail Types (Tertiary)
export interface LevelDetail {
  id: string;
  name: string;
  academicYear: string;
  isActive: boolean;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  facultyId?: string;
  facultyName?: string;
  studentsCount: number;
  coursesCount: number;
  createdAt: string;
}

export interface LevelStudent {
  id: string;
  uid: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  profileImage?: string;
  enrollmentId: string;
  enrollmentDate: string;
  classLevel: string;
  academicYear: string;
  user?: {
    id: string;
    email?: string;
    phone?: string;
    accountStatus: string;
  };
}

export interface LevelCourse {
  id: string;
  name: string;
  code?: string;
  description?: string;
  creditUnits?: number;
  isCore?: boolean;
  teachers: Array<{ id: string; name: string }>;
}

export interface LevelCurriculum {
  id: string;
  subject?: string;
  academicYear: string;
  teacher?: string;
  teacherId?: string;
  itemsCount: number;
  items: any[];
  createdAt: string;
}

export interface LevelResource {
  id: string;
  name: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  description?: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface CreateClassArmDto {
  name: string;
  capacity?: number;
  classLevelId: string;
}

export interface CreateSubjectDto {
  name: string;
  code?: string;
}

export interface CreateRoomDto {
  name: string;
  code?: string;
  capacity?: number;
  roomType?: string;
}

export type CalendarEventType = 'ACADEMIC' | 'EVENT' | 'EXAM' | 'MEETING' | 'HOLIDAY';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  type: CalendarEventType;
  location?: string;
  roomId?: string;
  roomName?: string;
  schoolId: string;
  createdBy?: string;
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventDto {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  type: CalendarEventType;
  location?: string;
  roomId?: string;
  isAllDay?: boolean;
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
}

// RTK Query endpoints for school admin
export const schoolAdminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get my school (for school admin)
    getMySchool: builder.query<ResponseDto<School>, void>({
      query: () => '/school-admin/school',
      providesTags: ['School'],
    }),
    uploadSchoolLogo: builder.mutation<ResponseDto<School>, { file: File }>({
      queryFn: async ({ file }, _api, _extraOptions, baseQuery) => {
        const state = _api.getState() as { auth: { accessToken?: string | null; token?: string | null } };
        const token = state.auth.accessToken || state.auth.token;

        if (!token) {
          return { error: { status: 'CUSTOM_ERROR', error: 'Not authenticated' } };
        }

        const formData = new FormData();
        formData.append('logo', file);

        // Get base URL - use the same as apiSlice
        const baseUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000/api';

        try {
          const response = await fetch(`${baseUrl}/school-admin/school/logo`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              // Don't set Content-Type - let browser set it with boundary for FormData
            },
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Upload failed' }));
            return { error: { status: response.status, data: error } };
          }

          const data = await response.json();
          return { data };
        } catch (error: any) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['School'],
    }),
    // Update my school information (for school admins to update their own school)
    updateMySchool: builder.mutation<ResponseDto<School>, { data: Partial<School>; token?: string }>({
      query: ({ data, token }) => {
        const queryParams = new URLSearchParams();
        if (token) queryParams.append('token', token);
        const queryString = queryParams.toString();
        return {
          url: `/school-admin/school${queryString ? `?${queryString}` : ''}`,
          method: 'PATCH',
          body: data,
        };
      },
      invalidatesTags: ['School'],
    }),
    // Request edit token for sensitive changes
    requestEditToken: builder.mutation<ResponseDto<{ message: string }>, Partial<School>>({
      query: (changes) => ({
        url: '/school-admin/school/request-edit-token',
        method: 'POST',
        body: changes,
      }),
    }),
    // Verify edit token
    verifyEditToken: builder.query<ResponseDto<{ changes: Partial<School>; school: School }>, string>({
      query: (token) => `/school-admin/school/verify-edit-token/${token}`,
    }),
    // Get school admin dashboard
    getSchoolAdminDashboard: builder.query<ResponseDto<SchoolDashboard>, string | undefined>({
      query: (schoolType) => {
        const queryParams = new URLSearchParams();
        if (schoolType) queryParams.append('schoolType', schoolType);
        const queryString = queryParams.toString();
        return `/school-admin/dashboard${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['School'],
    }),
    // Get staff list with pagination, search, and filtering
    getStaffList: builder.query<ResponseDto<StaffListResponse>, GetStaffListParams>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.search) queryParams.append('search', params.search);
        if (params.role) queryParams.append('role', params.role);
        if (params.schoolType) queryParams.append('schoolType', params.schoolType);
        const queryString = queryParams.toString();
        return `/school-admin/staff${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['School'],
    }),
    // Get single staff member by ID
    getStaffMember: builder.query<ResponseDto<StaffListItem & { type: 'teacher' | 'admin' }>, { schoolId: string; staffId: string }>({
      query: ({ schoolId, staffId }) => `/schools/${schoolId}/staff/${staffId}`,
      providesTags: (result, error, { staffId }) => [{ type: 'School' as const, id: staffId }],
    }),

    // =====================
    // Teacher Subject Competencies
    // =====================

    // Get subjects a teacher is qualified to teach
    getTeacherSubjects: builder.query<ResponseDto<TeacherSubject[]>, { schoolId: string; teacherId: string }>({
      query: ({ schoolId, teacherId }) => `/schools/${schoolId}/teachers/${teacherId}/subjects`,
      providesTags: (result, error, { teacherId }) => [
        { type: 'TeacherSubject' as const, id: teacherId },
        'School',
      ],
    }),

    // Get teacher with all subjects and assignment totals
    getTeacherWithSubjects: builder.query<ResponseDto<TeacherWithSubjects>, { schoolId: string; teacherId: string }>({
      query: ({ schoolId, teacherId }) => `/schools/${schoolId}/teachers/${teacherId}/subjects/details`,
      providesTags: (result, error, { teacherId }) => [
        { type: 'TeacherSubject' as const, id: teacherId },
        'School',
      ],
    }),

    // Update all subjects a teacher can teach (replaces existing)
    updateTeacherSubjects: builder.mutation<ResponseDto<TeacherSubject[]>, { schoolId: string; teacherId: string; subjectIds: string[] }>({
      query: ({ schoolId, teacherId, subjectIds }) => ({
        url: `/schools/${schoolId}/teachers/${teacherId}/subjects`,
        method: 'PUT',
        body: { subjectIds },
      }),
      invalidatesTags: (result, error, { teacherId }) => [
        { type: 'TeacherSubject' as const, id: teacherId },
        { type: 'School' as const, id: teacherId },
        'School',
      ],
    }),

    // Add a single subject to teacher's competencies
    addTeacherSubject: builder.mutation<ResponseDto<TeacherSubject>, { schoolId: string; teacherId: string; subjectId: string }>({
      query: ({ schoolId, teacherId, subjectId }) => ({
        url: `/schools/${schoolId}/teachers/${teacherId}/subjects`,
        method: 'POST',
        body: { subjectId },
      }),
      invalidatesTags: (result, error, { teacherId }) => [
        { type: 'TeacherSubject' as const, id: teacherId },
        { type: 'School' as const, id: teacherId },
        'School',
      ],
    }),

    // Remove a subject from teacher's competencies
    removeTeacherSubject: builder.mutation<ResponseDto<void>, { schoolId: string; teacherId: string; subjectId: string }>({
      query: ({ schoolId, teacherId, subjectId }) => ({
        url: `/schools/${schoolId}/teachers/${teacherId}/subjects/${subjectId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { teacherId }) => [
        { type: 'TeacherSubject' as const, id: teacherId },
        { type: 'School' as const, id: teacherId },
        'School',
      ],
    }),

    // Get subjects a teacher can be assigned to for a specific class
    getAssignableSubjects: builder.query<ResponseDto<AssignableSubject[]>, { schoolId: string; teacherId: string; classId: string }>({
      query: ({ schoolId, teacherId, classId }) => 
        `/schools/${schoolId}/teachers/${teacherId}/assignable-subjects?classId=${classId}`,
      providesTags: (result, error, { teacherId, classId }) => [
        { type: 'TeacherSubject' as const, id: teacherId },
        { type: 'Class' as const, id: classId },
      ],
    }),

    // Get all classes/courses for a school
    getClasses: builder.query<
      ResponseDto<Class[]>,
      { schoolId: string; academicYear?: string; type?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'; teacherId?: string }
    >({
      query: ({ schoolId, academicYear, type, teacherId }) => {
        const queryParams = new URLSearchParams();
        if (academicYear) queryParams.append('academicYear', academicYear);
        if (type) queryParams.append('type', type);
        if (teacherId) queryParams.append('teacherId', teacherId);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/classes${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Class' as const, id })),
              { type: 'Class', id: 'LIST' },
              'School',
            ]
          : [{ type: 'Class', id: 'LIST' }, 'School'],
    }),
    // Get a single class by ID
    getClassById: builder.query<ResponseDto<Class>, { schoolId: string; classId: string }>({
      query: ({ schoolId, classId }) => `/schools/${schoolId}/classes/${classId}`,
      providesTags: (result, error, { classId }) => [{ type: 'Class', id: classId }],
    }),
    // Create a new class
    createClass: builder.mutation<ResponseDto<Class>, { schoolId: string; classData: CreateClassDto }>({
      query: ({ schoolId, classData }) => ({
        url: `/schools/${schoolId}/classes`,
        method: 'POST',
        body: classData,
      }),
      invalidatesTags: [{ type: 'Class', id: 'LIST' }, 'School'],
    }),
    // Update a class
    updateClass: builder.mutation<ResponseDto<Class>, { schoolId: string; classId: string; classData: Partial<CreateClassDto> }>({
      query: ({ schoolId, classId, classData }) => ({
        url: `/schools/${schoolId}/classes/${classId}`,
        method: 'PATCH',
        body: classData,
      }),
      invalidatesTags: (result, error, { classId }) => [
        { type: 'Class', id: classId },
        { type: 'Class', id: 'LIST' },
        'School',
      ],
    }),
    // Delete a class
    deleteClass: builder.mutation<ResponseDto<void>, { schoolId: string; classId: string; forceDelete?: boolean }>({
      query: ({ schoolId, classId, forceDelete }) => ({
        url: `/schools/${schoolId}/classes/${classId}${forceDelete ? '?force=true' : ''}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'Class', id: 'LIST' },
        'School',
        'Student', // Also invalidate students since their enrollment may have changed
      ],
    }),
    // Assign a teacher to a class
    assignTeacherToClass: builder.mutation<ResponseDto<Class>, { schoolId: string; classId: string; assignment: AssignTeacherToClassDto }>({
      query: ({ schoolId, classId, assignment }) => ({
        url: `/schools/${schoolId}/classes/${classId}/teachers`,
        method: 'POST',
        body: assignment,
      }),
      invalidatesTags: (result, error, { classId }) => [{ type: 'Class', id: classId }, 'School'],
    }),
    // Remove a teacher from a class
    removeTeacherFromClass: builder.mutation<ResponseDto<void>, { schoolId: string; classId: string; teacherId: string; subject?: string }>({
      query: ({ schoolId, classId, teacherId, subject }) => {
        const queryParams = new URLSearchParams();
        if (subject) queryParams.append('subject', subject);
        const queryString = queryParams.toString();
        return {
          url: `/schools/${schoolId}/classes/${classId}/teachers/${teacherId}${queryString ? `?${queryString}` : ''}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: (result, error, { classId }) => [{ type: 'Class', id: classId }, 'School'],
    }),
    // Session Management
    getSessions: builder.query<ResponseDto<AcademicSession[]>, { schoolId: string; schoolType?: string }>({
      query: ({ schoolId, schoolType }) => {
        const queryParams = new URLSearchParams();
        if (schoolType) queryParams.append('schoolType', schoolType);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/sessions${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Session'],
    }),
    getActiveSession: builder.query<ResponseDto<ActiveSession>, { schoolId: string; schoolType?: string }>({
      query: ({ schoolId, schoolType }) => {
        const queryParams = new URLSearchParams();
        if (schoolType) queryParams.append('schoolType', schoolType);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/sessions/active${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Session'],
    }),
    initializeSession: builder.mutation<ResponseDto<AcademicSession>, { schoolId: string; data: InitializeSessionDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/sessions/initialize`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Session'],
    }),
    createTerm: builder.mutation<ResponseDto<Term>, { schoolId: string; sessionId: string; data: CreateTermDto }>({
      query: ({ schoolId, sessionId, data }) => ({
        url: `/schools/${schoolId}/sessions/${sessionId}/terms`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Session'],
    }),
    startNewTerm: builder.mutation<ResponseDto<StartTermResponse>, { schoolId: string; data: StartTermDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/sessions/start-term`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Session', 'School'],
    }),
    migrateStudents: builder.mutation<ResponseDto<{ migratedCount: number }>, { schoolId: string; data: MigrateStudentsDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/sessions/migrate-students`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Session', 'School'],
    }),
    endTerm: builder.mutation<ResponseDto<{ term: Term }>, { schoolId: string; schoolType?: string }>({
      query: ({ schoolId, schoolType }) => {
        const queryParams = new URLSearchParams();
        if (schoolType) queryParams.append('schoolType', schoolType);
        const queryString = queryParams.toString();
        return {
          url: `/schools/${schoolId}/sessions/end-term${queryString ? `?${queryString}` : ''}`,
          method: 'POST',
        };
      },
      invalidatesTags: ['Session', 'School'],
    }),
    reactivateTerm: builder.mutation<ResponseDto<{ term: Term }>, { schoolId: string; termId: string; schoolType?: string }>({
      query: ({ schoolId, termId, schoolType }) => ({
        url: `/schools/${schoolId}/sessions/reactivate-term`,
        method: 'POST',
        body: { termId, schoolType },
      }),
      invalidatesTags: ['Session', 'School'],
    }),
    endSession: builder.mutation<ResponseDto<{ session: AcademicSession }>, { schoolId: string; schoolType?: string }>({
      query: ({ schoolId, schoolType }) => {
        const queryParams = new URLSearchParams();
        if (schoolType) queryParams.append('schoolType', schoolType);
        const queryString = queryParams.toString();
        return {
          url: `/schools/${schoolId}/sessions/end-session${queryString ? `?${queryString}` : ''}`,
          method: 'POST',
        };
      },
      invalidatesTags: ['Session', 'School'],
    }),
    // Timetable Management
    getTimetableForClassArm: builder.query<ResponseDto<TimetablePeriod[]>, { schoolId: string; classArmId: string; termId: string }>({
      query: ({ schoolId, classArmId, termId }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('termId', termId);
        return `/schools/${schoolId}/timetable/class-arm/${classArmId}?${queryParams.toString()}`;
      },
      providesTags: (result, error, { classArmId }) => [{ type: 'Timetable', id: classArmId }],
    }),
    getTimetableForTeacher: builder.query<
      ResponseDto<TimetablePeriod[]>,
      { schoolId: string; teacherId: string; termId: string }
    >({
      query: ({ schoolId, teacherId, termId }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('termId', termId);
        return `/schools/${schoolId}/timetable/teacher/${teacherId}?${queryParams.toString()}`;
      },
      providesTags: (result, error, { teacherId, termId }) => [
        { type: 'Timetable' as const, id: `teacher-${teacherId}` },
        { type: 'Timetable' as const, id: `teacher-${teacherId}-${termId}` },
      ],
    }),
    getTimetableForClass: builder.query<ResponseDto<TimetablePeriod[]>, { schoolId: string; classId: string; termId: string }>({
      query: ({ schoolId, classId, termId }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('termId', termId);
        return `/schools/${schoolId}/timetable/class/${classId}?${queryParams.toString()}`;
      },
      providesTags: (result, error, { classId, termId }) => [
        { type: 'Timetable', id: classId },
        { type: 'Timetable', id: `${classId}-${termId}` },
      ],
    }),
    getTimetableForStudent: builder.query<ResponseDto<TimetablePeriod[]>, { schoolId: string; studentId: string; termId: string }>({
      query: ({ schoolId, studentId, termId }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('termId', termId);
        return `/schools/${schoolId}/timetable/student/${studentId}?${queryParams.toString()}`;
      },
      providesTags: (result, error, { studentId, termId }) => [
        { type: 'Timetable', id: `student-${studentId}` },
        { type: 'Timetable', id: `student-${studentId}-${termId}` },
      ],
    }),
    getTimetablesForSchoolType: builder.query<ResponseDto<Record<string, TimetablePeriod[]>>, { schoolId: string; schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'; termId?: string }>({
      query: ({ schoolId, schoolType, termId }) => {
        const queryParams = new URLSearchParams();
        if (schoolType) queryParams.append('schoolType', schoolType);
        if (termId) queryParams.append('termId', termId);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/timetable/timetables${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Timetable'],
    }),
    createTimetablePeriod: builder.mutation<ResponseDto<TimetablePeriod>, { schoolId: string; data: CreateTimetablePeriodDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/timetable/periods`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { data }) => [
        'Timetable', // Invalidate all timetable queries
        // Invalidate specific class timetable if classId is provided
        ...(data.classId ? [{ type: 'Timetable' as const, id: data.classId }, { type: 'Timetable' as const, id: `${data.classId}-${data.termId}` }] : []),
        // Invalidate teacher timetables (will be handled by general 'Timetable' tag)
      ],
    }),
    updateTimetablePeriod: builder.mutation<ResponseDto<TimetablePeriod>, { schoolId: string; periodId: string; data: Partial<CreateTimetablePeriodDto> }>({
      query: ({ schoolId, periodId, data }) => ({
        url: `/schools/${schoolId}/timetable/periods/${periodId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { data }) => [
        'Timetable', // Invalidate all timetable queries (including teacher timetables)
        { type: 'Timetable', id: 'LIST' },
        // Invalidate specific class timetable if classId is in the update
        ...(data.classId ? [{ type: 'Timetable' as const, id: data.classId }, { type: 'Timetable' as const, id: `${data.classId}-${data.termId}` }] : []),
        // If teacherId is updated, we should invalidate that teacher's timetable
        // But since we're invalidating 'Timetable' globally, all teacher queries will refetch
      ],
    }),
    deleteTimetablePeriod: builder.mutation<ResponseDto<void>, { schoolId: string; periodId: string }>({
      query: ({ schoolId, periodId }) => ({
        url: `/schools/${schoolId}/timetable/periods/${periodId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Timetable'], // Invalidate all timetable queries
    }),
    deleteTimetableForClass: builder.mutation<ResponseDto<void>, { schoolId: string; classId: string; termId: string }>({
      query: ({ schoolId, classId, termId }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('termId', termId);
        return {
          url: `/schools/${schoolId}/timetable/class/${classId}?${queryParams.toString()}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: ['Timetable', 'Class'],
    }),
    createMasterSchedule: builder.mutation<ResponseDto<{ created: number; skipped: number }>, { schoolId: string; data: CreateMasterScheduleDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/timetable/master-schedule`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { data }) => [
        'Timetable',
        'ClassArm',
        // Invalidate all timetable queries for the term
        { type: 'Timetable', id: 'LIST' },
      ],
    }),
    // Resource endpoints
    getClassLevels: builder.query<ResponseDto<ClassLevel[]>, { schoolId: string }>({
      query: ({ schoolId }) => `/schools/${schoolId}/timetable/class-levels`,
      providesTags: ['Timetable'],
    }),
    getClassArms: builder.query<ResponseDto<ClassArm[]>, { schoolId: string; classLevelId?: string; schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' }>({
      query: ({ schoolId, classLevelId, schoolType }) => {
        const queryParams = new URLSearchParams();
        if (classLevelId) queryParams.append('classLevelId', classLevelId);
        if (schoolType) queryParams.append('schoolType', schoolType);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/timetable/class-arms${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Timetable'],
    }),
    createClassArm: builder.mutation<ResponseDto<ClassArm>, { schoolId: string; data: CreateClassArmDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/timetable/class-arms`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [
        { type: 'Class', id: 'LIST' },
        'Timetable',
        'School',
      ],
    }),
    // Generate default classes for a school type (Primary 1-6, JSS1-SS3, Year 1-4)
    generateDefaultClasses: builder.mutation<
      ResponseDto<{ created: number; message: string }>,
      { schoolId: string; schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' }
    >({
      query: ({ schoolId, schoolType }) => ({
        url: `/schools/${schoolId}/timetable/generate-default-classes`,
        method: 'POST',
        body: { schoolType },
      }),
      invalidatesTags: [
        { type: 'Class', id: 'LIST' },
        'Timetable',
        'School',
      ],
    }),

    // ============ FACULTY ENDPOINTS (Tertiary) ============
    getFaculties: builder.query<ResponseDto<Faculty[]>, { schoolId: string }>({
      query: ({ schoolId }) => `/schools/${schoolId}/faculties`,
      providesTags: ['Faculty'],
    }),
    getFaculty: builder.query<ResponseDto<Faculty>, { schoolId: string; facultyId: string }>({
      query: ({ schoolId, facultyId }) => `/schools/${schoolId}/faculties/${facultyId}`,
      providesTags: (result, error, { facultyId }) => [{ type: 'Faculty', id: facultyId }],
    }),
    createFaculty: builder.mutation<ResponseDto<Faculty>, { schoolId: string; data: CreateFacultyDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/faculties`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Faculty'],
    }),
    updateFaculty: builder.mutation<ResponseDto<Faculty>, { schoolId: string; facultyId: string; data: UpdateFacultyDto }>({
      query: ({ schoolId, facultyId, data }) => ({
        url: `/schools/${schoolId}/faculties/${facultyId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { facultyId }) => ['Faculty', { type: 'Faculty', id: facultyId }],
    }),
    deleteFaculty: builder.mutation<ResponseDto<void>, { schoolId: string; facultyId: string; force?: boolean }>({
      query: ({ schoolId, facultyId, force }) => ({
        url: `/schools/${schoolId}/faculties/${facultyId}${force ? '?force=true' : ''}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Faculty', 'Department'],
    }),
    generateDefaultFaculties: builder.mutation<
      ResponseDto<{ created: number; skipped: number; message: string }>,
      { schoolId: string }
    >({
      query: ({ schoolId }) => ({
        url: `/schools/${schoolId}/faculties/generate-defaults`,
        method: 'POST',
      }),
      invalidatesTags: ['Faculty'],
    }),
    generateDepartmentsForFaculty: builder.mutation<
      ResponseDto<{ created: number; skipped: number; message: string }>,
      { schoolId: string; facultyId: string }
    >({
      query: ({ schoolId, facultyId }) => ({
        url: `/schools/${schoolId}/faculties/${facultyId}/generate-departments`,
        method: 'POST',
      }),
      invalidatesTags: ['Faculty', 'Department'],
    }),

    // ============ DEPARTMENT ENDPOINTS (Tertiary) ============
    getDepartments: builder.query<ResponseDto<Department[]>, { schoolId: string; facultyId?: string }>({
      query: ({ schoolId, facultyId }) => {
        const url = `/schools/${schoolId}/departments`;
        return facultyId ? `${url}?facultyId=${facultyId}` : url;
      },
      providesTags: ['Department'],
    }),
    getDepartment: builder.query<ResponseDto<Department>, { schoolId: string; departmentId: string }>({
      query: ({ schoolId, departmentId }) => `/schools/${schoolId}/departments/${departmentId}`,
      providesTags: (result, error, { departmentId }) => [{ type: 'Department', id: departmentId }],
    }),
    createDepartment: builder.mutation<ResponseDto<Department>, { schoolId: string; data: CreateDepartmentDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/departments`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Department', 'Faculty'],
    }),
    updateDepartment: builder.mutation<ResponseDto<Department>, { schoolId: string; departmentId: string; data: UpdateDepartmentDto }>({
      query: ({ schoolId, departmentId, data }) => ({
        url: `/schools/${schoolId}/departments/${departmentId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { departmentId }) => ['Department', 'Faculty', { type: 'Department', id: departmentId }],
    }),
    deleteDepartment: builder.mutation<ResponseDto<void>, { schoolId: string; departmentId: string; force?: boolean }>({
      query: ({ schoolId, departmentId, force }) => ({
        url: `/schools/${schoolId}/departments/${departmentId}${force ? '?force=true' : ''}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Department', 'Faculty'],
    }),
    getDepartmentLevels: builder.query<ResponseDto<DepartmentLevel[]>, { schoolId: string; departmentId: string }>({
      query: ({ schoolId, departmentId }) => `/schools/${schoolId}/departments/${departmentId}/levels`,
      providesTags: (result, error, { departmentId }) => [
        { type: 'Department', id: departmentId },
        { type: 'Class', id: 'LIST' },
      ],
    }),
    generateDepartmentLevels: builder.mutation<ResponseDto<{ created: number; message: string }>, { schoolId: string; departmentId: string; data?: GenerateLevelsDto }>({
      query: ({ schoolId, departmentId, data }) => ({
        url: `/schools/${schoolId}/departments/${departmentId}/generate-levels`,
        method: 'POST',
        body: data || {},
      }),
      invalidatesTags: (result, error, { departmentId }) => ['Department', { type: 'Department', id: departmentId }, { type: 'Class', id: 'LIST' }],
    }),

    // ============ LEVEL ENDPOINTS (Tertiary) ============
    getLevel: builder.query<ResponseDto<LevelDetail>, { schoolId: string; levelId: string }>({
      query: ({ schoolId, levelId }) => `/schools/${schoolId}/levels/${levelId}`,
      providesTags: (result, error, { levelId }) => [{ type: 'Class', id: levelId }],
    }),
    getLevelStudents: builder.query<ResponseDto<LevelStudent[]>, { schoolId: string; levelId: string }>({
      query: ({ schoolId, levelId }) => `/schools/${schoolId}/levels/${levelId}/students`,
      providesTags: (result, error, { levelId }) => [{ type: 'Class', id: levelId }, 'Student'],
    }),
    getLevelCourses: builder.query<ResponseDto<LevelCourse[]>, { schoolId: string; levelId: string }>({
      query: ({ schoolId, levelId }) => `/schools/${schoolId}/levels/${levelId}/courses`,
      providesTags: (result, error, { levelId }) => [{ type: 'Class', id: levelId }, 'Subject'],
    }),
    getLevelTimetable: builder.query<ResponseDto<TimetablePeriod[]>, { schoolId: string; levelId: string; termId: string }>({
      query: ({ schoolId, levelId, termId }) => `/schools/${schoolId}/levels/${levelId}/timetable?termId=${termId}`,
      providesTags: (result, error, { levelId }) => [{ type: 'Timetable', id: levelId }],
    }),
    getLevelCurriculum: builder.query<ResponseDto<LevelCurriculum[]>, { schoolId: string; levelId: string }>({
      query: ({ schoolId, levelId }) => `/schools/${schoolId}/levels/${levelId}/curriculum`,
      providesTags: (result, error, { levelId }) => [{ type: 'Class', id: levelId }, 'Curriculum'],
    }),
    getLevelResources: builder.query<ResponseDto<LevelResource[]>, { schoolId: string; levelId: string }>({
      query: ({ schoolId, levelId }) => `/schools/${schoolId}/levels/${levelId}/resources`,
      providesTags: (result, error, { levelId }) => [{ type: 'Class', id: levelId }, 'ClassResource'],
    }),

    getSubjects: builder.query<ResponseDto<Subject[]>, { 
      schoolId: string; 
      schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'; 
      classLevelId?: string;
      termId?: string;  // Include teacher workload data for SECONDARY
    }>({
      query: ({ schoolId, schoolType, classLevelId, termId }) => {
        const queryParams = new URLSearchParams();
        if (schoolType) queryParams.append('schoolType', schoolType);
        if (classLevelId) queryParams.append('classLevelId', classLevelId);
        if (termId) queryParams.append('termId', termId);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/timetable/subjects${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Timetable', 'Subject'],
    }),
    
    // ============================================
    // TEACHER WORKLOAD ENDPOINTS
    // ============================================
    
    getTeacherWorkloads: builder.query<ResponseDto<TeacherWorkloadSummary>, {
      schoolId: string;
      termId: string;
      schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
    }>({
      query: ({ schoolId, termId, schoolType }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('termId', termId);
        if (schoolType) queryParams.append('schoolType', schoolType);
        return `/schools/${schoolId}/timetable/teacher-workloads?${queryParams.toString()}`;
      },
      providesTags: ['Timetable', 'TeacherWorkload'],
    }),
    
    getLeastLoadedTeacher: builder.query<ResponseDto<TeacherWithWorkload | null>, {
      schoolId: string;
      subjectId: string;
      termId: string;
      excludeTeacherIds?: string[];
    }>({
      query: ({ schoolId, subjectId, termId, excludeTeacherIds }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('termId', termId);
        if (excludeTeacherIds?.length) {
          queryParams.append('excludeTeacherIds', excludeTeacherIds.join(','));
        }
        return `/schools/${schoolId}/timetable/subjects/${subjectId}/least-loaded-teacher?${queryParams.toString()}`;
      },
    }),
    
    // Get teacher's class assignments from timetable (for SECONDARY schools)
    getTeacherTimetableClasses: builder.query<ResponseDto<TeacherTimetableClasses>, {
      schoolId: string;
      teacherId: string;
      termId?: string;
    }>({
      query: ({ schoolId, teacherId, termId }) => {
        const queryParams = new URLSearchParams();
        if (termId) queryParams.append('termId', termId);
        const qs = queryParams.toString();
        return `/schools/${schoolId}/timetable/teachers/${teacherId}/classes${qs ? `?${qs}` : ''}`;
      },
      providesTags: (result, error, { teacherId }) => [
        { type: 'Timetable' as const, id: teacherId },
        'TeacherWorkload',
      ],
    }),
    
    createSubject: builder.mutation<ResponseDto<Subject>, { schoolId: string; data: CreateSubjectDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/timetable/subjects`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Timetable', 'Subject'],
    }),
    updateSubject: builder.mutation<ResponseDto<Subject>, { schoolId: string; subjectId: string; data: UpdateSubjectDto }>({
      query: ({ schoolId, subjectId, data }) => ({
        url: `/schools/${schoolId}/timetable/subjects/${subjectId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Timetable', 'Subject'],
    }),
    deleteSubject: builder.mutation<ResponseDto<void>, { schoolId: string; subjectId: string }>({
      query: ({ schoolId, subjectId }) => ({
        url: `/schools/${schoolId}/timetable/subjects/${subjectId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Timetable', 'Subject'],
    }),
    assignTeacherToSubject: builder.mutation<ResponseDto<Subject>, { schoolId: string; subjectId: string; teacherId: string }>({
      query: ({ schoolId, subjectId, teacherId }) => ({
        url: `/schools/${schoolId}/timetable/subjects/${subjectId}/teachers`,
        method: 'POST',
        body: { teacherId },
      }),
      invalidatesTags: ['Timetable', 'Subject'],
    }),
    removeTeacherFromSubject: builder.mutation<ResponseDto<Subject>, { schoolId: string; subjectId: string; teacherId: string }>({
      query: ({ schoolId, subjectId, teacherId }) => ({
        url: `/schools/${schoolId}/timetable/subjects/${subjectId}/teachers/${teacherId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Timetable', 'Subject'],
    }),
    autoGenerateSubjects: builder.mutation<
      ResponseDto<{ created: number; skipped: number; subjects: Subject[] }>,
      { schoolId: string; schoolType: 'PRIMARY' | 'SECONDARY' }
    >({
      query: ({ schoolId, schoolType }) => ({
        url: `/schools/${schoolId}/timetable/subjects/auto-generate`,
        method: 'POST',
        body: { schoolType },
      }),
      invalidatesTags: ['Timetable', 'Subject'],
    }),

    // Class-Subject-Teacher Assignment endpoints (for SECONDARY schools)
    getSubjectClassAssignments: builder.query<
      ResponseDto<SubjectClassAssignments>,
      { schoolId: string; subjectId: string; sessionId?: string }
    >({
      query: ({ schoolId, subjectId, sessionId }) => {
        let url = `/schools/${schoolId}/timetable/subjects/${subjectId}/class-assignments`;
        if (sessionId) url += `?sessionId=${sessionId}`;
        return url;
      },
      providesTags: ['Subject', 'Timetable'],
    }),
    bulkAssignTeachersToClasses: builder.mutation<
      ResponseDto<{ updated: number; removed: number }>,
      { schoolId: string; subjectId: string; data: BulkClassSubjectAssignment }
    >({
      query: ({ schoolId, subjectId, data }) => ({
        url: `/schools/${schoolId}/timetable/subjects/${subjectId}/class-assignments`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Subject', 'Timetable'],
    }),
    removeClassSubjectAssignment: builder.mutation<
      ResponseDto<void>,
      { schoolId: string; subjectId: string; classArmId: string; sessionId?: string }
    >({
      query: ({ schoolId, subjectId, classArmId, sessionId }) => ({
        url: `/schools/${schoolId}/timetable/subjects/${subjectId}/class-assignments/${classArmId}${sessionId ? `?sessionId=${sessionId}` : ''}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Subject', 'Timetable'],
    }),

    getRooms: builder.query<ResponseDto<Room[]>, { schoolId: string }>({
      query: ({ schoolId }) => `/schools/${schoolId}/timetable/rooms`,
      providesTags: ['Timetable'],
    }),
    createRoom: builder.mutation<ResponseDto<Room>, { schoolId: string; data: CreateRoomDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/timetable/rooms`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Timetable'],
    }),
    getCourses: builder.query<ResponseDto<Array<{ id: string; name: string; code?: string; creditHours?: number; type: string; isActive: boolean }>>, { schoolId: string; schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' }>({
      query: ({ schoolId, schoolType }) => {
        const queryParams = new URLSearchParams();
        if (schoolType) queryParams.append('schoolType', schoolType);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/timetable/courses${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Timetable'],
    }),
    // Event Management
    getEvents: builder.query<ResponseDto<CalendarEvent[]>, { schoolId: string; startDate: string; endDate: string; schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' }>({
      query: ({ schoolId, startDate, endDate, schoolType }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('startDate', startDate);
        queryParams.append('endDate', endDate);
        if (schoolType) queryParams.append('schoolType', schoolType);
        return `/schools/${schoolId}/events?${queryParams.toString()}`;
      },
      providesTags: ['Event'],
    }),
    getUpcomingEvents: builder.query<ResponseDto<CalendarEvent[]>, { schoolId: string; days?: number; schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' }>({
      query: ({ schoolId, days, schoolType }) => {
        const queryParams = new URLSearchParams();
        if (days) queryParams.append('days', days.toString());
        if (schoolType) queryParams.append('schoolType', schoolType);
        return `/schools/${schoolId}/events/upcoming?${queryParams.toString()}`;
      },
      providesTags: ['Event'],
    }),
    createEvent: builder.mutation<ResponseDto<CalendarEvent>, { schoolId: string; data: CreateEventDto }>({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/events`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Event'],
    }),
    updateEvent: builder.mutation<ResponseDto<CalendarEvent>, { schoolId: string; eventId: string; data: Partial<CreateEventDto> }>({
      query: ({ schoolId, eventId, data }) => ({
        url: `/schools/${schoolId}/events/${eventId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Event'],
    }),
    deleteEvent: builder.mutation<ResponseDto<void>, { schoolId: string; eventId: string }>({
      query: ({ schoolId, eventId }) => ({
        url: `/schools/${schoolId}/events/${eventId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Event'],
    }),
    // Google Calendar hooks
    getGoogleCalendarStatus: builder.query<ResponseDto<{ syncEnabled: boolean; lastSyncAt: string | null; syncDirection: string } | null>, { schoolId: string }>({
      query: ({ schoolId }) => `/schools/${schoolId}/integrations/google-calendar/status`,
      providesTags: ['Event'],
    }),
    connectGoogleCalendar: builder.mutation<ResponseDto<{ authUrl: string }>, { schoolId: string }>({
      query: ({ schoolId }) => ({
        url: `/schools/${schoolId}/integrations/google-calendar/auth`,
        method: 'GET',
      }),
      invalidatesTags: ['Event'],
    }),
    disconnectGoogleCalendar: builder.mutation<ResponseDto<void>, { schoolId: string }>({
      query: ({ schoolId }) => ({
        url: `/schools/${schoolId}/integrations/google-calendar/disconnect`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Event'],
    }),
    // Teacher Profile (for teachers)
    getMyTeacherProfile: builder.query<ResponseDto<any>, void>({
      query: () => '/teachers/me',
      providesTags: ['User'],
    }),
    getMyTeacherSchool: builder.query<ResponseDto<any>, void>({
      query: () => '/teachers/me/school',
      providesTags: ['School'],
    }),
    // Get subjects teacher can grade for a specific class
    getTeacherSubjectsForClass: builder.query<ResponseDto<TeacherSubjectsResponse>, { classId: string }>({
      query: ({ classId }) => `/teachers/me/subjects?classId=${classId}`,
      providesTags: ['TeacherSubjects'],
    }),
    // Student "me" endpoints
    getMyStudentProfile: builder.query<ResponseDto<any>, void>({
      query: () => '/students/me',
      providesTags: ['Student'],
    }),
    getMyStudentEnrollments: builder.query<ResponseDto<any[]>, void>({
      query: () => '/students/me/enrollments',
      providesTags: ['Student'],
    }),
    getMyStudentClasses: builder.query<ResponseDto<any[]>, void>({
      query: () => '/students/me/classes',
      providesTags: ['Student', 'Class'],
    }),
    getMyClassmates: builder.query<ResponseDto<any[]>, { classId?: string }>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.classId) queryParams.append('classId', params.classId);
        const queryString = queryParams.toString();
        return `/students/me/classmates${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Student'],
    }),
    getMyStudentTimetable: builder.query<
      ResponseDto<any[]>,
      { termId?: string }
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.termId) queryParams.append('termId', params.termId);
        const queryString = queryParams.toString();
        return `/students/me/timetable${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Student', 'Timetable'],
    }),
    getMyStudentGrades: builder.query<
      ResponseDto<any[]>,
      { classId?: string; termId?: string; subject?: string }
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.classId) queryParams.append('classId', params.classId);
        if (params.termId) queryParams.append('termId', params.termId);
        if (params.subject) queryParams.append('subject', params.subject);
        const queryString = queryParams.toString();
        return `/students/me/grades${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Student', 'Grade'],
    }),
    getMyStudentAttendance: builder.query<
      ResponseDto<any[]>,
      { classId?: string; termId?: string; startDate?: string; endDate?: string }
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.classId) queryParams.append('classId', params.classId);
        if (params.termId) queryParams.append('termId', params.termId);
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        const queryString = queryParams.toString();
        return `/students/me/attendance${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Student'],
    }),
    getMyStudentResources: builder.query<
      ResponseDto<any[]>,
      { classId?: string; resourceType?: string }
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.classId) queryParams.append('classId', params.classId);
        if (params.resourceType) queryParams.append('resourceType', params.resourceType);
        const queryString = queryParams.toString();
        return `/students/me/resources${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Student', 'ClassResource'],
    }),
    getMyStudentPersonalResources: builder.query<ResponseDto<any[]>, void>({
      query: () => '/students/me/personal-resources',
      providesTags: ['Student', 'StudentResource'],
    }),
    uploadPersonalResource: builder.mutation<
      ResponseDto<any>,
      { file: File; description?: string }
    >({
      query: ({ file, description }) => {
        const formData = new FormData();
        formData.append('file', file);
        if (description) {
          formData.append('description', description);
        }
        return {
          url: '/students/me/personal-resources/upload',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: ['Student', 'StudentResource'],
    }),
    deletePersonalResource: builder.mutation<
      ResponseDto<void>,
      { resourceId: string }
    >({
      query: ({ resourceId }) => ({
        url: `/students/me/personal-resources/${resourceId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Student', 'StudentResource'],
    }),
    getMyStudentCalendar: builder.query<
      ResponseDto<{ events: any[]; timetable: any[] }>,
      { startDate?: string; endDate?: string }
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        const queryString = queryParams.toString();
        return `/students/me/calendar${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Student', 'Event', 'Timetable'],
    }),
    getMyStudentTranscript: builder.query<
      ResponseDto<any>,
      { startDate?: string; endDate?: string; schoolId?: string }
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.startDate) queryParams.append('startDate', params.startDate);
        if (params.endDate) queryParams.append('endDate', params.endDate);
        if (params.schoolId) queryParams.append('schoolId', params.schoolId);
        const queryString = queryParams.toString();
        return `/students/me/transcript${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Student'],
    }),
    getMyStudentTransfers: builder.query<
      ResponseDto<any[]>,
      { status?: string }
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.status) queryParams.append('status', params.status);
        const queryString = queryParams.toString();
        return `/students/me/transfers${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Student'],
    }),

    getMyStudentSchool: builder.query<ResponseDto<any>, void>({
      query: () => '/students/me/school',
      providesTags: ['Student', 'School'],
    }),
    // Teacher Classes (wrapper for teacher's classes)
    getMyClasses: builder.query<
      ResponseDto<Class[]>,
      { schoolId: string; teacherId: string; academicYear?: string; type?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' }
    >({
      query: ({ schoolId, teacherId, academicYear, type }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('teacherId', teacherId);
        if (academicYear) queryParams.append('academicYear', academicYear);
        if (type) queryParams.append('type', type);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/classes?${queryString}`;
      },
      providesTags: ['School', 'Class'],
    }),
    // Get students in a class
    getClassStudents: builder.query<ResponseDto<StudentWithEnrollment[]>, { schoolId: string; classId: string }>({
      query: ({ schoolId, classId }) => `/schools/${schoolId}/classes/${classId}/students`,
      providesTags: (result, error, { classId }) => [{ type: 'Class', id: classId }, 'Student'],
    }),
    // Class Resources
    getClassResources: builder.query<ResponseDto<ClassResource[]>, { schoolId: string; classId: string }>({
      query: ({ schoolId, classId }) => `/schools/${schoolId}/classes/${classId}/resources`,
      providesTags: (result, error, { classId }) => [{ type: 'Class', id: classId }, 'ClassResource'],
    }),
    uploadClassResource: builder.mutation<ResponseDto<ClassResource>, { schoolId: string; classId: string; file: File; description?: string }>({
      queryFn: async ({ schoolId, classId, file, description }, _api, _extraOptions, baseQuery) => {
        const formData = new FormData();
        formData.append('file', file);
        if (description) {
          formData.append('description', description);
        }
        
        // Get token from state
        const state = _api.getState() as { auth: { accessToken?: string | null; token?: string | null } };
        const token = state?.auth?.accessToken || state?.auth?.token;
        
        // Get tenant ID
        const tenantId = typeof window !== 'undefined' ? (localStorage.getItem('tenantId') || window.location.hostname.split('.')[0]) : null;
        
        const baseUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000/api';
        const url = `${baseUrl}/schools/${schoolId}/classes/${classId}/resources/upload`;
        
        const headers: HeadersInit = {};
        if (token) {
          headers['authorization'] = `Bearer ${token}`;
        }
        if (tenantId && !['localhost', 'www', 'api', 'app'].includes(tenantId)) {
          headers['x-tenant-id'] = tenantId;
        }
        // Don't set Content-Type - browser will set it with boundary
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Upload failed' }));
          return { error: { status: response.status, data: error } };
        }
        
        const data = await response.json();
        return { data };
      },
      invalidatesTags: (result, error, { classId }) => [{ type: 'Class', id: classId }, 'ClassResource'],
    }),
    deleteClassResource: builder.mutation<ResponseDto<void>, { schoolId: string; classId: string; resourceId: string }>({
      query: ({ schoolId, classId, resourceId }) => ({
        url: `/schools/${schoolId}/classes/${classId}/resources/${resourceId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { classId }) => [{ type: 'Class', id: classId }, 'ClassResource'],
    }),
    // Student Admission
    admitStudent: builder.mutation<ResponseDto<{ id: string; uid: string; publicId: string; firstName: string; lastName: string; email: string | null; message: string }>, { schoolId: string; student: AddStudentDto }>({
      query: ({ schoolId, student }) => ({
        url: `/schools/${schoolId}/students/admit`,
        method: 'POST',
        body: student,
      }),
      invalidatesTags: (result, error, { schoolId, student }) => [
        { type: 'School', id: schoolId },
        'School',
        'Student',
        { type: 'Student', id: `class-${student.classLevel}` },
        { type: 'Class', id: 'LIST' },
      ],
    }),
    // Get students list
    getStudents: builder.query<ResponseDto<PaginatedResponse<StudentWithEnrollment>>, { schoolId: string; page?: number; limit?: number; schoolType?: string }>({
      query: ({ schoolId, ...params }) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.schoolType) queryParams.append('schoolType', params.schoolType);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/students${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Student'],
    }),
    // ============================================
    // NERDC Curriculum Endpoints
    // ============================================
    
    getNerdcSubjects: builder.query<
      ResponseDto<NerdcSubject[]>,
      { schoolId: string; schoolType?: string; category?: string }
    >({
      query: ({ schoolId, schoolType, category }) => {
        const queryParams = new URLSearchParams();
        if (schoolType) queryParams.append('schoolType', schoolType);
        if (category) queryParams.append('category', category);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/curriculum/nerdc/subjects${queryString ? `?${queryString}` : ''}`;
      },
    }),
    
    getNerdcTemplate: builder.query<
      ResponseDto<NerdcCurriculum | null>,
      { schoolId: string; subjectCode: string; classLevel: string; schoolType: string; term: number }
    >({
      query: ({ schoolId, subjectCode, classLevel, schoolType, term }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('subjectCode', subjectCode);
        queryParams.append('classLevel', classLevel);
        queryParams.append('schoolType', schoolType);
        queryParams.append('term', term.toString());
        return `/schools/${schoolId}/curriculum/nerdc/template?${queryParams.toString()}`;
      },
    }),
    
    // ============================================
    // Timetable-Driven Curriculum Endpoints
    // ============================================
    
    getSubjectsFromTimetable: builder.query<
      ResponseDto<TimetableSubject[]>,
      { schoolId: string; classLevelId: string; termId: string }
    >({
      query: ({ schoolId, classLevelId, termId }) =>
        `/schools/${schoolId}/curriculum/class-level/${classLevelId}/subjects?termId=${termId}`,
      providesTags: (result, error, { classLevelId }) => [
        { type: 'Curriculum' as const, id: `subjects-${classLevelId}` },
        'Timetable',
      ],
    }),
    
    getCurriculaSummary: builder.query<
      ResponseDto<CurriculumSummary[]>,
      { schoolId: string; classLevelId: string; termId: string }
    >({
      query: ({ schoolId, classLevelId, termId }) =>
        `/schools/${schoolId}/curriculum/class-level/${classLevelId}/summary?termId=${termId}`,
      providesTags: (result, error, { classLevelId }) => [
        { type: 'Curriculum' as const, id: `summary-${classLevelId}` },
        'Curriculum',
      ],
    }),
    
    // ============================================
    // Curriculum CRUD Endpoints
    // ============================================
    
    getCurriculumForClass: builder.query<
      ResponseDto<Curriculum | null>,
      { schoolId: string; classId: string; subject?: string; academicYear?: string; termId?: string }
    >({
      query: ({ schoolId, classId, subject, academicYear, termId }) => {
        const queryParams = new URLSearchParams();
        if (subject) queryParams.append('subject', subject);
        if (academicYear) queryParams.append('academicYear', academicYear);
        if (termId) queryParams.append('termId', termId);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/curriculum/classes/${classId}${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: (result, error, { classId }) => [{ type: 'Curriculum' as const, id: classId }],
    }),
    
    getCurriculumById: builder.query<
      ResponseDto<Curriculum>,
      { schoolId: string; curriculumId: string }
    >({
      query: ({ schoolId, curriculumId }) => `/schools/${schoolId}/curriculum/${curriculumId}`,
      providesTags: (result, error, { curriculumId }) => [{ type: 'Curriculum' as const, id: curriculumId }],
    }),
    
    createCurriculum: builder.mutation<ResponseDto<Curriculum>, { schoolId: string; curriculumData: CreateCurriculumDto }>({
      query: ({ schoolId, curriculumData }) => ({
        url: `/schools/${schoolId}/curriculum`,
        method: 'POST',
        body: curriculumData,
      }),
      invalidatesTags: (result, error, { curriculumData }) => [
        { type: 'Curriculum' as const, id: curriculumData.classId },
        'Curriculum',
        'Class',
      ],
    }),
    
    generateCurriculum: builder.mutation<
      ResponseDto<Curriculum>,
      { schoolId: string; data: GenerateCurriculumDto }
    >({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/curriculum/generate`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { data }) => [
        { type: 'Curriculum' as const, id: `summary-${data.classLevelId}` },
        'Curriculum',
      ],
    }),
    
    bulkGenerateCurriculum: builder.mutation<
      ResponseDto<{ created: string[]; failed: { subjectId: string; error: string }[] }>,
      { schoolId: string; data: BulkGenerateCurriculumDto }
    >({
      query: ({ schoolId, data }) => ({
        url: `/schools/${schoolId}/curriculum/generate-bulk`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { data }) => [
        { type: 'Curriculum' as const, id: `summary-${data.classLevelId}` },
        'Curriculum',
      ],
    }),
    
    updateCurriculum: builder.mutation<
      ResponseDto<Curriculum>,
      { schoolId: string; curriculumId: string; data: UpdateCurriculumDto }
    >({
      query: ({ schoolId, curriculumId, data }) => ({
        url: `/schools/${schoolId}/curriculum/${curriculumId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { curriculumId }) => [
        { type: 'Curriculum' as const, id: curriculumId },
        'Curriculum',
      ],
    }),
    
    deleteCurriculum: builder.mutation<ResponseDto<void>, { schoolId: string; curriculumId: string }>({
      query: ({ schoolId, curriculumId }) => ({
        url: `/schools/${schoolId}/curriculum/${curriculumId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { curriculumId }) => [
        { type: 'Curriculum' as const, id: curriculumId },
        'Curriculum',
      ],
    }),
    
    // ============================================
    // Curriculum Status Endpoints
    // ============================================
    
    submitCurriculumForApproval: builder.mutation<
      ResponseDto<Curriculum>,
      { schoolId: string; curriculumId: string }
    >({
      query: ({ schoolId, curriculumId }) => ({
        url: `/schools/${schoolId}/curriculum/${curriculumId}/submit`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { curriculumId }) => [
        { type: 'Curriculum' as const, id: curriculumId },
        'Curriculum',
      ],
    }),
    
    approveCurriculum: builder.mutation<
      ResponseDto<Curriculum>,
      { schoolId: string; curriculumId: string }
    >({
      query: ({ schoolId, curriculumId }) => ({
        url: `/schools/${schoolId}/curriculum/${curriculumId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { curriculumId }) => [
        { type: 'Curriculum' as const, id: curriculumId },
        'Curriculum',
      ],
    }),
    
    rejectCurriculum: builder.mutation<
      ResponseDto<Curriculum>,
      { schoolId: string; curriculumId: string; reason: string }
    >({
      query: ({ schoolId, curriculumId, reason }) => ({
        url: `/schools/${schoolId}/curriculum/${curriculumId}/reject`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (result, error, { curriculumId }) => [
        { type: 'Curriculum' as const, id: curriculumId },
        'Curriculum',
      ],
    }),
    
    activateCurriculum: builder.mutation<
      ResponseDto<Curriculum>,
      { schoolId: string; curriculumId: string }
    >({
      query: ({ schoolId, curriculumId }) => ({
        url: `/schools/${schoolId}/curriculum/${curriculumId}/activate`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { curriculumId }) => [
        { type: 'Curriculum' as const, id: curriculumId },
        'Curriculum',
      ],
    }),
    
    // ============================================
    // Curriculum Progress Endpoints
    // ============================================
    
    markWeekComplete: builder.mutation<
      ResponseDto<CurriculumItem>,
      { schoolId: string; curriculumId: string; weekNumber: number; notes?: string }
    >({
      query: ({ schoolId, curriculumId, weekNumber, notes }) => ({
        url: `/schools/${schoolId}/curriculum/${curriculumId}/weeks/${weekNumber}/complete`,
        method: 'POST',
        body: { notes },
      }),
      invalidatesTags: (result, error, { curriculumId }) => [
        { type: 'Curriculum' as const, id: curriculumId },
        'Curriculum',
      ],
    }),
    
    markWeekInProgress: builder.mutation<
      ResponseDto<CurriculumItem>,
      { schoolId: string; curriculumId: string; weekNumber: number }
    >({
      query: ({ schoolId, curriculumId, weekNumber }) => ({
        url: `/schools/${schoolId}/curriculum/${curriculumId}/weeks/${weekNumber}/in-progress`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { curriculumId }) => [
        { type: 'Curriculum' as const, id: curriculumId },
        'Curriculum',
      ],
    }),
    
    skipWeek: builder.mutation<
      ResponseDto<CurriculumItem>,
      { schoolId: string; curriculumId: string; weekNumber: number; reason: string }
    >({
      query: ({ schoolId, curriculumId, weekNumber, reason }) => ({
        url: `/schools/${schoolId}/curriculum/${curriculumId}/weeks/${weekNumber}/skip`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (result, error, { curriculumId }) => [
        { type: 'Curriculum' as const, id: curriculumId },
        'Curriculum',
      ],
    }),
    // Grades
    createGrade: builder.mutation<ResponseDto<Grade>, { schoolId: string; gradeData: CreateGradeDto }>({
      query: ({ schoolId, gradeData }) => ({
        url: `/schools/${schoolId}/grades`,
        method: 'POST',
        body: gradeData,
      }),
      invalidatesTags: (result, error, { gradeData }) => [
        { type: 'Grade' as const, id: gradeData.enrollmentId },
        'Class',
      ],
    }),
    bulkCreateGrades: builder.mutation<ResponseDto<Grade[]>, { schoolId: string; classId: string; gradeData: BulkGradeEntryDto }>({
      query: ({ schoolId, classId, gradeData }) => ({
        url: `/schools/${schoolId}/grades/classes/${classId}/bulk`,
        method: 'POST',
        body: gradeData,
      }),
      invalidatesTags: (result, error, { classId }) => [
        { type: 'Grade' as const, id: classId },
        { type: 'Class' as const, id: classId },
      ],
    }),
    getClassGrades: builder.query<
      ResponseDto<Grade[]>,
      { schoolId: string; classId: string; subject?: string; termId?: string; gradeType?: 'CA' | 'ASSIGNMENT' | 'EXAM' }
    >({
      query: ({ schoolId, classId, subject, termId, gradeType }) => {
        const queryParams = new URLSearchParams();
        if (subject) queryParams.append('subject', subject);
        if (termId) queryParams.append('termId', termId);
        if (gradeType) queryParams.append('gradeType', gradeType);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/grades/classes/${classId}${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: (result, error, { classId }) => [{ type: 'Grade' as const, id: classId }],
    }),
    getStudentGrades: builder.query<
      ResponseDto<Grade[]>,
      { schoolId: string; studentId: string; subject?: string; gradeType?: 'CA' | 'ASSIGNMENT' | 'EXAM' }
    >({
      query: ({ schoolId, studentId, subject, gradeType }) => {
        const queryParams = new URLSearchParams();
        if (subject) queryParams.append('subject', subject);
        if (gradeType) queryParams.append('gradeType', gradeType);
        const queryString = queryParams.toString();
        return `/schools/${schoolId}/grades/students/${studentId}${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: (result, error, { studentId }) => [{ type: 'Grade' as const, id: studentId }],
    }),
    updateGrade: builder.mutation<ResponseDto<Grade>, { schoolId: string; gradeId: string; gradeData: UpdateGradeDto }>({
      query: ({ schoolId, gradeId, gradeData }) => ({
        url: `/schools/${schoolId}/grades/${gradeId}`,
        method: 'PATCH',
        body: gradeData,
      }),
      invalidatesTags: (result, error, { gradeId }) => [{ type: 'Grade' as const, id: gradeId }],
    }),
    deleteGrade: builder.mutation<ResponseDto<void>, { schoolId: string; gradeId: string }>({
      query: ({ schoolId, gradeId }) => ({
        url: `/schools/${schoolId}/grades/${gradeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { gradeId }) => [{ type: 'Grade' as const, id: gradeId }],
    }),
    // Get student by ID
    getStudentById: builder.query<ResponseDto<StudentWithEnrollment>, { schoolId: string; id: string }>({
      query: ({ schoolId, id }) => `/schools/${schoolId}/students/${id}`,
      providesTags: (result, error, { id }) => [{ type: 'Student', id }],
    }),
    updateStudent: builder.mutation<ResponseDto<StudentWithEnrollment>, { schoolId: string; id: string; data: Partial<UpdateStudentDto> }>({
      query: ({ schoolId, id, data }) => ({
        url: `/schools/${schoolId}/students/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Student' as const, id },
        { type: 'Student' as const, id: 'LIST' },
        'Student',
      ],
    }),
    // Get students by class
    getStudentsByClass: builder.query<ResponseDto<StudentWithEnrollment[]>, { schoolId: string; classLevel: string }>({
      query: ({ schoolId, classLevel }) => `/schools/${schoolId}/students/by-class/${encodeURIComponent(classLevel)}`,
      providesTags: (result, error, { classLevel }) => [{ type: 'Student', id: `class-${classLevel}` }],
    }),
    // Permissions
    getAllPermissions: builder.query<ResponseDto<Permission[]>, { schoolId: string }>({
      query: ({ schoolId }) => `/schools/${schoolId}/permissions`,
      providesTags: (result) => (result ? [{ type: 'Permission' as const }] : []),
    }),
    /**
     * Get the current admin's own permissions
     * This endpoint does NOT require STAFF:READ permission (avoids circular dependency)
     */
    getMyPermissions: builder.query<ResponseDto<StaffPermissions>, { schoolId: string }>({
      query: ({ schoolId }) => `/schools/${schoolId}/permissions/me`,
      providesTags: (result) => [{ type: 'Permission' as const, id: 'me' }],
    }),
    getAdminPermissions: builder.query<ResponseDto<StaffPermissions>, { schoolId: string; adminId: string }>({
      query: ({ schoolId, adminId }) => `/schools/${schoolId}/admins/${adminId}/permissions`,
      providesTags: (result, error, { adminId }) => [{ type: 'Permission' as const, id: adminId }],
    }),
    assignPermissions: builder.mutation<ResponseDto<StaffPermissions>, { schoolId: string; adminId: string; permissionIds: string[] }>({
      query: ({ schoolId, adminId, permissionIds }) => ({
        url: `/schools/${schoolId}/admins/${adminId}/permissions`,
        method: 'POST',
        body: { permissionIds },
      }),
      invalidatesTags: (result, error, { adminId }) => [{ type: 'Permission' as const, id: adminId }, { type: 'Permission' as const }],
    }),
    // Resend password reset email for staff
    resendPasswordResetForStaff: builder.mutation<ResponseDto<void>, { schoolId: string; staffId: string }>({
      query: ({ schoolId, staffId }) => ({
        url: `/schools/${schoolId}/staff/${staffId}/resend-password-reset`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { staffId }) => [{ type: 'School' as const, id: staffId }],
    }),
    // Resend password reset email for student
    resendPasswordResetForStudent: builder.mutation<ResponseDto<void>, { schoolId: string; studentId: string }>({
      query: ({ schoolId, studentId }) => ({
        url: `/schools/${schoolId}/students/${studentId}/resend-password-reset`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { studentId }) => [{ type: 'School' as const, id: studentId }],
    }),
    // Upload student profile image
    uploadStudentImage: builder.mutation<ResponseDto<any>, { schoolId: string; studentId: string; file: File }>({
      queryFn: async ({ schoolId, studentId, file }, _api, _extraOptions, baseQuery) => {
        const formData = new FormData();
        formData.append('image', file);

        const state = _api.getState() as { auth: { accessToken?: string | null; token?: string | null } };
        const token = state?.auth?.accessToken || state?.auth?.token;

        const tenantId = typeof window !== 'undefined' ? (localStorage.getItem('tenantId') || window.location.hostname.split('.')[0]) : null;

        const baseUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000/api';
        const url = `${baseUrl}/schools/${schoolId}/students/${studentId}/image`;

        const headers: HeadersInit = {};
        if (token) {
          headers['authorization'] = `Bearer ${token}`;
        }
        if (tenantId) {
          headers['x-tenant-id'] = tenantId;
        }

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Upload failed' }));
            return { error: { status: response.status, data: error } };
          }

          const data = await response.json();
          return { data };
        } catch (error: any) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: (result, error, { studentId }) => [
        { type: 'Student' as const, id: studentId },
        { type: 'Student' as const, id: 'LIST' },
        'Student',
      ],
    }),
    // Bulk import staff
    bulkImportStaff: builder.mutation<ResponseDto<{ totalRows: number; successCount: number; errorCount: number; generatedPublicIds: string[]; errors: Array<{ row: number; error: string }> }>, { schoolId: string; file: File }>({
      queryFn: async ({ schoolId, file }, _api, _extraOptions, baseQuery) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const state = _api.getState() as { auth: { accessToken?: string | null; token?: string | null } };
        const token = state?.auth?.accessToken || state?.auth?.token;
        
        const tenantId = typeof window !== 'undefined' ? (localStorage.getItem('tenantId') || window.location.hostname.split('.')[0]) : null;
        
        const baseUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000/api';
        const url = `${baseUrl}/schools/${schoolId}/staff/bulk-import`;
        
        const headers: HeadersInit = {};
        if (token) {
          headers['authorization'] = `Bearer ${token}`;
        }
        if (tenantId && !['localhost', 'www', 'api', 'app'].includes(tenantId)) {
          headers['x-tenant-id'] = tenantId;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Import failed' }));
          return { error: { status: response.status, data: error } };
        }
        
        const data = await response.json();
        return { data };
      },
      invalidatesTags: ['School'],
    }),
    // Bulk import students
    bulkImportStudents: builder.mutation<ResponseDto<{ totalRows: number; successCount: number; errorCount: number; generatedUids: string[]; errors: Array<{ row: number; error: string }> }>, { schoolId: string; file: File }>({
      queryFn: async ({ schoolId, file }, _api, _extraOptions, baseQuery) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const state = _api.getState() as { auth: { accessToken?: string | null; token?: string | null } };
        const token = state?.auth?.accessToken || state?.auth?.token;
        
        const tenantId = typeof window !== 'undefined' ? (localStorage.getItem('tenantId') || window.location.hostname.split('.')[0]) : null;
        
        const baseUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000/api';
        const url = `${baseUrl}/schools/${schoolId}/students/bulk-import`;
        
        const headers: HeadersInit = {};
        if (token) {
          headers['authorization'] = `Bearer ${token}`;
        }
        if (tenantId && !['localhost', 'www', 'api', 'app'].includes(tenantId)) {
          headers['x-tenant-id'] = tenantId;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Import failed' }));
          return { error: { status: response.status, data: error } };
        }
        
        const data = await response.json();
        return { data };
      },
      invalidatesTags: ['Student', 'School'],
    }),

    // Transfer hooks
    generateTac: builder.mutation<
      ResponseDto<{
        transferId: string;
        tac: string;
        studentId: string;
        studentName: string;
        expiresAt: string;
        message: string;
      }>,
      { schoolId: string; studentId: string; reason?: string }
    >({
      query: ({ schoolId, studentId, reason }) => ({
        url: `/schools/${schoolId}/transfers/outgoing/generate`,
        method: 'POST',
        body: { studentId, reason },
      }),
      invalidatesTags: ['School'],
    }),

    getOutgoingTransfers: builder.query<
      ResponseDto<{
        transfers: any[];
        meta: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      }>,
      { schoolId: string; status?: string; page?: number; limit?: number; schoolType?: string }
    >({
      query: ({ schoolId, status, page = 1, limit = 20, schoolType }) => {
        const queryParams = new URLSearchParams();
        if (status) queryParams.append('status', status);
        if (page) queryParams.append('page', page.toString());
        if (limit) queryParams.append('limit', limit.toString());
        if (schoolType) queryParams.append('schoolType', schoolType);
        const queryString = queryParams.toString();
        return {
          url: `/schools/${schoolId}/transfers/outgoing${queryString ? `?${queryString}` : ''}`,
          method: 'GET',
        };
      },
      providesTags: ['School'],
    }),

    revokeTac: builder.mutation<
      ResponseDto<{ message: string }>,
      { schoolId: string; transferId: string }
    >({
      query: ({ schoolId, transferId }) => ({
        url: `/schools/${schoolId}/transfers/outgoing/${transferId}/revoke`,
        method: 'DELETE',
      }),
      invalidatesTags: ['School'],
    }),

    getTransferHistoricalGrades: builder.query<
      ResponseDto<{
        student: any;
        enrollments: any[];
        fromSchool: any;
        transfer: any;
      }>,
      { schoolId: string; transferId: string }
    >({
      query: ({ schoolId, transferId }) => ({
        url: `/schools/${schoolId}/transfers/outgoing/${transferId}/historical-grades`,
        method: 'GET',
      }),
      providesTags: (result, error, { transferId }) => [
        { type: 'Transfer', id: transferId },
        { type: 'Transfer', id: `${transferId}-grades` },
      ],
    }),

    initiateTransfer: builder.mutation<
      ResponseDto<{
        transferId: string;
        studentData: {
          student: any;
          enrollment: any;
          grades: any[];
          fromSchool: { id: string; name: string };
        };
        message: string;
      }>,
      { schoolId: string; tac: string; studentId: string }
    >({
      query: ({ schoolId, tac, studentId }) => ({
        url: `/schools/${schoolId}/transfers/incoming/initiate`,
        method: 'POST',
        body: { tac, studentId },
      }),
      invalidatesTags: ['School', 'Student'],
    }),

    getIncomingTransfers: builder.query<
      ResponseDto<{
        transfers: any[];
        meta: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      }>,
      { schoolId: string; status?: string; page?: number; limit?: number; schoolType?: string }
    >({
      query: ({ schoolId, status, page = 1, limit = 20, schoolType }) => {
        const queryParams = new URLSearchParams();
        if (status) queryParams.append('status', status);
        if (page) queryParams.append('page', page.toString());
        if (limit) queryParams.append('limit', limit.toString());
        if (schoolType) queryParams.append('schoolType', schoolType);
        const queryString = queryParams.toString();
        return {
          url: `/schools/${schoolId}/transfers/incoming${queryString ? `?${queryString}` : ''}`,
          method: 'GET',
        };
      },
      providesTags: ['School'],
    }),

    completeTransfer: builder.mutation<
      ResponseDto<{
        transferId: string;
        newEnrollmentId: string;
        message: string;
      }>,
      {
        schoolId: string;
        transferId: string;
        targetClassLevel: string;
        academicYear: string;
        classId?: string;
        classArmId?: string;
      }
    >({
      query: ({ schoolId, transferId, targetClassLevel, academicYear, classId, classArmId }) => ({
        url: `/schools/${schoolId}/transfers/incoming/${transferId}/complete`,
        method: 'POST',
        body: { targetClassLevel, academicYear, classId, classArmId },
      }),
      invalidatesTags: ['School', 'Student'],
    }),

    rejectTransfer: builder.mutation<
      ResponseDto<{ message: string }>,
      { schoolId: string; transferId: string; reason: string }
    >({
      query: ({ schoolId, transferId, reason }) => ({
        url: `/schools/${schoolId}/transfers/incoming/${transferId}/reject`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['School'],
    }),
  }),
});

export const { 
  useGetMySchoolQuery,
  useUploadSchoolLogoMutation,
  useUpdateMySchoolMutation,
  useRequestEditTokenMutation,
  useVerifyEditTokenQuery,
  useGetSchoolAdminDashboardQuery, 
  useGetStaffListQuery,
  useGetStaffMemberQuery,
  // Teacher Subject hooks
  useGetTeacherSubjectsQuery,
  useGetTeacherWithSubjectsQuery,
  useUpdateTeacherSubjectsMutation,
  useAddTeacherSubjectMutation,
  useRemoveTeacherSubjectMutation,
  useGetAssignableSubjectsQuery,
  useGetClassesQuery,
  useGetClassByIdQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
  useAssignTeacherToClassMutation,
  useRemoveTeacherFromClassMutation,
  // Session hooks
  useGetSessionsQuery,
  useGetActiveSessionQuery,
  useInitializeSessionMutation,
  useCreateTermMutation,
  useStartNewTermMutation,
  useMigrateStudentsMutation,
  useEndTermMutation,
  useReactivateTermMutation,
  useEndSessionMutation,
  // Timetable hooks
  useGetTimetableForClassArmQuery,
  useGetTimetableForTeacherQuery,
  useGetTimetableForClassQuery,
  useGetTimetablesForSchoolTypeQuery,
  useCreateTimetablePeriodMutation,
  useUpdateTimetablePeriodMutation,
    useDeleteTimetablePeriodMutation,
    useDeleteTimetableForClassMutation,
  useCreateMasterScheduleMutation,
  // Resource hooks
  useGetClassLevelsQuery,
  useGetClassArmsQuery,
  useCreateClassArmMutation,
  useGenerateDefaultClassesMutation,
  // Faculty endpoints
  useGetFacultiesQuery,
  useGetFacultyQuery,
  useCreateFacultyMutation,
  useUpdateFacultyMutation,
  useDeleteFacultyMutation,
  useGenerateDefaultFacultiesMutation,
  useGenerateDepartmentsForFacultyMutation,
  // Department endpoints
  useGetDepartmentsQuery,
  useGetDepartmentQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetDepartmentLevelsQuery,
  useGenerateDepartmentLevelsMutation,
  // Level endpoints (Tertiary)
  useGetLevelQuery,
  useGetLevelStudentsQuery,
  useGetLevelCoursesQuery,
  useGetLevelTimetableQuery,
  useGetLevelCurriculumQuery,
  useGetLevelResourcesQuery,
  // Subject endpoints
  useGetSubjectsQuery,
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
  useAssignTeacherToSubjectMutation,
  useRemoveTeacherFromSubjectMutation,
  useAutoGenerateSubjectsMutation,
  useGetSubjectClassAssignmentsQuery,
  useBulkAssignTeachersToClassesMutation,
  useRemoveClassSubjectAssignmentMutation,
  // Teacher workload endpoints
  useGetTeacherWorkloadsQuery,
  useGetLeastLoadedTeacherQuery,
  useGetTeacherTimetableClassesQuery,
  useGetRoomsQuery,
  useCreateRoomMutation,
  useGetCoursesQuery,
  // Event hooks
  useGetEventsQuery,
  useGetUpcomingEventsQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useGetGoogleCalendarStatusQuery,
  useConnectGoogleCalendarMutation,
  useDisconnectGoogleCalendarMutation,
  // Class Resource hooks
  useGetClassResourcesQuery,
  useUploadClassResourceMutation,
  useDeleteClassResourceMutation,
  // NERDC Curriculum hooks
  useGetNerdcSubjectsQuery,
  useGetNerdcTemplateQuery,
  // Timetable-Driven Curriculum hooks
  useGetSubjectsFromTimetableQuery,
  useGetCurriculaSummaryQuery,
  // Curriculum CRUD hooks
  useGetCurriculumForClassQuery,
  useGetCurriculumByIdQuery,
  useCreateCurriculumMutation,
  useGenerateCurriculumMutation,
  useBulkGenerateCurriculumMutation,
  useUpdateCurriculumMutation,
  useDeleteCurriculumMutation,
  // Curriculum Status hooks
  useSubmitCurriculumForApprovalMutation,
  useApproveCurriculumMutation,
  useRejectCurriculumMutation,
  useActivateCurriculumMutation,
  // Curriculum Progress hooks
  useMarkWeekCompleteMutation,
  useMarkWeekInProgressMutation,
  useSkipWeekMutation,
  // Grade hooks
  useCreateGradeMutation,
  useBulkCreateGradesMutation,
  useGetClassGradesQuery,
  useGetStudentGradesQuery,
  useUpdateGradeMutation,
  useDeleteGradeMutation,
  // Teacher hooks
  useGetMyTeacherProfileQuery,
  useGetMyTeacherSchoolQuery,
  useGetTeacherSubjectsForClassQuery,
  useGetMyClassesQuery,
  useGetClassStudentsQuery,
  // Student hooks
  useGetMyStudentProfileQuery,
  useGetMyStudentEnrollmentsQuery,
  useGetMyStudentClassesQuery,
  useGetMyClassmatesQuery,
  useGetMyStudentTimetableQuery,
  useGetMyStudentGradesQuery,
  useGetMyStudentAttendanceQuery,
  useGetMyStudentResourcesQuery,
  useGetMyStudentPersonalResourcesQuery,
  useUploadPersonalResourceMutation,
  useDeletePersonalResourceMutation,
  useGetMyStudentCalendarQuery,
  useGetMyStudentTranscriptQuery,
  useGetMyStudentTransfersQuery,
  useGetMyStudentSchoolQuery,
  // Student Admission hooks
  useAdmitStudentMutation,
  // Student hooks
  useGetStudentsQuery,
  useGetStudentByIdQuery,
  useGetStudentsByClassQuery,
  // Permission hooks
  useGetAllPermissionsQuery,
  useGetMyPermissionsQuery,
  useGetAdminPermissionsQuery,
  useAssignPermissionsMutation,
  // Password reset hooks
  useResendPasswordResetForStaffMutation,
  useResendPasswordResetForStudentMutation,
  useUploadStudentImageMutation,
  useUpdateStudentMutation,
  // Bulk import hooks
  useBulkImportStaffMutation,
  useBulkImportStudentsMutation,
  // Transfer hooks
  useGenerateTacMutation,
  useGetOutgoingTransfersQuery,
  useGetTransferHistoricalGradesQuery,
  useRevokeTacMutation,
  useInitiateTransferMutation,
  useGetIncomingTransfersQuery,
  useCompleteTransferMutation,
  useRejectTransferMutation,
} = schoolAdminApi;

