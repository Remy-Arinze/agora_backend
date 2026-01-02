import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsEnum } from 'class-validator';

export enum ClassType {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  TERTIARY = 'TERTIARY',
}

export class CreateClassDto {
  @ApiProperty({ description: 'Class name (e.g., "JSS1", "SS2", "Introduction to Computer Science")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Course code for tertiary courses (e.g., "CS101")', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'Class level for primary/secondary (e.g., "JSS1", "Class 1")', required: false })
  @IsString()
  @IsOptional()
  classLevel?: string;

  @ApiProperty({ description: 'Class type', enum: ClassType })
  @IsEnum(ClassType)
  @IsNotEmpty()
  type: ClassType;

  @ApiProperty({ description: 'Academic year (e.g., "2024/2025")' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ description: 'Credit hours for tertiary courses', required: false })
  @IsInt()
  @IsOptional()
  creditHours?: number;

  @ApiProperty({ description: 'Class description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

