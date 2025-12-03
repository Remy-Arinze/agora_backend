import { ApiProperty } from '@nestjs/swagger';
import { DayOfWeek, PeriodType } from './create-timetable-period.dto';

export class TimetablePeriodDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: DayOfWeek })
  dayOfWeek: DayOfWeek;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;

  @ApiProperty({ enum: PeriodType })
  type: PeriodType;

  @ApiProperty({ required: false })
  subjectId?: string;

  @ApiProperty({ required: false })
  subjectName?: string;

  @ApiProperty({ required: false })
  courseId?: string;

  @ApiProperty({ required: false })
  courseName?: string;

  @ApiProperty({ required: false })
  teacherId?: string;

  @ApiProperty({ required: false })
  teacherName?: string;

  @ApiProperty({ required: false })
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    profileImage?: string | null;
  };

  @ApiProperty({ required: false })
  roomId?: string;

  @ApiProperty({ required: false })
  roomName?: string;

  @ApiProperty({ required: false })
  classId?: string;

  @ApiProperty({ required: false })
  className?: string;

  @ApiProperty({ required: false })
  classArmId?: string;

  @ApiProperty({ required: false })
  classArmName?: string;

  @ApiProperty()
  termId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  hasConflict?: boolean; // True if this period conflicts with another period

  @ApiProperty({ required: false })
  conflictMessage?: string; // Description of the conflict

  @ApiProperty({ required: false })
  conflictingPeriodIds?: string[]; // IDs of periods that conflict with this one

  @ApiProperty({ required: false })
  isFromCourseRegistration?: boolean; // True if this period comes from course registration (carry-over)
}

export class ConflictInfo {
  @ApiProperty()
  type: 'TEACHER' | 'ROOM';

  @ApiProperty()
  message: string;

  @ApiProperty()
  conflictingPeriodId?: string;
}

