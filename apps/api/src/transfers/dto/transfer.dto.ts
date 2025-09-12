import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { TransferStatus } from '@prisma/client';

export class GenerateTacDto {
  @ApiProperty({ description: 'Student ID to generate TAC for' })
  @IsString()
  studentId: string;

  @ApiPropertyOptional({ description: 'Reason for transfer' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class InitiateTransferDto {
  @ApiProperty({ description: 'Transfer Access Code (TAC)' })
  @IsString()
  tac: string;

  @ApiProperty({ description: 'Student ID (must match TAC)' })
  @IsString()
  studentId: string;
}

export class CompleteTransferDto {
  @ApiProperty({ description: 'Target class level (e.g., JSS2, SS1)' })
  @IsString()
  targetClassLevel: string;

  @ApiProperty({ description: 'Academic year (e.g., 2024/2025)' })
  @IsString()
  academicYear: string;

  @ApiPropertyOptional({ description: 'Class ID (if class exists)' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Class Arm ID (optional)' })
  @IsOptional()
  @IsString()
  classArmId?: string;
}

export class RejectTransferDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  reason: string;
}

export class TransferDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty()
  fromSchoolId: string;

  @ApiPropertyOptional()
  toSchoolId?: string;

  @ApiProperty({ enum: TransferStatus })
  status: TransferStatus;

  @ApiPropertyOptional()
  tac?: string;

  @ApiPropertyOptional()
  tacGeneratedAt?: string;

  @ApiPropertyOptional()
  tacExpiresAt?: string;

  @ApiPropertyOptional()
  tacUsedAt?: string;

  @ApiPropertyOptional()
  tacUsedBy?: string;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  requestedBy?: string;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  approvedAt?: string;

  @ApiPropertyOptional()
  rejectedAt?: string;

  @ApiPropertyOptional()
  rejectionReason?: string;

  @ApiPropertyOptional()
  completedAt?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class StudentTransferDataDto {
  @ApiProperty({ description: 'Student profile information' })
  student: {
    id: string;
    uid: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    email?: string;
    phone?: string;
    address?: string;
    gender?: string;
    bloodGroup?: string;
    allergies?: string;
    medications?: string;
    emergencyContact?: string;
    emergencyContactPhone?: string;
    medicalNotes?: string;
  };

  @ApiProperty({ description: 'Current enrollment information' })
  enrollment: {
    id: string;
    classLevel: string;
    academicYear: string;
    enrollmentDate: string;
    isActive: boolean;
  };

  @ApiProperty({ description: 'All historical grades' })
  grades: Array<{
    id: string;
    subject: string;
    score: number;
    maxScore: number;
    grade: string;
    term: string;
    academicYear: string;
    remarks?: string;
    signedAt?: string;
    createdAt: string;
  }>;

  @ApiProperty({ description: 'Source school information' })
  fromSchool: {
    id: string;
    name: string;
  };
}

export class GenerateTacResponseDto {
  @ApiProperty()
  transferId: string;

  @ApiProperty()
  tac: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty()
  studentName: string;

  @ApiProperty()
  expiresAt: string;

  @ApiProperty()
  message: string;
}

