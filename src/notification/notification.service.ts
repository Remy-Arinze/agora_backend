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

export interface AssessmentPublishedPayload {
    schoolId: string;
    classId?: string;
    classArmId?: string;
    assessmentTitle: string;
    subjectName: string;
    assessmentId: string;
    teacherName: string;
    timestamp: string;
}

export interface GradePublishedPayload {
    schoolId: string;
    studentId: string; // The student's profile ID
    assessmentTitle: string;
    subjectName: string;
    score: number;
    maxScore: number;
    timestamp: string;
}

export interface AgoraSubjectAddedPayload {
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    schoolTypes: string[];
    timestamp: string;
}

export interface StudentReassignedPayload {
    schoolId: string;
    studentId: string;
    studentName: string;
    oldClassArmId?: string;
    oldClassName?: string;
    newClassArmId?: string;
    newClassName?: string;
    adminName: string;
    teacherIds: string[]; // List of teacher profile IDs to notify (form teachers)
    timestamp: string;
}

export interface AcademicRiskDigestPayload {
  schoolId: string;
  schoolName: string;
  atRiskCount: number;
  preview: { studentName: string; avgPercent: number }[];
  timestamp: string;
}

export interface SubscriptionBillingReminderPayload {
  schoolId: string;
  schoolName: string;
  kind: 'GRACE_PERIOD' | 'ADMIN_ACTION_REQUIRED';
  graceEndsAt: string;
  graceDay: number;
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

    emitAssessmentPublished(payload: AssessmentPublishedPayload) {
        this.logger.log(`Emitting assessment published notification for class ${payload.classId || payload.classArmId}: ${payload.assessmentTitle}`);
        this.eventEmitter.emit('assessment.published', payload);
    }

    emitGradePublished(payload: GradePublishedPayload) {
        this.logger.log(`Emitting grade published notification for student ${payload.studentId}: ${payload.assessmentTitle}`);
        this.eventEmitter.emit('grade.published', payload);
    }

    emitAgoraSubjectAdded(payload: AgoraSubjectAddedPayload) {
        this.logger.log(`Emitting global subject added notification: ${payload.subjectName} (${payload.subjectCode})`);
        this.eventEmitter.emit('agora.subject.added', payload);
    }

    emitStudentReassigned(payload: StudentReassignedPayload) {
        this.logger.log(`Emitting student reassigned notification for ${payload.teacherIds.length} teachers: ${payload.studentName}`);
        this.eventEmitter.emit('student.reassigned', payload);
    }

  emitAcademicRiskDigest(payload: AcademicRiskDigestPayload) {
    this.logger.log(
      `Emitting academic risk digest for school ${payload.schoolId}: ${payload.atRiskCount} student(s) below threshold`,
    );
    this.eventEmitter.emit('academic.risk.digest', payload);
  }

  emitSubscriptionBillingReminder(payload: SubscriptionBillingReminderPayload) {
    this.logger.log(
      `Emitting subscription billing reminder for school ${payload.schoolId} (${payload.kind}, day ${payload.graceDay})`,
    );
    this.eventEmitter.emit('subscription.billing.reminder', payload);
  }
}
