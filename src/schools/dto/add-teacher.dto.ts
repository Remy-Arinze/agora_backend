import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, IsArray, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  sanitizeString,
  sanitizeOptionalString,
  sanitizeEmail,
  sanitizePhone,
} from '../../common/utils/sanitize.util';

export class AddTeacherDto {
  @ApiProperty({ description: 'Teacher first name' })
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => sanitizeString(value, 50))
  firstName: string;

  @ApiProperty({ description: 'Teacher last name' })
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => sanitizeString(value, 50))
  lastName: string;

  @ApiProperty({ description: 'Teacher email' })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => sanitizeEmail(value) ?? value ?? '')
  email: string;

  @ApiProperty({ description: 'Teacher phone number' })
  @IsString()
  @MinLength(10)
  @MaxLength(20)
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
}
