import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import { CreateEventDto } from './dto/create-event.dto';
import { EventDto } from './dto/event.dto';
import { GoogleCalendarService } from '../integrations/google-calendar/google-calendar.service';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository,
    private readonly googleCalendarService?: GoogleCalendarService
  ) {}

  // Access Prisma models using bracket notation for reserved keywords
  private get eventModel() {
    return (this.prisma as any)['event'];
  }

  /**
   * Create a one-off event
   */
  async createEvent(schoolId: string, dto: CreateEventDto, createdBy?: string): Promise<EventDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate schoolType if provided
    if (dto.schoolType) {
      const validTypes = ['PRIMARY', 'SECONDARY', 'TERTIARY'];
      if (!validTypes.includes(dto.schoolType)) {
        throw new BadRequestException(
          'Invalid school type. Must be PRIMARY, SECONDARY, or TERTIARY'
        );
      }
      // Verify school has this type
      if (dto.schoolType === 'PRIMARY' && !school.hasPrimary) {
        throw new BadRequestException('School does not have PRIMARY level');
      }
      if (dto.schoolType === 'SECONDARY' && !school.hasSecondary) {
        throw new BadRequestException('School does not have SECONDARY level');
      }
      if (dto.schoolType === 'TERTIARY' && !school.hasTertiary) {
        throw new BadRequestException('School does not have TERTIARY level');
      }
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Validate room if provided
    if (dto.roomId) {
      const room = await (this.prisma as any)['room'].findUnique({
        where: { id: dto.roomId },
      });

      if (!room || room.schoolId !== school.id) {
        throw new NotFoundException('Room not found');
      }
    }

    const event = await this.eventModel.create({
      data: {
        title: dto.title,
        description: dto.description,
        startDate: startDate,
        endDate: endDate,
        type: dto.type,
        schoolType: dto.schoolType || null,
        location: dto.location,
        roomId: dto.roomId || null,
        schoolId: school.id,
        createdBy: createdBy || null,
        isAllDay: dto.isAllDay || false,
        syncStatus: 'PENDING',
      },
      include: {
        room: true,
      },
    });

    const eventDto = this.mapToEventDto(event);

    // Sync to Google Calendar if user has sync enabled (async, don't block)
    if (createdBy && this.googleCalendarService) {
      this.syncToGoogleCalendar(eventDto, createdBy, school.id).catch((error) => {
        this.logger.error(`Failed to sync event ${eventDto.id} to Google Calendar`, error);
      });
    }

    return eventDto;
  }

  /**
   * Get events for a date range, optionally filtered by school type
   */
  async getEvents(
    schoolId: string,
    startDate: Date,
    endDate: Date,
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<EventDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const where: any = {
      schoolId: school.id,
      AND: [
        {
          OR: [
            {
              startDate: { gte: startDate, lte: endDate },
            },
            {
              endDate: { gte: startDate, lte: endDate },
            },
            {
              AND: [{ startDate: { lte: startDate } }, { endDate: { gte: endDate } }],
            },
          ],
        },
      ],
    };

    // Filter by school type: include events that are null (all types) or match the requested type
    if (schoolType) {
      where.AND.push({
        OR: [
          { schoolType: null }, // Events for all types
          { schoolType: schoolType }, // Events for this specific type
        ],
      });
    }

    const events = await this.eventModel.findMany({
      where,
      include: {
        room: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    return events.map((e: any) => this.mapToEventDto(e));
  }

  /**
   * Get upcoming events (next 7 days), optionally filtered by school type
   */
  async getUpcomingEvents(
    schoolId: string,
    days: number = 7,
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  ): Promise<EventDto[]> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const where: any = {
      schoolId: school.id,
      startDate: {
        gte: now,
        lte: futureDate,
      },
    };

    // Filter by school type: include events that are null (all types) or match the requested type
    if (schoolType) {
      where.OR = [
        { schoolType: null }, // Events for all types
        { schoolType: schoolType }, // Events for this specific type
      ];
    }

    const events = await this.eventModel.findMany({
      where,
      include: {
        room: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    return events.map((e: any) => this.mapToEventDto(e));
  }

  /**
   * Update an event
   */
  async updateEvent(
    schoolId: string,
    eventId: string,
    dto: Partial<CreateEventDto>
  ): Promise<EventDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const event = await this.eventModel.findUnique({
      where: { id: eventId },
    });

    if (!event || event.schoolId !== school.id) {
      throw new NotFoundException('Event not found');
    }

    const updateData: any = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);
    if (dto.type) updateData.type = dto.type;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.roomId !== undefined) updateData.roomId = dto.roomId || null;
    if (dto.isAllDay !== undefined) updateData.isAllDay = dto.isAllDay;

    const updated = await this.eventModel.update({
      where: { id: eventId },
      data: {
        ...updateData,
        syncStatus: event.googleEventId ? 'PENDING' : undefined,
      },
      include: {
        room: true,
      },
    });

    const eventDto = this.mapToEventDto(updated);

    // Sync to Google Calendar if event was previously synced
    if (eventDto.googleEventId && event.createdBy && this.googleCalendarService) {
      this.syncToGoogleCalendar(eventDto, event.createdBy, school.id).catch((error) => {
        this.logger.error(`Failed to sync event ${eventDto.id} to Google Calendar`, error);
      });
    }

    return eventDto;
  }

  /**
   * Delete an event
   */
  async deleteEvent(schoolId: string, eventId: string): Promise<void> {
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const event = await this.eventModel.findUnique({
      where: { id: eventId },
    });

    if (!event || event.schoolId !== school.id) {
      throw new NotFoundException('Event not found');
    }

    // Delete from Google Calendar if synced
    if (event.googleEventId && event.createdBy && this.googleCalendarService) {
      this.googleCalendarService
        .deleteEventFromGoogle(event.googleEventId, event.createdBy, school.id)
        .catch((error) => {
          this.logger.error(`Failed to delete event ${eventId} from Google Calendar`, error);
        });
    }

    await this.eventModel.delete({
      where: { id: eventId },
    });
  }

  /**
   * Sync event to Google Calendar
   */
  private async syncToGoogleCalendar(
    event: EventDto,
    userId: string,
    schoolId: string
  ): Promise<void> {
    if (!this.googleCalendarService) return;

    try {
      const googleEventId = await this.googleCalendarService.syncEventToGoogle(
        event,
        userId,
        schoolId
      );

      if (googleEventId) {
        // Update event with Google Calendar ID
        await this.eventModel.update({
          where: { id: event.id },
          data: {
            googleEventId,
            syncStatus: 'SYNCED',
            syncedAt: new Date(),
          },
        });
      }
    } catch (error) {
      // Log error but don't fail event creation
      this.logger.error(`Failed to sync event ${event.id} to Google Calendar`, error);

      // Update sync status to failed
      await this.eventModel.update({
        where: { id: event.id },
        data: { syncStatus: 'FAILED' },
      });
    }
  }

  /**
   * Map Prisma event to DTO
   */
  private mapToEventDto(event: any): EventDto {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      type: event.type,
      schoolType: event.schoolType,
      location: event.location,
      roomId: event.roomId,
      roomName: event.room?.name,
      schoolId: event.schoolId,
      createdBy: event.createdBy,
      isAllDay: event.isAllDay,
      googleEventId: event.googleEventId,
      syncedAt: event.syncedAt,
      syncStatus: event.syncStatus,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
