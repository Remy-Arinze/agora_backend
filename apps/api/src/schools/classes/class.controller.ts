import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ClassService } from './class.service';
import { CreateClassDto } from '../dto/create-class.dto';
import { AssignTeacherToClassDto } from '../dto/assign-teacher-to-class.dto';
import { ClassDto } from '../dto/class.dto';
import { ResponseDto } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../../common/guards/school-data-access.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../dto/permission.dto';

@ApiTags('schools')
@Controller('schools/:schoolId/classes')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Post()
  @RequirePermission(PermissionResource.CLASSES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Create a new class/course' })
  @ApiResponse({
    status: 201,
    description: 'Class created successfully',
    type: ClassDto,
  })
  @ApiResponse({ status: 404, description: 'School not found' })
  @ApiResponse({ status: 400, description: 'Invalid school type for class type' })
  async createClass(
    @Param('schoolId') schoolId: string,
    @Body() createClassDto: CreateClassDto
  ): Promise<ResponseDto<ClassDto>> {
    const data = await this.classService.createClass(schoolId, createClassDto);
    return ResponseDto.ok(data, 'Class created successfully');
  }

  @Get()
  @RequirePermission(PermissionResource.CLASSES, PermissionType.READ)
  @ApiOperation({ summary: 'Get all classes/courses for a school' })
  @ApiResponse({
    status: 200,
    description: 'Classes retrieved successfully',
    type: [ClassDto],
  })
  async getClasses(
    @Param('schoolId') schoolId: string,
    @Query('academicYear') academicYear?: string,
    @Query('type') type?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
    @Query('teacherId') teacherId?: string
  ): Promise<ResponseDto<ClassDto[]>> {
    // If teacherId is provided, get classes for that teacher
    if (teacherId) {
      const data = await this.classService.getTeacherClasses(schoolId, teacherId);
      return ResponseDto.ok(data, 'Teacher classes retrieved successfully');
    }

    const data = await this.classService.getClasses(schoolId, academicYear, type);
    return ResponseDto.ok(data, 'Classes retrieved successfully');
  }

  @Get(':classId')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.READ)
  @ApiOperation({ summary: 'Get a single class/course by ID' })
  @ApiResponse({
    status: 200,
    description: 'Class retrieved successfully',
    type: ClassDto,
  })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getClassById(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string
  ): Promise<ResponseDto<ClassDto>> {
    const data = await this.classService.getClassById(schoolId, classId);
    return ResponseDto.ok(data, 'Class retrieved successfully');
  }

  @Patch(':classId')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Update a class/course' })
  @ApiResponse({
    status: 200,
    description: 'Class updated successfully',
    type: ClassDto,
  })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async updateClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Body() updateClassDto: Partial<CreateClassDto>
  ): Promise<ResponseDto<ClassDto>> {
    const data = await this.classService.updateClass(schoolId, classId, updateClassDto);
    return ResponseDto.ok(data, 'Class updated successfully');
  }

  @Delete(':classId')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Delete a class/course' })
  @ApiQuery({
    name: 'force',
    required: false,
    type: Boolean,
    description: 'Force delete even if students are enrolled (will unenroll all students)',
  })
  @ApiResponse({
    status: 200,
    description: 'Class deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Class not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete class with enrolled students (use force=true to override)',
  })
  async deleteClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Query('force') force?: string
  ): Promise<ResponseDto<void>> {
    const forceDelete = force === 'true';
    await this.classService.deleteClass(schoolId, classId, forceDelete);
    return ResponseDto.ok(undefined, 'Class deleted successfully');
  }

  @Post(':classId/teachers')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Assign a teacher to a class/course' })
  @ApiResponse({
    status: 201,
    description: 'Teacher assigned to class successfully',
    type: ClassDto,
  })
  @ApiResponse({ status: 404, description: 'Class or teacher not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid assignment (e.g., missing subject for secondary)',
  })
  @ApiResponse({
    status: 409,
    description: 'Teacher already assigned or conflict with existing assignment',
  })
  async assignTeacherToClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Body() assignTeacherDto: AssignTeacherToClassDto
  ): Promise<ResponseDto<ClassDto>> {
    const data = await this.classService.assignTeacherToClass(schoolId, classId, assignTeacherDto);
    return ResponseDto.ok(data, 'Teacher assigned to class successfully');
  }

  @Delete(':classId/teachers/:teacherId')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.WRITE)
  @ApiOperation({ summary: 'Remove a teacher from a class/course' })
  @ApiResponse({
    status: 200,
    description: 'Teacher removed from class successfully',
  })
  @ApiResponse({ status: 404, description: 'Class, teacher, or assignment not found' })
  async removeTeacherFromClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Param('teacherId') teacherId: string,
    @Query('subject') subject?: string
  ): Promise<ResponseDto<void>> {
    await this.classService.removeTeacherFromClass(schoolId, classId, teacherId, subject);
    return ResponseDto.ok(undefined, 'Teacher removed from class successfully');
  }

  @Get(':classId/students')
  @RequirePermission(PermissionResource.STUDENTS, PermissionType.READ)
  @ApiOperation({ summary: 'Get all students enrolled in a class' })
  @ApiResponse({
    status: 200,
    description: 'Students retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getClassStudents(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string
  ): Promise<ResponseDto<any[]>> {
    const data = await this.classService.getClassStudents(schoolId, classId);
    return ResponseDto.ok(data, 'Students retrieved successfully');
  }
}
