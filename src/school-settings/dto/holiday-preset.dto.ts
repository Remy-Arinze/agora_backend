import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateHolidayPresetDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recurringRule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolType?: string;
}

export class UpdateHolidayPresetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recurringRule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolType?: string;
}
