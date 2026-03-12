import { Body, Controller, Post, Get, Put, UseGuards, Request, Param, Query, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto, SubmitAssessmentDto, GradeSubmissionDto } from './dto/assessment.dto';

@ApiTags('Assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools/:schoolId')
export class AssessmentsController {
    constructor(private readonly assessmentsService: AssessmentsService) { }

    @Post('classes/:classId/assessments')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Create a new assessment for a class' })
    async createAssessment(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Body() dto: CreateAssessmentDto
    ) {
        return this.assessmentsService.createAssessment(schoolId, dto, req.user);
    }

    @Get('classes/:classId/assessments')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'List assessments for a class' })
    async getClassAssessments(
        @Param('schoolId') schoolId: string,
        @Param('classId') classId: string,
        @Query('termId') termId?: string
    ) {
        return this.assessmentsService.getClassAssessments(schoolId, classId, termId);
    }

    @Get('assessments/:assessmentId')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Get details of a specific assessment' })
    async getAssessmentById(
        @Param('schoolId') schoolId: string,
        @Param('assessmentId') assessmentId: string
    ) {
        return this.assessmentsService.getAssessmentById(schoolId, assessmentId);
    }

    @Post('assessments/:assessmentId/submit')
    @Roles(UserRole.STUDENT)
    @ApiOperation({ summary: 'Submit answers for an assessment' })
    async submitAssessment(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('assessmentId') assessmentId: string,
        @Body() dto: SubmitAssessmentDto
    ) {
        return this.assessmentsService.submitAssessment(schoolId, assessmentId, dto, req.user);
    }

    @Get('assessments/submissions/:submissionId')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Get a specific submission' })
    async getSubmissionById(
        @Param('schoolId') schoolId: string,
        @Param('submissionId') submissionId: string
    ) {
        return this.assessmentsService.getSubmissionById(schoolId, submissionId);
    }

    @Post('assessments/submissions/:submissionId/grade')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Grade a submission' })
    async gradeSubmission(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('submissionId') submissionId: string,
        @Body() dto: GradeSubmissionDto
    ) {
        return this.assessmentsService.gradeSubmission(schoolId, submissionId, dto, req.user);
    }
}
