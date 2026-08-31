import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SchoolSettingsService, SettingsSection } from './school-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../schools/dto/permission.dto';
import { ResponseDto } from '../common/dto/response.dto';
import { UpdateStructureSettingsDto } from './dto/update-structure-settings.dto';
import { UpdateCalendarSettingsDto } from './dto/update-calendar-settings.dto';
import { UpdateGradingSettingsDto } from './dto/update-grading-settings.dto';
import { UpdatePermissionsSettingsDto } from './dto/update-permissions-settings.dto';
import { UpdateAdmissionsSettingsDto } from './dto/update-admissions-settings.dto';
import { UpdateTimetableSettingsDto } from './dto/update-timetable-settings.dto';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';
import { UpdateCommunicationsSettingsDto } from './dto/update-communications-settings.dto';
import { UpdateFinanceSettingsDto } from './dto/update-finance-settings.dto';
import { UpdateCurriculumSettingsDto } from './dto/update-curriculum-settings.dto';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';
import { CreateHolidayPresetDto, UpdateHolidayPresetDto } from './dto/holiday-preset.dto';
import { CreateRoleTemplateDto, UpdateRoleTemplateDto } from './dto/role-template.dto';
import { CreateAssessmentTemplateDto, UpdateAssessmentTemplateDto } from './dto/assessment-template.dto';
import { CreateFeeCategoryDto, UpdateFeeCategoryDto } from './dto/fee-category.dto';
import { CreateFeeScheduleDto, UpdateFeeScheduleDto } from './dto/fee-schedule.dto';
import { CreateKnowledgeDocumentDto } from './dto/knowledge-document.dto';

const SECTIONS: SettingsSection[] = [
  'structure',
  'calendar',
  'grading',
  'permissions',
  'admissions',
  'timetable',
  'attendance',
  'communications',
  'finance',
  'curriculum',
  'security',
];

function isSettingsSection(value: string): value is SettingsSection {
  return SECTIONS.includes(value as SettingsSection);
}

@ApiTags('school-admin')
@Controller('school-admin/settings')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
@Throttle({ standard: {} })
export class SchoolSettingsController {
  constructor(private readonly settingsService: SchoolSettingsService) {}

  @Get()
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.READ)
  @ApiOperation({ summary: 'Get all school settings (aggregate)' })
  async getAll(@Request() req: { user: { schoolId: string } }) {
    const data = await this.settingsService.getAllSettings(req.user.schoolId);
    return ResponseDto.ok(data, 'Settings retrieved');
  }

  @Get('audit-logs')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.READ)
  @ApiOperation({ summary: 'Get audit logs for school' })
  async getAuditLogs(@Request() req: { user: { schoolId: string } }) {
    const data = await this.settingsService.getAuditLogs(req.user.schoolId);
    return ResponseDto.ok(data, 'Audit logs retrieved');
  }

  @Get(':section')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.READ)
  @ApiOperation({ summary: 'Get settings for a section' })
  async getSection(
    @Request() req: { user: { schoolId: string } },
    @Param('section') section: string,
  ) {
    if (!isSettingsSection(section)) {
      throw new BadRequestException(`Invalid section: ${section}`);
    }
    const data = await this.settingsService.getSection(req.user.schoolId, section);
    return ResponseDto.ok(data, 'Section settings retrieved');
  }

  @Patch(':section')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Update settings for a section' })
  async updateSection(
    @Request() req: { user: { schoolId: string } },
    @Param('section') section: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (!isSettingsSection(section)) {
      throw new BadRequestException(`Invalid section: ${section}`);
    }
    const data = await this.settingsService.updateSection(req.user.schoolId, section, body);
    return ResponseDto.ok(data, 'Section settings updated');
  }

  // Holiday presets
  @Post('calendar/holidays')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async createHoliday(@Request() req: { user: { schoolId: string } }, @Body() dto: CreateHolidayPresetDto) {
    const data = await this.settingsService.createHolidayPreset(req.user.schoolId, dto);
    return ResponseDto.ok(data, 'Holiday preset created');
  }

  @Patch('calendar/holidays/:id')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async updateHoliday(
    @Request() req: { user: { schoolId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateHolidayPresetDto,
  ) {
    const data = await this.settingsService.updateHolidayPreset(req.user.schoolId, id, dto);
    return ResponseDto.ok(data, 'Holiday preset updated');
  }

  @Delete('calendar/holidays/:id')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async deleteHoliday(@Request() req: { user: { schoolId: string } }, @Param('id') id: string) {
    await this.settingsService.deleteHolidayPreset(req.user.schoolId, id);
    return ResponseDto.ok(null, 'Holiday preset deleted');
  }

  @Post('calendar/holidays/:id/apply')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async applyHoliday(@Request() req: { user: { schoolId: string } }, @Param('id') id: string) {
    const data = await this.settingsService.applyHolidayPresetToCalendar(req.user.schoolId, id);
    return ResponseDto.ok(data, 'Holiday applied to calendar');
  }

  // Role templates
  @Post('permissions/role-templates')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async createRoleTemplate(@Request() req: { user: { schoolId: string } }, @Body() dto: CreateRoleTemplateDto) {
    const data = await this.settingsService.createRoleTemplate(req.user.schoolId, dto);
    return ResponseDto.ok(data, 'Role template created');
  }

  @Patch('permissions/role-templates/:id')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async updateRoleTemplate(
    @Request() req: { user: { schoolId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateRoleTemplateDto,
  ) {
    const data = await this.settingsService.updateRoleTemplate(req.user.schoolId, id, dto);
    return ResponseDto.ok(data, 'Role template updated');
  }

  @Delete('permissions/role-templates/:id')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async deleteRoleTemplate(@Request() req: { user: { schoolId: string } }, @Param('id') id: string) {
    await this.settingsService.deleteRoleTemplate(req.user.schoolId, id);
    return ResponseDto.ok(null, 'Role template deleted');
  }

  @Post('permissions/role-templates/:id/apply/:adminId')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.ADMIN)
  async applyRoleTemplate(
    @Request() req: { user: { schoolId: string } },
    @Param('id') id: string,
    @Param('adminId') adminId: string,
  ) {
    const data = await this.settingsService.applyRoleTemplate(req.user.schoolId, id, adminId);
    return ResponseDto.ok(data, 'Role template applied');
  }

  // Assessment templates
  @Post('grading/templates')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async createAssessmentTemplate(
    @Request() req: { user: { schoolId: string } },
    @Body() dto: CreateAssessmentTemplateDto,
  ) {
    const data = await this.settingsService.createAssessmentTemplate(req.user.schoolId, dto);
    return ResponseDto.ok(data, 'Assessment template created');
  }

  @Patch('grading/templates/:id')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async updateAssessmentTemplate(
    @Request() req: { user: { schoolId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentTemplateDto,
  ) {
    const data = await this.settingsService.updateAssessmentTemplate(req.user.schoolId, id, dto);
    return ResponseDto.ok(data, 'Assessment template updated');
  }

  @Delete('grading/templates/:id')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async deleteAssessmentTemplate(@Request() req: { user: { schoolId: string } }, @Param('id') id: string) {
    await this.settingsService.deleteAssessmentTemplate(req.user.schoolId, id);
    return ResponseDto.ok(null, 'Assessment template deactivated');
  }

  // Finance
  @Post('finance/categories')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async createFeeCategory(@Request() req: { user: { schoolId: string } }, @Body() dto: CreateFeeCategoryDto) {
    const data = await this.settingsService.createFeeCategory(req.user.schoolId, dto);
    return ResponseDto.ok(data, 'Fee category created');
  }

  @Patch('finance/categories/:id')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async updateFeeCategory(
    @Request() req: { user: { schoolId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateFeeCategoryDto,
  ) {
    const data = await this.settingsService.updateFeeCategory(req.user.schoolId, id, dto);
    return ResponseDto.ok(data, 'Fee category updated');
  }

  @Post('finance/schedules')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async createFeeSchedule(@Request() req: { user: { schoolId: string } }, @Body() dto: CreateFeeScheduleDto) {
    const data = await this.settingsService.createFeeSchedule(req.user.schoolId, dto);
    return ResponseDto.ok(data, 'Fee schedule created');
  }

  @Patch('finance/schedules/:id')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async updateFeeSchedule(
    @Request() req: { user: { schoolId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateFeeScheduleDto,
  ) {
    const data = await this.settingsService.updateFeeSchedule(req.user.schoolId, id, dto);
    return ResponseDto.ok(data, 'Fee schedule updated');
  }

  @Post('finance/schedules/:id/generate')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async generateFees(@Request() req: { user: { schoolId: string } }, @Param('id') id: string) {
    const data = await this.settingsService.generateFeesFromSchedule(req.user.schoolId, id);
    return ResponseDto.ok(data, 'Fees generated');
  }

  // Knowledge base
  @Post('curriculum/knowledge')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async createKnowledge(
    @Request() req: { user: { schoolId: string } },
    @Body() dto: CreateKnowledgeDocumentDto,
  ) {
    const data = await this.settingsService.createKnowledgeDocument(req.user.schoolId, dto);
    return ResponseDto.ok(data, 'Knowledge document created');
  }

  @Delete('curriculum/knowledge/:id')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async deleteKnowledge(@Request() req: { user: { schoolId: string } }, @Param('id') id: string) {
    await this.settingsService.deleteKnowledgeDocument(req.user.schoolId, id);
    return ResponseDto.ok(null, 'Knowledge document deleted');
  }
}
