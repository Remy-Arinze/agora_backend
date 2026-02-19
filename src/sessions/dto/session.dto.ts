import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus, TermStatus } from '@prisma/client';

export class TermDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  number: number;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ required: false })
  halfTermStart?: Date;

  @ApiProperty({ required: false })
  halfTermEnd?: Date;

  @ApiProperty({ enum: TermStatus })
  status: TermStatus;

  @ApiProperty()
  academicSessionId: string;

  @ApiProperty()
  createdAt: Date;
}

export class AcademicSessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ enum: SessionStatus })
  status: SessionStatus;

  @ApiProperty()
  schoolId: string;

  @ApiProperty({ required: false })
  schoolType?: string;

  @ApiProperty({ type: [TermDto] })
  terms: TermDto[];

  @ApiProperty()
  createdAt: Date;
}

export class ActiveSessionDto {
  @ApiProperty({ type: AcademicSessionDto, required: false })
  session?: AcademicSessionDto;

  @ApiProperty({ type: TermDto, required: false })
  term?: TermDto;
}
