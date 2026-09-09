import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek, PeriodType } from './create-timetable-period.dto';

export class CurateTimetableDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  termId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  classId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  classArmId?: string;

  @ApiPropertyOptional({ enum: ['FILL_EMPTY', 'REPLACE'], default: 'FILL_EMPTY' })
  @IsEnum(['FILL_EMPTY', 'REPLACE'])
  @IsOptional()
  mode?: 'FILL_EMPTY' | 'REPLACE';
}

export class CurateApplyPeriodDto {
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsEnum(PeriodType)
  @IsOptional()
  type?: PeriodType;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;
}

export class CurateApplyTimetableDto extends CurateTimetableDto {
  @ApiPropertyOptional({
    description: 'If omitted, the server generates then applies. If provided, these periods are applied after re-validation.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CurateApplyPeriodDto)
  @IsOptional()
  periods?: CurateApplyPeriodDto[];
}
