import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StudentBulkImportRowDto {
  @ApiProperty({ example: 'John', description: 'Student first name' })
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Student middle name (optional)', required: false })
  middleName?: string;

  @ApiProperty({ example: 'Smith', description: 'Student last name' })
  lastName: string;

  @ApiProperty({
    example: '2010-05-15',
    description: 'Date of birth (YYYY-MM-DD)',
  })
  dateOfBirth: string;

  @ApiProperty({
    example: 'JSS 3',
    description: 'Class level (must match existing ClassLevel name, e.g., "JSS 3", "Primary 1")',
  })
  classLevel: string;

  @ApiPropertyOptional({
    example: 'A',
    description:
      'Class arm name for schools using ClassArms (e.g., "A", "Gold", "Blue"). If provided, student will be enrolled in the specific ClassArm. If omitted, falls back to classLevel only.',
  })
  classArm?: string;

  @ApiProperty({
    example: 'student@example.com',
    description: 'Student email (optional, but recommended)',
    required: false,
  })
  email?: string;

  @ApiProperty({
    example: '+2348012345678',
    description: 'Student phone number (optional)',
    required: false,
  })
  phone?: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Parent/Guardian name',
  })
  parentName: string;

  @ApiProperty({
    example: '+2348012345679',
    description: 'Parent/Guardian phone number',
  })
  parentPhone: string;

  @ApiProperty({
    example: 'parent@example.com',
    description: 'Parent email address (optional)',
    required: false,
  })
  parentEmail?: string;

  @ApiProperty({
    example: 'Father',
    description: 'Parent relationship (e.g., Father, Mother, Guardian)',
    required: false,
  })
  parentRelationship?: string;

  @ApiProperty({
    example: 'O+',
    description: 'Blood group (optional)',
    required: false,
  })
  bloodGroup?: string;

  @ApiProperty({
    example: 'Peanuts, Shellfish',
    description: 'Allergies (optional)',
    required: false,
  })
  allergies?: string;

  @ApiProperty({
    example: 'Inhaler',
    description: 'Medications (optional)',
    required: false,
  })
  medications?: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Emergency contact name (optional)',
    required: false,
  })
  emergencyContact?: string;

  @ApiProperty({
    example: '+2348012345680',
    description: 'Emergency contact phone (optional)',
    required: false,
  })
  emergencyContactPhone?: string;

  @ApiProperty({
    example: 'Student has asthma',
    description: 'Medical notes (optional)',
    required: false,
  })
  medicalNotes?: string;
}

export class StudentImportSummaryDto {
  @ApiProperty({ example: 150, description: 'Total rows processed' })
  totalRows: number;

  @ApiProperty({ example: 145, description: 'Successfully imported rows' })
  successCount: number;

  @ApiProperty({ example: 5, description: 'Failed rows' })
  errorCount: number;

  @ApiProperty({
    example: ['AG-SCHOOL-ABC123', 'AG-SCHOOL-DEF456'],
    description: 'Array of generated public IDs for successfully imported students',
  })
  generatedPublicIds: string[];

  @ApiProperty({
    example: [
      { row: 3, error: 'Student email already exists in Agora system - transfer required' },
      { row: 7, error: 'Invalid date format for dateOfBirth' },
      { row: 12, error: 'Class level "JSS5" not found' },
    ],
    description: 'Array of errors encountered',
  })
  errors: Array<{ row: number; error: string }>;
}
