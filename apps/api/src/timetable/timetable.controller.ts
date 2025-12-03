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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TimetableService } from './timetable.service';
import { ResourcesService } from './resources.service';
import { CreateTimetablePeriodDto, CreateMasterScheduleDto } from './dto/create-timetable-period.dto';
import { TimetablePeriodDto } from './dto/timetable.dto';
import {
  ClassLevelDto,
  ClassArmDto,
  RoomDto,
  SubjectDto,
  CreateClassArmDto,
  CreateRoomDto,
  CreateSubjectDto,
  UpdateSubjectDto,
  AssignTeacherToSubjectDto,
  AutoGenerateSubjectsDto,
  AutoGenerateSubjectsResponseDto,
  SubjectClassAssignmentsDto,
  BulkClassSubjectAssignmentDto,
} from './dto/resource.dto';
import { ResponseDto } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../schools/dto/permission.dto';

@ApiTags('timetable')
@Controller('schools/:schoolId/timetable')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
export class TimetableController {
  constructor(
    private readonly timetableService: TimetableService,
    private readonly resourcesService: ResourcesService
  ) {}

  @Post('periods')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Create a timetable period with conflict detection' })
  @ApiResponse({
    status: 201,
    description: 'Period created successfully',
    type: TimetablePeriodDto,
  })
  @ApiResponse({ status: 409, description: 'Conflict detected (teacher or room already booked)' })
  async createPeriod(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateTimetablePeriodDto
  ): Promise<ResponseDto<TimetablePeriodDto>> {
    const data = await this.timetableService.createPeriod(schoolId, dto);
    return ResponseDto.ok(data, 'Period created successfully');
  }

  @Post('master-schedule')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Create master schedule (empty slots for all class arms)' })
  @ApiResponse({
    status: 201,
    description: 'Master schedule created successfully',
  })
  async createMasterSchedule(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateMasterScheduleDto
  ): Promise<ResponseDto<{ created: number; skipped: number }>> {
    const data = await this.timetableService.createMasterSchedule(schoolId, dto);
    return ResponseDto.ok(data, 'Master schedule created successfully');
  }

  @Get('class-arm/:classArmId')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.READ)
  @ApiOperation({ summary: 'Get timetable for a class arm' })
  @ApiResponse({
    status: 200,
    description: 'Timetable retrieved successfully',
    type: [TimetablePeriodDto],
  })
  async getTimetableForClassArm(
    @Param('schoolId') schoolId: string,
    @Param('classArmId') classArmId: string,
    @Query('termId') termId: string
  ): Promise<ResponseDto<TimetablePeriodDto[]>> {
    const data = await this.timetableService.getTimetableForClassArm(schoolId, classArmId, termId);
    return ResponseDto.ok(data, 'Timetable retrieved successfully');
  }

  @Get('teacher/:teacherId')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.READ)
  @ApiOperation({ summary: 'Get timetable for a teacher' })
  @ApiResponse({
    status: 200,
    description: 'Timetable retrieved successfully',
    type: [TimetablePeriodDto],
  })
  async getTimetableForTeacher(
    @Param('schoolId') schoolId: string,
    @Param('teacherId') teacherId: string,
    @Query('termId') termId: string
  ): Promise<ResponseDto<TimetablePeriodDto[]>> {
    const data = await this.timetableService.getTimetableForTeacher(schoolId, teacherId, termId);
    return ResponseDto.ok(data, 'Timetable retrieved successfully');
  }

  @Get('class/:classId')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.READ)
  @ApiOperation({ summary: 'Get timetable for a class' })
  @ApiResponse({
    status: 200,
    description: 'Timetable retrieved successfully',
    type: [TimetablePeriodDto],
  })
  async getTimetableForClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Query('termId') termId: string
  ): Promise<ResponseDto<TimetablePeriodDto[]>> {
    const data = await this.timetableService.getTimetableForClass(schoolId, classId, termId);
    return ResponseDto.ok(data, 'Timetable retrieved successfully');
  }

  @Get('student/:studentId')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.READ)
  @ApiOperation({ summary: 'Get timetable for a student (Hybrid approach for TERTIARY)' })
  @ApiResponse({
    status: 200,
    description: 'Timetable retrieved successfully',
    type: [TimetablePeriodDto],
  })
  async getTimetableForStudent(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Query('termId') termId: string
  ): Promise<ResponseDto<TimetablePeriodDto[]>> {
    const data = await this.timetableService.getTimetableForStudent(schoolId, studentId, termId);
    return ResponseDto.ok(data, 'Timetable retrieved successfully');
  }

  @Get('timetables')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.READ)
  @ApiOperation({ summary: 'Get all timetables for a school type (grouped by class)' })
  @ApiResponse({
    status: 200,
    description: 'Timetables retrieved successfully',
  })
  async getTimetablesForSchoolType(
    @Param('schoolId') schoolId: string,
    @Query('schoolType') schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
    @Query('termId') termId?: string
  ): Promise<ResponseDto<Record<string, TimetablePeriodDto[]>>> {
    const data = await this.timetableService.getTimetablesForSchoolType(schoolId, schoolType, termId);
    return ResponseDto.ok(data, 'Timetables retrieved successfully');
  }

  @Patch('periods/:periodId')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Update a timetable period' })
  @ApiResponse({
    status: 200,
    description: 'Period updated successfully',
    type: TimetablePeriodDto,
  })
  @ApiResponse({ status: 409, description: 'Conflict detected' })
  async updatePeriod(
    @Param('schoolId') schoolId: string,
    @Param('periodId') periodId: string,
    @Body() dto: Partial<CreateTimetablePeriodDto>
  ): Promise<ResponseDto<TimetablePeriodDto>> {
    const data = await this.timetableService.updatePeriod(schoolId, periodId, dto);
    return ResponseDto.ok(data, 'Period updated successfully');
  }

  @Delete('periods/:periodId')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Delete a timetable period' })
  @ApiResponse({
    status: 200,
    description: 'Period deleted successfully',
  })
  async deletePeriod(
    @Param('schoolId') schoolId: string,
    @Param('periodId') periodId: string
  ): Promise<ResponseDto<void>> {
    await this.timetableService.deletePeriod(schoolId, periodId);
    return ResponseDto.ok(undefined, 'Period deleted successfully');
  }

  @Delete('class/:classId')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Delete all timetable periods for a class and term' })
  @ApiQuery({ name: 'termId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Timetable deleted successfully',
  })
  async deleteTimetableForClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Query('termId') termId: string
  ): Promise<ResponseDto<void>> {
    await this.timetableService.deleteTimetableForClass(schoolId, classId, termId);
    return ResponseDto.ok(undefined, 'Timetable deleted successfully');
  }

  // Resource endpoints (ClassArms, Subjects, Rooms)
  @Post('generate-default-classes')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Generate default classes for a school type (Primary 1-6, JSS1-SS3, Year 1-4)' })
  @ApiResponse({
    status: 201,
    description: 'Classes generated successfully',
  })
  @ApiResponse({ status: 409, description: 'Classes already exist for this type' })
  async generateDefaultClasses(
    @Param('schoolId') schoolId: string,
    @Body() dto: { schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' }
  ): Promise<ResponseDto<{ created: number; message: string }>> {
    const data = await this.resourcesService.generateDefaultClasses(schoolId, dto.schoolType);
    return ResponseDto.ok(data, data.message);
  }

  @Get('class-levels')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.READ)
  @ApiOperation({ summary: 'Get all class levels for a school, optionally filtered by school type' })
  @ApiResponse({
    status: 200,
    description: 'Class levels retrieved successfully',
    type: [ClassLevelDto],
  })
  async getClassLevels(
    @Param('schoolId') schoolId: string,
    @Query('schoolType') schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<ResponseDto<ClassLevelDto[]>> {
    const data = await this.resourcesService.getClassLevels(schoolId, schoolType);
    return ResponseDto.ok(data, 'Class levels retrieved successfully');
  }

  @Get('class-arms')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.READ)
  @ApiOperation({ summary: 'Get all class arms for a school, optionally filtered by school type' })
  @ApiResponse({
    status: 200,
    description: 'Class arms retrieved successfully',
    type: [ClassArmDto],
  })
  async getClassArms(
    @Param('schoolId') schoolId: string,
    @Query('classLevelId') classLevelId?: string,
    @Query('schoolType') schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<ResponseDto<ClassArmDto[]>> {
    const data = await this.resourcesService.getClassArms(schoolId, classLevelId, schoolType);
    return ResponseDto.ok(data, 'Class arms retrieved successfully');
  }

  @Post('class-arms')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Create a new class arm' })
  @ApiResponse({
    status: 201,
    description: 'Class arm created successfully',
    type: ClassArmDto,
  })
  async createClassArm(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateClassArmDto
  ): Promise<ResponseDto<ClassArmDto>> {
    const data = await this.resourcesService.createClassArm(schoolId, dto);
    return ResponseDto.ok(data, 'Class arm created successfully');
  }

  @Get('subjects')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.READ)
  @ApiOperation({ summary: 'Get all subjects for a school' })
  @ApiResponse({
    status: 200,
    description: 'Subjects retrieved successfully',
    type: [SubjectDto],
  })
  @ApiQuery({ name: 'termId', required: false, description: 'Term ID to include teacher workload data (SECONDARY only)' })
  async getSubjects(
    @Param('schoolId') schoolId: string,
    @Query('schoolType') schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
    @Query('classLevelId') classLevelId?: string,
    @Query('termId') termId?: string
  ): Promise<ResponseDto<SubjectDto[]>> {
    const data = await this.resourcesService.getSubjects(schoolId, schoolType, classLevelId, termId);
    return ResponseDto.ok(data, 'Subjects retrieved successfully');
  }

  @Post('subjects')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Create a new subject' })
  @ApiResponse({
    status: 201,
    description: 'Subject created successfully',
    type: SubjectDto,
  })
  async createSubject(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateSubjectDto
  ): Promise<ResponseDto<SubjectDto>> {
    const data = await this.resourcesService.createSubject(schoolId, dto);
    return ResponseDto.ok(data, 'Subject created successfully');
  }

  @Patch('subjects/:subjectId')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Update a subject' })
  @ApiResponse({
    status: 200,
    description: 'Subject updated successfully',
    type: SubjectDto,
  })
  async updateSubject(
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: UpdateSubjectDto
  ): Promise<ResponseDto<SubjectDto>> {
    const data = await this.resourcesService.updateSubject(schoolId, subjectId, dto);
    return ResponseDto.ok(data, 'Subject updated successfully');
  }

  @Delete('subjects/:subjectId')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Delete a subject' })
  @ApiResponse({
    status: 200,
    description: 'Subject deleted successfully',
  })
  async deleteSubject(
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string
  ): Promise<ResponseDto<void>> {
    await this.resourcesService.deleteSubject(schoolId, subjectId);
    return ResponseDto.ok(undefined, 'Subject deleted successfully');
  }

  @Post('subjects/:subjectId/teachers')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Assign a teacher to a subject' })
  @ApiResponse({
    status: 200,
    description: 'Teacher assigned successfully',
    type: SubjectDto,
  })
  async assignTeacherToSubject(
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: AssignTeacherToSubjectDto
  ): Promise<ResponseDto<SubjectDto>> {
    const data = await this.resourcesService.assignTeacherToSubject(schoolId, subjectId, dto.teacherId);
    return ResponseDto.ok(data, 'Teacher assigned successfully');
  }

  @Delete('subjects/:subjectId/teachers/:teacherId')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Remove a teacher from a subject' })
  @ApiResponse({
    status: 200,
    description: 'Teacher removed successfully',
    type: SubjectDto,
  })
  async removeTeacherFromSubject(
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string,
    @Param('teacherId') teacherId: string
  ): Promise<ResponseDto<SubjectDto>> {
    const data = await this.resourcesService.removeTeacherFromSubject(schoolId, subjectId, teacherId);
    return ResponseDto.ok(data, 'Teacher removed successfully');
  }

  @Post('subjects/auto-generate')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Auto-generate standard subjects for a school type' })
  @ApiResponse({
    status: 201,
    description: 'Subjects generated successfully',
    type: AutoGenerateSubjectsResponseDto,
  })
  async autoGenerateSubjects(
    @Param('schoolId') schoolId: string,
    @Body() dto: AutoGenerateSubjectsDto
  ): Promise<ResponseDto<AutoGenerateSubjectsResponseDto>> {
    const data = await this.resourcesService.autoGenerateSubjects(schoolId, dto);
    return ResponseDto.ok(data, `Generated ${data.created} subjects, ${data.skipped} already existed`);
  }

  // ============================================
  // CLASS SUBJECT TEACHER ASSIGNMENTS (SECONDARY)
  // ============================================

  @Get('subjects/:subjectId/class-assignments')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.READ)
  @ApiOperation({ summary: 'Get class assignments for a subject (SECONDARY schools)' })
  @ApiResponse({
    status: 200,
    description: 'Class assignments retrieved successfully',
    type: SubjectClassAssignmentsDto,
  })
  async getSubjectClassAssignments(
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string,
    @Query('sessionId') sessionId?: string
  ): Promise<ResponseDto<SubjectClassAssignmentsDto>> {
    const data = await this.resourcesService.getSubjectClassAssignments(schoolId, subjectId, sessionId);
    return ResponseDto.ok(data, 'Class assignments retrieved successfully');
  }

  @Post('subjects/:subjectId/class-assignments')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Bulk assign teachers to classes for a subject (SECONDARY schools)' })
  @ApiResponse({
    status: 200,
    description: 'Assignments updated successfully',
  })
  async bulkAssignTeachersToClasses(
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: BulkClassSubjectAssignmentDto
  ): Promise<ResponseDto<{ updated: number; removed: number }>> {
    const data = await this.resourcesService.bulkAssignTeachersToClasses(schoolId, subjectId, dto);
    return ResponseDto.ok(data, `Updated ${data.updated} assignments, removed ${data.removed}`);
  }

  @Delete('subjects/:subjectId/class-assignments/:classArmId')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Remove a class-subject-teacher assignment' })
  @ApiResponse({
    status: 200,
    description: 'Assignment removed successfully',
  })
  async removeClassSubjectAssignment(
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string,
    @Param('classArmId') classArmId: string,
    @Query('sessionId') sessionId?: string
  ): Promise<ResponseDto<void>> {
    await this.resourcesService.removeClassSubjectAssignment(schoolId, subjectId, classArmId, sessionId);
    return ResponseDto.ok(undefined, 'Assignment removed successfully');
  }

  // ============================================
  // TEACHER WORKLOAD ANALYSIS ENDPOINTS
  // ============================================

  @Get('teacher-workloads')
  @RequirePermission(PermissionResource.STAFF, PermissionType.READ)
  @ApiOperation({ summary: 'Get teacher workload summary for balancing assignments' })
  @ApiQuery({ name: 'termId', required: true, description: 'Term ID to analyze workloads for' })
  @ApiQuery({ name: 'schoolType', required: false, description: 'Filter by school type' })
  @ApiResponse({
    status: 200,
    description: 'Teacher workloads retrieved successfully',
  })
  async getTeacherWorkloads(
    @Param('schoolId') schoolId: string,
    @Query('termId') termId: string,
    @Query('schoolType') schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<ResponseDto<any>> {
    const data = await this.resourcesService.getTeacherWorkloadSummary(schoolId, termId, schoolType);
    return ResponseDto.ok(data, 'Teacher workloads retrieved successfully');
  }

  @Get('subjects/:subjectId/least-loaded-teacher')
  @RequirePermission(PermissionResource.STAFF, PermissionType.READ)
  @ApiOperation({ summary: 'Get the least loaded teacher for a subject (for auto-assignment)' })
  @ApiQuery({ name: 'termId', required: true, description: 'Term ID to check workloads' })
  @ApiQuery({ name: 'excludeTeacherIds', required: false, description: 'Comma-separated teacher IDs to exclude' })
  @ApiResponse({
    status: 200,
    description: 'Least loaded teacher retrieved',
  })
  async getLeastLoadedTeacher(
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string,
    @Query('termId') termId: string,
    @Query('excludeTeacherIds') excludeTeacherIds?: string
  ): Promise<ResponseDto<any>> {
    const excludeIds = excludeTeacherIds ? excludeTeacherIds.split(',').map(id => id.trim()) : [];
    const data = await this.resourcesService.getLeastLoadedTeacherForSubject(schoolId, subjectId, termId, excludeIds);
    return ResponseDto.ok(data, data ? 'Least loaded teacher found' : 'No competent teachers available');
  }

  // ============================================
  // TEACHER CLASS ASSIGNMENTS (FROM TIMETABLE)
  // ============================================

  @Get('teachers/:teacherId/classes')
  @RequirePermission(PermissionResource.STAFF, PermissionType.READ)
  @ApiOperation({ summary: 'Get classes assigned to a teacher from timetable (for SECONDARY schools)' })
  @ApiQuery({ name: 'termId', required: false, description: 'Term ID (defaults to current active term)' })
  @ApiResponse({
    status: 200,
    description: 'Teacher class assignments retrieved successfully',
  })
  async getTeacherTimetableClasses(
    @Param('schoolId') schoolId: string,
    @Param('teacherId') teacherId: string,
    @Query('termId') termId?: string
  ): Promise<ResponseDto<any>> {
    const data = await this.resourcesService.getTeacherTimetableClasses(schoolId, teacherId, termId);
    return ResponseDto.ok(data, 'Teacher class assignments retrieved successfully');
  }

  @Get('rooms')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.READ)
  @ApiOperation({ summary: 'Get all rooms for a school' })
  @ApiResponse({
    status: 200,
    description: 'Rooms retrieved successfully',
    type: [RoomDto],
  })
  async getRooms(
    @Param('schoolId') schoolId: string
  ): Promise<ResponseDto<RoomDto[]>> {
    const data = await this.resourcesService.getRooms(schoolId);
    return ResponseDto.ok(data, 'Rooms retrieved successfully');
  }

  @Post('rooms')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({
    status: 201,
    description: 'Room created successfully',
    type: RoomDto,
  })
  async createRoom(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateRoomDto
  ): Promise<ResponseDto<RoomDto>> {
    const data = await this.resourcesService.createRoom(schoolId, dto);
    return ResponseDto.ok(data, 'Room created successfully');
  }

  @Get('courses')
  @RequirePermission(PermissionResource.SUBJECTS, PermissionType.READ)
  @ApiOperation({ summary: 'Get all courses for a school (for TERTIARY schools)' })
  @ApiResponse({
    status: 200,
    description: 'Courses retrieved successfully',
  })
  async getCourses(
    @Param('schoolId') schoolId: string,
    @Query('schoolType') schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<ResponseDto<any[]>> {
    const data = await this.resourcesService.getCourses(schoolId, schoolType);
    return ResponseDto.ok(data, 'Courses retrieved successfully');
  }
}

