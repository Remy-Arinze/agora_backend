import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class BellScheduleTemplateInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsString()
  schoolType!: string;

  @ApiPropertyOptional()
  periods!: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateTimetableSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultPeriodLengthMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPeriodsPerTeacherPerDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  roomCapacityWarningEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  examBlackoutEnabled?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  substituteNotifyRoles?: string[];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  bellScheduleTemplates?: BellScheduleTemplateInput[];
}
