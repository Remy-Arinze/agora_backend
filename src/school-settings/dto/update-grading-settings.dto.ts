import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { GradeScaleType, ReportCardReleaseMode, TemplatesMode } from '@prisma/client';

export class UpdateGradingSettingsDto {
  @ApiPropertyOptional({ enum: GradeScaleType })
  @IsOptional()
  @IsEnum(GradeScaleType)
  gradeScaleType?: GradeScaleType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  gradeScaleBands?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  passMark?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultCaWeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultExamWeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultLateDuePenalty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultLateTimerPenalty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  defaultIntegrityEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultViolationThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultPointsPerViolation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  defaultAllowLateSubmissionAfterDue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  defaultAllowLateSubmissionAfterTimer?: boolean;

  @ApiPropertyOptional({ enum: TemplatesMode })
  @IsOptional()
  @IsEnum(TemplatesMode)
  templatesMode?: TemplatesMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  gradeLockDaysAfterTermEnd?: number;

  @ApiPropertyOptional({ enum: ReportCardReleaseMode })
  @IsOptional()
  @IsEnum(ReportCardReleaseMode)
  reportCardReleaseMode?: ReportCardReleaseMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gradeApprovalRequired?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gradeApproverRoles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minAttendancePercentForExam?: number;

  @ApiPropertyOptional()
  @IsOptional()
  templates?: unknown[];
}
