import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchemeGenerationMode, SchemeOfWorkStatus } from '@prisma/client';

export class GenerateSchemeOfWorkDto {
  @ApiPropertyOptional({ description: 'Specific class arm ID (primary/secondary)' })
  @IsOptional()
  @IsString()
  classArmId?: string;

  @ApiPropertyOptional({ description: 'Specific class ID (tertiary or common course)' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiProperty({ description: 'ID of the subject (from the school scope)' })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'ID of the term/semester' })
  @IsString()
  @IsNotEmpty()
  termId: string;

  @ApiProperty({ enum: SchemeGenerationMode })
  @IsEnum(SchemeGenerationMode)
  generationMode: SchemeGenerationMode;

  @ApiPropertyOptional({ description: 'Agora Curriculum ID to draw from' })
  @IsOptional()
  @IsString()
  agoraCurriculumId?: string;

  @ApiPropertyOptional({ description: 'School custom doc ID to draw from' })
  @IsOptional()
  @IsString()
  schoolCurriculumId?: string;

  @ApiPropertyOptional({ description: 'Percentage weight for Agora (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  mergeWeightAgora?: number;

  @ApiPropertyOptional({ description: 'Percentage weight for School Custom (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  mergeWeightSchool?: number;

  @ApiPropertyOptional({ description: 'Parent scheme ID to fork from' })
  @IsOptional()
  @IsString()
  parentSchemeId?: string;
}

export class UpdateSchemeOfWorkStatusDto {
  @ApiProperty({ enum: SchemeOfWorkStatus })
  @IsEnum(SchemeOfWorkStatus)
  status: SchemeOfWorkStatus;
}

export class UpdateSchemeOfWorkWeekDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: true })
  subTopics?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: true })
  learningOutcomes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: true })
  studentFriendlyOutcomes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: true })
  suggestedActivities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: true })
  resources?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessmentType?: string;
}

export class MarkWeekDeliveredDto {
  @ApiProperty({ description: 'Is the week successfully delivered?' })
  @IsBoolean()
  isDelivered: boolean;

  @ApiPropertyOptional({ description: 'Private teacher notes tracking delivery challenges/wins' })
  @IsOptional()
  @IsString()
  privateTeacherNotes?: string;
}
