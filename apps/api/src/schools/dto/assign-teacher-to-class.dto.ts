import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class AssignTeacherToClassDto {
  @ApiProperty({ description: 'Teacher ID' })
  @IsString()
  @IsNotEmpty()
  teacherId: string;

  @ApiProperty({ 
    description: 'Subject name (for secondary schools) or course module/topic (for tertiary). For primary schools, can be "Class Teacher" or null',
    required: false 
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({ 
    description: 'For primary schools, marks this teacher as the primary class teacher',
    required: false,
    default: false
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

