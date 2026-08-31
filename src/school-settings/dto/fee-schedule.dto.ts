import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFeeScheduleDto {
  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classLevelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  termId?: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty()
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  lateGraceDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latePenaltyPercent?: number;
}

export class UpdateFeeScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  lateGraceDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latePenaltyPercent?: number;
}
