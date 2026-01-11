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
 */
export const PRINCIPAL_ROLES = [
  'principal',
  'school principal',
  'head teacher',
  'headmaster',
  'headmistress',
] as const;

/**
 * Check if a role is a Principal role (has permanent full access)
 */
export function isPrincipalRole(role: string): boolean {
  const normalizedRole = role.toLowerCase().trim();
  return PRINCIPAL_ROLES.includes(normalizedRole as (typeof PRINCIPAL_ROLES)[number]);
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
