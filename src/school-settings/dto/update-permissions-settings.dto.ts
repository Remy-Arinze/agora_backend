import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { TeacherScopeMode } from '@prisma/client';

export class UpdatePermissionsSettingsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customRoles?: string[];

  @ApiPropertyOptional({ enum: TeacherScopeMode })
  @IsOptional()
  @IsEnum(TeacherScopeMode)
  teacherScope?: TeacherScopeMode;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  admissionApproverRoles?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transferApproverRoles?: string[];
}
