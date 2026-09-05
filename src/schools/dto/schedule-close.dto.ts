import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ScheduleCloseDto {
  @ApiProperty({ description: 'Why this school is being closed', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Please provide a reason (at least 8 characters).' })
  @MaxLength(2000)
  reason: string;
}
