import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from './create-school.dto';

export class SchoolAdminDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  adminId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string | null;

  @ApiProperty()
  phone: string;

  @ApiProperty({ description: 'Admin role (stored as string to support custom roles)' })
  role: string;

  @ApiProperty({ 
    description: 'Account status - SHADOW means password not set, ACTIVE means password set',
    enum: ['SHADOW', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'],
    required: false
  })
  accountStatus?: 'SHADOW' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

  @ApiProperty({ 
    description: 'User ID for resending password emails',
    required: false
  })
  userId?: string;

  @ApiProperty()
  createdAt: Date;
}

export class SchoolDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  subdomain: string;

  @ApiProperty()
  domain: string | null;

  @ApiProperty()
  address: string | null;

  @ApiProperty()
  city: string | null;

  @ApiProperty()
  state: string | null;

  @ApiProperty()
  country: string;

  @ApiProperty()
  phone: string | null;

  @ApiProperty()
  email: string | null;

  @ApiProperty({ nullable: true })
  logo: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  hasPrimary: boolean;

  @ApiProperty()
  hasSecondary: boolean;

  @ApiProperty()
  hasTertiary: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [SchoolAdminDto] })
  admins: SchoolAdminDto[];

  @ApiProperty()
  teachersCount: number;

  @ApiProperty()
  studentsCount?: number;

  @ApiProperty({ type: [Object] })
  teachers: TeacherDto[];

  @ApiProperty({ description: 'School type context', type: Object })
  schoolType?: {
    hasPrimary: boolean;
    hasSecondary: boolean;
    hasTertiary: boolean;
    isMixed: boolean;
    availableTypes: ('PRIMARY' | 'SECONDARY' | 'TERTIARY')[];
    primaryType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'MIXED';
  };
}

export class TeacherDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  teacherId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string | null;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  employeeId: string | null;

  @ApiProperty()
  subject: string | null;

  @ApiProperty()
  isTemporary: boolean;

  @ApiProperty()
  createdAt: Date;
}
