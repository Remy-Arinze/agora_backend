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
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CourseRegistrationService } from './course-registration.service';
import {
  CreateCourseRegistrationDto,
  UpdateCourseRegistrationDto,
  CourseRegistrationDto,
} from './dto/course-registration.dto';
import { ResponseDto } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentDataAccessGuard } from '../common/guards/student-data-access.guard';

@ApiTags('students')
@Controller('students/me/course-registrations')
@UseGuards(JwtAuthGuard, StudentDataAccessGuard)
@ApiBearerAuth()
export class CourseRegistrationController {
  constructor(private readonly courseRegistrationService: CourseRegistrationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all course registrations for the current student (TERTIARY only)' })
  @ApiQuery({ name: 'termId', required: false, type: String, description: 'Filter by term ID' })
  @ApiResponse({
    status: 200,
    description: 'Course registrations retrieved successfully',
    type: ResponseDto<CourseRegistrationDto[]>,
  })
  async getMyCourseRegistrations(
    @Request() req: any,
    @Query('termId') termId?: string
  ): Promise<ResponseDto<CourseRegistrationDto[]>> {
    const data = await this.courseRegistrationService.getStudentCourseRegistrations(
      req.user,
      termId
    );
    return ResponseDto.ok(data, 'Course registrations retrieved successfully');
  }

  @Post()
  @ApiOperation({ summary: 'Register for a course (TERTIARY only)' })
  @ApiResponse({
    status: 201,
    description: 'Course registration created successfully',
    type: ResponseDto<CourseRegistrationDto>,
  })
  async createCourseRegistration(
    @Request() req: any,
    @Body() dto: CreateCourseRegistrationDto
  ): Promise<ResponseDto<CourseRegistrationDto>> {
    const data = await this.courseRegistrationService.createCourseRegistration(req.user, dto);
    return ResponseDto.ok(data, 'Course registration created successfully');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a course registration' })
  @ApiParam({ name: 'id', description: 'Course registration ID' })
  @ApiResponse({
    status: 200,
    description: 'Course registration updated successfully',
    type: ResponseDto<CourseRegistrationDto>,
  })
  async updateCourseRegistration(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCourseRegistrationDto
  ): Promise<ResponseDto<CourseRegistrationDto>> {
    const data = await this.courseRegistrationService.updateCourseRegistration(req.user, id, dto);
    return ResponseDto.ok(data, 'Course registration updated successfully');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (deactivate) a course registration' })
  @ApiParam({ name: 'id', description: 'Course registration ID' })
  @ApiResponse({
    status: 200,
    description: 'Course registration deleted successfully',
  })
  async deleteCourseRegistration(
    @Request() req: any,
    @Param('id') id: string
  ): Promise<ResponseDto<void>> {
    await this.courseRegistrationService.deleteCourseRegistration(req.user, id);
    return ResponseDto.ok(undefined, 'Course registration deleted successfully');
  }
}

