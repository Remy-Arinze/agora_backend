import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  sessionTimeoutMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(6)
  passwordMinLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireSpecialChar?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  passwordResetDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  auditLogRetentionDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  alumniDataRetentionYears?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  studentPhotoConsentRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sensitiveChangesRequireEmailVerification?: boolean;
}
