import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponseDto } from '../common/dto/response.dto';
import { NotificationInboxService } from './notification-inbox.service';

@ApiTags('Notifications Inbox')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Throttle({ standard: {} })
export class NotificationInboxController {
  constructor(private readonly inbox: NotificationInboxService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for the current user' })
  async list(
    @Req() req: any,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const data = await this.inbox.listForUser(req.user.id, {
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
      cursor,
      limit: limit ? parseInt(limit, 10) : 30,
      schoolId,
    });
    return ResponseDto.ok(data, 'Notifications retrieved');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for badge' })
  async unreadCount(@Req() req: any, @Query('schoolId') schoolId?: string) {
    const count = await this.inbox.unreadCount(req.user.id, schoolId);
    return ResponseDto.ok({ count }, 'Unread count retrieved');
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@Req() req: any, @Param('id') id: string) {
    const row = await this.inbox.markRead(req.user.id, id);
    return ResponseDto.ok(row, 'Notification marked read');
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Req() req: any, @Body() body?: { schoolId?: string }) {
    const data = await this.inbox.markAllRead(req.user.id, body?.schoolId);
    return ResponseDto.ok(data, 'All notifications marked read');
  }

  @Get('push/vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for Web Push subscribe' })
  async vapidPublicKey() {
    const key = this.inbox.getVapidPublicKey();
    return ResponseDto.ok({ publicKey: key }, key ? 'VAPID public key' : 'VAPID not configured');
  }

  @Post('push/subscribe')
  @ApiOperation({ summary: 'Save a Web Push subscription' })
  async subscribe(
    @Req() req: any,
    @Body()
    body: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ) {
    const data = await this.inbox.savePushSubscription(req.user.id, body);
    return ResponseDto.ok(data, 'Push subscription saved');
  }

  @Delete('push/subscribe')
  @ApiOperation({ summary: 'Remove a Web Push subscription' })
  async unsubscribe(@Req() req: any, @Body() body: { endpoint: string }) {
    const data = await this.inbox.removePushSubscription(req.user.id, body.endpoint);
    return ResponseDto.ok(data, 'Push subscription removed');
  }
}
