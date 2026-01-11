import { School } from '@prisma/client';
import { SchoolDto } from '../../dto/school.dto';

/**
 * Mapper for converting School entities to DTOs
 * Follows the mapper pattern for separation of concerns
 */
export class SchoolMapper {
  /**
   * Convert School entity to SchoolDto
   */
  toDto(school: School & { admins?: any[]; teachers?: any[]; enrollments?: any[] }): SchoolDto {
    // Calculate school type context
    const availableTypes: ('PRIMARY' | 'SECONDARY' | 'TERTIARY')[] = [];
    if (school.hasPrimary) availableTypes.push('PRIMARY');
    if (school.hasSecondary) availableTypes.push('SECONDARY');
    if (school.hasTertiary) availableTypes.push('TERTIARY');

    const isMixed = availableTypes.length > 1;
    const primaryType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'MIXED' = isMixed
      ? 'MIXED'
      : availableTypes[0] || 'PRIMARY';

    return {
      id: school.id,
      schoolId: school.schoolId,
      name: school.name,
      subdomain: school.subdomain,
      domain: school.domain,
      address: school.address,
      city: school.city,
      state: school.state,
      country: school.country,
      phone: school.phone,
      email: school.email,
      logo: school.logo,
      isActive: school.isActive,
      hasPrimary: school.hasPrimary,
      hasSecondary: school.hasSecondary,
      hasTertiary: school.hasTertiary,
      createdAt: school.createdAt,
      admins:
        school.admins?.map((admin) => ({
          id: admin.id,
          adminId: admin.adminId,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          createdAt: admin.createdAt,
        })) || [],
      teachers:
        school.teachers?.map((teacher) => ({
          id: teacher.id,
          teacherId: teacher.teacherId,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
          phone: teacher.phone,
          employeeId: teacher.employeeId,
          subject: teacher.subject,
          isTemporary: teacher.isTemporary,
          createdAt: teacher.createdAt,
        })) || [],
      teachersCount: school.teachers?.length || 0,
      studentsCount: school.enrollments?.filter((e) => e.isActive).length || 0,
      schoolType: {
        hasPrimary: school.hasPrimary,
        hasSecondary: school.hasSecondary,
        hasTertiary: school.hasTertiary,
        isMixed,
        availableTypes,
        primaryType,
      },
    };
  }

  /**
   * Convert array of School entities to SchoolDto array
   */
  toDtoArray(
    schools: (School & { admins?: any[]; teachers?: any[]; enrollments?: any[] })[]
  ): SchoolDto[] {
    return schools.map((school) => this.toDto(school));
  }
}
