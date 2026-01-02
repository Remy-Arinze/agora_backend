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
import { FacultyService } from './faculty.service';
import {
  CreateFacultyDto,
  UpdateFacultyDto,
  FacultyDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  DepartmentDto,
  GenerateLevelsDto,
  DepartmentLevelDto,
} from '../dto/faculty.dto';
import { ResponseDto } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../../common/guards/school-data-access.guard';

@ApiTags('faculties')
@Controller('schools/:schoolId/faculties')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard)
@ApiBearerAuth()
export class FacultyController {
  constructor(private readonly facultyService: FacultyService) {}

  // ============ FACULTY ENDPOINTS ============

  @Get()
  @ApiOperation({ summary: 'Get all faculties for a school (tertiary only)' })
  @ApiResponse({
    status: 200,
    description: 'Faculties retrieved successfully',
    type: [FacultyDto],
  })
  async getFaculties(
    @Param('schoolId') schoolId: string
  ): Promise<ResponseDto<FacultyDto[]>> {
    const data = await this.facultyService.getFaculties(schoolId);
    return ResponseDto.ok(data, 'Faculties retrieved successfully');
  }

  @Get(':facultyId')
  @ApiOperation({ summary: 'Get a single faculty by ID' })
  @ApiResponse({
    status: 200,
    description: 'Faculty retrieved successfully',
    type: FacultyDto,
  })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  async getFaculty(
    @Param('schoolId') schoolId: string,
    @Param('facultyId') facultyId: string
  ): Promise<ResponseDto<FacultyDto>> {
    const data = await this.facultyService.getFaculty(schoolId, facultyId);
    return ResponseDto.ok(data, 'Faculty retrieved successfully');
  }

  @Post()
  @ApiOperation({ summary: 'Create a new faculty' })
  @ApiResponse({
    status: 201,
    description: 'Faculty created successfully',
    type: FacultyDto,
  })
  @ApiResponse({ status: 409, description: 'Faculty with this code already exists' })
  async createFaculty(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateFacultyDto
  ): Promise<ResponseDto<FacultyDto>> {
    const data = await this.facultyService.createFaculty(schoolId, dto);
    return ResponseDto.ok(data, 'Faculty created successfully');
  }

  @Patch(':facultyId')
  @ApiOperation({ summary: 'Update a faculty' })
  @ApiResponse({
    status: 200,
    description: 'Faculty updated successfully',
    type: FacultyDto,
  })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  async updateFaculty(
    @Param('schoolId') schoolId: string,
    @Param('facultyId') facultyId: string,
    @Body() dto: UpdateFacultyDto
  ): Promise<ResponseDto<FacultyDto>> {
    const data = await this.facultyService.updateFaculty(schoolId, facultyId, dto);
    return ResponseDto.ok(data, 'Faculty updated successfully');
  }

  @Delete(':facultyId')
  @ApiOperation({ summary: 'Delete a faculty' })
  @ApiQuery({
    name: 'force',
    required: false,
    type: Boolean,
    description: 'Force delete even if faculty has departments',
  })
  @ApiResponse({
    status: 200,
    description: 'Faculty deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  @ApiResponse({ status: 400, description: 'Faculty has active departments' })
  async deleteFaculty(
    @Param('schoolId') schoolId: string,
    @Param('facultyId') facultyId: string,
    @Query('force') force?: string
  ): Promise<ResponseDto<void>> {
    await this.facultyService.deleteFaculty(schoolId, facultyId, force === 'true');
    return ResponseDto.ok(undefined, 'Faculty deleted successfully');
  }

  @Post('generate-defaults')
  @ApiOperation({ summary: 'Generate common university faculties' })
  @ApiResponse({
    status: 201,
    description: 'Default faculties generated successfully',
  })
  async generateDefaultFaculties(
    @Param('schoolId') schoolId: string
  ): Promise<ResponseDto<{ created: number; skipped: number; message: string }>> {
    const data = await this.facultyService.generateDefaultFaculties(schoolId);
    return ResponseDto.ok(data, data.message);
  }

  @Post(':facultyId/generate-departments')
  @ApiOperation({ summary: 'Generate default departments for a faculty' })
  @ApiResponse({
    status: 201,
    description: 'Default departments generated successfully',
  })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  async generateDepartmentsForFaculty(
    @Param('schoolId') schoolId: string,
    @Param('facultyId') facultyId: string
  ): Promise<ResponseDto<{ created: number; skipped: number; message: string }>> {
    const data = await this.facultyService.generateDepartmentsForFaculty(schoolId, facultyId);
    return ResponseDto.ok(data, data.message);
  }

  // ============ DEPARTMENT ENDPOINTS ============

  @Get(':facultyId/departments')
  @ApiOperation({ summary: 'Get all departments in a faculty' })
  @ApiResponse({
    status: 200,
    description: 'Departments retrieved successfully',
    type: [DepartmentDto],
  })
  async getDepartmentsByFaculty(
    @Param('schoolId') schoolId: string,
    @Param('facultyId') facultyId: string
  ): Promise<ResponseDto<DepartmentDto[]>> {
    const data = await this.facultyService.getDepartments(schoolId, facultyId);
    return ResponseDto.ok(data, 'Departments retrieved successfully');
  }
}

// Separate controller for departments at school level
@ApiTags('departments')
@Controller('schools/:schoolId/departments')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard)
@ApiBearerAuth()
export class DepartmentController {
  constructor(private readonly facultyService: FacultyService) {}

  @Get()
  @ApiOperation({ summary: 'Get all departments for a school (tertiary only)' })
  @ApiQuery({
    name: 'facultyId',
    required: false,
    description: 'Filter by faculty ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Departments retrieved successfully',
    type: [DepartmentDto],
  })
  async getDepartments(
    @Param('schoolId') schoolId: string,
    @Query('facultyId') facultyId?: string
  ): Promise<ResponseDto<DepartmentDto[]>> {
    const data = await this.facultyService.getDepartments(schoolId, facultyId);
    return ResponseDto.ok(data, 'Departments retrieved successfully');
  }

  @Get(':departmentId')
  @ApiOperation({ summary: 'Get a single department by ID' })
  @ApiResponse({
    status: 200,
    description: 'Department retrieved successfully',
    type: DepartmentDto,
  })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async getDepartment(
    @Param('schoolId') schoolId: string,
    @Param('departmentId') departmentId: string
  ): Promise<ResponseDto<DepartmentDto>> {
    const data = await this.facultyService.getDepartment(schoolId, departmentId);
    return ResponseDto.ok(data, 'Department retrieved successfully');
  }

  @Post()
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({
    status: 201,
    description: 'Department created successfully',
    type: DepartmentDto,
  })
  @ApiResponse({ status: 409, description: 'Department with this code already exists' })
  async createDepartment(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateDepartmentDto
  ): Promise<ResponseDto<DepartmentDto>> {
    const data = await this.facultyService.createDepartment(schoolId, dto);
    return ResponseDto.ok(data, 'Department created successfully');
  }

  @Patch(':departmentId')
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({
    status: 200,
    description: 'Department updated successfully',
    type: DepartmentDto,
  })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async updateDepartment(
    @Param('schoolId') schoolId: string,
    @Param('departmentId') departmentId: string,
    @Body() dto: UpdateDepartmentDto
  ): Promise<ResponseDto<DepartmentDto>> {
    const data = await this.facultyService.updateDepartment(schoolId, departmentId, dto);
    return ResponseDto.ok(data, 'Department updated successfully');
  }

  @Delete(':departmentId')
  @ApiOperation({ summary: 'Delete a department' })
  @ApiQuery({
    name: 'force',
    required: false,
    type: Boolean,
    description: 'Force delete even if department has enrolled students',
  })
  @ApiResponse({
    status: 200,
    description: 'Department deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 400, description: 'Department has enrolled students' })
  async deleteDepartment(
    @Param('schoolId') schoolId: string,
    @Param('departmentId') departmentId: string,
    @Query('force') force?: string
  ): Promise<ResponseDto<void>> {
    await this.facultyService.deleteDepartment(schoolId, departmentId, force === 'true');
    return ResponseDto.ok(undefined, 'Department deleted successfully');
  }

  @Get(':departmentId/levels')
  @ApiOperation({ summary: 'Get all levels for a department' })
  @ApiResponse({
    status: 200,
    description: 'Levels retrieved successfully',
    type: [DepartmentLevelDto],
  })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async getDepartmentLevels(
    @Param('schoolId') schoolId: string,
    @Param('departmentId') departmentId: string
  ): Promise<ResponseDto<DepartmentLevelDto[]>> {
    const data = await this.facultyService.getDepartmentLevels(schoolId, departmentId);
    return ResponseDto.ok(data, 'Levels retrieved successfully');
  }

  @Post(':departmentId/generate-levels')
  @ApiOperation({ summary: 'Generate default levels for a department (100L, 200L, etc.)' })
  @ApiResponse({
    status: 201,
    description: 'Levels generated successfully',
  })
  @ApiResponse({ status: 409, description: 'Department already has levels' })
  async generateLevels(
    @Param('schoolId') schoolId: string,
    @Param('departmentId') departmentId: string,
    @Body() dto?: GenerateLevelsDto
  ): Promise<ResponseDto<{ created: number; message: string }>> {
    const data = await this.facultyService.generateLevels(schoolId, departmentId, dto);
    return ResponseDto.ok(data, data.message);
  }
}

// Level controller for tertiary schools
@ApiTags('levels')
@Controller('schools/:schoolId/levels')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard)
@ApiBearerAuth()
export class LevelController {
  constructor(private readonly facultyService: FacultyService) {}

  @Get(':levelId')
  @ApiOperation({ summary: 'Get a single level by ID' })
  @ApiResponse({
    status: 200,
    description: 'Level retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async getLevel(
    @Param('schoolId') schoolId: string,
    @Param('levelId') levelId: string
  ): Promise<ResponseDto<any>> {
    const data = await this.facultyService.getLevel(schoolId, levelId);
    return ResponseDto.ok(data, 'Level retrieved successfully');
  }

  @Get(':levelId/students')
  @ApiOperation({ summary: 'Get students enrolled in a level' })
  @ApiResponse({
    status: 200,
    description: 'Students retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async getLevelStudents(
    @Param('schoolId') schoolId: string,
    @Param('levelId') levelId: string
  ): Promise<ResponseDto<any[]>> {
    const data = await this.facultyService.getLevelStudents(schoolId, levelId);
    return ResponseDto.ok(data, 'Students retrieved successfully');
  }

  @Get(':levelId/courses')
  @ApiOperation({ summary: 'Get courses for a level' })
  @ApiResponse({
    status: 200,
    description: 'Courses retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async getLevelCourses(
    @Param('schoolId') schoolId: string,
    @Param('levelId') levelId: string
  ): Promise<ResponseDto<any[]>> {
    const data = await this.facultyService.getLevelCourses(schoolId, levelId);
    return ResponseDto.ok(data, 'Courses retrieved successfully');
  }

  @Get(':levelId/timetable')
  @ApiOperation({ summary: 'Get timetable for a level' })
  @ApiQuery({
    name: 'termId',
    required: true,
    description: 'Term ID for the timetable',
  })
  @ApiResponse({
    status: 200,
    description: 'Timetable retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async getLevelTimetable(
    @Param('schoolId') schoolId: string,
    @Param('levelId') levelId: string,
    @Query('termId') termId: string
  ): Promise<ResponseDto<any[]>> {
    const data = await this.facultyService.getLevelTimetable(schoolId, levelId, termId);
    return ResponseDto.ok(data, 'Timetable retrieved successfully');
  }

  @Get(':levelId/curriculum')
  @ApiOperation({ summary: 'Get curriculum for a level' })
  @ApiResponse({
    status: 200,
    description: 'Curriculum retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async getLevelCurriculum(
    @Param('schoolId') schoolId: string,
    @Param('levelId') levelId: string
  ): Promise<ResponseDto<any[]>> {
    const data = await this.facultyService.getLevelCurriculum(schoolId, levelId);
    return ResponseDto.ok(data, 'Curriculum retrieved successfully');
  }

  @Get(':levelId/resources')
  @ApiOperation({ summary: 'Get resources for a level' })
  @ApiResponse({
    status: 200,
    description: 'Resources retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Level not found' })
  async getLevelResources(
    @Param('schoolId') schoolId: string,
    @Param('levelId') levelId: string
  ): Promise<ResponseDto<any[]>> {
    const data = await this.facultyService.getLevelResources(schoolId, levelId);
    return ResponseDto.ok(data, 'Resources retrieved successfully');
  }
}

