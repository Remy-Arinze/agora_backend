import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../dto/permission.dto';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserWithContext } from '../../auth/types/user-with-context.type';
import { ResponseDto } from '../../common/dto/response.dto';
import { SchemeOfWorkService } from './scheme-of-work.service';
import {
  GenerateSchemeOfWorkDto,
  UpdateSchemeOfWorkStatusDto,
  MarkWeekDeliveredDto,
} from './dto/scheme-of-work.dto';
import { SchoolDataAccessGuard } from '../../common/guards/school-data-access.guard';

@ApiTags('Scheme of Work')
@Controller('schools/:schoolId/scheme-of-work')
@UseGuards(JwtAuthGuard, RolesGuard, SchoolDataAccessGuard)
@ApiBearerAuth()
export class SchemeOfWorkController {
  constructor(private readonly schemeOfWorkService: SchemeOfWorkService) {}

  // ==========================================
  // SCHOOL ADMIN ENDPOINTS
  // ==========================================

  @Post('generate')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionGuard)
  @RequirePermission(PermissionResource.SCHEME_OF_WORK, PermissionType.WRITE)
  @ApiOperation({ summary: 'Generate a new Scheme of Work for a specific context' })
  @ApiResponse({ status: 201, description: 'Scheme of Work queued for generation' })
  async generateScheme(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: UserWithContext,
    @Body() dto: GenerateSchemeOfWorkDto,
  ) {
    const scheme = await this.schemeOfWorkService.generateScheme(schoolId, dto, user.id);
    return ResponseDto.ok(scheme, 'Scheme of Work generation queued successfully');
  }

  @Get()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionGuard)
  @RequirePermission(PermissionResource.SCHEME_OF_WORK, PermissionType.READ)
  @ApiOperation({ summary: 'Get all Schemes of Work within the school' })
  async getSchemes(
    @Param('schoolId') schoolId: string,
    @Query('classId') classId?: string,
    @Query('termId') termId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    const schemes = await this.schemeOfWorkService.getSchemesBySchool(schoolId, {
      classId,
      termId,
      subjectId,
    });
    return ResponseDto.ok(schemes, 'Schemes of Work retrieved successfully');
  }

  /**
   * Used by teacher/student class detail SchemeOfWorkView.
   * Must be registered before GET :id so "class" is not captured as an id.
   */
  @Get('class/:classId')
  @Roles(UserRole.TEACHER, UserRole.STUDENT, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get a published Scheme of Work for a class arm/class (class-level Agora schemes supported)',
  })
  @ApiParam({ name: 'schoolId' })
  @ApiParam({ name: 'classId', description: 'ClassArm id (PRIMARY/SECONDARY) or Class id' })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'termId', required: false })
  async getSchemeForClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Query('subjectId') subjectId?: string,
    @Query('termId') termId?: string,
  ) {
    const scheme = await this.schemeOfWorkService.getPublishedSchemeForClass(schoolId, classId, {
      subjectId,
      termId,
    });
    return ResponseDto.ok(scheme, 'Scheme of Work retrieved');
  }

  @Patch('week/:weekId')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update week delivery status / private notes (enforces current-week window)' })
  async updateWeek(
    @Param('schoolId') schoolId: string,
    @Param('weekId') weekId: string,
    @Body() dto: MarkWeekDeliveredDto,
    @CurrentUser() user: UserWithContext,
  ) {
    const result = await this.schemeOfWorkService.updateWeekForSchool(
      schoolId,
      weekId,
      dto,
      user.id,
    );
    return ResponseDto.ok(result, 'Week updated');
  }

  @Post('week/:weekId/lesson-note')
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload optional lesson note to raise delivery confidence' })
  async uploadLessonNote(
    @Param('schoolId') schoolId: string,
    @Param('weekId') weekId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserWithContext,
  ) {
    const result = await this.schemeOfWorkService.uploadLessonNote(
      schoolId,
      weekId,
      file,
      user.id,
    );
    return ResponseDto.ok(result, 'Lesson note uploaded');
  }

  @Get(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionGuard)
  @RequirePermission(PermissionResource.SCHEME_OF_WORK, PermissionType.READ)
  @ApiOperation({ summary: 'Get full details of a specific Scheme of Work' })
  async getSchemeById(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    const scheme = await this.schemeOfWorkService.getSchemeById(schoolId, id);
    return ResponseDto.ok(scheme, 'Scheme of Work detail retrieved');
  }

  @Patch(':id/status')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionGuard)
  @RequirePermission(PermissionResource.SCHEME_OF_WORK, PermissionType.WRITE)
  @ApiOperation({ summary: 'Update Scheme of Work status (Draft/Approved/Published)' })
  async updateStatus(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: UserWithContext,
    @Param('id') id: string,
    @Body() dto: UpdateSchemeOfWorkStatusDto,
  ) {
    const scheme = await this.schemeOfWorkService.updateSchemeStatus(schoolId, id, dto, user.id);
    return ResponseDto.ok(scheme, 'Scheme of Work status updated');
  }

  // ==========================================
  // TEACHER ENDPOINTS
  // ==========================================

  @Get('teacher/class/:classId/term/:termId')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher view: Get published schemes of work for their assigned class context' })
  async getTeacherClassLoader(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: UserWithContext,
    @Param('classId') classId: string,
    @Param('termId') termId: string,
  ) {
    const scheme = await this.schemeOfWorkService.getSchemeForTeacherClassScope(
      schoolId,
      classId,
      termId,
      user.id,
    );
    return ResponseDto.ok(scheme, 'Class Scheme of Work payload retrieved');
  }

  @Patch('teacher/week/:weekId/delivery')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher view: Mark a specific topic/week as delivered or add private notes' })
  async markWeekDelivered(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: UserWithContext,
    @Param('weekId') weekId: string,
    @Body() dto: MarkWeekDeliveredDto,
  ) {
    const result = await this.schemeOfWorkService.markWeekDelivered(schoolId, weekId, dto, user.id);
    return ResponseDto.ok(result, 'Week delivery status updated');
  }

  // ==========================================
  // STUDENT ENDPOINTS
  // ==========================================

  @Get('student/class/:classId/term/:termId')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student view: Get public-facing published schemes of work for their class' })
  async getStudentClassLoader(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: UserWithContext,
    @Param('classId') classId: string,
    @Param('termId') termId: string,
  ) {
    const scheme = await this.schemeOfWorkService.getSchemeForStudentClassScope(
      schoolId,
      classId,
      termId,
      user.id,
    );
    return ResponseDto.ok(scheme, 'Student Scheme of Work payload retrieved');
  }
}
