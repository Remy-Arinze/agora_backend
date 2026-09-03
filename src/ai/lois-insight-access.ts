import { PermissionResource, PermissionType } from '@prisma/client';

export const LOIS_INSIGHT_TYPES = {
  ACADEMIC_RISK: 'ACADEMIC_RISK',
  STUDENT_DROP: 'STUDENT_DROP',
  SOW_GAP: 'SOW_GAP',
  ATTENDANCE_RISK: 'ATTENDANCE_RISK',
  FEE_ARREARS: 'FEE_ARREARS',
  ADMISSIONS_BACKLOG: 'ADMISSIONS_BACKLOG',
} as const;

export type LoisInsightType = (typeof LOIS_INSIGHT_TYPES)[keyof typeof LOIS_INSIGHT_TYPES];

export const ALL_LOIS_INSIGHT_TYPES = Object.values(LOIS_INSIGHT_TYPES);

/** Overview / Analytics read sees the school-wide digest types. */
export const INSIGHT_ACCESS: Record<
  LoisInsightType,
  { resource: PermissionResource; type: PermissionType }[]
> = {
  ACADEMIC_RISK: [
    { resource: PermissionResource.GRADES, type: PermissionType.READ },
    { resource: PermissionResource.ANALYTICS, type: PermissionType.READ },
  ],
  STUDENT_DROP: [
    { resource: PermissionResource.GRADES, type: PermissionType.READ },
    { resource: PermissionResource.STUDENTS, type: PermissionType.READ },
  ],
  SOW_GAP: [
    { resource: PermissionResource.SCHEME_OF_WORK, type: PermissionType.READ },
    { resource: PermissionResource.CURRICULUM, type: PermissionType.READ },
  ],
  ATTENDANCE_RISK: [
    { resource: PermissionResource.STUDENTS, type: PermissionType.READ },
    { resource: PermissionResource.ANALYTICS, type: PermissionType.READ },
  ],
  FEE_ARREARS: [
    { resource: PermissionResource.SETTINGS, type: PermissionType.READ },
    { resource: PermissionResource.STUDENTS, type: PermissionType.READ },
  ],
  ADMISSIONS_BACKLOG: [{ resource: PermissionResource.ADMISSIONS, type: PermissionType.READ }],
};

export function isLoisInsightType(value: string): value is LoisInsightType {
  return (ALL_LOIS_INSIGHT_TYPES as string[]).includes(value);
}
