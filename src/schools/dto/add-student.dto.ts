import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsDateString, MaxLength, MinLength, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  sanitizeString,
  sanitizeOptionalString,
  sanitizeEmail,
  sanitizePhone,
} from '../../common/utils/sanitize.util';

export class AddStudentDto {
  @ApiProperty({ description: 'Student first name' })
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  @Transform(({ value }) => sanitizeString(value, 50))
  firstName: string;

  @ApiPropertyOptional({ description: 'Student middle name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => sanitizeOptionalString(value, 50))
  middleName?: string;

  @ApiProperty({ description: 'Student last name' })
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  @Transform(({ value }) => sanitizeString(value, 50))
  lastName: string;

  @ApiProperty({ description: 'Student date of birth' })
  @IsDateString({}, { message: 'Please provide a valid date of birth' })
  @IsNotEmpty({ message: 'Date of birth is required' })
  dateOfBirth: string;

  @ApiProperty({ description: 'Student gender' })
  @IsString({ message: 'Gender must be a string' })
  @IsNotEmpty({ message: 'Gender is required' })
  @Transform(({ value }) => sanitizeString(value, 10))
  gender: string;

  @ApiProperty({ description: 'Student email' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Student email is required' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters' })
  @Transform(({ value }) => sanitizeEmail(value))
  email: string;

  @ApiPropertyOptional({ description: 'Student phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => sanitizePhone(value))
  phone?: string;

  @ApiPropertyOptional({ description: 'Student address' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => sanitizeOptionalString(value, 500))
  address?: string;

  @ApiProperty({ description: 'Nationality (e.g. Nigerian, Ghanaian)' })
  @IsString({ message: 'Nationality must be a string' })
  @IsNotEmpty({ message: 'Nationality is required' })
  @MaxLength(100, { message: 'Nationality cannot exceed 100 characters' })
  @Transform(({ value }) => sanitizeString(value, 100))
  nationality: string;

  @ApiProperty({ description: 'State or region (e.g. Lagos, Abuja)' })
  @IsString({ message: 'State or region must be a string' })
  @IsNotEmpty({ message: 'State or region is required' })
  @MaxLength(100, { message: 'State cannot exceed 100 characters' })
  @Transform(({ value }) => sanitizeString(value, 100))
  state: string;

  @ApiPropertyOptional({
    description: 'Class level (e.g., JSS1, SS1, Class 1) - Required if classArmId not provided',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => sanitizeOptionalString(value, 100))
  classLevel?: string;

  @ApiPropertyOptional({
    description:
      'ClassArm ID (for PRIMARY/SECONDARY schools using ClassArms) - Preferred over classLevel',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => sanitizeOptionalString(value, 100))
  classArmId?: string;

  @ApiPropertyOptional({ description: 'Academic year (e.g., 2024/2025)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => sanitizeOptionalString(value, 50))
  academicYear?: string;

  // Parent/Guardian Information
  @ApiProperty({ description: 'Parent/Guardian name' })
  @IsString({ message: 'Parent/Guardian name must be a string' })
  @IsNotEmpty({ message: 'Parent/Guardian name is required' })
  @MaxLength(100, { message: 'Parent name cannot exceed 100 characters' })
  @Transform(({ value }) => sanitizeString(value, 100))
  parentName: string;

  @ApiProperty({ description: 'Parent/Guardian phone' })
  @IsString({ message: 'Parent/Guardian phone must be a string' })
  @IsNotEmpty({ message: 'Parent/Guardian phone is required' })
  @MinLength(10, { message: 'Parent phone must be at least 10 characters' })
  @MaxLength(20, { message: 'Parent phone cannot exceed 20 characters' })
  @Transform(({ value }) => sanitizePhone(value) ?? '')
  parentPhone: string;

  @ApiPropertyOptional({ description: 'Parent/Guardian email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => sanitizeEmail(value))
  parentEmail?: string;

  @ApiProperty({ description: 'Relationship to student (e.g., Father, Mother, Guardian)' })
  @IsString({ message: 'Relationship must be a string' })
  @IsNotEmpty({ message: 'Relationship to student is required' })
  @MaxLength(50, { message: 'Relationship cannot exceed 50 characters' })
  @Transform(({ value }) => sanitizeString(value, 50))
  parentRelationship: string;

  // Health Information (Optional)
  @ApiPropertyOptional({ description: 'Blood group' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => sanitizeOptionalString(value, 20))
  bloodGroup?: string;

  @ApiPropertyOptional({ description: 'Allergies' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => sanitizeOptionalString(value, 500))
  allergies?: string;

  @ApiPropertyOptional({ description: 'Medications' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => sanitizeOptionalString(value, 500))
  medications?: string;

  @ApiPropertyOptional({ description: 'Emergency contact name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => sanitizeOptionalString(value, 100))
  emergencyContact?: string;

  @ApiPropertyOptional({ description: 'Emergency contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => sanitizePhone(value))
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'Medical notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => sanitizeOptionalString(value, 1000))
  medicalNotes?: string;

  @ApiPropertyOptional({ description: 'Profile image URL (Cloudinary)' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(({ value }) => sanitizeOptionalString(value, 2048))
  profileImage?: string;
}
