import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, IsArray, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  sanitizeString,
  sanitizeOptionalString,
  sanitizeEmail,
  sanitizePhone,
} from '../../common/utils/sanitize.util';

export class AddTeacherDto {
  @ApiProperty({ description: 'Teacher first name' })
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  @Transform(({ value }) => sanitizeString(value, 50))
  firstName: string;

  @ApiProperty({ description: 'Teacher last name' })
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  @Transform(({ value }) => sanitizeString(value, 50))
  lastName: string;

  @ApiProperty({ description: 'Teacher email' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Teacher email is required' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters' })
  @Transform(({ value }) => sanitizeEmail(value) ?? value ?? '')
  email: string;

  @ApiProperty({ description: 'Teacher phone number' })
  @IsString({ message: 'Phone number must be a string' })
  @IsNotEmpty({ message: 'Teacher phone number is required' })
  @MinLength(10, { message: 'Phone number must be at least 10 characters' })
  @MaxLength(20, { message: 'Phone number cannot exceed 20 characters' })
  @Transform(({ value }) => sanitizePhone(value) ?? '')
  phone: string;

  @ApiPropertyOptional({
    description:
      'Primary course/subject the teacher will teach (legacy, use subjectIds for multi-subject)',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => sanitizeOptionalString(value, 100))
  subject?: string;

  @ApiPropertyOptional({
    description: 'Array of subject IDs the teacher is qualified to teach (for SECONDARY schools)',
    type: [String],
    example: ['clxxx1', 'clxxx2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];

  @ApiPropertyOptional({ description: 'Whether the teacher is temporary', default: false })
  @IsOptional()
  @IsBoolean()
  isTemporary?: boolean;

  @ApiPropertyOptional({ description: 'School type (PRIMARY, SECONDARY, TERTIARY)' })
  @IsOptional()
  @IsString()
  schoolType?: string;

  @ApiPropertyOptional({
    description: 'Employee ID (optional internal identifier for the teacher)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => sanitizeOptionalString(value, 50))
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Profile image URL (Cloudinary)' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(({ value }) => sanitizeOptionalString(value, 2048))
  profileImage?: string;

  @ApiPropertyOptional({
    description:
      'Class arm ID to assign the teacher to (for PRIMARY schools). Creates a ClassTeacher record automatically.',
    example: 'clxxx1',
  })
  @IsOptional()
  @IsString()
  classArmId?: string;
}
