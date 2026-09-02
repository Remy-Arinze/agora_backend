import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';

export class SubmitAdmissionApplicationDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classArmId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicYear?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentRelationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImage?: string;
}

export class ApproveAdmissionApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classArmId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  academicYear: string;
}

export class RejectAdmissionApplicationDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  reason: string;
}
