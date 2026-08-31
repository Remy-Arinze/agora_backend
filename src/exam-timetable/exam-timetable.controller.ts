import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExamTimetableService } from './exam-timetable.service';
import {
  CreateExamTimetableSlotDto,
  ExamPublishEligibilityDto,
  ExamTimetableSlotDto,
  PublishExamTimetableDto,
  UpdateExamTimetableSlotDto,
} from './dto/exam-timetable.dto';
import { ResponseDto } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../schools/dto/permission.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserWithContext } from '../auth/types/user-with-context.type';

@ApiTags('exam-timetable')
@Controller('schools/:schoolId/exam-timetable')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
export class ExamTimetableController {
  constructor(private readonly examTimetableService: ExamTimetableService) {}

  @Get()
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.READ)
  @ApiOperation({ summary: 'List exam timetable slots for a term' })
  @ApiQuery({ name: 'termId', required: true })
  async list(
    @Param('schoolId') schoolId: string,
    @Query('termId') termId: string,
  ): Promise<ResponseDto<ExamTimetableSlotDto[]>> {
    const data = await this.examTimetableService.listSlots(schoolId, termId);
    return ResponseDto.ok(data, 'Exam timetable retrieved');
  }

  @Get('published')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.READ)
  @ApiOperation({ summary: 'List published exam slots (teachers/students during exam period)' })
  @ApiQuery({ name: 'termId', required: true })
  async listPublished(
    @Param('schoolId') schoolId: string,
    @Query('termId') termId: string,
  ): Promise<ResponseDto<ExamTimetableSlotDto[]>> {
    const data = await this.examTimetableService.listSlots(schoolId, termId, {
      publishedOnly: true,
    });
    return ResponseDto.ok(data, 'Published exam timetable retrieved');
  }

  @Post('slots')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Create an exam timetable slot (admin only)' })
  async create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateExamTimetableSlotDto,
  ): Promise<ResponseDto<ExamTimetableSlotDto>> {
    const data = await this.examTimetableService.createSlot(schoolId, dto);
    return ResponseDto.ok(data, 'Exam slot created');
  }

  @Patch('slots/:slotId')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.ADMIN)
  async update(
    @Param('schoolId') schoolId: string,
    @Param('slotId') slotId: string,
    @Body() dto: UpdateExamTimetableSlotDto,
  ): Promise<ResponseDto<ExamTimetableSlotDto>> {
    const data = await this.examTimetableService.updateSlot(schoolId, slotId, dto);
    return ResponseDto.ok(data, 'Exam slot updated');
  }

  @Delete('slots/:slotId')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.ADMIN)
  async remove(
    @Param('schoolId') schoolId: string,
    @Param('slotId') slotId: string,
  ): Promise<ResponseDto<null>> {
    await this.examTimetableService.deleteSlot(schoolId, slotId);
    return ResponseDto.ok(null, 'Exam slot deleted');
  }

  @Post('publish')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Publish exam timetable — replaces lesson schedule during exam period' })
  async publish(
    @Param('schoolId') schoolId: string,
    @Body() dto: PublishExamTimetableDto,
    @CurrentUser() user: UserWithContext,
  ) {
    const data = await this.examTimetableService.publishExamTimetable(
      schoolId,
      dto.termId,
      user.id,
    );
    return ResponseDto.ok(data, 'Exam timetable published');
  }

  @Post('unpublish')
  @RequirePermission(PermissionResource.TIMETABLES, PermissionType.ADMIN)
  async unpublish(
    @Param('schoolId') schoolId: string,
    @Body() dto: PublishExamTimetableDto,
  ) {
    const data = await this.examTimetableService.unpublishExamTimetable(schoolId, dto.termId);
    return ResponseDto.ok(data, 'Exam timetable unpublished');
  }

  @Get('exam-assessment-eligibility')
  @RequirePermission(PermissionResource.CLASSES, PermissionType.READ)
  @ApiOperation({ summary: 'Check if teacher can publish an EXAM assessment' })
  async eligibility(
    @Param('schoolId') schoolId: string,
    @Query('termId') termId: string,
    @Query('subjectId') subjectId: string,
    @Query('classId') classId?: string,
    @Query('classArmId') classArmId?: string,
  ): Promise<ResponseDto<ExamPublishEligibilityDto>> {
    const result = await this.examTimetableService.assertCanPublishExamAssessment({
      schoolId,
      termId,
      subjectId,
      classId,
      classArmId,
    });
    return ResponseDto.ok(
      {
        canPublishExamAssessment: result.ok,
        blockers: result.ok === false ? result.blockers : [],
      },
      'Eligibility checked',
    );
  }
}
