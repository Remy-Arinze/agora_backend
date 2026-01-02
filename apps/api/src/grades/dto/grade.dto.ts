import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsNotEmpty, Min, Max, IsEnum, IsDateString, IsInt, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum GradeType {
  CA = 'CA',
  ASSIGNMENT = 'ASSIGNMENT',
  EXAM = 'EXAM',
}

export class CreateGradeDto {
  @ApiProperty({ description: 'Enrollment ID' })
  @IsString()
  @IsNotEmpty()
  enrollmentId: string;

  @ApiPropertyOptional({ description: 'Subject ID (preferred over subject string)' })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiProperty({ description: 'Subject name (auto-populated if subjectId provided)', required: false })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({ description: 'Grade type', enum: GradeType, example: GradeType.CA })
  @IsEnum(GradeType)
  @IsNotEmpty()
  gradeType: GradeType;

  @ApiPropertyOptional({ description: 'Assessment name', example: 'CA1', required: false })
  @IsString()
  @IsOptional()
  assessmentName?: string;

  @ApiPropertyOptional({ description: 'Assessment date (ISO string)', required: false })
  @IsDateString()
  @IsOptional()
  assessmentDate?: string;

  @ApiPropertyOptional({ description: 'Sequence number', example: 1, required: false })
  @IsInt()
  @IsOptional()
  sequence?: number;

  @ApiProperty({ description: 'Score obtained', example: 85 })
  @IsNumber()
  @Min(0)
  score: number;

  @ApiProperty({ description: 'Maximum possible score', example: 100, default: 100 })
  @IsNumber()
  @Min(0)
  maxScore: number;

  @ApiProperty({ description: 'Term name', required: false })
  @IsString()
  @IsOptional()
  term?: string;

  @ApiProperty({ description: 'Term ID', required: false })
  @IsString()
  @IsOptional()
  termId?: string;

  @ApiProperty({ description: 'Academic year', required: false })
  @IsString()
  @IsOptional()
  academicYear?: string;

  @ApiProperty({ description: 'Teacher remarks', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({ description: 'Whether grade is published', default: false })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class UpdateGradeDto {
  @ApiPropertyOptional({ description: 'Score obtained', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  score?: number;

  @ApiPropertyOptional({ description: 'Maximum possible score', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxScore?: number;

  @ApiPropertyOptional({ description: 'Subject ID (preferred over subject string)' })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Subject name', required: false })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Assessment name', required: false })
  @IsString()
  @IsOptional()
  assessmentName?: string;

  @ApiPropertyOptional({ description: 'Assessment date (ISO string)', required: false })
  @IsDateString()
  @IsOptional()
  assessmentDate?: string;

  @ApiPropertyOptional({ description: 'Sequence number', required: false })
  @IsInt()
  @IsOptional()
  sequence?: number;

  @ApiPropertyOptional({ description: 'Teacher remarks', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({ description: 'Whether grade is published', required: false })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class StudentGradeEntryDto {
  @ApiProperty({ description: 'Enrollment ID' })
  @IsString()
  @IsNotEmpty()
  enrollmentId: string;

  @ApiProperty({ description: 'Score obtained', example: 85 })
  @IsNumber()
  @Min(0)
  score: number;

  @ApiPropertyOptional({ description: 'Teacher remarks', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class BulkGradeEntryDto {
  @ApiProperty({ description: 'Class ID' })
  @IsString()
  @IsNotEmpty()
  classId: string;

  @ApiPropertyOptional({ description: 'Subject ID (preferred over subject string)' })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Subject name (auto-populated if subjectId provided)', required: false })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({ description: 'Grade type', enum: GradeType, example: GradeType.CA })
  @IsEnum(GradeType)
  @IsNotEmpty()
  gradeType: GradeType;

  @ApiProperty({ description: 'Assessment name', example: 'CA1' })
  @IsString()
  @IsNotEmpty()
  assessmentName: string;

  @ApiPropertyOptional({ description: 'Assessment date (ISO string)', required: false })
  @IsDateString()
  @IsOptional()
  assessmentDate?: string;

  @ApiPropertyOptional({ description: 'Sequence number', example: 1, required: false })
  @IsInt()
  @IsOptional()
  sequence?: number;

  @ApiProperty({ description: 'Maximum possible score', example: 100, default: 100 })
  @IsNumber()
  @Min(0)
  maxScore: number;

  @ApiPropertyOptional({ description: 'Term ID', required: false })
  @IsString()
  @IsOptional()
  termId?: string;

  @ApiPropertyOptional({ description: 'Academic year', required: false })
  @IsString()
  @IsOptional()
  academicYear?: string;

  @ApiPropertyOptional({ description: 'Whether grades are published', default: false })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiProperty({ description: 'Array of student grades', type: [StudentGradeEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentGradeEntryDto)
  grades: StudentGradeEntryDto[];
}

