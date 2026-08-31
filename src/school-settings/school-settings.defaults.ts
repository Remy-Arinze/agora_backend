import { Prisma } from '@prisma/client';

export const DEFAULT_ADMISSION_FORM_FIELDS = [
  { key: 'firstName', label: 'First Name', required: true, visible: true },
  { key: 'lastName', label: 'Last Name', required: true, visible: true },
  { key: 'middleName', label: 'Middle Name', required: false, visible: true },
  { key: 'email', label: 'Email', required: true, visible: true },
  { key: 'phone', label: 'Phone', required: false, visible: true },
  { key: 'dateOfBirth', label: 'Date of Birth', required: true, visible: true },
  { key: 'gender', label: 'Gender', required: true, visible: true },
  { key: 'address', label: 'Address', required: false, visible: true },
  { key: 'nationality', label: 'Nationality', required: true, visible: true },
  { key: 'state', label: 'State', required: true, visible: true },
  { key: 'parentName', label: 'Parent/Guardian Name', required: true, visible: true },
  { key: 'parentPhone', label: 'Parent Phone', required: true, visible: true },
  { key: 'parentEmail', label: 'Parent Email', required: false, visible: true },
  { key: 'parentRelationship', label: 'Relationship', required: true, visible: true },
  { key: 'bloodGroup', label: 'Blood Group', required: false, visible: true },
  { key: 'allergies', label: 'Allergies', required: false, visible: true },
  { key: 'medications', label: 'Medications', required: false, visible: true },
  { key: 'emergencyContact', label: 'Emergency Contact', required: false, visible: true },
  { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', required: false, visible: true },
  { key: 'medicalNotes', label: 'Medical Notes', required: false, visible: true },
];

export const DEFAULT_DOCUMENT_REQUIREMENTS = [
  { key: 'birth_certificate', label: 'Birth Certificate', required: false, description: 'Upload a copy of birth certificate' },
  { key: 'previous_report', label: 'Previous Report Card', required: false, description: 'Most recent academic report' },
];

export const DEFAULT_EVENT_TRIGGERS = {
  GRADE_PUBLISHED: true,
  ABSENCE: true,
  TRANSFER_APPROVED: true,
  FEE_DUE: true,
  ADMISSION_RECEIVED: true,
  SESSION_STARTED: false,
};

export const DEFAULT_STRUCTURE_CONFIG: Prisma.SchoolStructureConfigCreateWithoutSchoolInput = {
  defaultClassArmNames: ['A', 'B', 'C'],
  classLevelNamingMode: 'STANDARD',
  subjectRegistryMode: 'AGORA_PLUS_CUSTOM',
  defaultAgoraSubjectIds: [],
  facultyStructureVisible: true,
  teacherScope: 'ASSIGNED_ONLY',
  customRoles: [],
  admissionApproverRoles: [],
  transferApproverRoles: [],
};

export const DEFAULT_GRADING_POLICY: Prisma.GradingPolicyCreateWithoutSchoolInput = {
  gradeScaleType: 'PERCENTAGE',
  passMark: 40,
  defaultCaWeight: 40,
  defaultExamWeight: 60,
  defaultLateDuePenalty: 0,
  defaultLateTimerPenalty: 0,
  defaultIntegrityEnabled: false,
  defaultViolationThreshold: 1,
  defaultPointsPerViolation: 0,
  defaultAllowLateSubmissionAfterDue: false,
  defaultAllowLateSubmissionAfterTimer: false,
  templatesMode: 'TEACHER_DISCRETION',
  gradeLockDaysAfterTermEnd: 7,
  reportCardReleaseMode: 'MANUAL',
  gradeApprovalRequired: false,
  gradeApproverRoles: [],
  minAttendancePercentForExam: 75,
};

export const DEFAULT_ADMISSION_POLICY: Prisma.AdmissionPolicyCreateWithoutSchoolInput = {
  applicationsOpen: true,
  tacExpiryDays: 30,
  transferPolicy: 'MANUAL_REVIEW',
  formFields: DEFAULT_ADMISSION_FORM_FIELDS,
  documentRequirements: DEFAULT_DOCUMENT_REQUIREMENTS,
};

export const DEFAULT_TIMETABLE_POLICY: Prisma.TimetablePolicyCreateWithoutSchoolInput = {
  defaultPeriodLengthMinutes: 40,
  maxPeriodsPerTeacherPerDay: 6,
  roomCapacityWarningEnabled: true,
  examBlackoutEnabled: true,
  substituteNotifyRoles: [],
};

export const DEFAULT_ATTENDANCE_POLICY: Prisma.AttendancePolicyCreateWithoutSchoolInput = {
  markingWindowHours: 24,
  statusOptions: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK'],
  minAttendancePercent: 75,
  absenceNotifyChannels: ['EMAIL', 'IN_APP'],
  editRoles: ['TEACHER', 'ADMIN'],
};

export const DEFAULT_NOTIFICATION_POLICY: Prisma.NotificationPolicyCreateWithoutSchoolInput = {
  enabledChannels: ['EMAIL', 'IN_APP', 'PUSH'],
  eventTriggers: DEFAULT_EVENT_TRIGGERS,
  quietHoursTimezone: 'Africa/Lagos',
};

export const DEFAULT_FINANCE_POLICY: Prisma.FinancePolicyCreateWithoutSchoolInput = {
  paymentMethods: ['BANK_TRANSFER', 'PAYSTACK', 'CASH'],
  feeVisibleToStudents: false,
};

export const DEFAULT_CURRICULUM_POLICY: Prisma.CurriculumPolicyCreateWithoutSchoolInput = {
  curriculumSource: 'MERGED',
  schemeApprovalRequired: false,
  schemeApproverRoles: [],
};

export const DEFAULT_SECURITY_POLICY: Prisma.SecurityPolicyCreateWithoutSchoolInput = {
  sessionTimeoutMinutes: 480,
  passwordMinLength: 8,
  passwordRequireSpecialChar: true,
  passwordResetDays: 90,
  auditLogRetentionDays: 365,
  alumniDataRetentionYears: 7,
  studentPhotoConsentRequired: false,
  sensitiveChangesRequireEmailVerification: true,
};
