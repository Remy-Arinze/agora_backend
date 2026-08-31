import { Controller, Get, Query, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../schools/dto/permission.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { Throttle } from '@nestjs/throttler';
import { ExportService } from './export.service';

/**
 * database-intensive tier: CSV export operations involve bulk Prisma queries
 * across enrollments, attendance, grades, and fees.
 */
@Controller('schools/:schoolId/export')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@Throttle({ 'database-intensive': { limit: 60, ttl: 60000 } })
export class SchoolExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * GET schools/:schoolId/export/roster
   * Exports all active enrollments for a school and academic year as CSV.
   */
  @Get('roster')
  @RequirePermission(PermissionResource.STUDENTS, PermissionType.READ)
  async exportRoster(
    @Param('schoolId') schoolId: string,
    @Query('academicYear') academicYear: string,
    @Res() res: Response,
    @CurrentUser() user: UserWithContext,
  ): Promise<void> {
    const buffer = await this.exportService.exportRoster(schoolId, academicYear, user.id);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `student-roster-${schoolId}-${today}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * GET schools/:schoolId/export/attendance
   * Exports attendance records for a class/classArm within a term date range as CSV.
   */
  @Get('attendance')
  @RequirePermission(PermissionResource.GRADES, PermissionType.READ)
  async exportAttendance(
    @Param('schoolId') schoolId: string,
    @Query('classId') classId: string,
    @Query('classType') classType: 'CLASS' | 'CLASS_ARM' = 'CLASS_ARM',
    @Query('termId') termId: string,
    @Res() res: Response,
    @CurrentUser() user: UserWithContext,
  ): Promise<void> {
    const resolvedClassType: 'CLASS' | 'CLASS_ARM' =
      classType === 'CLASS' ? 'CLASS' : 'CLASS_ARM';

    const buffer = await this.exportService.exportAttendance(
      schoolId,
      classId,
      resolvedClassType,
      termId,
      user.id,
    );

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `attendance-${classId}-${termId}-${today}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * GET schools/:schoolId/export/grades
   * Exports grade records for enrollments in a class for a term as CSV.
   */
  @Get('grades')
  @RequirePermission(PermissionResource.GRADES, PermissionType.READ)
  async exportGrades(
    @Param('schoolId') schoolId: string,
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Res() res: Response,
    @CurrentUser() user: UserWithContext,
  ): Promise<void> {
    const buffer = await this.exportService.exportGrades(schoolId, classId, termId, user.id);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `grades-${classId}-${termId}-${today}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * GET schools/:schoolId/export/fees
   * Exports fee records for a school filtered to enrollments in a given term as CSV.
   */
  @Get('fees')
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.ADMIN)
  async exportFees(
    @Param('schoolId') schoolId: string,
    @Query('termId') termId: string,
    @Res() res: Response,
    @CurrentUser() user: UserWithContext,
  ): Promise<void> {
    const buffer = await this.exportService.exportFees(schoolId, termId, user.id);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todayCompact = today.replace(/-/g, ''); // YYYYMMDD
    const filename = `fees-${schoolId}-${termId}-${todayCompact}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
