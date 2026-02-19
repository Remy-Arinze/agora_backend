import { ApiProperty } from '@nestjs/swagger';

export class StudentDto {
  @ApiProperty({ example: 'clx1234567890', description: 'Student ID' })
  id: string;

  @ApiProperty({ example: 'AGO-2025-001', description: 'Universal ID' })
  uid: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  lastName: string;

  @ApiProperty({ example: 'Michael', description: 'Middle name', required: false })
  middleName: string | null;

  @ApiProperty({ example: '2010-05-15', description: 'Date of birth' })
  dateOfBirth: string;

  @ApiProperty({ example: false, description: 'Whether profile is locked' })
  profileLocked: boolean;

  @ApiProperty({
    example: 'https://res.cloudinary.com/...',
    description: 'Profile image URL',
    required: false,
    nullable: true,
  })
  profileImage: string | null;

  @ApiProperty({
    description: 'Health information',
    required: false,
    nullable: true,
    example: {
      bloodGroup: 'O+',
      allergies: 'Peanuts',
      medications: 'Inhaler',
      emergencyContact: 'John Doe',
      emergencyContactPhone: '+1234567890',
      medicalNotes: 'Asthma condition',
    },
  })
  healthInfo?: {
    bloodGroup?: string;
    allergies?: string;
    medications?: string;
    emergencyContact?: string;
    emergencyContactPhone?: string;
    medicalNotes?: string;
  } | null;

  @ApiProperty({ example: '2024-01-15T10:00:00Z', description: 'Creation timestamp' })
  createdAt: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z', description: 'Last update timestamp' })
  updatedAt: string;

  @ApiProperty({
    description: 'User account information',
    required: false,
  })
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    accountStatus: 'SHADOW' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  };
}

export class StudentWithEnrollmentDto extends StudentDto {
  @ApiProperty({
    description: 'Current enrollment information',
    required: false,
  })
  enrollment?: {
    id: string;
    classLevel: string;
    academicYear: string;
    enrollmentDate: string;
    school: {
      id: string;
      name: string;
      subdomain: string;
    };
  };
}
