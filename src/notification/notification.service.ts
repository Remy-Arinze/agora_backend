import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface SubmissionNotificationPayload {
    schoolId: string;
    teacherId: string; // The teacher's profile ID (from Teacher table)
    studentName: string;
    assessmentTitle: string;
    subjectName: string;
    assessmentId: string;
    submissionId: string;
    timestamp: string;
}

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(private readonly eventEmitter: EventEmitter2) {}

    emitSubmissionNotification(payload: SubmissionNotificationPayload) {
        this.logger.log(`Emitting submission notification for teacher ${payload.teacherId}: ${payload.studentName} submitted ${payload.assessmentTitle}`);
        this.eventEmitter.emit('assessment.submitted', payload);
    }
}
