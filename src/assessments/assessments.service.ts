import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAssessmentDto, SubmitAssessmentDto, GradeSubmissionDto } from './dto/assessment.dto';
import { AiService } from '../ai/ai.service';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { UserRole } from '@prisma/client';

@Injectable()
export class AssessmentsService {
    private readonly logger = new Logger(AssessmentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService
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
        return await this.prisma.assessment.create({
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
                },
                subject: true,
                class: true
            }
        });
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
                        student: true
                    }
                },
                subject: true,
                class: true
            }
        });

        if (!assessment || assessment.schoolId !== schoolId) {
            throw new NotFoundException('Assessment not found');
        }

        // SECURITY: Hide correct answers for students before submitting
        if (user.role === 'STUDENT') {
            const hasSubmitted = assessment.submissions.some(s => s.student.userId === user.id);
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
                    isCorrect = ans.selectedOption === question.correctAnswer;
                    score = isCorrect ? Number(question.points) : 0;
                    totalScore += score;
                    gradedBy = 'AUTO';
                } else if (question.type === 'SHORT_ANSWER') {
                    const aiResult = aiResults.find((_, i) => aiGradingItems[i]?.question === question.text);
                    if (aiResult) {
                        isCorrect = aiResult.isCorrect;
                        score = aiResult.score;
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
                feedback,
                gradedBy
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
