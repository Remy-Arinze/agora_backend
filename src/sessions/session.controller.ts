import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SessionService } from './session.service';
import {
  InitializeSessionDto,
  CreateTermDto,
  MigrateStudentsDto,
} from './dto/initialize-session.dto';
import { AcademicSessionDto, TermDto, ActiveSessionDto } from './dto/session.dto';
import { ResponseDto } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../schools/dto/permission.dto';

@ApiTags('sessions')
@Controller('schools/:schoolId/sessions')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('initialize')
  @RequirePermission(PermissionResource.SESSIONS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Initialize a new academic session' })
  @ApiResponse({
    status: 201,
    description: 'Session initialized successfully',
    type: AcademicSessionDto,
  })
  async initializeSession(
    @Param('schoolId') schoolId: string,
    @Body() dto: InitializeSessionDto
  ): Promise<ResponseDto<AcademicSessionDto>> {
    const data = await this.sessionService.initializeSession(schoolId, dto);
    return ResponseDto.ok(data, 'Session initialized successfully');
  }

  @Post(':sessionId/terms')
  @RequirePermission(PermissionResource.SESSIONS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Create a term for an academic session' })
  @ApiResponse({
    status: 201,
    description: 'Term created successfully',
    type: TermDto,
  })
  async createTerm(
    @Param('schoolId') schoolId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateTermDto
  ): Promise<ResponseDto<TermDto>> {
    const data = await this.sessionService.createTerm(schoolId, sessionId, dto);
    return ResponseDto.ok(data, 'Term created successfully');
  }

  @Post('start-term')
  @RequirePermission(PermissionResource.SESSIONS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Start a new term (wizard endpoint - handles promotion/carry-over)' })
  @ApiResponse({
    status: 201,
    description: 'Term started successfully',
  })
  async startNewTerm(
    @Param('schoolId') schoolId: string,
    @Body() dto: InitializeSessionDto & { termId?: string }
  ): Promise<ResponseDto<{ session: AcademicSessionDto; term: TermDto; migratedCount: number }>> {
    const data = await this.sessionService.startNewTerm(schoolId, dto);
    return ResponseDto.ok(data, 'Term started successfully');
  }

  @Post('migrate-students')
  @RequirePermission(PermissionResource.SESSIONS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Migrate students (promote or carry over)' })
  @ApiResponse({
    status: 200,
    description: 'Students migrated successfully',
  })
  async migrateStudents(
    @Param('schoolId') schoolId: string,
    @Body() dto: MigrateStudentsDto
  ): Promise<ResponseDto<{ migratedCount: number }>> {
    const data = await this.sessionService.migrateStudents(schoolId, dto);
    return ResponseDto.ok(data, 'Students migrated successfully');
  }

  @Get('active')
  // No permission required - active session is foundational data needed across the dashboard
  @ApiOperation({ summary: 'Get active session and term for the school' })
  @ApiQuery({
    name: 'schoolType',
    required: false,
    description: 'Filter by school type (PRIMARY, SECONDARY, TERTIARY)',
  })
  @ApiResponse({
    status: 200,
    description: 'Active session retrieved successfully',
    type: ActiveSessionDto,
  })
  async getActiveSession(
    @Param('schoolId') schoolId: string,
    @Query('schoolType') schoolType?: string
  ): Promise<ResponseDto<ActiveSessionDto>> {
    const data = await this.sessionService.getActiveSession(schoolId, schoolType);
    return ResponseDto.ok(data, 'Active session retrieved successfully');
  }

  @Get()
  @RequirePermission(PermissionResource.SESSIONS, PermissionType.READ)
  @ApiOperation({ summary: 'Get all sessions for a school' })
  @ApiQuery({
    name: 'schoolType',
    required: false,
    description: 'Filter by school type (PRIMARY, SECONDARY, TERTIARY)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessions retrieved successfully',
    type: [AcademicSessionDto],
  })
  async getSessions(
    @Param('schoolId') schoolId: string,
    @Query('schoolType') schoolType?: string
  ): Promise<ResponseDto<AcademicSessionDto[]>> {
    const data = await this.sessionService.getSessions(schoolId, schoolType);
    return ResponseDto.ok(data, 'Sessions retrieved successfully');
  }

  @Post('end-term')
  @RequirePermission(PermissionResource.SESSIONS, PermissionType.ADMIN)
  @ApiOperation({ summary: 'End the current active term' })
  @ApiQuery({
    name: 'schoolType',
    required: false,
    description: 'Filter by school type (PRIMARY, SECONDARY, TERTIARY)',
  })
  @ApiResponse({
    status: 200,
    description: 'Term ended successfully',
  })
  async endTerm(
    @Param('schoolId') schoolId: string,
    @Query('schoolType') schoolType?: string
  ): Promise<ResponseDto<{ term: TermDto }>> {
    const data = await this.sessionService.endTerm(schoolId, schoolType);
    return ResponseDto.ok(data, 'Term ended successfully');
  }

  @Post('end-session')
  @RequirePermission(PermissionResource.SESSIONS, PermissionType.ADMIN)
  @ApiOperation({ summary: 'End the current active session' })
  @ApiQuery({
    name: 'schoolType',
    required: false,
    description: 'Filter by school type (PRIMARY, SECONDARY, TERTIARY)',
  })
  @ApiResponse({
    status: 200,
    description: 'Session ended successfully',
  })
  async endSession(
    @Param('schoolId') schoolId: string,
    @Query('schoolType') schoolType?: string
  ): Promise<ResponseDto<{ session: AcademicSessionDto }>> {
    const data = await this.sessionService.endSession(schoolId, schoolType);
    return ResponseDto.ok(data, 'Session ended successfully');
  }

  @Post('reactivate-term')
  @RequirePermission(PermissionResource.SESSIONS, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Reactivate a completed term (continue a term that was ended early)' })
  @ApiResponse({
    status: 200,
    description: 'Term reactivated successfully',
  })
  async reactivateTerm(
    @Param('schoolId') schoolId: string,
    @Body() body: { termId: string; schoolType?: string }
  ): Promise<ResponseDto<{ term: TermDto }>> {
    const data = await this.sessionService.reactivateTerm(schoolId, body.termId, body.schoolType);
    return ResponseDto.ok(data, 'Term reactivated successfully');
  }
}
