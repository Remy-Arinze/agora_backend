import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventDto } from './dto/event.dto';
import { ResponseDto } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../schools/dto/permission.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserWithContext } from '../auth/types/user-with-context.type';

@ApiTags('events')
@Controller('schools/:schoolId/events')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @RequirePermission(PermissionResource.EVENTS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Create a one-off event' })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully',
    type: EventDto,
  })
  async createEvent(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateEventDto,
    @CurrentUser() user: UserWithContext
  ): Promise<ResponseDto<EventDto>> {
    const data = await this.eventService.createEvent(schoolId, dto, user.id);
    return ResponseDto.ok(data, 'Event created successfully');
  }

  @Get()
  @RequirePermission(PermissionResource.EVENTS, PermissionType.READ)
  @ApiOperation({ summary: 'Get events for a date range, optionally filtered by school type' })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved successfully',
    type: [EventDto],
  })
  async getEvents(
    @Param('schoolId') schoolId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('schoolType') schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<ResponseDto<EventDto[]>> {
    const data = await this.eventService.getEvents(
      schoolId,
      new Date(startDate),
      new Date(endDate),
      schoolType
    );
    return ResponseDto.ok(data, 'Events retrieved successfully');
  }

  @Get('upcoming')
  @RequirePermission(PermissionResource.EVENTS, PermissionType.READ)
  @ApiOperation({
    summary: 'Get upcoming events (next 7 days), optionally filtered by school type',
  })
  @ApiResponse({
    status: 200,
    description: 'Upcoming events retrieved successfully',
    type: [EventDto],
  })
  async getUpcomingEvents(
    @Param('schoolId') schoolId: string,
    @Query('days') days?: string,
    @Query('schoolType') schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<ResponseDto<EventDto[]>> {
    const data = await this.eventService.getUpcomingEvents(
      schoolId,
      days ? parseInt(days) : 7,
      schoolType
    );
    return ResponseDto.ok(data, 'Upcoming events retrieved successfully');
  }

  @Patch(':eventId')
  @RequirePermission(PermissionResource.EVENTS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Update an event' })
  @ApiResponse({
    status: 200,
    description: 'Event updated successfully',
    type: EventDto,
  })
  async updateEvent(
    @Param('schoolId') schoolId: string,
    @Param('eventId') eventId: string,
    @Body() dto: Partial<CreateEventDto>
  ): Promise<ResponseDto<EventDto>> {
    const data = await this.eventService.updateEvent(schoolId, eventId, dto);
    return ResponseDto.ok(data, 'Event updated successfully');
  }

  @Delete(':eventId')
  @RequirePermission(PermissionResource.EVENTS, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Delete an event' })
  @ApiResponse({
    status: 200,
    description: 'Event deleted successfully',
  })
  async deleteEvent(
    @Param('schoolId') schoolId: string,
    @Param('eventId') eventId: string
  ): Promise<ResponseDto<void>> {
    await this.eventService.deleteEvent(schoolId, eventId);
    return ResponseDto.ok(undefined, 'Event deleted successfully');
  }
}
