import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, IsEnum } from 'class-validator';

export class GenerateQuizDto {
    @ApiProperty({ example: 'Algebraic Expressions' })
    @IsString()
    @IsNotEmpty()
    topic: string;

    @ApiProperty({ example: 'Mathematics' })
    @IsString()
    @IsNotEmpty()
    subject: string;

    @ApiProperty({ example: 'JSS 2' })
    @IsString()
    @IsNotEmpty()
    gradeLevel: string;

    @ApiProperty({ example: 10, required: false })
    @IsNumber()
    @IsOptional()
    questionCount?: number;

    @ApiProperty({ example: ['multiple_choice'], required: false })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    questionTypes?: ('multiple_choice' | 'true_false' | 'short_answer')[];

    @ApiProperty({ example: 'medium', required: false })
    @IsEnum(['easy', 'medium', 'hard'])
    @IsOptional()
    difficulty?: 'easy' | 'medium' | 'hard';
}

export class GenerateAssessmentDto {
    @ApiProperty({ example: 'Algebraic Expressions' })
    @IsString()
    @IsNotEmpty()
    topic: string;

    @ApiProperty({ example: 'Mathematics' })
    @IsString()
    @IsNotEmpty()
    subject: string;

    @ApiProperty({ example: 'JSS 2' })
    @IsString()
    @IsNotEmpty()
    gradeLevel: string;

    @ApiProperty({ example: 20, required: false })
    @IsNumber()
    @IsOptional()
    questionCount?: number;

    @ApiProperty({ example: ['multiple_choice', 'short_answer', 'essay'], required: false })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    questionTypes?: ('multiple_choice' | 'short_answer' | 'essay')[];

    @ApiProperty({ example: 'mixed', required: false })
    @IsEnum(['easy', 'medium', 'hard', 'mixed'])
    @IsOptional()
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';

    @ApiProperty({ example: 'NERDC', required: false })
    @IsString()
    @IsOptional()
    curriculum?: string;
}

export class GradeEssayDto {
    @ApiProperty({ example: 'Discuss the impact of climate change.' })
    @IsString()
    @IsNotEmpty()
    prompt: string;

    @ApiProperty({ example: 'Climate change is bad because...' })
    @IsString()
    @IsNotEmpty()
    essay: string;

    @ApiProperty({ example: 'Score on grammar, relevance, and strength of argument', required: false })
    @IsString()
    @IsOptional()
    rubric?: string;

    @ApiProperty({ example: 100, required: false })
    @IsNumber()
    @IsOptional()
    maxScore?: number;

    @ApiProperty({ example: 'English' })
    @IsString()
    @IsNotEmpty()
    subject: string;

    @ApiProperty({ example: 'SS 2' })
    @IsString()
    @IsNotEmpty()
    gradeLevel: string;
}

export class GenerateLessonPlanDto {
    @ApiProperty({ example: 'Photosynthesis' })
    @IsString()
    @IsNotEmpty()
    topic: string;

    @ApiProperty({ example: 'Biology' })
    @IsString()
    @IsNotEmpty()
    subject: string;

    @ApiProperty({ example: 'SS 1' })
    @IsString()
    @IsNotEmpty()
    gradeLevel: string;

    @ApiProperty({ example: ['Understand the light phase', 'Explain the dark phase'] })
    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    objectives: string[];

    @ApiProperty({ example: 40, required: false })
    @IsNumber()
    @IsOptional()
    duration?: number;
}
