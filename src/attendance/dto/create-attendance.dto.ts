import { IsNotEmpty, IsString, IsDateString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
}

export class StudentAttendanceDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  enrollmentId: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsNotEmpty()
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateAttendanceDto extends StudentAttendanceDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  date: string;
}

export class BulkAttendanceDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  classId: string;

  @ApiProperty({ enum: ['CLASS', 'CLASS_ARM'] })
  @IsNotEmpty()
  @IsString()
  classType: 'CLASS' | 'CLASS_ARM';

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({ type: [StudentAttendanceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentAttendanceDto)
  students: StudentAttendanceDto[];
}
