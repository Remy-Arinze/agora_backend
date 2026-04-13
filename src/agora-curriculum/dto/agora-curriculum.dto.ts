import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgoraCurriculumSourceStatus, AgoraCurriculumPublishStatus } from '@prisma/client';

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
