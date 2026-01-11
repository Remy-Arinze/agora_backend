import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateCourseRegistrationDto {
  @ApiProperty({ description: 'Subject ID (course ID for TERTIARY)' })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiPropertyOptional({ description: 'Semester (e.g., "First Semester", "Second Semester")' })
  @IsString()
  @IsOptional()
  semester?: string;

  @ApiProperty({ description: 'Academic year (e.g., "2024/2025")' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiPropertyOptional({
    description: 'Term ID (optional, for tracking which term registration is for)',
  })
  @IsString()
  @IsOptional()
  termId?: string;

  @ApiPropertyOptional({ description: 'Is this a carry-over/repeat course?', default: false })
  @IsBoolean()
  @IsOptional()
  isCarryOver?: boolean;
}

export class UpdateCourseRegistrationDto {
  @ApiPropertyOptional({ description: 'Semester' })
  @IsString()
  @IsOptional()
  semester?: string;

  @ApiPropertyOptional({ description: 'Academic year' })
  @IsString()
  @IsOptional()
  academicYear?: string;

  @ApiPropertyOptional({ description: 'Term ID' })
  @IsString()
  @IsOptional()
  termId?: string;

  @ApiPropertyOptional({ description: 'Is carry-over' })
  @IsBoolean()
  @IsOptional()
  isCarryOver?: boolean;

  @ApiPropertyOptional({ description: 'Is active (can be used to drop course)' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CourseRegistrationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName?: string;

  @ApiProperty()
  subjectCode?: string;

  @ApiPropertyOptional()
  semester?: string;

  @ApiProperty()
  academicYear: string;

  @ApiPropertyOptional()
  termId?: string;

  @ApiProperty()
  isCarryOver: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
