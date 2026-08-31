import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateCommunicationsSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailSenderName?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledChannels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  eventTriggers?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quietHoursTimezone?: string;
}
