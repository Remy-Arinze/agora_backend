import { ApiProperty } from '@nestjs/swagger';

export class SchoolSetupProgressDto {
  @ApiProperty({ description: 'Active academic session and term exist' })
  hasActiveSession: boolean;

  @ApiProperty({ description: 'At least one subject exists for this school type' })
  hasSubjects: boolean;

  @ApiProperty({ description: 'At least one class/course exists for this school type' })
  hasClasses: boolean;

  @ApiProperty({ description: 'At least one teacher exists' })
  hasStaff: boolean;

  @ApiProperty({ description: 'At least one lesson period exists on the timetable' })
  hasTimetable: boolean;

  @ApiProperty({ description: 'At least one published scheme of work / curriculum' })
  hasCurriculum: boolean;

  @ApiProperty({ description: 'At least one active student enrollment' })
  hasStudents: boolean;

  @ApiProperty({
    description: 'Active term has midterm assessment dates set',
  })
  hasMidtermDates: boolean;

  @ApiProperty({
    description: 'Active term has end-of-term exam dates set',
  })
  hasExamDates: boolean;

  @ApiProperty({
    description: 'School has at least one HOLIDAY calendar event (e.g. public holidays)',
  })
  hasHolidays: boolean;

  @ApiProperty({
    description:
      'True when one-time foundation steps (subjects/classes/staff/students) are all done — use to hide them on later terms',
  })
  isFoundationComplete: boolean;

  @ApiProperty({ description: 'Number of completed visible setup steps' })
  completedCount: number;

  @ApiProperty({ description: 'Total visible setup steps for this school state' })
  totalCount: number;

  @ApiProperty({
    description: 'First class/arm id for deep-linking (e.g. curriculum tab)',
    required: false,
    nullable: true,
  })
  suggestedClassId?: string | null;
}
