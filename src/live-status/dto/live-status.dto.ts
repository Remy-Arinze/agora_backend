import { ApiProperty } from '@nestjs/swagger';

export class CurrentActivityDto {
  @ApiProperty()
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  location?: string;

  @ApiProperty({ required: false })
  context?: string;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;
}
