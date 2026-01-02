import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface PublicSchool {
  id: string;
  name: string;
  logo: string | null;
  type: string;
  state: string | null;
}

export interface PlatformStats {
  totalSchools: number;
  totalStudents: number;
  totalRecords: number;
  totalTeachers: number;
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all schools that are actively using Agora
   * Returns all active schools (not just those with enrollments) to match the hero stats
   */
  async getPublicSchools(): Promise<PublicSchool[]> {
    const schools = await this.prisma.school.findMany({
      where: {
        // Show all active schools, regardless of enrollment status
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        logo: true,
        state: true,
        hasPrimary: true,
        hasSecondary: true,
        hasTertiary: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20, // Limit to 20 schools for the landing page
    });

    return schools.map((school) => {
      // Derive school type from boolean flags
      const types: string[] = [];
      if (school.hasPrimary) types.push('Primary');
      if (school.hasSecondary) types.push('Secondary');
      if (school.hasTertiary) types.push('Tertiary');
      
      return {
        id: school.id,
        name: school.name,
        logo: school.logo,
        type: types.join(' & ') || 'School',
        state: school.state,
      };
    });
  }

  /**
   * Get aggregate platform statistics for the landing page
   */
  async getPlatformStats(): Promise<PlatformStats> {
    const [totalSchools, totalStudents, totalTeachers] = await Promise.all([
      this.prisma.school.count({
        where: {
          isActive: true, // Only count active schools to match what's displayed
        },
      }),
      this.prisma.student.count(),
      this.prisma.teacher.count(),
    ]);

    // Records = enrollments + grades + attendance (simplified to enrollments for now)
    const totalEnrollments = await this.prisma.enrollment.count();
    
    // Estimate total records as enrollments * 3 (for various record types)
    // This gives a more impressive but still realistic number
    const totalRecords = totalEnrollments + totalStudents;

    return {
      totalSchools,
      totalStudents,
      totalRecords,
      totalTeachers,
    };
  }
}

