import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class AddTeacherDto {
  @ApiProperty({ description: 'Teacher first name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Teacher last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Teacher email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Teacher phone number' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({
    description:
      'Primary course/subject the teacher will teach (legacy, use subjectIds for multi-subject)',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
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
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Profile image URL (Cloudinary)' })
  @IsOptional()
  @IsString()
  profileImage?: string;
}
