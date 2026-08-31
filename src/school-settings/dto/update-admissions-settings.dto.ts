import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { TransferPolicyMode } from '@prisma/client';

export class UpdateAdmissionsSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  applicationsOpen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applicationDeadline?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  tacExpiryDays?: number;

  @ApiPropertyOptional({ enum: TransferPolicyMode })
  @IsOptional()
  @IsEnum(TransferPolicyMode)
  transferPolicy?: TransferPolicyMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  formFields?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  documentRequirements?: unknown[];
}
