import { Controller, Get, Post, Delete, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../schools/dto/permission.dto';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { BackupService } from './backup.service';

@Controller('schools/:schoolId/export/backup')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Google Drive
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET schools/:schoolId/export/backup/google-drive/auth
   * Returns the Google Drive OAuth authorisation URL.
   */
  @Get('google-drive/auth')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async getGoogleDriveAuthUrl(
    @Param('schoolId') schoolId: string,
  ): Promise<{ authUrl: string }> {
    const authUrl = await this.backupService.getOAuthUrl(schoolId, 'GOOGLE_DRIVE');
    return { authUrl };
  }

  /**
   * GET schools/:schoolId/export/backup/google-drive/callback
   * OAuth callback called directly by Google — no auth guards.
   * Redirects to frontend on success or failure.
   */
  @Get('google-drive/callback')
  async handleGoogleDriveCallback(
    @Param('schoolId') schoolId: string,
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const base = `${frontendUrl}/dashboard/school/settings/profile?tab=data`;

    if (error || !code) {
      return res.redirect(`${base}&google-drive_error=true`);
    }

    try {
      await this.backupService.handleOAuthCallback(schoolId, 'GOOGLE_DRIVE', code);
      res.redirect(`${base}&google-drive_connected=true`);
    } catch {
      res.redirect(`${base}&google-drive_error=true`);
    }
  }

  /**
   * GET schools/:schoolId/export/backup/google-drive/status
   * Returns the Google Drive connection status.
   */
  @Get('google-drive/status')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async getGoogleDriveStatus(@Param('schoolId') schoolId: string) {
    return this.backupService.getStatus(schoolId, 'GOOGLE_DRIVE');
  }

  /**
   * DELETE schools/:schoolId/export/backup/google-drive/disconnect
   * Disconnects Google Drive for this school.
   */
  @Delete('google-drive/disconnect')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async disconnectGoogleDrive(@Param('schoolId') schoolId: string): Promise<void> {
    await this.backupService.disconnect(schoolId, 'GOOGLE_DRIVE');
  }

  /**
   * POST schools/:schoolId/export/backup/google-drive/backup-now
   * Triggers an immediate backup to Google Drive.
   */
  @Post('google-drive/backup-now')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  @Throttle({ 'database-intensive': { limit: 10, ttl: 60000 } })
  async backupNowGoogleDrive(@Param('schoolId') schoolId: string): Promise<void> {
    await this.backupService.backupNow(schoolId, 'GOOGLE_DRIVE');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Dropbox
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET schools/:schoolId/export/backup/dropbox/auth
   * Returns the Dropbox OAuth authorisation URL.
   */
  @Get('dropbox/auth')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async getDropboxAuthUrl(
    @Param('schoolId') schoolId: string,
  ): Promise<{ authUrl: string }> {
    const authUrl = await this.backupService.getOAuthUrl(schoolId, 'DROPBOX');
    return { authUrl };
  }

  /**
   * GET schools/:schoolId/export/backup/dropbox/callback
   * OAuth callback called directly by Dropbox — no auth guards.
   * Redirects to frontend on success or failure.
   */
  @Get('dropbox/callback')
  async handleDropboxCallback(
    @Param('schoolId') schoolId: string,
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const base = `${frontendUrl}/dashboard/school/settings/profile?tab=data`;

    if (error || !code) {
      return res.redirect(`${base}&dropbox_error=true`);
    }

    try {
      await this.backupService.handleOAuthCallback(schoolId, 'DROPBOX', code);
      res.redirect(`${base}&dropbox_connected=true`);
    } catch {
      res.redirect(`${base}&dropbox_error=true`);
    }
  }

  /**
   * GET schools/:schoolId/export/backup/dropbox/status
   * Returns the Dropbox connection status.
   */
  @Get('dropbox/status')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async getDropboxStatus(@Param('schoolId') schoolId: string) {
    return this.backupService.getStatus(schoolId, 'DROPBOX');
  }

  /**
   * DELETE schools/:schoolId/export/backup/dropbox/disconnect
   * Disconnects Dropbox for this school.
   */
  @Delete('dropbox/disconnect')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async disconnectDropbox(@Param('schoolId') schoolId: string): Promise<void> {
    await this.backupService.disconnect(schoolId, 'DROPBOX');
  }

  /**
   * POST schools/:schoolId/export/backup/dropbox/backup-now
   * Triggers an immediate backup to Dropbox.
   */
  @Post('dropbox/backup-now')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  @Throttle({ 'database-intensive': { limit: 10, ttl: 60000 } })
  async backupNowDropbox(@Param('schoolId') schoolId: string): Promise<void> {
    await this.backupService.backupNow(schoolId, 'DROPBOX');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MEGA
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST schools/:schoolId/export/backup/mega/connect
   * Saves encrypted MEGA credentials for automated backup.
   */
  @Post('mega/connect')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async connectMega(
    @Param('schoolId') schoolId: string,
    @Body() body: { email: string; password: string },
  ): Promise<void> {
    await this.backupService.connectMega(schoolId, body.email, body.password);
  }

  /**
   * GET schools/:schoolId/export/backup/mega/status
   * Returns the MEGA connection status.
   */
  @Get('mega/status')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async getMegaStatus(@Param('schoolId') schoolId: string) {
    return this.backupService.getStatus(schoolId, 'MEGA');
  }

  /**
   * DELETE schools/:schoolId/export/backup/mega/disconnect
   * Disconnects MEGA for this school.
   */
  @Delete('mega/disconnect')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  async disconnectMega(@Param('schoolId') schoolId: string): Promise<void> {
    await this.backupService.disconnect(schoolId, 'MEGA');
  }

  /**
   * POST schools/:schoolId/export/backup/mega/backup-now
   * Triggers an immediate backup to MEGA.
   */
  @Post('mega/backup-now')
  @UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
  @RequirePermission(PermissionResource.SETTINGS, PermissionType.WRITE)
  @Throttle({ 'database-intensive': { limit: 10, ttl: 60000 } })
  async backupNowMega(@Param('schoolId') schoolId: string): Promise<void> {
    await this.backupService.backupNow(schoolId, 'MEGA');
  }
}
