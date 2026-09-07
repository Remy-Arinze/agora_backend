import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsNumber, IsBoolean, IsDateString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum QuestionType {
    MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
    SHORT_ANSWER = 'SHORT_ANSWER',
    ESSAY = 'ESSAY',
}

export enum AssessmentType {
    QUIZ = 'QUIZ',
    EXAM = 'EXAM',
    ASSIGNMENT = 'ASSIGNMENT',
}

export enum AssessmentStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    CLOSED = 'CLOSED',
}

class CreateQuestionDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    text: string;

    @ApiProperty({ enum: QuestionType })
    @IsEnum(QuestionType)
    type: QuestionType;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    options?: string[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    correctAnswer?: string;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    points: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    stableKey?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    bloomLevel?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    source?: string;

    @ApiProperty()
    @IsNumber()
    order: number;
}

export class CreateAssessmentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ enum: AssessmentType })
    @IsEnum(AssessmentType)
    type: AssessmentType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    classId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    classArmId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    subjectId: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    termId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @IsNumber()
    @Min(0)
    maxScore: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isTimed?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(1)
    duration?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    hasIntegrity?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    autoSubmitOnTimeout?: boolean;

    @ApiPropertyOptional({ description: 'Allow students to submit after the due date (may be flagged late for grading)' })
    @IsOptional()
    @IsBoolean()
    allowLateSubmissionAfterDue?: boolean;

    @ApiPropertyOptional({ description: 'Allow students to submit after the exam timer expires (may be flagged late for grading)' })
    @IsOptional()
    @IsBoolean()
    allowLateSubmissionAfterTimer?: boolean;

    @ApiPropertyOptional({ description: 'Default points deducted when submission is late (due date)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    lateDuePenaltyPoints?: number;

    @ApiPropertyOptional({ description: 'Default points deducted when submission is late (timer)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    lateTimerPenaltyPoints?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(0)
    violationThreshold?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(0)
    pointsPerViolation?: number;

    @ApiPropertyOptional({ enum: AssessmentStatus })
    @IsOptional()
    @IsEnum(AssessmentStatus)
    status?: AssessmentStatus;

    @ApiProperty({ type: [CreateQuestionDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateQuestionDto)
    questions: CreateQuestionDto[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    schemeOfWorkId?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    weekIds?: string[];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    stableKeys?: string[];
}

export class SubmitAnswerDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    questionId: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    text?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    selectedOption?: string;
}

export class SubmitAssessmentDto {
    @ApiProperty({ type: [SubmitAnswerDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SubmitAnswerDto)
    answers: SubmitAnswerDto[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    examSessionToken?: string;

    @ApiPropertyOptional({ description: 'Set when the client auto-submits on timer expiry' })
    @IsOptional()
    @IsBoolean()
    isAutoSubmit?: boolean;
}

export class StartAssessmentResponseDto {
    @ApiProperty()
    examSessionToken: string;

    @ApiProperty()
    startedAt: string;

    @ApiProperty()
    duration: number | null;
}

export class LogViolationDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @IsEnum(['TAB_SWITCH', 'FULLSCREEN_EXIT', 'CLIPBOARD_COPY', 'CLIPBOARD_PASTE', 'CLIPBOARD_CUT', 'DEVTOOLS_OPEN', 'WINDOW_BLUR'])
    type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'CLIPBOARD_COPY' | 'CLIPBOARD_PASTE' | 'CLIPBOARD_CUT' | 'DEVTOOLS_OPEN' | 'WINDOW_BLUR';

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    details?: string;

    @ApiPropertyOptional()
    @IsOptional()
    metadata?: any;
}

export class GradeSubmissionDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    totalScore?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    teacherFeedback?: string;

    @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
    @IsOptional()
    questionScores?: Record<string, number>;

    @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
    @IsOptional()
    questionFeedback?: Record<string, string>;

    @ApiPropertyOptional({ description: 'Points to deduct for late due-date submission (0 = waived)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    lateDueDeduction?: number;

    @ApiPropertyOptional({ description: 'Points to deduct for late timer submission (0 = waived)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    lateTimerDeduction?: number;
}
