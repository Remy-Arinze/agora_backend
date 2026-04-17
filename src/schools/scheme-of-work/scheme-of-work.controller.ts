import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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

@ApiTags('Scheme of Work')
@Controller('scheme-of-work')
@UseGuards(JwtAuthGuard, RolesGuard)
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
    @CurrentUser() user: UserWithContext,
    @Body() dto: GenerateSchemeOfWorkDto
  ) {
    const schoolId = user.currentSchoolId!;
    const scheme = await this.schemeOfWorkService.generateScheme(schoolId, dto, user.id);
    return ResponseDto.ok(scheme, 'Scheme of Work generation queued successfully');
  }

  @Get()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionGuard)
  @RequirePermission(PermissionResource.SCHEME_OF_WORK, PermissionType.READ)
  @ApiOperation({ summary: 'Get all Schemes of Work within the school' })
  async getSchemes(
    @CurrentUser() user: UserWithContext,
    @Query('classId') classId?: string,
    @Query('termId') termId?: string,
    @Query('subjectId') subjectId?: string
  ) {
    const schoolId = user.currentSchoolId!;
    const schemes = await this.schemeOfWorkService.getSchemesBySchool(schoolId, { classId, termId, subjectId });
    return ResponseDto.ok(schemes, 'Schemes of Work retrieved successfully');
  }

  @Get(':id')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionGuard)
  @RequirePermission(PermissionResource.SCHEME_OF_WORK, PermissionType.READ)
  @ApiOperation({ summary: 'Get full details of a specific Scheme of Work' })
  async getSchemeById(
    @CurrentUser() user: UserWithContext,
    @Param('id') id: string
  ) {
    const schoolId = user.currentSchoolId!;
    const scheme = await this.schemeOfWorkService.getSchemeById(schoolId, id);
    return ResponseDto.ok(scheme, 'Scheme of Work detail retrieved');
  }

  @Patch(':id/status')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionGuard)
  @RequirePermission(PermissionResource.SCHEME_OF_WORK, PermissionType.WRITE)
  @ApiOperation({ summary: 'Update Scheme of Work status (Draft/Approved/Published)' })
  async updateStatus(
    @CurrentUser() user: UserWithContext,
    @Param('id') id: string,
    @Body() dto: UpdateSchemeOfWorkStatusDto
  ) {
    const schoolId = user.currentSchoolId!;
    const scheme = await this.schemeOfWorkService.updateSchemeStatus(schoolId, id, dto, user.id);
    return ResponseDto.ok(scheme, 'Scheme of Work status updated');
  }

  // ==========================================
  // TEACHER ENDPOINTS
  // Class scoped
  // ==========================================

  @Get('teacher/class/:classId/term/:termId')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher view: Get published schemes of work for their assigned class context' })
  async getTeacherClassLoader(
    @CurrentUser() user: UserWithContext,
    @Param('classId') classId: string,
    @Param('termId') termId: string
  ) {
    const schoolId = user.currentSchoolId!;
    const scheme = await this.schemeOfWorkService.getSchemeForTeacherClassScope(
      schoolId, classId, termId, user.id
    );
    return ResponseDto.ok(scheme, 'Class Scheme of Work payload retrieved');
  }

  @Patch('teacher/week/:weekId/delivery')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher view: Mark a specific topic/week as delivered or add private notes' })
  async markWeekDelivered(
    @CurrentUser() user: UserWithContext,
    @Param('weekId') weekId: string,
    @Body() dto: MarkWeekDeliveredDto
  ) {
    const schoolId = user.currentSchoolId!;
    const result = await this.schemeOfWorkService.markWeekDelivered(schoolId, weekId, dto, user.id);
    return ResponseDto.ok(result, 'Week delivery status updated');
  }

  // ==========================================
  // STUDENT ENDPOINTS
  // Class scoped and structurally limited
  // ==========================================

  @Get('student/class/:classId/term/:termId')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student view: Get public-facing published schemes of work for their class' })
  async getStudentClassLoader(
    @CurrentUser() user: UserWithContext,
    @Param('classId') classId: string,
    @Param('termId') termId: string
  ) {
    const schoolId = user.currentSchoolId!;
    const scheme = await this.schemeOfWorkService.getSchemeForStudentClassScope(
      schoolId, classId, termId, user.id
    );
    return ResponseDto.ok(scheme, 'Student Scheme of Work payload retrieved');
  }
}
