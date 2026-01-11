import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { EventType } from '@prisma/client';

export class CreateEventDto {
  @ApiProperty({ description: 'Event title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Event description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Event start date and time (ISO 8601 format)' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'Event end date and time (ISO 8601 format)' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ description: 'Event type', enum: EventType })
  @IsEnum(EventType)
  @IsNotEmpty()
  type: EventType;

  @ApiProperty({ description: 'Event location', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'Room ID if event is in a specific room', required: false })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiProperty({ description: 'Whether the event is all-day', default: false })
  @IsBoolean()
  @IsOptional()
  isAllDay?: boolean;

  @ApiProperty({
    description:
      'School type this event applies to (PRIMARY, SECONDARY, TERTIARY). Null means all types.',
    required: false,
  })
  @IsString()
  @IsOptional()
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
}
