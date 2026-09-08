import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgoraCurriculumSourceStatus, AgoraCurriculumPublishStatus } from '@prisma/client';

export class CreateAgoraSubjectDto {
  @ApiProperty({ description: 'Name of the subject' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Code for the subject (unique)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Category e.g., CORE, ELECTIVE' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'List of school types e.g., ["PRIMARY", "SECONDARY"]' })
  @IsArray()
  @IsString({ each: true })
  schoolTypes: string[];

  @ApiPropertyOptional({ description: 'PRIMARY, JUNIOR (JSS), and/or SENIOR (SS)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  levelStreams?: string[];

  @ApiPropertyOptional({ description: 'Brief description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateAgoraSubjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  schoolTypes?: string[];

  @ApiPropertyOptional({ description: 'PRIMARY, JUNIOR (JSS), and/or SENIOR (SS)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  levelStreams?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAgoraCurriculumSourceDto {
  @ApiProperty({ description: 'ID of the NerdcSubject' })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'Grade level e.g., JSS_1, SS_2' })
  @IsString()
  @IsNotEmpty()
  gradeLevel: string;

  @ApiProperty({ description: 'MANUAL or FILE_UPLOAD' })
  @IsString()
  @IsNotEmpty()
  sourceType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  manualContent?: any;
}

/** Multipart body for /sources/upload-multiple. Supports one shared subject/grade or a per-file queue. */
export class UploadMultipleCurriculumSourcesDto {
  @ApiPropertyOptional({ description: 'Shared subject ID when all files belong to one subject' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Shared grade(s), comma-separated, when not using entries' })
  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @ApiPropertyOptional({ description: 'MANUAL or FILE_UPLOAD' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({
    description: 'JSON array of { fileIndex, subjectId, gradeLevel } for mixed-subject queues',
  })
  @IsOptional()
  @IsString()
  entries?: string;
}

export class ConsolidateCurriculumDto {
  @ApiProperty({ description: 'ID of the NerdcSubject' })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'Grade level e.g., JSS_1, SS_2' })
  @IsString()
  @IsNotEmpty()
  gradeLevel: string;

  @ApiProperty({ description: 'Array of source IDs to use' })
  @IsNotEmpty()
  sourceIds: string[];

  @ApiPropertyOptional({ description: 'Mint a new version even if a complete draft already exists' })
  @IsOptional()
  @IsBoolean()
  forceNewVersion?: boolean;
}

export class PublishCurriculumDto {
  @ApiProperty({ enum: AgoraCurriculumPublishStatus })
  @IsEnum(AgoraCurriculumPublishStatus)
  status: AgoraCurriculumPublishStatus;
}
