import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { Throttle } from '@nestjs/throttler';
import { ExportService } from './export.service';

/**
 * database-intensive tier: PDF generation involves multi-table Prisma queries
 * across enrollments, grades, and attendance records.
 *
 * No SchoolDataAccessGuard or PermissionGuard — students access only their own data.
 */
@Controller('students/me/export')
@UseGuards(JwtAuthGuard)
@Throttle({ 'database-intensive': { limit: 60, ttl: 60000 } })
export class StudentExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * GET students/me/export/report-card
   * Exports the student's term report card as a PDF.
   */
  @Get('report-card')
  async exportReportCard(
    @Query('termId') termId: string,
    @Res() res: Response,
    @CurrentUser() user: UserWithContext,
  ): Promise<void> {
    const buffer = await this.exportService.exportReportCard(user.id, termId);

    const filename = `report-card-${user.id}-${termId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * GET students/me/export/attendance
   * Exports the student's attendance summary for a term as a PDF.
   */
  @Get('attendance')
  async exportAttendance(
    @Query('termId') termId: string,
    @Res() res: Response,
    @CurrentUser() user: UserWithContext,
  ): Promise<void> {
    const buffer = await this.exportService.exportAttendanceSummary(user.id, termId);

    const filename = `attendance-${user.id}-${termId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * GET students/me/export/transcript
   * Exports the student's full academic transcript as a PDF.
   */
  @Get('transcript')
  async exportTranscript(
    @Res() res: Response,
    @CurrentUser() user: UserWithContext,
  ): Promise<void> {
    const buffer = await this.exportService.exportTranscript(user.id);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `transcript-${user.id}-${today}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
