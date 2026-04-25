import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSchoolCurriculumDocDto {
  @ApiProperty({ description: 'ID of the school subject' })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'Grade level e.g., JSS_1, SS_2' })
  @IsString()
  @IsNotEmpty()
  gradeLevel: string;

  @ApiPropertyOptional({ description: 'Specific term number (1, 2, or 3)' })
  @IsOptional()
  termNumber?: number;

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
