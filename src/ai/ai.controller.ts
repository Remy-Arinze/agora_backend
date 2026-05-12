import { Body, Controller, Post, Get, Delete, UseGuards, Request, Param, BadRequestException, ForbiddenException, Query, Res, Header } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../schools/dto/permission.dto';
import { AiService } from './ai.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionBillingService } from '../subscriptions/subscription-billing.service';
import { KnowledgeIndexingService } from './knowledge-indexing.service';
import { PrismaService } from '../database/prisma.service';
import {
    GenerateQuizDto,
    GenerateAssessmentDto,
    GradeEssayDto,
    GenerateLessonPlanDto
} from './dto/ai.dto';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { toLoisStreamErrorPayload } from './ai-stream-errors';

/**
 * heavy-ai tier: Protects against excessive LLM token usage and high-compute indexing operations.
 */
@ApiTags('AI Features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, RolesGuard, PermissionGuard)
@Throttle({ 'heavy-ai': { limit: 10, ttl: 60000 } })
@Controller('schools/:schoolId/ai')
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly subscriptionsService: SubscriptionsService,
        private readonly subscriptionBilling: SubscriptionBillingService,
        private readonly indexingService: KnowledgeIndexingService,
        private readonly prisma: PrismaService
    ) { }

    /**
     * Pre-check to ensure school has access and some credits available
     */
    private async verifyAccess(schoolId: string) {
        if (!this.aiService.isConfigured()) {
            throw new BadRequestException('OpenAI is not configured. Please add OPENAI_API_KEY.');
        }

        const toolAccess = await this.subscriptionsService.checkToolAccess(schoolId, 'agora-ai');
        if (!toolAccess.hasAccess) {
            throw new BadRequestException('School does not have access to Agora AI tools. Please upgrade your subscription.');
        }

        const summary = await this.subscriptionsService.getSubscriptionSummary(schoolId);
        if (summary.aiCreditsRemaining <= 0 && summary.tier !== 'CUSTOM') {
            throw new BadRequestException('Insufficient AI credits. Please upgrade your subscription.');
        }

        return summary;
    }

    /** Staff/student billing limits for AI (no OpenAI pre-check). */
    private async assertAiBillingForRequest(req: any, schoolId: string): Promise<void> {
        if (req.user.role === UserRole.TEACHER && req.user.currentProfileId) {
            await this.subscriptionBilling.assertTeacherMayWrite(schoolId, req.user.currentProfileId);
        }
        if (req.user.role === UserRole.SCHOOL_ADMIN && req.user.currentProfileId) {
            await this.subscriptionBilling.assertSchoolAdminNotBillingSuspended(schoolId, req.user.currentProfileId);
        }
        if (req.user.role === UserRole.STUDENT) {
            const st = await this.prisma.student.findUnique({
                where: { userId: req.user.id },
                select: { id: true },
            });
            if (!st) {
                throw new ForbiddenException('Student profile not found');
            }
            await this.subscriptionBilling.assertStudentEnrollmentOperational(st.id, schoolId);
        }
    }

    private async verifyAccessWithBilling(req: any, schoolId: string) {
        const summary = await this.verifyAccess(schoolId);
        await this.assertAiBillingForRequest(req, schoolId);
        return summary;
    }

    /**
     * Dynamically calculate actual credits based on language model limits
     */
    private async calculateAndDeductTokensFromUsage(schoolId: string, userId: string, usage: any, actionName: string) {
        if (!usage || !usage.total_tokens) return;
        
        // Use the exchange rate variable from environment, defaults to 1000
        const exchangeRate = Number(process.env.AGORA_CREDITS_PER_1M_TOKENS) || 1000;
        
        // Mathematically calculate raw tokens used to Agora credits
        const tokensToDeduct = Math.ceil(usage.total_tokens * (exchangeRate / 1000000));
        
        // Ensure at least 1 credit is burned if a request happened
        const credits = Math.max(1, tokensToDeduct);
        
        await this.subscriptionsService.useAiCredits(schoolId, credits, userId, actionName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SSE STREAMING + AGENTIC CHAT (New Primary Endpoint)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Heavy-AI: AI streaming consumes significant server resources per request.
     */
    @Post('chat/stream')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @RequirePermission(PermissionResource.ANALYTICS, PermissionType.READ)
    @ApiOperation({ summary: 'Stream AI chat with agentic tool-calling via SSE' })
    async chatStream(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() body: { messages: any[]; conversationId?: string },
        @Res() res: Response
    ) {
        let finalUsage = { total_tokens: 0 };

        try {
            const summary = await this.verifyAccessWithBilling(req, schoolId);
            const exchangeRate = Number(process.env.AGORA_CREDITS_PER_1M_TOKENS) || 1000;
            const remainingTokens = summary.tier === 'CUSTOM' ? Infinity : Math.max(0, (summary.aiCreditsRemaining * 1000000) / exchangeRate);

            // Set SSE headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.flushHeaders();

            // Handle client disconnect
            const abortController = new AbortController();
            req.on('close', () => {
                abortController.abort();
            });

            finalUsage = await this.aiService.chatStreamSSE(
                res,
                body.messages,
                req.user.id,
                body.conversationId,
                schoolId,
                remainingTokens,
                abortController.signal
            );
        } catch (error: any) {
            const payload = toLoisStreamErrorPayload(error);
            if (!res.headersSent) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                res.flushHeaders();
            }
            res.write(`event: error\ndata: ${JSON.stringify(payload)}\n\n`);
        } finally {
            // Deduct credits based on exact tracked token usage 
            try {
                if (finalUsage && finalUsage.total_tokens > 0) {
                    await this.calculateAndDeductTokensFromUsage(
                        schoolId,
                        req.user.id,
                        finalUsage,
                        'ai_chat_stream'
                    );
                }
            } catch (e) {
                // Credit deduction failure should not break the stream
            }
            res.end();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXISTING ENDPOINTS (Preserved)
    // ─────────────────────────────────────────────────────────────────────────

    @Post('quiz')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @RequirePermission(PermissionResource.CURRICULUM, PermissionType.READ)
    @ApiOperation({ summary: 'Generate a short quiz' })
    async generateQuiz(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() dto: GenerateQuizDto
    ) {
        await this.verifyAccessWithBilling(req, schoolId);
        const { data, usage } = await this.aiService.generateQuiz(dto);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'generate_quiz');
        return data;
    }

    @Post('assessment')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @RequirePermission(PermissionResource.CURRICULUM, PermissionType.READ)
    @ApiOperation({ summary: 'Generate a comprehensive assessment' })
    async generateAssessment(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() dto: GenerateAssessmentDto
    ) {
        await this.verifyAccessWithBilling(req, schoolId);
        const { data, usage } = await this.aiService.generateAssessmentQuestions(dto);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'generate_assessment');
        return data;
    }

    @Post('lesson-plan')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @RequirePermission(PermissionResource.CURRICULUM, PermissionType.READ)
    @ApiOperation({ summary: 'Generate a lesson plan' })
    async generateLessonPlan(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() dto: GenerateLessonPlanDto
    ) {
        await this.verifyAccessWithBilling(req, schoolId);
        const { data, usage } = await this.aiService.generateLessonPlan(dto);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'generate_lesson_plan');
        return data;
    }

    @Post('grade-essay')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @RequirePermission(PermissionResource.GRADES, PermissionType.READ)
    @ApiOperation({ summary: 'Grade a student essay' })
    async gradeEssay(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() dto: GradeEssayDto
    ) {
        await this.verifyAccessWithBilling(req, schoolId);
        const { data, usage } = await this.aiService.gradeEssay(dto);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'grade_essay');
        return data;
    }

    @Post('chat')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @RequirePermission(PermissionResource.ANALYTICS, PermissionType.READ)
    @ApiOperation({ summary: 'Generic AI assistant chat (legacy, non-streaming)' })
    async chat(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() body: { messages: any[]; conversationId?: string }
    ) {
        await this.verifyAccessWithBilling(req, schoolId);
        const { data, usage } = await this.aiService.chat(body.messages, req.user.id, body.conversationId, schoolId);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'ai_chat');
        return data;
    }

    @Get('history')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @RequirePermission(PermissionResource.ANALYTICS, PermissionType.READ)
    @ApiOperation({ summary: 'Get chat history' })
    async getHistory(@Request() req: any, @Param('schoolId') schoolId: string) {
        await this.assertAiBillingForRequest(req, schoolId);
        return this.aiService.getConversations(req.user.id);
    }

    @Get('history/:conversationId')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @RequirePermission(PermissionResource.ANALYTICS, PermissionType.READ)
    @ApiOperation({ summary: 'Get messages for a conversation' })
    async getConversationMessages(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('conversationId') conversationId: string
    ) {
        await this.assertAiBillingForRequest(req, schoolId);
        return this.aiService.getConversationMessages(conversationId, req.user.id);
    }

    @Delete('history/:conversationId')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @RequirePermission(PermissionResource.ANALYTICS, PermissionType.READ)
    @ApiOperation({ summary: 'Delete a conversation' })
    async deleteConversation(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('conversationId') conversationId: string
    ) {
        await this.assertAiBillingForRequest(req, schoolId);
        return this.aiService.deleteConversation(conversationId, req.user.id);
    }

    @Post('index-school')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @RequirePermission(PermissionResource.ANALYTICS, PermissionType.READ)
    @ApiOperation({ summary: 'Trigger knowledge indexing for the school' })
    async indexSchool(@Request() req: any, @Param('schoolId') schoolId: string) {
        if (req.user?.role === UserRole.SCHOOL_ADMIN && req.user?.currentProfileId) {
            await this.subscriptionBilling.assertSchoolAdminNotBillingSuspended(schoolId, req.user.currentProfileId);
        }
        // Trigger background sync for school, teachers, and classes
        await this.indexingService.syncSchool(schoolId);

        // Also sync students (limited for now to avoid timeout)
        const students = await this.prisma.student.findMany({
            where: { enrollments: { some: { schoolId } } },
            select: { id: true },
            take: 100 // Limit for manual trigger
        });

        for (const s of students) {
            await this.indexingService.triggerEntitySync('student', s.id);
        }

        return { 
            success: true, 
            message: `School knowledge base updated. Indexed school profiles, teachers, and ${students.length} students.` 
        };
    }
}
