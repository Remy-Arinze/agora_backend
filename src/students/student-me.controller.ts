import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { ResponseDto } from '../common/dto/response.dto';
import { StudentsService } from './students.service';
import { Response } from 'express';

@ApiTags('students')
@Controller('students')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StudentMeController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current student profile' })
  @ApiResponse({
    status: 200,
    description: 'Student profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  async getMyProfile(@CurrentUser() user: UserWithContext): Promise<ResponseDto<any>> {
    const data = await this.studentsService.getMyProfile(user);
    return ResponseDto.ok(data, 'Student profile retrieved successfully');
  }

  @Post('me/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    })
  )
  @ApiOperation({ summary: 'Upload student profile image' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Image uploaded successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid file or missing file' })
  async uploadProfileImage(
    @CurrentUser() user: UserWithContext,
    @UploadedFile() file: Express.Multer.File
  ): Promise<ResponseDto<any>> {
    const data = await this.studentsService.uploadProfileImage(user, file);
    return ResponseDto.ok(data, 'Image uploaded successfully');
  }

  @Get('me/enrollments')
  @ApiOperation({ summary: 'Get all enrollments for current student' })
  @ApiResponse({
    status: 200,
    description: 'Enrollments retrieved successfully',
  })
  async getMyEnrollments(@CurrentUser() user: UserWithContext): Promise<ResponseDto<any[]>> {
    const data = await this.studentsService.getMyEnrollments(user);
    return ResponseDto.ok(data, 'Enrollments retrieved successfully');
  }

  @Get('me/timetable')
  @ApiOperation({ summary: 'Get timetable for current student' })
  @ApiQuery({ name: 'termId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Timetable retrieved successfully',
  })
  async getMyTimetable(
    @CurrentUser() user: UserWithContext,
    @Query('termId') termId?: string
  ): Promise<ResponseDto<any[]>> {
    // Get schoolId from user context or find from enrollments
    const schoolId = user.currentSchoolId || null;
    const data = await this.studentsService.getMyTimetable(user, schoolId, termId);
    return ResponseDto.ok(data, 'Timetable retrieved successfully');
  }

  @Get('me/grades')
  @ApiOperation({ summary: 'Get all published grades for current student' })
  @ApiQuery({ name: 'classId', required: false, type: String })
  @ApiQuery({ name: 'termId', required: false, type: String })
  @ApiQuery({ name: 'subject', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Grades retrieved successfully',
  })
  async getMyGrades(
    @CurrentUser() user: UserWithContext,
    @Query('classId') classId?: string,
    @Query('termId') termId?: string,
    @Query('subject') subject?: string
  ): Promise<ResponseDto<any[]>> {
    const schoolId = user.currentSchoolId || null;
    const data = await this.studentsService.getMyGrades(user, schoolId, {
      classId,
      termId,
      subject,
    });
    return ResponseDto.ok(data, 'Grades retrieved successfully');
  }

  @Get('me/attendance')
  @ApiOperation({ summary: 'Get attendance records for current student' })
  @ApiQuery({ name: 'classId', required: false, type: String })
  @ApiQuery({ name: 'termId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Attendance retrieved successfully',
  })
  async getMyAttendance(
    @CurrentUser() user: UserWithContext,
    @Query('classId') classId?: string,
    @Query('termId') termId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<ResponseDto<any[]>> {
    const schoolId = user.currentSchoolId || null;
    const data = await this.studentsService.getMyAttendance(user, schoolId, {
      classId,
      termId,
      startDate,
      endDate,
    });
    return ResponseDto.ok(data, 'Attendance retrieved successfully');
  }

  @Get('me/resources')
  @ApiOperation({ summary: 'Get accessible resources for current student' })
  @ApiQuery({ name: 'classId', required: false, type: String })
  @ApiQuery({ name: 'resourceType', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Resources retrieved successfully',
  })
  async getMyResources(
    @CurrentUser() user: UserWithContext,
    @Query('classId') classId?: string,
    @Query('resourceType') resourceType?: string
  ): Promise<ResponseDto<any[]>> {
    const schoolId = user.currentSchoolId || null;
    const data = await this.studentsService.getMyResources(user, schoolId, {
      classId,
      resourceType,
    });
    return ResponseDto.ok(data, 'Resources retrieved successfully');
  }

  @Get('me/calendar')
  @ApiOperation({ summary: 'Get calendar data for current student' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Calendar data retrieved successfully',
  })
  async getMyCalendar(
    @CurrentUser() user: UserWithContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<ResponseDto<any>> {
    const schoolId = user.currentSchoolId || null;
    const data = await this.studentsService.getMyCalendar(user, schoolId, startDate, endDate);
    return ResponseDto.ok(data, 'Calendar data retrieved successfully');
  }

  @Get('me/transcript')
  @ApiOperation({
    summary: 'Get complete education history across all schools (via UID)',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'schoolId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Transcript retrieved successfully',
  })
  async getMyTranscript(
    @CurrentUser() user: UserWithContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('schoolId') schoolId?: string
  ): Promise<ResponseDto<any>> {
    const data = await this.studentsService.getMyTranscript(user, {
      startDate,
      endDate,
      schoolId,
    });
    return ResponseDto.ok(data, 'Transcript retrieved successfully');
  }

  @Get('me/transfers')
  @ApiOperation({ summary: 'Get all transfers for current student' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Transfers retrieved successfully',
  })
  async getMyTransfers(
    @CurrentUser() user: UserWithContext,
    @Query('status') status?: string
  ): Promise<ResponseDto<any[]>> {
    const data = await this.studentsService.getMyTransfers(user, { status });
    return ResponseDto.ok(data, 'Transfers retrieved successfully');
  }

  @Get('me/classes')
  @ApiOperation({ summary: 'Get enrolled classes for current student with full details' })
  @ApiResponse({
    status: 200,
    description: 'Classes retrieved successfully',
  })
  async getMyClasses(@CurrentUser() user: UserWithContext): Promise<ResponseDto<any[]>> {
    const data = await this.studentsService.getMyClasses(user);
    return ResponseDto.ok(data, 'Classes retrieved successfully');
  }

  @Get('me/classmates')
  @ApiOperation({ summary: 'Get classmates (students in the same class)' })
  @ApiQuery({ name: 'classId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Classmates retrieved successfully',
  })
  async getMyClassmates(
    @CurrentUser() user: UserWithContext,
    @Query('classId') classId?: string
  ): Promise<ResponseDto<any[]>> {
    const data = await this.studentsService.getMyClassmates(user, classId);
    return ResponseDto.ok(data, 'Classmates retrieved successfully');
  }

  @Get('me/school')
  @ApiOperation({ summary: 'Get current school for student' })
  @ApiResponse({
    status: 200,
    description: 'School retrieved successfully',
  })
  async getMySchool(@CurrentUser() user: UserWithContext): Promise<ResponseDto<any>> {
    const data = await this.studentsService.getMySchool(user);
    return ResponseDto.ok(data, 'School retrieved successfully');
  }

  @Get('me/personal-resources')
  @ApiOperation({ summary: 'Get personal resources for current student' })
  @ApiResponse({
    status: 200,
    description: 'Personal resources retrieved successfully',
  })
  async getMyPersonalResources(@CurrentUser() user: UserWithContext): Promise<ResponseDto<any[]>> {
    const data = await this.studentsService.getMyPersonalResources(user);
    return ResponseDto.ok(data, 'Personal resources retrieved successfully');
  }

  @Post('me/personal-resources/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a personal resource' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Resource uploaded successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid file or missing file' })
  async uploadPersonalResource(
    @CurrentUser() user: UserWithContext,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description?: string
  ): Promise<ResponseDto<any>> {
    const data = await this.studentsService.uploadPersonalResource(user, file, description);
    return ResponseDto.ok(data, 'Resource uploaded successfully');
  }

  @Get('me/personal-resources/:resourceId/download')
  @ApiOperation({ summary: 'Download a personal resource file' })
  @ApiResponse({
    status: 200,
    description: 'File downloaded successfully',
  })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async downloadPersonalResource(
    @CurrentUser() user: UserWithContext,
    @Param('resourceId') resourceId: string,
    @Res() res: Response
  ): Promise<void> {
    const { buffer, resource } = await this.studentsService.getPersonalResourceFile(
      user,
      resourceId
    );

    res.setHeader('Content-Type', resource.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${resource.name}"`);
    res.setHeader('Content-Length', resource.fileSize);
    res.send(buffer);
  }

  @Delete('me/personal-resources/:resourceId')
  @ApiOperation({ summary: 'Delete a personal resource' })
  @ApiResponse({
    status: 200,
    description: 'Resource deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async deletePersonalResource(
    @CurrentUser() user: UserWithContext,
    @Param('resourceId') resourceId: string
  ): Promise<ResponseDto<void>> {
    await this.studentsService.deletePersonalResource(user, resourceId);
    return ResponseDto.ok(undefined, 'Resource deleted successfully');
  }
}
