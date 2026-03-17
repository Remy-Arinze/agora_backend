import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsNumber, IsDateString, ValidateNested, Min, Max } from 'class-validator';
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

    @ApiProperty()
    @IsNumber()
    @Min(0)
    maxScore: number;

    @ApiProperty({ type: [CreateQuestionDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateQuestionDto)
    questions: CreateQuestionDto[];
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
}
