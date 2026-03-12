import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAssessmentDto, SubmitAssessmentDto, GradeSubmissionDto } from './dto/assessment.dto';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { UserRole } from '@prisma/client';

@Injectable()
export class AssessmentsService {
    private readonly logger = new Logger(AssessmentsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async createAssessment(schoolId: string, dto: CreateAssessmentDto, user: UserWithContext) {
        const teacherId = user.currentProfileId;
        if (!teacherId) {
            throw new ForbiddenException('Teacher profile not found');
        }

        const teacher = await this.prisma.teacher.findUnique({
            where: {
                userId_schoolId: { userId: user.id, schoolId }
            }
        });

        if (!teacher) {
            throw new ForbiddenException('Teacher not found in this school');
        }

        // Logic to create assessment and its questions
        return await this.prisma.assessment.create({
            data: {
                schoolId,
                classId: dto.classId,
                classArmId: dto.classArmId,
                subjectId: dto.subjectId,
                teacherId: teacher.id,
                termId: dto.termId,
                title: dto.title,
                description: dto.description,
                type: dto.type,
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
                questions: true
            }
        });
    }

    async getClassAssessments(schoolId: string, classId: string, termId?: string) {
        return this.prisma.assessment.findMany({
            where: {
                schoolId,
                classId,
                ...(termId ? { termId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { submissions: true }
                }
            }
        });
    }

    async getAssessmentById(schoolId: string, assessmentId: string) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: {
                questions: {
                    orderBy: { order: 'asc' }
                },
                submissions: {
                    include: {
                        student: true
                    }
                }
            }
        });

        if (!assessment || assessment.schoolId !== schoolId) {
            throw new NotFoundException('Assessment not found');
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

        // Create submission with basic auto-grading for MCQs
        let totalScore = 0;
        const answers = dto.answers.map(ans => {
            const question = assessment.questions.find(q => q.id === ans.questionId);
            let isCorrect = null;
            let score = 0;

            if (question && question.type === 'MULTIPLE_CHOICE') {
                isCorrect = ans.selectedOption === question.correctAnswer;
                score = isCorrect ? Number(question.points) : 0;
                totalScore += score;
            }

            return {
                questionId: ans.questionId,
                text: ans.text,
                selectedOption: ans.selectedOption,
                isCorrect,
                score,
                gradedBy: (question?.type === 'MULTIPLE_CHOICE') ? 'AUTO' : 'TEACHER'
            };
        });

        // Use transaction to ensure assessment submission
        return this.prisma.$transaction(async (tx) => {
            const submission = await tx.assessmentSubmission.create({
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

            return submission;
        });
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
            }

            return updatedSubmission;
        });
    }
}
