import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ClassLevelDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  code?: string;

  @ApiProperty()
  level: number;

  @ApiProperty()
  type: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  nextLevelId?: string;
}

export class ClassArmDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  capacity?: number;

  @ApiProperty()
  classLevelId: string;

  @ApiProperty()
  classLevelName: string;

  @ApiProperty()
  isActive: boolean;
}

export class RoomDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  code?: string;

  @ApiProperty({ required: false })
  capacity?: number;

  @ApiProperty({ required: false })
  roomType?: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  isActive: boolean;
}

export class TeacherWithWorkloadDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional({ description: 'Number of periods assigned in the current term' })
  periodCount?: number;

  @ApiPropertyOptional({ description: 'Number of unique classes assigned' })
  classCount?: number;
}

export class SubjectDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  code?: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty({ required: false })
  schoolType?: string;

  @ApiProperty({ required: false })
  classLevelId?: string;

  @ApiProperty({ required: false })
  classLevelName?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false, type: [TeacherWithWorkloadDto] })
  teachers?: TeacherWithWorkloadDto[];
}

export class CreateClassArmDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  capacity?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  classLevelId: string;
}

export class CreateRoomDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  code?: string;

  @ApiProperty({ required: false })
  capacity?: number;

  @ApiProperty({ required: false })
  roomType?: string;
}

export class CreateSubjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ required: false, enum: ['PRIMARY', 'SECONDARY', 'TERTIARY'] })
  @IsEnum(['PRIMARY', 'SECONDARY', 'TERTIARY'])
  @IsOptional()
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  classLevelId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateSubjectDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ required: false, enum: ['PRIMARY', 'SECONDARY', 'TERTIARY'] })
  @IsEnum(['PRIMARY', 'SECONDARY', 'TERTIARY'])
  @IsOptional()
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  classLevelId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  isActive?: boolean;
}

export class AssignTeacherToSubjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  teacherId: string;
}

export class AutoGenerateSubjectsDto {
  @ApiProperty({ required: true, enum: ['PRIMARY', 'SECONDARY'] })
  @IsEnum(['PRIMARY', 'SECONDARY'])
  @IsNotEmpty()
  schoolType: 'PRIMARY' | 'SECONDARY';
}

export class AutoGenerateSubjectsResponseDto {
  @ApiProperty()
  created: number;

  @ApiProperty()
  skipped: number;

  @ApiProperty({ type: [SubjectDto] })
  subjects: SubjectDto[];
}

// ============================================
// CLASS SUBJECT TEACHER ASSIGNMENT DTOs
// For assigning teachers to teach subjects in specific classes (SECONDARY)
// ============================================

export class ClassSubjectAssignmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  classArmId: string;

  @ApiProperty()
  classArmName: string;

  @ApiProperty()
  classLevelName: string;

  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName: string;

  @ApiPropertyOptional()
  teacherId?: string;

  @ApiPropertyOptional()
  teacherName?: string;

  @ApiPropertyOptional()
  sessionId?: string;
}

export class ClassAssignmentEntryDto {
  @ApiProperty({ description: 'ClassArm ID' })
  @IsString()
  @IsNotEmpty()
  classArmId: string;

  @ApiPropertyOptional({ description: 'Teacher ID to assign (null to unassign)' })
  @IsString()
  @IsOptional()
  teacherId?: string;
}

export class BulkClassSubjectAssignmentDto {
  @ApiPropertyOptional({ description: 'Academic session ID (defaults to active session)' })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({ description: 'List of class-teacher assignments', type: [ClassAssignmentEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassAssignmentEntryDto)
  assignments: ClassAssignmentEntryDto[];
}

export class SubjectClassAssignmentsDto {
  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName: string;

  @ApiProperty()
  schoolType: string;

  @ApiProperty({ description: 'All class arms for this school type' })
  classArms: Array<{
    id: string;
    name: string;
    classLevelId: string;
    classLevelName: string;
    fullName: string;
  }>;

  @ApiProperty({ description: 'Current assignments (classArmId -> teacher)' })
  assignments: Record<string, {
    assignmentId: string;
    teacherId: string;
    teacherName: string;
  }>;

  @ApiProperty({ description: 'Teachers competent to teach this subject' })
  competentTeachers: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
}

// ============================================
// TEACHER WORKLOAD DTOs
// For analyzing and balancing teacher assignments
// ============================================

export class TeacherWorkloadDto {
  @ApiProperty()
  teacherId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ description: 'Total periods assigned across all classes' })
  totalPeriods: number;

  @ApiProperty({ description: 'Number of unique classes teaching' })
  classCount: number;

  @ApiProperty({ description: 'Number of unique subjects teaching' })
  subjectCount: number;

  @ApiProperty({ description: 'Periods breakdown by subject' })
  periodsBySubject: Record<string, number>;

  @ApiProperty({ description: 'Periods breakdown by class' })
  periodsByClass: Record<string, number>;

  @ApiProperty({ description: 'Workload status based on thresholds', enum: ['LOW', 'NORMAL', 'HIGH', 'OVERLOADED'] })
  status: 'LOW' | 'NORMAL' | 'HIGH' | 'OVERLOADED';
}

export class TeacherWorkloadSummaryDto {
  @ApiProperty({ type: [TeacherWorkloadDto] })
  teachers: TeacherWorkloadDto[];

  @ApiProperty({ description: 'Average periods per teacher' })
  averagePeriods: number;

  @ApiProperty({ description: 'Teachers with high or overloaded status' })
  warnings: Array<{
    teacherId: string;
    teacherName: string;
    periodCount: number;
    status: string;
    message: string;
  }>;

  @ApiProperty({ description: 'Subjects with no competent teachers assigned' })
  unassignedSubjects: Array<{
    subjectId: string;
    subjectName: string;
    message: string;
  }>;
}

// ============================================
// TIMETABLE GENERATION PREVIEW DTOs
// For previewing auto-generated timetables before applying
// ============================================

export class GeneratedPeriodDto {
  @ApiProperty()
  dayOfWeek: string;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional()
  subjectId?: string;

  @ApiPropertyOptional()
  subjectName?: string;

  @ApiPropertyOptional()
  teacherId?: string;

  @ApiPropertyOptional()
  teacherName?: string;

  @ApiPropertyOptional({ description: 'True if no teacher available for this subject' })
  hasTeacherWarning?: boolean;

  @ApiPropertyOptional({ description: 'Warning message for admin' })
  warningMessage?: string;
}

export class TimetableGenerationPreviewDto {
  @ApiProperty({ type: [GeneratedPeriodDto] })
  periods: GeneratedPeriodDto[];

  @ApiProperty({ description: 'Subjects without assigned teachers' })
  subjectsWithoutTeachers: Array<{
    subjectId: string;
    subjectName: string;
    periodCount: number;
  }>;

  @ApiProperty({ description: 'Teacher assignments summary' })
  teacherAssignments: Array<{
    teacherId: string;
    teacherName: string;
    subjectId: string;
    subjectName: string;
    periodCount: number;
  }>;

  @ApiProperty({ description: 'Overall generation stats' })
  stats: {
    totalPeriods: number;
    assignedPeriods: number;
    unassignedPeriods: number;
    subjectsUsed: number;
    teachersInvolved: number;
  };
}

