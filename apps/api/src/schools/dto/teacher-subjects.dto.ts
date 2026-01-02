import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional, ArrayMinSize } from 'class-validator';

/**
 * DTO for adding/updating teacher subject competencies
 */
export class UpdateTeacherSubjectsDto {
  @ApiProperty({ 
    description: 'Array of subject IDs the teacher is qualified to teach',
    type: [String],
    example: ['clxxx1', 'clxxx2']
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one subject must be selected' })
  subjectIds: string[];
}

/**
 * DTO for adding a single subject to a teacher
 */
export class AddTeacherSubjectDto {
  @ApiProperty({ 
    description: 'Subject ID to add to teacher',
    example: 'clxxx1'
  })
  @IsString()
  @IsNotEmpty({ message: 'Subject ID is required' })
  subjectId: string;
}

/**
 * DTO for teacher subject response
 */
export class TeacherSubjectDto {
  @ApiProperty({ description: 'Subject ID' })
  id: string;

  @ApiProperty({ description: 'Subject name' })
  name: string;

  @ApiPropertyOptional({ description: 'Subject code' })
  code?: string | null;

  @ApiPropertyOptional({ description: 'School type this subject belongs to' })
  schoolType?: string | null;

  @ApiPropertyOptional({ description: 'Class level ID for secondary subjects' })
  classLevelId?: string | null;

  @ApiPropertyOptional({ description: 'Class level name' })
  classLevelName?: string | null;

  @ApiProperty({ description: 'Number of classes teacher teaches this subject in' })
  assignedClassCount: number;
}

/**
 * DTO for teacher with subjects response
 */
export class TeacherWithSubjectsDto {
  @ApiProperty({ description: 'Teacher ID' })
  id: string;

  @ApiProperty({ description: 'Teacher first name' })
  firstName: string;

  @ApiProperty({ description: 'Teacher last name' })
  lastName: string;

  @ApiProperty({ description: 'Subjects the teacher can teach', type: [TeacherSubjectDto] })
  subjects: TeacherSubjectDto[];

  @ApiProperty({ description: 'Total number of class assignments' })
  totalAssignments: number;
}

/**
 * DTO for assignable subjects (filtered by teacher competency)
 */
export class AssignableSubjectDto {
  @ApiProperty({ description: 'Subject ID' })
  id: string;

  @ApiProperty({ description: 'Subject name' })
  name: string;

  @ApiPropertyOptional({ description: 'Subject code' })
  code?: string | null;

  @ApiProperty({ description: 'Whether teacher is already teaching this in the target class' })
  alreadyAssigned: boolean;
}

