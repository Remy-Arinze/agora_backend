import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus, TermStatus } from '@prisma/client';

export class TermDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  number: number;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ required: false })
  halfTermStart?: Date;

  @ApiProperty({ required: false })
  halfTermEnd?: Date;

  @ApiProperty({ required: false })
  midtermStart?: Date;

  @ApiProperty({ required: false })
  midtermEnd?: Date;

  @ApiProperty({ required: false })
  examStart?: Date;

  @ApiProperty({ required: false })
  examEnd?: Date;

  @ApiProperty({ enum: TermStatus })
  status: TermStatus;

  @ApiProperty()
  academicSessionId: string;

  @ApiProperty({
    required: false,
    description: 'Current calendar week number (from term start). Only present for ACTIVE terms.',
  })
  currentWeek?: number;

  @ApiProperty({
    required: false,
    description: 'Total calendar weeks in this term (from start/end dates).',
  })
  totalWeeks?: number;

  @ApiProperty({
    required: false,
    description:
      'Current teaching week (skips non-instructional stretches). Only present for ACTIVE terms.',
  })
  currentTeachingWeek?: number;

  @ApiProperty({
    required: false,
    description: 'Total teaching weeks in this term (working days minus half-term / holidays).',
  })
  totalTeachingWeeks?: number;

  @ApiProperty({
    required: false,
    description: 'Calendar days until term end (negative when overdue).',
  })
  daysRemaining?: number;

  @ApiProperty({
    required: false,
    description: 'True when today is after the scheduled end date (term may still be ACTIVE).',
  })
  isPastEndDate?: boolean;

  @ApiProperty({
    required: false,
    description: 'True when status is ACTIVE and today falls within start/end dates.',
  })
  isOperationallyActive?: boolean;

  @ApiProperty({ required: false })
  examTimetablePublishedAt?: Date;

  @ApiProperty({ required: false })
  isInExamPeriod?: boolean;

  @ApiProperty({ required: false })
  isLessonScheduleActive?: boolean;

  @ApiProperty({
    required: false,
    enum: ['NOT_STARTED', 'IN_SESSION', 'EXAM_PERIOD', 'OVERDUE', 'ENDED'],
  })
  termPhase?: string;

  @ApiProperty()
  createdAt: Date;
}

export class AcademicSessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ enum: SessionStatus })
  status: SessionStatus;

  @ApiProperty()
  schoolId: string;

  @ApiProperty({ required: false })
  schoolType?: string;

  @ApiProperty({ type: [TermDto] })
  terms: TermDto[];

  @ApiProperty()
  createdAt: Date;
}

export class ActiveSessionDto {
  @ApiProperty({ type: AcademicSessionDto, required: false })
  session?: AcademicSessionDto;

  @ApiProperty({ type: TermDto, required: false })
  term?: TermDto;
}
