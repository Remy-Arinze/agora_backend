import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================
// Curriculum Item DTO (Enhanced with progress tracking)
// ============================================

export class CurriculumItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  curriculumId: string;

  @ApiProperty({ example: 1, description: 'Week number (1-13)' })
  weekNumber: number;

  @ApiProperty({ description: 'Main topic' })
  topic: string;

  @ApiProperty({ type: [String], description: 'Sub-topics' })
  subTopics: string[];

  @ApiProperty({ type: [String], description: 'Learning objectives' })
  objectives: string[];

  @ApiProperty({ type: [String], description: 'Suggested activities' })
  activities: string[];

  @ApiProperty({ type: [String], description: 'Required resources' })
  resources: string[];

  @ApiPropertyOptional({ description: 'Assessment method' })
  assessment: string | null;

  @ApiProperty({ description: 'Display order' })
  order: number;

  // Customization tracking
  @ApiProperty({ description: 'Whether modified from NERDC template' })
  isCustomized: boolean;

  @ApiPropertyOptional({ description: 'Original NERDC topic (if customized)' })
  originalTopic: string | null;

  // Progress tracking
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'], description: 'Week status' })
  status: string;

  @ApiPropertyOptional({ description: 'When this week was taught' })
  taughtAt: Date | null;

  @ApiPropertyOptional({ description: "Teacher's notes after teaching" })
  teacherNotes: string | null;

  @ApiPropertyOptional({ description: 'Teacher ID who marked complete' })
  completedBy: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// Curriculum DTO (Enhanced with status & NERDC)
// ============================================

export class CurriculumDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ description: 'School ID' })
  schoolId: string | null;

  @ApiPropertyOptional({ description: 'Class ID (for TERTIARY)' })
  classId: string | null;

  @ApiPropertyOptional({ description: 'Class Level ID (for PRIMARY/SECONDARY)' })
  classLevelId: string | null;

  @ApiPropertyOptional({ description: 'Subject ID' })
  subjectId: string | null;

  @ApiPropertyOptional({ description: 'Subject name (legacy)' })
  subject: string | null;

  @ApiProperty()
  teacherId: string;

  @ApiPropertyOptional({ description: 'Teacher name' })
  teacherName?: string;

  @ApiProperty()
  academicYear: string;

  @ApiPropertyOptional()
  termId: string | null;

  @ApiPropertyOptional({ description: 'Term name' })
  termName?: string;

  // NERDC Integration
  @ApiPropertyOptional({ description: 'NERDC curriculum template ID' })
  nerdcCurriculumId: string | null;

  @ApiProperty({ description: 'Whether generated from NERDC template' })
  isNerdcBased: boolean;

  @ApiProperty({ description: 'Number of customizations made' })
  customizations: number;

  // Status & Approval
  @ApiProperty({ 
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED'],
    description: 'Curriculum status' 
  })
  status: string;

  @ApiPropertyOptional({ description: 'When submitted for approval' })
  submittedAt: Date | null;

  @ApiPropertyOptional({ description: 'Admin who approved' })
  approvedBy: string | null;

  @ApiPropertyOptional({ description: 'When approved' })
  approvedAt: Date | null;

  @ApiPropertyOptional({ description: 'Reason for rejection' })
  rejectionReason: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [CurriculumItemDto] })
  items: CurriculumItemDto[];

  // Computed progress stats
  @ApiPropertyOptional({ description: 'Total weeks in curriculum' })
  totalWeeks?: number;

  @ApiPropertyOptional({ description: 'Completed weeks' })
  completedWeeks?: number;

  @ApiPropertyOptional({ description: 'Progress percentage' })
  progressPercentage?: number;
}

// ============================================
// Curriculum Summary DTO (for listing)
// ============================================

export class CurriculumSummaryDto {
  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName: string;

  @ApiPropertyOptional()
  subjectCode: string | null;

  @ApiProperty({ description: 'Whether subject is required in timetable' })
  isRequired: boolean;

  @ApiPropertyOptional({ description: 'Existing curriculum ID if any' })
  curriculumId: string | null;

  @ApiPropertyOptional({ 
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED'],
    description: 'Curriculum status if exists' 
  })
  status: string | null;

  @ApiPropertyOptional()
  teacherId: string | null;

  @ApiPropertyOptional()
  teacherName: string | null;

  @ApiProperty({ description: 'Total weeks defined' })
  weeksTotal: number;

  @ApiProperty({ description: 'Weeks marked as completed' })
  weeksCompleted: number;

  @ApiProperty({ description: 'Whether based on NERDC template' })
  isNerdcBased: boolean;

  @ApiProperty({ description: 'Periods per week from timetable' })
  periodsPerWeek: number;

  // Teachers from timetable (for multi-teacher support)
  @ApiPropertyOptional({ type: [Object], description: 'Teachers assigned in timetable' })
  teachers?: { id: string; name: string }[];
}

// ============================================
// Subject from Timetable DTO
// ============================================

export class TimetableSubjectDto {
  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName: string;

  @ApiPropertyOptional()
  subjectCode: string | null;

  @ApiProperty({ description: 'Number of periods per week' })
  periodsPerWeek: number;

  @ApiProperty({ type: [Object], description: 'Teachers assigned to this subject' })
  teachers: { id: string; name: string }[];
}
