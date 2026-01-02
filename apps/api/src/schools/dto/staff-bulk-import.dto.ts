import { ApiProperty } from '@nestjs/swagger';

export class StaffBulkImportRowDto {
  @ApiProperty({ example: 'teacher', description: 'Staff type: "teacher" or "admin"', enum: ['teacher', 'admin'] })
  type: 'teacher' | 'admin';

  @ApiProperty({ example: 'John', description: 'First name' })
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  lastName: string;

  @ApiProperty({ example: 'john.doe@school.com', description: 'Email address' })
  email: string;

  @ApiProperty({ example: '+2348012345678', description: 'Phone number' })
  phone: string;

  @ApiProperty({ 
    example: 'Bursar', 
    description: 'Admin role (required for admin type, ignored for teacher type)',
    required: false 
  })
  role?: string;

  @ApiProperty({ 
    example: 'Mathematics', 
    description: 'Subject name to assign teacher to (must match an existing subject in the school, case-insensitive). If found, creates SubjectTeacher relationship for competency tracking.',
    required: false 
  })
  subject?: string;

  @ApiProperty({ 
    example: 'EMP001', 
    description: 'Employee ID (optional)',
    required: false 
  })
  employeeId?: string;

  @ApiProperty({ 
    example: 'false', 
    description: 'Whether teacher is temporary: "true" or "false" (optional, defaults to false)',
    required: false 
  })
  isTemporary?: string;
}

export class StaffImportSummaryDto {
  @ApiProperty({ example: 100, description: 'Total rows processed' })
  totalRows: number;

  @ApiProperty({ example: 95, description: 'Successfully imported rows' })
  successCount: number;

  @ApiProperty({ example: 5, description: 'Failed rows' })
  errorCount: number;

  @ApiProperty({
    example: ['AG-SCHOOL-ABC123', 'AG-SCHOOL-DEF456'],
    description: 'Array of generated public IDs for successfully imported staff',
  })
  generatedPublicIds: string[];

  @ApiProperty({
    example: [
      { row: 3, error: 'Email already exists in school' },
      { row: 7, error: 'Invalid email format' },
      { row: 12, error: 'Missing required field: role (required for admin type)' },
    ],
    description: 'Array of errors encountered',
  })
  errors: Array<{ row: number; error: string }>;
}

