import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import { CurriculumSourceMode } from '@prisma/client';

export class UpdateCurriculumSettingsDto {
  @ApiPropertyOptional({ enum: CurriculumSourceMode })
  @IsOptional()
  @IsEnum(CurriculumSourceMode)
  curriculumSource?: CurriculumSourceMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  schemeApprovalRequired?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  schemeApproverRoles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  aiCreditLimitPerTeacher?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  aiCreditLimitPerDepartment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  departmentCreditOverrides?: Record<string, number>;
}
