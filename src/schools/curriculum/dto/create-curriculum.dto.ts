import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// Curriculum Item DTOs
// ============================================

export class CreateCurriculumItemDto {
  @ApiProperty({ example: 1, description: 'Week number (1-13)' })
  @IsInt()
  @Min(1)
  @Max(13)
  weekNumber: number;

  @ApiProperty({ example: 'Introduction to Algebra', description: 'Main topic' })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiPropertyOptional({
    example: ['Linear equations', 'Variables'],
    description: 'Sub-topics within the week',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subTopics?: string[];

  @ApiProperty({
    example: ['Understand basic algebraic concepts', 'Solve simple equations'],
    description: 'Learning objectives',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  objectives: string[];

  @ApiPropertyOptional({
    example: ['Group problem solving', 'Individual practice'],
    description: 'Suggested activities',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  activities?: string[];

  @ApiProperty({
    example: ['Textbook Chapter 1', 'Worksheet 1'],
    description: 'Required resources',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  resources: string[];

  @ApiPropertyOptional({ example: 'Weekly quiz', description: 'Assessment method' })
  @IsString()
  @IsOptional()
  assessment?: string;

  @ApiPropertyOptional({ example: 0, description: 'Display order' })
  @IsInt()
  @IsOptional()
  order?: number;

  // Legacy field for backward compatibility
  @ApiPropertyOptional({ example: 1, description: 'Week number (deprecated, use weekNumber)' })
  @IsInt()
  @IsOptional()
  week?: number;
}

export class UpdateCurriculumItemDto {
  @ApiPropertyOptional({ example: 'Updated topic', description: 'Main topic' })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiPropertyOptional({ type: [String], description: 'Sub-topics' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subTopics?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Learning objectives' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  objectives?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Suggested activities' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  activities?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Required resources' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  resources?: string[];

  @ApiPropertyOptional({ description: 'Assessment method' })
  @IsString()
  @IsOptional()
  assessment?: string;

  @ApiPropertyOptional({ description: "Teacher's notes" })
  @IsString()
  @IsOptional()
  teacherNotes?: string;
}

// ============================================
// Curriculum DTOs
// ============================================

export class CreateCurriculumDto {
  @ApiProperty({ example: 'clx1234567890', description: 'Class ID or ClassArm ID' })
  @IsString()
  @IsNotEmpty()
  classId: string;

  @ApiPropertyOptional({ example: 'clx1234567890', description: 'Subject ID' })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({
    example: 'Mathematics',
    description: 'Subject name (legacy, use subjectId)',
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({ example: '2024/2025', description: 'Academic year' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: 'clx1234567890', description: 'Term ID' })
  @IsString()
  @IsNotEmpty()
  termId: string;

  @ApiPropertyOptional({ example: 'clx1234567890', description: 'NERDC curriculum ID to base on' })
  @IsString()
  @IsOptional()
  nerdcCurriculumId?: string;

  @ApiProperty({
    description: 'Curriculum items',
    type: [CreateCurriculumItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCurriculumItemDto)
  items: CreateCurriculumItemDto[];
}

export class GenerateCurriculumDto {
  @ApiProperty({ example: 'clx1234567890', description: 'Class Level ID' })
  @IsString()
  @IsNotEmpty()
  classLevelId: string;

  @ApiProperty({ example: 'clx1234567890', description: 'Subject ID' })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ example: 'clx1234567890', description: 'Term ID' })
  @IsString()
  @IsNotEmpty()
  termId: string;

  @ApiPropertyOptional({
    example: 'clx1234567890',
    description: 'Specific teacher ID (defaults to current user)',
  })
  @IsString()
  @IsOptional()
  teacherId?: string;
}

export class BulkGenerateCurriculumDto {
  @ApiProperty({ example: 'clx1234567890', description: 'Class Level ID' })
  @IsString()
  @IsNotEmpty()
  classLevelId: string;

  @ApiProperty({ example: 'clx1234567890', description: 'Term ID' })
  @IsString()
  @IsNotEmpty()
  termId: string;

  @ApiProperty({
    example: ['subj1', 'subj2'],
    description: 'Subject IDs to generate curricula for',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  subjectIds: string[];

  @ApiProperty({ example: 'clx1234567890', description: 'Teacher ID' })
  @IsString()
  @IsNotEmpty()
  teacherId: string;
}

export class UpdateCurriculumDto {
  @ApiPropertyOptional({ example: '2024/2025', description: 'Academic year' })
  @IsString()
  @IsOptional()
  academicYear?: string;

  @ApiPropertyOptional({ example: 'clx1234567890', description: 'Term ID' })
  @IsString()
  @IsOptional()
  termId?: string;

  @ApiPropertyOptional({
    description: 'Updated curriculum items',
    type: [CreateCurriculumItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCurriculumItemDto)
  @IsOptional()
  items?: CreateCurriculumItemDto[];
}

// ============================================
// Status Management DTOs
// ============================================

export class SubmitCurriculumDto {
  @ApiPropertyOptional({ description: 'Optional notes for admin' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ApproveCurriculumDto {
  @ApiPropertyOptional({ description: 'Optional notes for teacher' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectCurriculumDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

// ============================================
// Progress Tracking DTOs
// ============================================

export class MarkWeekCompleteDto {
  @ApiPropertyOptional({ description: 'Teacher notes after teaching' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class MarkWeekInProgressDto {
  @ApiPropertyOptional({ description: 'Teacher notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SkipWeekDto {
  @ApiProperty({ description: 'Reason for skipping' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
