import { ApiProperty } from '@nestjs/swagger';

export class StaffListItemDto {
  @ApiProperty({ description: 'Staff ID' })
  id: string;

  @ApiProperty({ description: 'Staff type: teacher or admin' })
  type: 'teacher' | 'admin';

  @ApiProperty({ description: 'First name' })
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  lastName: string;

  @ApiProperty({ description: 'Email address', nullable: true })
  email: string | null;

  @ApiProperty({ description: 'Phone number' })
  phone: string;

  @ApiProperty({ description: 'Role (for admins) or "Teacher"', nullable: true })
  role: string | null;

  @ApiProperty({ description: 'Subject (for teachers)', nullable: true })
  subject: string | null;

  @ApiProperty({ description: 'Employee ID', nullable: true })
  employeeId: string | null;

  @ApiProperty({ description: 'Is temporary (for teachers)' })
  isTemporary: boolean;

  @ApiProperty({ description: 'Account status (simplified)' })
  status: 'active' | 'inactive';

  @ApiProperty({
    description:
      'Account activation status (SHADOW=pending, ACTIVE=activated, SUSPENDED, ARCHIVED)',
  })
  accountStatus: 'SHADOW' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

  @ApiProperty({ description: 'Profile image URL', nullable: true })
  profileImage: string | null;

  @ApiProperty({ description: 'Created date' })
  createdAt: Date;
}

export class StaffListMetaDto {
  @ApiProperty({ description: 'Total number of staff' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;

  @ApiProperty({ description: 'Has next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Has previous page' })
  hasPrev: boolean;
}

export class StaffListResponseDto {
  @ApiProperty({ description: 'List of staff', type: [StaffListItemDto] })
  items: StaffListItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: StaffListMetaDto })
  meta: StaffListMetaDto;

  @ApiProperty({ description: 'Available roles for filtering', type: [String] })
  availableRoles: string[];
}

export class GetStaffListQueryDto {
  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  page?: number;

  @ApiProperty({ description: 'Items per page', required: false, default: 10 })
  limit?: number;

  @ApiProperty({ description: 'Search query (name, email, subject)', required: false })
  search?: string;

  @ApiProperty({ description: 'Filter by role', required: false })
  role?: string;

  @ApiProperty({
    description: 'Filter by school type (PRIMARY, SECONDARY, TERTIARY)',
    required: false,
  })
  schoolType?: string;
}
