import { ApiProperty } from '@nestjs/swagger';

export class CurrentActivityDto {
  @ApiProperty({ description: 'Type of activity', enum: ['LESSON', 'BREAK', 'ASSEMBLY', 'LUNCH'] })
  type: string;

  @ApiProperty({ description: 'Title of the activity (e.g. subject name or "Lunch Break")' })
  title: string;

  @ApiProperty({ description: 'Location (e.g. room name)', required: false })
  location?: string;

  @ApiProperty({ description: 'Additional context (e.g. class name for teachers, teacher name for students)', required: false })
  context?: string;

  @ApiProperty({ description: 'Start time (HH:mm)' })
  startTime: string;

  @ApiProperty({ description: 'End time (HH:mm)' })
  endTime: string;
}
