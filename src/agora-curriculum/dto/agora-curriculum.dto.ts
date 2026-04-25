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
}

export class PublishCurriculumDto {
  @ApiProperty({ enum: AgoraCurriculumPublishStatus })
  @IsEnum(AgoraCurriculumPublishStatus)
  status: AgoraCurriculumPublishStatus;
}
