import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto, BulkAttendanceDto } from './dto/create-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { ResponseDto } from '../common/dto/response.dto';

@ApiTags('attendance')
@Controller('schools/:schoolId/attendance')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @ApiOperation({ summary: 'Mark attendance for a student' })
  @ApiResponse({ status: 201, description: 'Attendance marked successfully' })
  async markAttendance(
    @CurrentUser() user: UserWithContext,
    @Body() dto: CreateAttendanceDto
  ) {
    const data = await this.attendanceService.markAttendance(user, dto);
    return ResponseDto.ok(data, 'Attendance marked successfully');
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Mark attendance in bulk for a class' })
  @ApiResponse({ status: 201, description: 'Bulk attendance marked successfully' })
  async markBulkAttendance(
    @CurrentUser() user: UserWithContext,
    @Body() dto: BulkAttendanceDto
  ) {
    const data = await this.attendanceService.markBulkAttendance(user, dto);
    return ResponseDto.ok(data, 'Bulk attendance marked successfully');
  }

  @Get('classes/:classId')
  @ApiOperation({ summary: 'Get attendance for a class on a specific date' })
  @ApiQuery({ name: 'date', required: true, type: String })
  @ApiQuery({ name: 'classType', required: true, enum: ['CLASS', 'CLASS_ARM'] })
  async getClassAttendance(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Query('classType') classType: 'CLASS' | 'CLASS_ARM',
    @Query('date') date: string
  ) {
    const data = await this.attendanceService.getClassAttendance(schoolId, classId, classType, date);
    return ResponseDto.ok(data, 'Attendance retrieved successfully');
  }

  @Get('classes/:classId/summary')
  @ApiOperation({ summary: 'Get attendance summary for a class over a period' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'classType', required: true, enum: ['CLASS', 'CLASS_ARM'] })
  async getClassAttendanceSummary(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Query('classType') classType: 'CLASS' | 'CLASS_ARM',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    const data = await this.attendanceService.getClassAttendanceSummary(
      schoolId,
      classId,
      classType,
      startDate,
      endDate
    );
    return ResponseDto.ok(data, 'Attendance summary retrieved successfully');
  }
}
