import { Body, Controller, Post, Get, Put, UseGuards, Request, Param, Query, NotFoundException, ForbiddenException, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto, SubmitAssessmentDto, GradeSubmissionDto, LogViolationDto } from './dto/assessment.dto';
import { ResponseDto } from '../common/dto/response.dto';
import { Throttle } from '@nestjs/throttler';

/**
 * heavy-ai tier: Assessments utilize AI for automated short-answer grading
 * and trigger real-time notification events.
 */
@ApiTags('Assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools/:schoolId')
@Throttle({ 'heavy-ai': {} })
export class AssessmentsController {
    constructor(private readonly assessmentsService: AssessmentsService) { }

    @Post('classes/:classId/assessments')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Create a new assessment for a class' })
    async createAssessment(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('classId') classId: string,
        @Body() dto: CreateAssessmentDto
    ): Promise<ResponseDto<any>> {
        // Ensure classId from URL matches DTO if provided
        if (!dto.classId) dto.classId = classId;

        const data = await this.assessmentsService.createAssessment(schoolId, dto, req.user);
        return ResponseDto.ok(data, 'Assessment created successfully');
    }

    @Get('classes/:classId/assessments')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'List assessments for a class' })
    async getClassAssessments(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('classId') classId: string,
        @Query('termId') termId?: string,
        @Query('studentId') studentId?: string
    ): Promise<ResponseDto<any[]>> {
        const data = await this.assessmentsService.getClassAssessments(schoolId, classId, termId, studentId, req.user);
        return ResponseDto.ok(data, 'Assessments retrieved successfully');
    }

    @Get('assessments/:assessmentId')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Get details of a specific assessment' })
    async getAssessmentById(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('assessmentId') assessmentId: string
    ): Promise<ResponseDto<any>> {
        const data = await this.assessmentsService.getAssessmentById(schoolId, assessmentId, req.user);
        return ResponseDto.ok(data, 'Assessment retrieved successfully');
    }

    @Post('assessments/:assessmentId/start')
    @Roles(UserRole.STUDENT)
    @ApiOperation({ summary: 'Initialize and start a timed/proctored assessment' })
    async startAssessment(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('assessmentId') assessmentId: string
    ): Promise<ResponseDto<any>> {
        const data = await this.assessmentsService.startAssessment(schoolId, assessmentId, req.user);
        return ResponseDto.ok(data, 'Assessment started successfully');
    }

    @Post('assessments/:assessmentId/violation')
    @Roles(UserRole.STUDENT)
    @ApiOperation({ summary: 'Log an exam integrity violation' })
    async logViolation(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('assessmentId') assessmentId: string,
        @Body() dto: LogViolationDto
    ): Promise<ResponseDto<any>> {
        const data = await this.assessmentsService.logViolation(schoolId, assessmentId, dto.type, req.user);
        return ResponseDto.ok(data, 'Violation logged successfully');
    }

    @Post('assessments/:assessmentId/submit')
    @Roles(UserRole.STUDENT)
    @ApiOperation({ summary: 'Submit answers for an assessment' })
    async submitAssessment(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('assessmentId') assessmentId: string,
        @Body() dto: SubmitAssessmentDto
    ): Promise<ResponseDto<any>> {
        const data = await this.assessmentsService.submitAssessment(schoolId, assessmentId, dto, req.user);
        return ResponseDto.ok(data, 'Assessment submitted successfully');
    }

    @Get('assessments/submissions/:submissionId')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Get a specific submission' })
    async getSubmissionById(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('submissionId') submissionId: string
    ): Promise<ResponseDto<any>> {
        const data = await this.assessmentsService.getSubmissionById(schoolId, submissionId, req.user);
        return ResponseDto.ok(data, 'Submission retrieved successfully');
    }

    @Post('assessments/submissions/:submissionId/grade')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Grade a submission' })
    async gradeSubmission(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('submissionId') submissionId: string,
        @Body() dto: GradeSubmissionDto
    ): Promise<ResponseDto<any>> {
        const data = await this.assessmentsService.gradeSubmission(schoolId, submissionId, dto, req.user);
        return ResponseDto.ok(data, 'Submission graded successfully');
    }

    @Delete('assessments/:assessmentId')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Delete an assessment' })
    async deleteAssessment(
        @Request() req: any,
        @Param('schoolId') schoolId: string,
        @Param('assessmentId') assessmentId: string
    ): Promise<ResponseDto<void>> {
        await this.assessmentsService.deleteAssessment(schoolId, assessmentId, req.user);
        return ResponseDto.ok(undefined, 'Assessment deleted successfully');
    }
}
