import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsArray, IsString, IsOptional } from 'class-validator';

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

/**
 * Roles that have permanent full access (cannot be edited)
 * Using exact match for security - prevents "Vice Principal" from getting full access
 * 
 * IMPORTANT: This is the single source of truth for principal roles.
 * Always use isPrincipalRole() function instead of direct string comparison.
 * 
 * Role naming convention: Use underscores for multi-word roles (e.g., 'school_owner', 'head_teacher')
 */
export const PRINCIPAL_ROLES = [
  'principal',
  'school_principal',
  'head_teacher',
  'headmaster',
  'headmistress',
  'school_owner',
] as const;

export type PrincipalRole = typeof PRINCIPAL_ROLES[number];

/**
 * Check if a role is a Principal role (has permanent full access)
 * This is the ONLY function that should be used to check principal roles.
 * 
 * @param role - The role string to check (can be null/undefined)
 * @returns true if the role is a principal role (case-insensitive, exact match)
 * 
 * @example
 * isPrincipalRole('Principal') // true
 * isPrincipalRole('school_owner') // true
 * isPrincipalRole('Vice Principal') // false (not exact match)
 */
export function isPrincipalRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalizedRole = role.toLowerCase().trim();
  return PRINCIPAL_ROLES.some(principalRole => 
    normalizedRole === principalRole.toLowerCase()
  );
}

export class PermissionDto {
  @ApiProperty({ description: 'Permission ID' })
  id: string;

  @ApiProperty({ enum: PermissionResource, description: 'Resource area' })
  resource: PermissionResource;

  @ApiProperty({ enum: PermissionType, description: 'Permission type' })
  type: PermissionType;

  @ApiPropertyOptional({ description: 'Permission description' })
  description?: string;
}

export class AssignPermissionsDto {
  @ApiProperty({
    description: 'Array of permission IDs to assign',
    type: [String],
    example: ['perm1', 'perm2'],
  })
  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}

export class StaffPermissionsDto {
  @ApiProperty({ description: 'Admin ID' })
  adminId: string;

  @ApiProperty({ description: 'Admin name' })
  adminName: string;

  @ApiProperty({ description: 'Admin role' })
  role: string;

  @ApiProperty({ type: [PermissionDto], description: 'Assigned permissions' })
  permissions: PermissionDto[];
}
