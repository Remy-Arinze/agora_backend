import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

// Define enums locally to avoid dependency on Prisma client generation
export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export enum PeriodType {
  LESSON = 'LESSON',
  BREAK = 'BREAK',
  ASSEMBLY = 'ASSEMBLY',
  LUNCH = 'LUNCH',
}

export class CreateTimetablePeriodDto {
  @ApiProperty({ description: 'Day of the week', enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  dayOfWeek: DayOfWeek;

  @ApiProperty({ description: 'Start time in HH:mm format (e.g., "08:00")' })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ description: 'End time in HH:mm format (e.g., "09:00")' })
  @IsString()
  @IsNotEmpty()
  endTime: string;

  @ApiProperty({ description: 'Period type', enum: PeriodType, default: PeriodType.LESSON })
  @IsEnum(PeriodType)
  @IsOptional()
  type?: PeriodType;

  @ApiProperty({ description: 'Subject ID (for PRIMARY/SECONDARY schools)', required: false })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiProperty({ description: 'Course ID (for TERTIARY schools)', required: false })
  @IsString()
  @IsOptional()
  courseId?: string;

  @ApiProperty({ description: 'Teacher ID', required: false })
  @IsString()
  @IsOptional()
  teacherId?: string;

  @ApiProperty({ description: 'Room ID', required: false })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiProperty({ description: 'Class ID (for PRIMARY/SECONDARY - direct class assignment)', required: false })
  @IsString()
  @IsOptional()
  classId?: string;

  @ApiProperty({ description: 'Class Arm ID (optional, for sections)', required: false })
  @IsString()
  @IsOptional()
  classArmId?: string;

  @ApiProperty({ description: 'Term ID' })
  @IsString()
  @IsNotEmpty()
  termId: string;
}

export class CreateMasterScheduleDto {
  @ApiProperty({ description: 'Term ID' })
  @IsString()
  @IsNotEmpty()
  termId: string;

  @ApiProperty({ description: 'Array of period definitions' })
  @IsNotEmpty()
  periods: Array<{
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    type?: PeriodType;
  }>;
}

