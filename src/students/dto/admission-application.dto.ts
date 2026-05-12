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

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  gender: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  nationality: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  state: string;

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

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  parentName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  parentPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  parentRelationship: string;

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
