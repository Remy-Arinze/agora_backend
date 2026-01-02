import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsDateString, IsEnum } from 'class-validator';

export class AddStudentDto {
  @ApiProperty({ description: 'Student first name' })
  @IsString()
  firstName: string;

  @ApiPropertyOptional({ description: 'Student middle name' })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({ description: 'Student last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Student date of birth' })
  @IsDateString()
  dateOfBirth: string;

  @ApiPropertyOptional({ description: 'Student email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Student phone number' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'Student address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Class level (e.g., JSS1, SS1, Class 1) - Required if classArmId not provided' })
  @IsOptional()
  @IsString()
  classLevel?: string;

  @ApiPropertyOptional({ description: 'ClassArm ID (for PRIMARY/SECONDARY schools using ClassArms) - Preferred over classLevel' })
  @IsOptional()
  @IsString()
  classArmId?: string;

  @ApiPropertyOptional({ description: 'Academic year (e.g., 2024/2025)' })
  @IsOptional()
  @IsString()
  academicYear?: string;

  // Parent/Guardian Information
  @ApiProperty({ description: 'Parent/Guardian name' })
  @IsString()
  parentName: string;

  @ApiProperty({ description: 'Parent/Guardian phone' })
  @IsString()
  parentPhone: string;

  @ApiPropertyOptional({ description: 'Parent/Guardian email' })
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @ApiProperty({ description: 'Relationship to student (e.g., Father, Mother, Guardian)' })
  @IsString()
  parentRelationship: string;

  // Health Information (Optional)
  @ApiPropertyOptional({ description: 'Blood group' })
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiPropertyOptional({ description: 'Allergies' })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional({ description: 'Medications' })
  @IsOptional()
  @IsString()
  medications?: string;

  @ApiPropertyOptional({ description: 'Emergency contact name' })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({ description: 'Emergency contact phone' })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'Medical notes' })
  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @ApiPropertyOptional({ description: 'Profile image URL (Cloudinary)' })
  @IsOptional()
  @IsString()
  profileImage?: string;
}

