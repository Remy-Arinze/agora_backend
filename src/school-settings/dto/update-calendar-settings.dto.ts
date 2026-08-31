import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export class UpdateCalendarSettingsDto {
  @ApiPropertyOptional({ enum: DayOfWeek, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  workingDays?: DayOfWeek[];
}
