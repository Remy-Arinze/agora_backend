import { Controller, Get, Param, Req, Res, Logger, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Response, Request } from 'express';
import { SubmissionNotificationPayload } from './notification.service';
import { PrismaService } from '../database/prisma.service';

/**
 * SSE-based notification controller.
 * Teachers connect to GET /schools/:schoolId/notifications/stream?token=JWT
 * and receive real-time events when students submit assessments.
 * 
 * NOTE: We skip the standard JwtAuthGuard here because EventSource (SSE)
 * cannot set custom HTTP headers. Instead, we extract the JWT from the
 * query parameter and validate it manually via JwtService.
 */
@ApiTags('Notifications')
@Controller('schools/:schoolId/notifications')
export class NotificationController {
    private readonly logger = new Logger(NotificationController.name);

    // Map of teacherProfileId -> Set of SSE Response objects
    private readonly connections = new Map<string, Set<Response>>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    /**
     * Validate a JWT token from query parameter and return the user payload.
     */
    private async validateToken(token: string) {
        try {
            const payload = this.jwtService.verify(token);
            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
                select: { id: true, role: true },
            });

            if (!user) throw new UnauthorizedException();

            return {
                ...user,
                currentProfileId: payload.profileId,
            };
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    @SkipThrottle()
    @Get('stream')
    @ApiOperation({ summary: 'SSE stream for real-time teacher notifications' })
    async stream(
        @Req() req: Request,
        @Param('schoolId') schoolId: string,
        @Res() res: Response,
    ) {
        // Manually authenticate via query parameter
        const token = req.query.token as string;
        if (!token) {
            res.status(401).json({ message: 'Missing authentication token' });
            return;
        }

        let user: any;
        try {
            user = await this.validateToken(token);
        } catch {
            res.status(401).json({ message: 'Invalid authentication token' });
            return;
        }

        if (user.role !== 'TEACHER' && user.role !== 'SCHOOL_ADMIN') {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        // Resolve the teacher's profile ID so we can match events
        const teacher = await this.prisma.teacher.findFirst({
            where: { userId: user.id, schoolId },
            select: { id: true },
        });

        const teacherProfileId = teacher?.id || user.id;

        this.logger.log(`SSE notification stream opened for teacher ${teacherProfileId}`);

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Send initial connected event
        res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Notification stream connected' })}\n\n`);

        // Register this connection
        if (!this.connections.has(teacherProfileId)) {
            this.connections.set(teacherProfileId, new Set());
        }
        this.connections.get(teacherProfileId)!.add(res);

        // Heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
            try {
                res.write(`:heartbeat\n\n`);
            } catch {
                clearInterval(heartbeat);
            }
        }, 30000);

        // Cleanup on disconnect
        req.on('close', () => {
            clearInterval(heartbeat);
            this.connections.get(teacherProfileId)?.delete(res);
            if (this.connections.get(teacherProfileId)?.size === 0) {
                this.connections.delete(teacherProfileId);
            }
            this.logger.log(`SSE notification stream closed for teacher ${teacherProfileId}`);
        });
    }

    /**
     * Listens for internal 'assessment.submitted' events and pushes them
     * to the relevant teacher's SSE connections.
     */
    @OnEvent('assessment.submitted')
    handleSubmissionEvent(payload: SubmissionNotificationPayload) {
        const connections = this.connections.get(payload.teacherId);
        if (!connections || connections.size === 0) {
            return;
        }

        const eventData = JSON.stringify({
            type: 'ASSESSMENT_SUBMITTED',
            studentName: payload.studentName,
            assessmentTitle: payload.assessmentTitle,
            subjectName: payload.subjectName,
            assessmentId: payload.assessmentId,
            submissionId: payload.submissionId,
            timestamp: payload.timestamp,
        });

        connections.forEach((res) => {
            try {
                res.write(`event: notification\ndata: ${eventData}\n\n`);
            } catch (err) {
                this.logger.warn(`Failed to write SSE event: ${err}`);
            }
        });

        this.logger.log(`Pushed notification to ${connections.size} connection(s) for teacher ${payload.teacherId}`);
    }
}
