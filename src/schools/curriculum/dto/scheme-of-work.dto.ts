import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsArray, Min, Max } from 'class-validator';
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

  @ApiProperty({ description: 'Term ID', example: 't_012' })
  @IsString()
  @IsNotEmpty()
  termId: string;

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
  forceOverwrite?: boolean;
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
