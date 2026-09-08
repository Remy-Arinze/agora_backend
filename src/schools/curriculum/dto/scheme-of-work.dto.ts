import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  IsBoolean,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchemeGenerationMode } from '@prisma/client';

export class SetupSchemeOfWorkDto {
  @ApiProperty({ description: 'Class level ID', example: 'cl_123' })
  @IsString()
  @IsNotEmpty()
  classLevelId: string;

  @ApiPropertyOptional({ description: 'Specific class ID (for tertiary or arms)', example: 'c_456' })
  @IsString()
  @IsOptional()
  classId?: string;

  @ApiProperty({ description: 'Subject ID', example: 's_789' })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiPropertyOptional({ description: 'Term ID (Optional: If omitted, generates Scheme of Work for the entire session)', example: 't_012' })
  @IsString()
  @IsOptional()
  termId?: string;

  @ApiProperty({ enum: SchemeGenerationMode })
  @IsEnum(SchemeGenerationMode)
  mode: SchemeGenerationMode;

  @ApiPropertyOptional({ description: 'Agora Curriculum ID (for Option A)' })
  @IsString()
  @IsOptional()
  agoraCurriculumId?: string;

  @ApiPropertyOptional({ description: 'School Curriculum Doc ID (for Option B)' })
  @IsString()
  @IsOptional()
  schoolCurriculumDocId?: string;

  @ApiPropertyOptional({ description: 'School Curriculum Doc IDs (Legacy/Multiple)' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  schoolCurriculumDocIds?: string[];

  @ApiPropertyOptional({ description: 'Force overwrite existing Scheme of Work via archiving' })
  @IsOptional()
  @IsBoolean()
  forceOverwrite?: boolean;

  @ApiPropertyOptional({ description: 'Agora merge weight percent (MERGED)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  mergeWeightAgora?: number;

  @ApiPropertyOptional({ description: 'School merge weight percent (MERGED)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  mergeWeightSchool?: number;
}

export class UpdateSchemeOfWorkStatusDto {
  @ApiProperty({ description: 'New status' })
  @IsString()
  @IsNotEmpty()
  status: string; // Draft, Approved, Published
}

export class SchemeOfWorkResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  classLevelId: string;

  @ApiPropertyOptional()
  classId?: string;

  @ApiProperty()
  termId: string;

  @ApiProperty({ enum: SchemeGenerationMode })
  mode: SchemeGenerationMode;

  @ApiProperty()
  status: string;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional()
  generatedAt?: Date;

  @ApiPropertyOptional()
  publishedAt?: Date;
}

export class ReplaceSchemeWeekDto {
  @ApiPropertyOptional({ description: 'Existing week id (omit for new weeks)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Topic title' })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subTopics?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Learning objectives' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resources?: string[];

  @ApiPropertyOptional({ description: 'Assessment type (CATCH_UP is stripped for content weeks)' })
  @IsOptional()
  @IsString()
  assessment?: string;
}

export class ReplaceSchemeWeeksDto {
  @ApiProperty({ type: [ReplaceSchemeWeekDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReplaceSchemeWeekDto)
  weeks: ReplaceSchemeWeekDto[];
}
