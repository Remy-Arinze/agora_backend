import { Body, Controller, Post, Get, Delete, UseGuards, Request, Param, BadRequestException, Query, Res, Header } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AiService } from './ai.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
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

/**
 * heavy-ai tier: Protects against excessive LLM token usage and high-compute indexing operations.
 */
@ApiTags('AI Features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Throttle({ 'heavy-ai': { limit: 10, ttl: 60000 } })
@Controller('schools/:schoolId/ai')
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly subscriptionsService: SubscriptionsService,
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
    @ApiOperation({ summary: 'Stream AI chat with agentic tool-calling via SSE' })
    async chatStream(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() body: { messages: any[]; conversationId?: string },
        @Res() res: Response
    ) {
        let finalUsage = { total_tokens: 0 };

        try {
            const summary = await this.verifyAccess(schoolId);
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
                remainingTokens
            );
        } catch (error: any) {
            // If the error happens before SSE starts, write it as an SSE event
            if (!res.headersSent) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.flushHeaders();
            }
            res.write(`event: error\ndata: ${JSON.stringify({ message: error?.message || 'Stream failed' })}\n\n`);
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
    @ApiOperation({ summary: 'Generate a short quiz' })
    async generateQuiz(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() dto: GenerateQuizDto
    ) {
        await this.verifyAccess(schoolId);
        const { data, usage } = await this.aiService.generateQuiz(dto);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'generate_quiz');
        return data;
    }

    @Post('assessment')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Generate a comprehensive assessment' })
    async generateAssessment(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() dto: GenerateAssessmentDto
    ) {
        await this.verifyAccess(schoolId);
        const { data, usage } = await this.aiService.generateAssessmentQuestions(dto);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'generate_assessment');
        return data;
    }

    @Post('lesson-plan')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Generate a lesson plan' })
    async generateLessonPlan(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() dto: GenerateLessonPlanDto
    ) {
        await this.verifyAccess(schoolId);
        const { data, usage } = await this.aiService.generateLessonPlan(dto);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'generate_lesson_plan');
        return data;
    }

    @Post('grade-essay')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Grade a student essay' })
    async gradeEssay(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() dto: GradeEssayDto
    ) {
        await this.verifyAccess(schoolId);
        const { data, usage } = await this.aiService.gradeEssay(dto);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'grade_essay');
        return data;
    }

    @Post('chat')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Generic AI assistant chat (legacy, non-streaming)' })
    async chat(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() body: { messages: any[]; conversationId?: string }
    ) {
        await this.verifyAccess(schoolId);
        const { data, usage } = await this.aiService.chat(body.messages, req.user.id, body.conversationId, schoolId);
        await this.calculateAndDeductTokensFromUsage(schoolId, req.user.id, usage, 'ai_chat');
        return data;
    }

    @Get('history')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Get chat history' })
    async getHistory(@Request() req: any) {
        return this.aiService.getConversations(req.user.id);
    }

    @Get('history/:conversationId')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Get messages for a conversation' })
    async getConversationMessages(
        @Request() req: any,
        @Param('conversationId') conversationId: string
    ) {
        return this.aiService.getConversationMessages(conversationId, req.user.id);
    }

    @Delete('history/:conversationId')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Delete a conversation' })
    async deleteConversation(
        @Request() req: any,
        @Param('conversationId') conversationId: string
    ) {
        return this.aiService.deleteConversation(conversationId, req.user.id);
    }

    @Post('index-school')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Trigger knowledge indexing for the school' })
    async indexSchool(@Param('schoolId') schoolId: string) {
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
