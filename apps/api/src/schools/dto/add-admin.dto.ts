import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminRole } from './create-school.dto';
import { PermissionResource, PermissionType } from './permission.dto';

/**
 * Represents a single permission assignment for the new admin
 */
export class AdminPermissionDto {
  @ApiProperty({
    description: 'The resource to grant permission for',
    enum: PermissionResource,
    example: PermissionResource.STUDENTS,
  })
  @IsString()
  resource: PermissionResource;

  @ApiProperty({
    description: 'The permission type (READ, WRITE, or ADMIN)',
    enum: PermissionType,
    example: PermissionType.READ,
  })
  @IsString()
  type: PermissionType;
}

export class AddAdminDto {
  @ApiProperty({ description: 'Admin first name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Admin last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Admin phone number' })
  @IsString()
  phone: string;

  @ApiProperty({
    description:
      'Admin role (can be enum value or custom role string like "Bursar", "Vice Principal", etc.)',
    example: 'BURSAR or "Dean of Students"',
  })
  @IsString()
  role: string; // Changed to string to accept custom roles

  @ApiPropertyOptional({ description: 'Profile image URL (Cloudinary)' })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional({ description: 'Employee ID (optional internal identifier)' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({
    description:
      'Custom permissions to assign. If not provided, default READ permissions for all resources will be assigned.',
    type: [AdminPermissionDto],
    example: [
      { resource: 'STUDENTS', type: 'READ' },
      { resource: 'STUDENTS', type: 'WRITE' },
      { resource: 'CLASSES', type: 'READ' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminPermissionDto)
  permissions?: AdminPermissionDto[];
}
