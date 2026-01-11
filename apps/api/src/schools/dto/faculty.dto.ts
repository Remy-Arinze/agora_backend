import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

// DTO for creating a faculty
export class CreateFacultyDto {
  @ApiProperty({ description: 'Faculty name', example: 'Faculty of Science' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Faculty code', example: 'FOS' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ description: 'Faculty description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Faculty image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Dean teacher ID' })
  @IsOptional()
  @IsString()
  deanId?: string;
}

// DTO for updating a faculty
export class UpdateFacultyDto {
  @ApiPropertyOptional({ description: 'Faculty name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Faculty code' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ description: 'Faculty description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Faculty image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Dean teacher ID' })
  @IsOptional()
  @IsString()
  deanId?: string;

  @ApiPropertyOptional({ description: 'Whether faculty is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Response DTO for faculty
export class FacultyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty()
  schoolId: string;

  @ApiPropertyOptional()
  deanId?: string;

  @ApiPropertyOptional({ description: 'Dean name if assigned' })
  deanName?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ description: 'Number of departments in faculty' })
  departmentsCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// DTO for creating a department (ClassLevel under faculty)
export class CreateDepartmentDto {
  @ApiProperty({ description: 'Department name', example: 'Computer Science' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Department code', example: 'CS' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ description: 'Department description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Department image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ description: 'Faculty ID this department belongs to' })
  @IsString()
  facultyId: string;
}

// DTO for updating a department
export class UpdateDepartmentDto {
  @ApiPropertyOptional({ description: 'Department name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Department code' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ description: 'Department description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Department image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Faculty ID' })
  @IsOptional()
  @IsString()
  facultyId?: string;

  @ApiPropertyOptional({ description: 'Whether department is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Response DTO for department
export class DepartmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty()
  schoolId: string;

  @ApiPropertyOptional()
  facultyId?: string;

  @ApiPropertyOptional()
  facultyName?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ description: 'Number of levels in department' })
  levelsCount: number;

  @ApiProperty({ description: 'Total students in department' })
  studentsCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// DTO for generating default levels for a department
export class GenerateLevelsDto {
  @ApiPropertyOptional({
    description: 'Number of levels to generate (default: 4 for 100L-400L)',
    example: 4,
  })
  @IsOptional()
  levelCount?: number;
}

// Response DTO for department level (ClassArm)
export class DepartmentLevelDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Level name, e.g., "100 Level"' })
  name: string;

  @ApiPropertyOptional({ description: 'Academic year, e.g., "2024/2025"' })
  academicYear?: string;

  @ApiProperty({ description: 'Number of students in this level' })
  studentsCount: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}
