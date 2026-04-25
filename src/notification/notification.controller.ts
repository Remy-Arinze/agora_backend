import { Controller, Get, Param, Req, Res, Logger, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Response, Request } from 'express';
import { 
    SubmissionNotificationPayload, 
    AssessmentPublishedPayload, 
    GradePublishedPayload,
    AgoraSubjectAddedPayload,
    StudentReassignedPayload
} from './notification.service';
import { PrismaService } from '../database/prisma.service';

/**
 * SSE-based notification controller.
 * Supports both Teachers and Students.
 * 
 * NOTE: We skip the standard JwtAuthGuard here because EventSource (SSE)
 * cannot set custom HTTP headers. Instead, we extract the JWT from the
 * query parameter and validate it manually via JwtService.
 */
@ApiTags('Notifications')
@Controller('schools/:schoolId/notifications')
export class NotificationController {
    private readonly logger = new Logger(NotificationController.name);

    // Map of profileId -> Set of SSE Response objects
    private readonly teacherConnections = new Map<string, Set<Response>>();
    private readonly studentConnections = new Map<string, Set<Response>>();

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

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Send initial connected event
        res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Notification stream connected' })}\n\n`);

        if (user.role === 'TEACHER' || user.role === 'SCHOOL_ADMIN') {
            // Resolve the teacher's profile ID
            const teacher = await this.prisma.teacher.findFirst({
                where: { userId: user.id, schoolId },
                select: { id: true },
            });
            const profileId = teacher?.id || user.id;

            if (!this.teacherConnections.has(profileId)) {
                this.teacherConnections.set(profileId, new Set());
            }
            this.teacherConnections.get(profileId)!.add(res);
            this.logger.log(`SSE teacher notification stream opened: ${profileId}`);

            req.on('close', () => {
                this.teacherConnections.get(profileId)?.delete(res);
                if (this.teacherConnections.get(profileId)?.size === 0) {
                    this.teacherConnections.delete(profileId);
                }
            });
        } else if (user.role === 'STUDENT') {
            const student = await this.prisma.student.findUnique({
                where: { userId: user.id },
                select: { id: true },
            });
            const profileId = student?.id;

            if (profileId) {
                if (!this.studentConnections.has(profileId)) {
                    this.studentConnections.set(profileId, new Set());
                }
                this.studentConnections.get(profileId)!.add(res);
                this.logger.log(`SSE student notification stream opened: ${profileId}`);

                req.on('close', () => {
                    this.studentConnections.get(profileId)?.delete(res);
                    if (this.studentConnections.get(profileId)?.size === 0) {
                        this.studentConnections.delete(profileId);
                    }
                });
            }
        }

        // Heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
            try {
                res.write(`:heartbeat\n\n`);
            } catch {
                clearInterval(heartbeat);
            }
        }, 30000);

        req.on('close', () => {
            clearInterval(heartbeat);
            this.logger.log(`SSE notification stream closed for user ${user.id}`);
        });
    }

    @OnEvent('assessment.submitted')
    handleSubmissionEvent(payload: SubmissionNotificationPayload) {
        const connections = this.teacherConnections.get(payload.teacherId);
        if (!connections || connections.size === 0) return;

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
            try { res.write(`event: notification\ndata: ${eventData}\n\n`); }
            catch (err) { this.logger.warn(`Failed to write SSE event: ${err}`); }
        });
    }

    @OnEvent('assessment.published')
    async handleAssessmentPublished(payload: AssessmentPublishedPayload) {
        // Find all students in this class/arm
        const students = await this.prisma.student.findMany({
            where: {
                enrollments: {
                    some: {
                        isActive: true,
                        OR: [
                            { classId: payload.classId },
                            { classArmId: payload.classArmId }
                        ]
                    }
                }
            },
            select: { id: true }
        });

        const studentIds = students.map(s => s.id);
        const eventData = JSON.stringify({
            type: 'ASSESSMENT_PUBLISHED',
            assessmentTitle: payload.assessmentTitle,
            subjectName: payload.subjectName,
            assessmentId: payload.assessmentId,
            teacherName: payload.teacherName,
            timestamp: payload.timestamp,
        });

        studentIds.forEach(profileId => {
            const connections = this.studentConnections.get(profileId);
            if (connections) {
                connections.forEach(res => {
                    try { res.write(`event: notification\ndata: ${eventData}\n\n`); }
                    catch (err) { }
                });
            }
        });
    }

    @OnEvent('grade.published')
    handleGradePublished(payload: GradePublishedPayload) {
        const connections = this.studentConnections.get(payload.studentId);
        if (!connections || connections.size === 0) return;

        const eventData = JSON.stringify({
            type: 'GRADE_PUBLISHED',
            assessmentTitle: payload.assessmentTitle,
            subjectName: payload.subjectName,
            score: payload.score,
            maxScore: payload.maxScore,
            timestamp: payload.timestamp,
        });

        connections.forEach(res => {
            try { res.write(`event: notification\ndata: ${eventData}\n\n`); }
            catch (err) { }
        });
    }

    @OnEvent('agora.subject.added')
    handleAgoraSubjectAdded(payload: AgoraSubjectAddedPayload) {
        this.logger.log(`Broadcasting new Agora subject: ${payload.subjectName}`);
        
        const eventData = JSON.stringify({
            type: 'AGORA_SUBJECT_ADDED',
            subjectId: payload.subjectId,
            subjectName: payload.subjectName,
            subjectCode: payload.subjectCode,
            schoolTypes: payload.schoolTypes,
            timestamp: payload.timestamp,
        });

        // Broadcast to all connected teachers and school admins
        this.teacherConnections.forEach((connections) => {
            connections.forEach((res) => {
                try { res.write(`event: notification\ndata: ${eventData}\n\n`); }
                catch (err) { }
            });
        });
    }

    @OnEvent('student.reassigned')
    handleStudentReassigned(payload: StudentReassignedPayload) {
        const eventData = JSON.stringify({
            type: 'STUDENT_REASSIGNED',
            studentId: payload.studentId,
            studentName: payload.studentName,
            oldClassName: payload.oldClassName,
            newClassName: payload.newClassName,
            adminName: payload.adminName,
            timestamp: payload.timestamp,
        });

        payload.teacherIds.forEach(profileId => {
            const connections = this.teacherConnections.get(profileId);
            if (connections) {
                connections.forEach(res => {
                    try { res.write(`event: notification\ndata: ${eventData}\n\n`); }
                    catch (err) { }
                });
            }
        });
    }
}
