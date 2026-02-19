import { Controller, Get, Delete, Query, Param, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { GoogleCalendarService } from './google-calendar.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../../common/guards/school-data-access.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserWithContext } from '../../auth/types/user-with-context.type';
import { ResponseDto } from '../../common/dto/response.dto';

// Callback endpoint - must be at root level for fixed redirect URI
@ApiTags('google-calendar')
@Controller('integrations/google-calendar')
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('callback')
  @ApiOperation({ summary: 'Handle Google Calendar OAuth callback' })
  @ApiResponse({
    status: 200,
    description: 'Google Calendar connected successfully',
  })
  // No auth required - Google calls this directly
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      const { userId, schoolId } = await this.googleCalendarService.handleCallback(code, state);

      // Redirect to frontend with success message
      const redirectUrl =
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/dashboard/teacher/calendar';
      res.redirect(`${redirectUrl}?google_calendar_connected=true`);
    } catch (error) {
      // Redirect to frontend with error message
      const redirectUrl =
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/dashboard/teacher/calendar';
      res.redirect(`${redirectUrl}?google_calendar_error=true`);
    }
  }
}

// School-specific endpoints
@ApiTags('google-calendar')
@Controller('schools/:schoolId/integrations/google-calendar')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard)
@ApiBearerAuth()
export class GoogleCalendarSchoolController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('auth')
  @ApiOperation({ summary: 'Get Google Calendar OAuth URL' })
  @ApiResponse({
    status: 200,
    description: 'OAuth URL generated successfully',
  })
  async getAuthUrl(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<{ authUrl: string }>> {
    const authUrl = this.googleCalendarService.getAuthUrl(user.id, schoolId);
    return ResponseDto.ok({ authUrl }, 'OAuth URL generated successfully');
  }

  @Get('status')
  @ApiOperation({ summary: 'Get Google Calendar sync status' })
  @ApiResponse({
    status: 200,
    description: 'Sync status retrieved successfully',
  })
  async getStatus(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<any>> {
    const status = await this.googleCalendarService.getSyncStatus(user.id, schoolId);
    return ResponseDto.ok(status, 'Sync status retrieved successfully');
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect Google Calendar' })
  @ApiResponse({
    status: 200,
    description: 'Google Calendar disconnected successfully',
  })
  async disconnect(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<void>> {
    await this.googleCalendarService.disconnect(user.id, schoolId);
    return ResponseDto.ok(undefined, 'Google Calendar disconnected successfully');
  }
}
