import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAssessmentDto, SubmitAssessmentDto, GradeSubmissionDto } from './dto/assessment.dto';
import { AiService } from '../ai/ai.service';
import { NotificationService } from '../notification/notification.service';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { UserRole } from '@prisma/client';

@Injectable()
export class AssessmentsService {
    private readonly logger = new Logger(AssessmentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly notificationService: NotificationService
    ) { }

    async createAssessment(schoolId: string, dto: CreateAssessmentDto, user: UserWithContext) {
        const teacherProfileId = user.currentProfileId;
        if (!teacherProfileId) {
            throw new ForbiddenException('Teacher profile not found');
        }

        // Validate teacher has access to the school
        const teacher = await this.prisma.teacher.findFirst({
            where: {
                id: teacherProfileId,
                schoolId
            }
        });

        if (!teacher) {
            throw new ForbiddenException('Teacher not found in this school');
        }

        // Resolve and validate class/arm IDs
        let finalClassId = dto.classId;
        let finalClassArmId = dto.classArmId;

        if (finalClassId) {
            // Check if it's a ClassArm first (Primary/Secondary context)
            const classArm = await (this.prisma as any).classArm.findUnique({ where: { id: finalClassId } });
            if (classArm) {
                finalClassArmId = classArm.id;
                finalClassId = undefined; // It's an Arm, so clear the Class ID field
            } else {
                // Check if it's a regular Class
                const classExists = await this.prisma.class.findUnique({ where: { id: finalClassId } });
                if (!classExists) {
                    throw new NotFoundException(`Class or ClassArm with ID ${finalClassId} not found`);
                }
            }
        }

        if (dto.subjectId) {
            const subjectExists = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
            if (!subjectExists) throw new NotFoundException(`Subject with ID ${dto.subjectId} not found`);
        }

        if (dto.termId) {
            const termExists = await this.prisma.term.findUnique({ where: { id: dto.termId } });
            if (!termExists) throw new NotFoundException(`Academic Term with ID ${dto.termId} not found`);
        }

        // Logic to create assessment and its questions
        const assessment = await this.prisma.assessment.create({
            data: {
                schoolId,
                classId: finalClassId,
                classArmId: finalClassArmId,
                subjectId: dto.subjectId,
                teacherId: teacher.id,
                termId: dto.termId,
                title: dto.title,
                description: dto.description,
                type: dto.type,
                status: dto.status || 'DRAFT',
                dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
                maxScore: dto.maxScore,
                questions: {
                    create: dto.questions.map(q => ({
                        text: q.text,
                        type: q.type,
                        options: q.options || [],
                        correctAnswer: q.correctAnswer,
                        points: q.points,
                        order: q.order
                    }))
                }
            },
            include: {
                questions: true,
                subject: true
            }
        });

        // Notify students if it's published immediately
        if (assessment.status === 'PUBLISHED') {
            this.notificationService.emitAssessmentPublished({
                schoolId,
                classId: assessment.classId || undefined,
                classArmId: assessment.classArmId || undefined,
                assessmentTitle: assessment.title,
                subjectName: assessment.subject?.name || 'Unknown',
                assessmentId: assessment.id,
                teacherName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                timestamp: new Date().toISOString(),
            });
        }

        return assessment;
    }

    async getClassAssessments(schoolId: string, classId: string, termId?: string, studentId?: string) {
        const assessments = await this.prisma.assessment.findMany({
            where: {
                schoolId,
                OR: [
                    { classId },
                    { classArmId: classId }
                ],
                status: 'PUBLISHED', // Only published assessments for general list (can be adjusted for teachers)
                ...(termId ? { termId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { submissions: true }
                },
                ...(studentId ? {
                    submissions: {
                        where: { studentId },
                        select: { id: true, status: true, totalScore: true, submittedAt: true }
                    }
                } : {}),
                subject: true,
                class: true
            }
        });

        if (studentId) {
            return assessments.map(a => ({
                ...a,
                isSubmitted: a.submissions.length > 0,
                submission: a.submissions[0] || null
            }));
        }

        return assessments;
    }

    async getAssessmentById(schoolId: string, assessmentId: string, user: UserWithContext) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: {
                questions: {
                    orderBy: { order: 'asc' }
                },
                submissions: {
                    include: {
                        student: true,
                        answers: true
                    }
                },
                subject: true,
                class: true
            }
        });

        if (!assessment || assessment.schoolId !== schoolId) {
            throw new NotFoundException('Assessment not found');
        }

        if (user.role === 'STUDENT') {
            // SECURITY: Only allow the student to see their OWN submission, never others'
            assessment.submissions = assessment.submissions.filter(s => s.student.userId === user.id);

            // SECURITY: Hide correct answers for students before submitting
            const hasSubmitted = assessment.submissions.length > 0;
            if (!hasSubmitted) {
                assessment.questions = assessment.questions.map(q => ({
                    ...q,
                    correctAnswer: undefined // Don't send answers to the client during the test!
                })) as any;
            }
        }

        return assessment;
    }

    async submitAssessment(schoolId: string, assessmentId: string, dto: SubmitAssessmentDto, user: UserWithContext) {
        const student = await this.prisma.student.findUnique({
            where: { userId: user.id }
        });

        if (!student) {
            throw new ForbiddenException('Student profile not found');
        }

        const assessment = await this.prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: { questions: true }
        });

        if (!assessment || assessment.schoolId !== schoolId) {
            throw new NotFoundException('Assessment not found');
        }

        const existingSubmission = await this.prisma.assessmentSubmission.findUnique({
            where: {
                assessmentId_studentId: {
                    assessmentId,
                    studentId: student.id
                }
            }
        });

        if (existingSubmission) {
            throw new ForbiddenException('You have already submitted this assessment.');
        }

        // 1. Separate MCQs for instant grading and Short Answers for AI grading
        const mcqs = assessment.questions.filter(q => q.type === 'MULTIPLE_CHOICE');
        const shortAnswers = assessment.questions.filter(q => q.type === 'SHORT_ANSWER');

        // 2. Perform AI grading for Short Answers if present
        const aiGradingItems = dto.answers
            .filter(ans => shortAnswers.some(sq => sq.id === ans.questionId))
            .map(ans => {
                const question = shortAnswers.find(sq => sq.id === ans.questionId)!;
                return {
                    question: question.text,
                    studentAnswer: ans.text || '',
                    sampleAnswer: question.correctAnswer || '',
                    maxPoints: Number(question.points) || 1
                };
            });

        let aiResults: any[] = [];
        if (aiGradingItems.length > 0) {
            try {
                const gradeRes = await this.aiService.gradeShortAnswers(aiGradingItems);
                aiResults = gradeRes.data;
            } catch (err) {
                this.logger.error(`AI Grading failed for submission: ${err}`);
            }
        }

        let totalScore = 0;
        const answers = dto.answers.map(ans => {
            const question = assessment.questions.find(q => q.id === ans.questionId);
            let isCorrect: boolean | null = null;
            let score = 0;
            let feedback: string | undefined = undefined;
            let gradedBy: 'AUTO' | 'TEACHER' | 'AI' = 'TEACHER';

            if (question) {
                if (question.type === 'MULTIPLE_CHOICE') {
                    const optionsArray = Array.isArray(question.options) 
                        ? question.options as string[] 
                        : (typeof question.options === 'string' ? JSON.parse(question.options || '[]') : []);
                    const getOptText = (val: string, options: string[]) => {
                        if (!val) return '';
                        const clean = val.trim();
                        if (/^[A-D]$/i.test(clean)) {
                            const idx = clean.toUpperCase().charCodeAt(0) - 65;
                            return options[idx] || clean;
                        }
                        const match = clean.match(/^[A-D][\.\)]\s*(.*)/i);
                        return match ? match[1] : clean;
                    };
                    const normExpected = getOptText(question.correctAnswer || '', optionsArray).toLowerCase();
                    const normActual = getOptText(ans.selectedOption || '', optionsArray).toLowerCase();
                    isCorrect = normExpected === normActual && normExpected !== '';

                    score = isCorrect ? Number(question.points) : 0;
                    totalScore += score;
                    gradedBy = 'AUTO';
                } else if (question.type === 'SHORT_ANSWER') {
                    const aiResult = aiResults.find((res, i) => aiGradingItems[i]?.question === question.text);
                    if (aiResult) {
                        isCorrect = aiResult.isCorrect;
                        score = Number(aiResult.score) || 0;
                        feedback = aiResult.feedback;
                        totalScore += score;
                        gradedBy = 'AI';
                    }
                }
                // Essay stays as gradedBy: TEACHER by default
            }

            return {
                questionId: ans.questionId,
                text: ans.text,
                selectedOption: ans.selectedOption,
                isCorrect,
                score,
                aiFeedback: feedback,
                gradedBy
            };
        });

        // Use transaction to ensure assessment submission
        const submission = await this.prisma.$transaction(async (tx) => {
            const sub = await tx.assessmentSubmission.create({
                data: {
                    assessmentId,
                    studentId: student.id,
                    totalScore,
                    status: 'SUBMITTED',
                    answers: {
                        create: answers
                    }
                },
                include: {
                    answers: true
                }
            });

            return sub;
        });

        // --- Emit real-time notification to the teacher ---
        try {
            const subject = await this.prisma.subject.findUnique({ where: { id: assessment.subjectId }, select: { name: true } });
            this.notificationService.emitSubmissionNotification({
                schoolId,
                teacherId: assessment.teacherId,
                studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
                assessmentTitle: assessment.title,
                subjectName: subject?.name || 'Unknown Subject',
                assessmentId,
                submissionId: submission.id,
                timestamp: new Date().toISOString(),
            });
        } catch (notifErr) {
            this.logger.warn(`Failed to emit submission notification: ${notifErr}`);
        }

        return submission;
    }

    async getSubmissionById(schoolId: string, submissionId: string) {
        const submission = await this.prisma.assessmentSubmission.findUnique({
            where: { id: submissionId },
            include: {
                assessment: {
                    include: { questions: true }
                },
                student: true,
                answers: true
            }
        });

        if (!submission || (submission.assessment.schoolId !== schoolId)) {
            throw new NotFoundException('Submission not found');
        }

        return submission;
    }

    async gradeSubmission(schoolId: string, submissionId: string, dto: GradeSubmissionDto, user: UserWithContext) {
        const submission = await this.prisma.assessmentSubmission.findUnique({
            where: { id: submissionId },
            include: {
                assessment: {
                    include: {
                        questions: true,
                        subject: true,
                        term: true
                    }
                },
                student: {
                    include: {
                        enrollments: {
                            where: { isActive: true },
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                },
                answers: true
            }
        });

        if (!submission || submission.assessment.schoolId !== schoolId) {
            throw new NotFoundException('Submission not found');
        }

        // SECURITY: Prevent unauthorized teachers from modifying other teachers' assessments
        if (user.role === 'TEACHER') {
            const teacherProfile = await this.prisma.teacher.findUnique({
                where: { userId_schoolId: { userId: user.id, schoolId } }
            });
            if (!teacherProfile || submission.assessment.teacherId !== teacherProfile.id) {
                throw new ForbiddenException('You do not have permission to grade this assessment');
            }
        }

        const currentTotalScore = dto.totalScore !== undefined ? dto.totalScore : Number(submission.totalScore);

        // Finalize submission grading
        return this.prisma.$transaction(async (tx) => {
            const updatedSubmission = await tx.assessmentSubmission.update({
                where: { id: submissionId },
                data: {
                    status: 'GRADED',
                    totalScore: currentTotalScore,
                    teacherFeedback: dto.teacherFeedback,
                    gradedAt: new Date(),
                    // Update individual answers if feedback/scores provided
                    answers: {
                        update: Object.entries(dto.questionScores || {}).map(([qId, score]) => ({
                            where: { submissionId_questionId: { submissionId, questionId: qId } },
                            data: {
                                score,
                                teacherFeedback: dto.questionFeedback?.[qId]
                            }
                        }))
                    }
                }
            });

            // Integrate with main Grade model
            const enrollment = submission.student.enrollments[0];
            if (enrollment) {
                const assessment = submission.assessment;

                const existingGrade = await tx.grade.findFirst({
                    where: {
                        enrollmentId: enrollment.id,
                        subjectId: assessment.subjectId,
                        termId: assessment.termId,
                        assessmentName: assessment.title
                    }
                });

                if (existingGrade) {
                    await tx.grade.update({
                        where: { id: existingGrade.id },
                        data: {
                            score: currentTotalScore,
                            remarks: dto.teacherFeedback,
                            isPublished: true
                        }
                    });
                } else {
                    await tx.grade.create({
                        data: {
                            enrollmentId: enrollment.id,
                            teacherId: assessment.teacherId,
                            termId: assessment.termId,
                            subjectId: assessment.subjectId,
                            subject: assessment.subject.name,
                            gradeType: assessment.type === 'EXAM' ? 'EXAM' : (assessment.type === 'ASSIGNMENT' ? 'ASSIGNMENT' : 'CA'),
                            assessmentName: assessment.title,
                            assessmentDate: assessment.createdAt,
                            score: currentTotalScore,
                            maxScore: assessment.maxScore,
                            term: assessment.term?.name || 'Unknown',
                            academicYear: assessment.academicYear || '',
                            remarks: dto.teacherFeedback,
                            isPublished: true
                        }
                    });
                }

                // Notify Student
                this.notificationService.emitGradePublished({
                    schoolId,
                    studentId: submission.studentId,
                    assessmentTitle: assessment.title,
                    subjectName: assessment.subject.name,
                    score: Number(currentTotalScore),
                    maxScore: Number(assessment.maxScore),
                    timestamp: new Date().toISOString(),
                });
            }

            return updatedSubmission;
        });
    }

    async deleteAssessment(schoolId: string, assessmentId: string, user: UserWithContext) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: {
                _count: {
                    select: { submissions: true }
                }
            }
        });

        if (!assessment || assessment.schoolId !== schoolId) {
            throw new NotFoundException('Assessment not found');
        }

        // SECURITY: Prevent unauthorized teachers from deleting other teachers' assessments
        if (user.role === 'TEACHER') {
            const teacherProfile = await this.prisma.teacher.findUnique({
                where: { userId_schoolId: { userId: user.id, schoolId } }
            });
            if (!teacherProfile || assessment.teacherId !== teacherProfile.id) {
                throw new ForbiddenException('You do not have permission to delete this assessment');
            }
        }

        // Logic: Cannot delete if it has submissions (to protect student data)
        // This follows the user requirement of "can't be deleted if it was published and distributed" 
        // as submission count indicates it reached students.
        if (assessment._count.submissions > 0) {
            throw new BadRequestException('Cannot delete assessment because it already has student submissions. Please archive it instead or contact administration.');
        }

        return this.prisma.assessment.delete({
            where: { id: assessmentId }
        });
    }
}
