import { ApiProperty } from '@nestjs/swagger';
import { EventType } from '@prisma/client';

export class EventDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ enum: EventType })
  type: EventType;

  @ApiProperty({ required: false })
  location?: string;

  @ApiProperty({ required: false })
  roomId?: string;

  @ApiProperty({ required: false })
  roomName?: string;

  @ApiProperty({ required: false })
  schoolType?: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty({ required: false })
  createdBy?: string;

  @ApiProperty()
  isAllDay: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

