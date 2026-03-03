import { Body, Controller, Post, UseGuards, Request, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AiService } from './ai.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
    GenerateQuizDto,
    GenerateAssessmentDto,
    GradeEssayDto,
    GenerateLessonPlanDto
} from './dto/ai.dto';
import { UserRole } from '@prisma/client';

@ApiTags('AI Features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools/:schoolId/ai')
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly subscriptionsService: SubscriptionsService
    ) { }

    /**
     * Internal helper to verify school has tokens and deduct them.
     */
    private async checkAndDeductTokens(schoolId: string, tokensRequired: number, actionName: string) {
        if (!this.aiService.isConfigured()) {
            throw new BadRequestException('OpenAI is not configured. Please add OPENAI_API_KEY.');
        }

        const toolAccess = await this.subscriptionsService.checkToolAccess(schoolId, 'agora-ai');
        if (!toolAccess.hasAccess) {
            throw new BadRequestException('School does not have access to Agora AI tools. Please upgrade your subscription.');
        }

        const result = await this.subscriptionsService.useAiCredits(schoolId, tokensRequired, actionName);
        if (!result.success) {
            throw new BadRequestException(result.message);
        }
    }

    @Post('quiz')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Generate a short quiz (Costs 5 credits)' })
    async generateQuiz(
        @Param('schoolId') schoolId: string,
        @Body() dto: GenerateQuizDto
    ) {
        const creditsRequired = 5;
        await this.checkAndDeductTokens(schoolId, creditsRequired, 'generate_quiz');
        return this.aiService.generateQuiz(dto);
    }

    @Post('assessment')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Generate a comprehensive assessment (Costs 15 credits)' })
    async generateAssessment(
        @Param('schoolId') schoolId: string,
        @Body() dto: GenerateAssessmentDto
    ) {
        const creditsRequired = 15;
        await this.checkAndDeductTokens(schoolId, creditsRequired, 'generate_assessment');
        return this.aiService.generateAssessmentQuestions(dto);
    }

    @Post('lesson-plan')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Generate a lesson plan (Costs 10 credits)' })
    async generateLessonPlan(
        @Param('schoolId') schoolId: string,
        @Body() dto: GenerateLessonPlanDto
    ) {
        const creditsRequired = 10;
        await this.checkAndDeductTokens(schoolId, creditsRequired, 'generate_lesson_plan');
        return this.aiService.generateLessonPlan(dto);
    }

    @Post('grade-essay')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Grade a student essay (Costs 3 credits per essay)' })
    async gradeEssay(
        @Param('schoolId') schoolId: string,
        @Body() dto: GradeEssayDto
    ) {
        const creditsRequired = 3;
        await this.checkAndDeductTokens(schoolId, creditsRequired, 'grade_essay');
        return this.aiService.gradeEssay(dto);
    }
}
