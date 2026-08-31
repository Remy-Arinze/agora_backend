import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateExamTimetableSlotDto {
  @ApiProperty()
  @IsString()
  termId: string;

  @ApiProperty({ description: 'Calendar date (YYYY-MM-DD)' })
  @IsDateString()
  examDate: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(TIME_PATTERN)
  startTime: string;

  @ApiProperty({ example: '11:00' })
  @IsString()
  @Matches(TIME_PATTERN)
  endTime: string;

  @ApiProperty()
  @IsString()
  subjectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classArmId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateExamTimetableSlotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  examDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classArmId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PublishExamTimetableDto {
  @ApiProperty()
  @IsString()
  termId: string;
}

export class ExamTimetableSlotDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  termId: string;

  @ApiProperty()
  examDate: Date;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;

  @ApiProperty()
  subjectId: string;

  @ApiPropertyOptional()
  subjectName?: string;

  @ApiPropertyOptional()
  classId?: string;

  @ApiPropertyOptional()
  classArmId?: string;

  @ApiPropertyOptional()
  className?: string;

  @ApiPropertyOptional()
  classArmName?: string;

  @ApiPropertyOptional()
  teacherId?: string;

  @ApiPropertyOptional()
  teacherName?: string;

  @ApiPropertyOptional()
  roomId?: string;

  @ApiPropertyOptional()
  roomName?: string;

  @ApiPropertyOptional()
  notes?: string;
}

export class ExamPublishEligibilityDto {
  @ApiProperty()
  canPublishExamAssessment: boolean;

  @ApiProperty({ type: [String] })
  blockers: string[];
}
