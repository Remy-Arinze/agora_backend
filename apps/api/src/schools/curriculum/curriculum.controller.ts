import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CurriculumService } from './curriculum.service';
import { NerdcCurriculumService } from './nerdc-curriculum.service';
import { 
  CreateCurriculumDto,
  GenerateCurriculumDto,
  BulkGenerateCurriculumDto,
  UpdateCurriculumDto,
  RejectCurriculumDto,
  MarkWeekCompleteDto,
  SkipWeekDto,
} from './dto/create-curriculum.dto';
import { CurriculumDto, CurriculumSummaryDto, TimetableSubjectDto } from './dto/curriculum.dto';
import { NerdcSubjectDto, NerdcCurriculumDto, GetNerdcSubjectsQueryDto } from './dto/nerdc-curriculum.dto';
import { ResponseDto } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../../common/guards/school-data-access.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../dto/permission.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserWithContext } from '../../auth/types/user-with-context.type';

@ApiTags('curriculum')
@Controller('schools/:schoolId/curriculum')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
export class CurriculumController {
  constructor(
    private readonly curriculumService: CurriculumService,
    private readonly nerdcService: NerdcCurriculumService,
  ) {}

  // ============================================
  // NERDC Template Endpoints
  // ============================================

  @Get('nerdc/subjects')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.READ)
  @ApiOperation({ summary: 'Get NERDC subjects list' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiQuery({ name: 'schoolType', required: false, description: 'Filter by school type (PRIMARY, SECONDARY)' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category (CORE, ELECTIVE)' })
  @ApiResponse({ status: 200, description: 'NERDC subjects retrieved successfully' })
  async getNerdcSubjects(
    @Query() query: GetNerdcSubjectsQueryDto
  ): Promise<ResponseDto<NerdcSubjectDto[]>> {
    const data = await this.nerdcService.getSubjects(query);
    return ResponseDto.ok(data, 'NERDC subjects retrieved successfully');
  }

  @Get('nerdc/template')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.READ)
  @ApiOperation({ summary: 'Get NERDC curriculum template' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiQuery({ name: 'subjectCode', description: 'Subject code (e.g., MTH, ENG)' })
  @ApiQuery({ name: 'classLevel', description: 'Class level name (e.g., Primary 1, JSS 1)' })
  @ApiQuery({ name: 'schoolType', description: 'School type (PRIMARY, SECONDARY)' })
  @ApiQuery({ name: 'term', description: 'Term number (1, 2, or 3)' })
  @ApiResponse({ status: 200, description: 'NERDC template retrieved successfully' })
  async getNerdcTemplate(
    @Query('subjectCode') subjectCode: string,
    @Query('classLevel') classLevel: string,
    @Query('schoolType') schoolType: string,
    @Query('term') term: string
  ): Promise<ResponseDto<NerdcCurriculumDto | null>> {
    const data = await this.nerdcService.getCurriculumTemplate(
      subjectCode,
      classLevel,
      schoolType,
      parseInt(term, 10)
    );
    return ResponseDto.ok(data, data ? 'NERDC template retrieved successfully' : 'No NERDC template found');
  }

  // ============================================
  // Timetable-Driven Subjects
  // ============================================

  @Get('class-level/:classLevelId/subjects')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.READ)
  @ApiOperation({ summary: 'Get subjects from timetable for a class level' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'classLevelId', description: 'Class Level ID' })
  @ApiQuery({ name: 'termId', description: 'Term ID' })
  @ApiResponse({ status: 200, description: 'Timetable subjects retrieved successfully' })
  async getSubjectsFromTimetable(
    @Param('schoolId') schoolId: string,
    @Param('classLevelId') classLevelId: string,
    @Query('termId') termId: string
  ): Promise<ResponseDto<TimetableSubjectDto[]>> {
    const data = await this.curriculumService.getSubjectsFromTimetable(schoolId, classLevelId, termId);
    return ResponseDto.ok(data, 'Timetable subjects retrieved successfully');
  }

  @Get('class-level/:classLevelId/summary')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.READ)
  @ApiOperation({ summary: 'Get curriculum summary for all subjects in a class level' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'classLevelId', description: 'Class Level ID' })
  @ApiQuery({ name: 'termId', description: 'Term ID' })
  @ApiResponse({ status: 200, description: 'Curriculum summary retrieved successfully' })
  async getCurriculaSummary(
    @Param('schoolId') schoolId: string,
    @Param('classLevelId') classLevelId: string,
    @Query('termId') termId: string
  ): Promise<ResponseDto<CurriculumSummaryDto[]>> {
    const data = await this.curriculumService.getCurriculaSummary(schoolId, classLevelId, termId);
    return ResponseDto.ok(data, 'Curriculum summary retrieved successfully');
  }

  // ============================================
  // Curriculum CRUD
  // ============================================

  @Post()
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.WRITE)
  @ApiOperation({ summary: 'Create a new curriculum (manual)' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiResponse({ status: 201, description: 'Curriculum created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Teacher not assigned to class' })
  async createCurriculum(
    @Param('schoolId') schoolId: string,
    @Body() createDto: CreateCurriculumDto,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<CurriculumDto>> {
    const data = await this.curriculumService.createCurriculum(schoolId, createDto, user);
    return ResponseDto.ok(data, 'Curriculum created successfully');
  }

  @Post('generate')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.WRITE)
  @ApiOperation({ summary: 'Generate curriculum from NERDC template' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiResponse({ status: 201, description: 'Curriculum generated successfully' })
  async generateCurriculum(
    @Param('schoolId') schoolId: string,
    @Body() dto: GenerateCurriculumDto,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<CurriculumDto>> {
    const data = await this.curriculumService.generateFromNerdc(schoolId, dto, user);
    return ResponseDto.ok(data, 'Curriculum generated successfully');
  }

  @Post('generate-bulk')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.WRITE)
  @ApiOperation({ summary: 'Bulk generate curricula from NERDC templates' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiResponse({ status: 201, description: 'Curricula generated successfully' })
  async bulkGenerateCurriculum(
    @Param('schoolId') schoolId: string,
    @Body() dto: BulkGenerateCurriculumDto,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<{ created: string[]; failed: { subjectId: string; error: string }[] }>> {
    const data = await this.curriculumService.bulkGenerateFromNerdc(schoolId, dto, user);
    return ResponseDto.ok(data, 'Bulk curriculum generation completed');
  }

  @Get(':curriculumId')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.READ)
  @ApiOperation({ summary: 'Get curriculum by ID' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiResponse({ status: 200, description: 'Curriculum retrieved successfully' })
  async getCurriculumById(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<CurriculumDto>> {
    const data = await this.curriculumService.getCurriculumById(schoolId, curriculumId, user);
    return ResponseDto.ok(data, 'Curriculum retrieved successfully');
  }

  @Get('classes/:classId')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.READ)
  @ApiOperation({ summary: 'Get curriculum for a class (legacy)' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiQuery({ name: 'subject', required: false, description: 'Subject name' })
  @ApiQuery({ name: 'academicYear', required: false, description: 'Academic year' })
  @ApiQuery({ name: 'termId', required: false, description: 'Term ID' })
  @ApiResponse({ status: 200, description: 'Curriculum retrieved successfully' })
  async getCurriculumForClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Query('subject') subject?: string,
    @Query('academicYear') academicYear?: string,
    @Query('termId') termId?: string,
    @CurrentUser() user?: UserWithContext
  ): Promise<ResponseDto<CurriculumDto | null>> {
    const data = await this.curriculumService.getCurriculumForClass(
      schoolId,
      classId,
      subject,
      academicYear,
      termId,
      user
    );
    return ResponseDto.ok(data, 'Curriculum retrieved successfully');
  }

  @Patch(':curriculumId')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.WRITE)
  @ApiOperation({ summary: 'Update curriculum' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiResponse({ status: 200, description: 'Curriculum updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  async updateCurriculum(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @Body() updateDto: UpdateCurriculumDto,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<CurriculumDto>> {
    const data = await this.curriculumService.updateCurriculum(schoolId, curriculumId, updateDto, user);
    return ResponseDto.ok(data, 'Curriculum updated successfully');
  }

  @Delete(':curriculumId')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Delete curriculum' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiResponse({ status: 200, description: 'Curriculum deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not curriculum owner' })
  async deleteCurriculum(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<void>> {
    await this.curriculumService.deleteCurriculum(schoolId, curriculumId, user);
    return ResponseDto.ok(undefined, 'Curriculum deleted successfully');
  }

  // ============================================
  // Status Management
  // ============================================

  @Post(':curriculumId/submit')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.WRITE)
  @ApiOperation({ summary: 'Submit curriculum for admin approval' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiResponse({ status: 200, description: 'Curriculum submitted successfully' })
  async submitForApproval(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<CurriculumDto>> {
    const data = await this.curriculumService.submitForApproval(schoolId, curriculumId, user);
    return ResponseDto.ok(data, 'Curriculum submitted for approval');
  }

  @Post(':curriculumId/approve')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Approve curriculum (admin only)' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiResponse({ status: 200, description: 'Curriculum approved successfully' })
  async approveCurriculum(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<CurriculumDto>> {
    const data = await this.curriculumService.approveCurriculum(schoolId, curriculumId, user);
    return ResponseDto.ok(data, 'Curriculum approved successfully');
  }

  @Post(':curriculumId/reject')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Reject curriculum (admin only)' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiResponse({ status: 200, description: 'Curriculum rejected' })
  async rejectCurriculum(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @Body() dto: RejectCurriculumDto,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<CurriculumDto>> {
    const data = await this.curriculumService.rejectCurriculum(schoolId, curriculumId, dto.reason, user);
    return ResponseDto.ok(data, 'Curriculum rejected');
  }

  @Post(':curriculumId/activate')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.WRITE)
  @ApiOperation({ summary: 'Activate curriculum (start teaching)' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiResponse({ status: 200, description: 'Curriculum activated' })
  async activateCurriculum(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<CurriculumDto>> {
    const data = await this.curriculumService.activateCurriculum(schoolId, curriculumId, user);
    return ResponseDto.ok(data, 'Curriculum activated');
  }

  // ============================================
  // Progress Tracking
  // ============================================

  @Post(':curriculumId/weeks/:weekNumber/complete')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.WRITE)
  @ApiOperation({ summary: 'Mark a week as complete' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiParam({ name: 'weekNumber', description: 'Week number (1-13)' })
  @ApiResponse({ status: 200, description: 'Week marked as complete' })
  async markWeekComplete(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @Param('weekNumber') weekNumber: string,
    @Body() dto: MarkWeekCompleteDto,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<any>> {
    const data = await this.curriculumService.markWeekComplete(
      schoolId,
      curriculumId,
      parseInt(weekNumber, 10),
      dto.notes,
      user
    );
    return ResponseDto.ok(data, 'Week marked as complete');
  }

  @Post(':curriculumId/weeks/:weekNumber/in-progress')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.WRITE)
  @ApiOperation({ summary: 'Mark a week as in progress' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiParam({ name: 'weekNumber', description: 'Week number (1-13)' })
  @ApiResponse({ status: 200, description: 'Week marked as in progress' })
  async markWeekInProgress(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @Param('weekNumber') weekNumber: string,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<any>> {
    const data = await this.curriculumService.markWeekInProgress(
      schoolId,
      curriculumId,
      parseInt(weekNumber, 10),
      user
    );
    return ResponseDto.ok(data, 'Week marked as in progress');
  }

  @Post(':curriculumId/weeks/:weekNumber/skip')
  @RequirePermission(PermissionResource.CURRICULUM, PermissionType.WRITE)
  @ApiOperation({ summary: 'Skip a week with reason' })
  @ApiParam({ name: 'schoolId', description: 'School ID' })
  @ApiParam({ name: 'curriculumId', description: 'Curriculum ID' })
  @ApiParam({ name: 'weekNumber', description: 'Week number (1-13)' })
  @ApiResponse({ status: 200, description: 'Week skipped' })
  async skipWeek(
    @Param('schoolId') schoolId: string,
    @Param('curriculumId') curriculumId: string,
    @Param('weekNumber') weekNumber: string,
    @Body() dto: SkipWeekDto,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<any>> {
    const data = await this.curriculumService.skipWeek(
      schoolId,
      curriculumId,
      parseInt(weekNumber, 10),
      dto.reason,
      user
    );
    return ResponseDto.ok(data, 'Week skipped');
  }
}
