import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Enrollment, Grade, Attendance } from '@prisma/client';

@Injectable()
export class StudentTranscriptRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all enrollments for a student across all schools
   * Used for building complete transcript
   * Includes both active and inactive enrollments
   */
  async findAllEnrollmentsForStudent(studentId: string): Promise<
    Array<
      Enrollment & {
        school: {
          id: string;
          name: string;
          schoolId: string | null;
          hasPrimary: boolean;
          hasSecondary: boolean;
          hasTertiary: boolean;
        };
        grades: Grade[];
        attendances: Attendance[];
      }
    >
  > {
    return this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            schoolId: true,
            hasPrimary: true,
            hasSecondary: true,
            hasTertiary: true,
          },
        },
        grades: {
          orderBy: [{ academicYear: 'desc' }, { term: 'desc' }],
        },
        attendances: {
          orderBy: { date: 'desc' },
        },
      },
      orderBy: [{ academicYear: 'desc' }, { enrollmentDate: 'desc' }],
    });
  }

  /**
   * Get transcript for a specific school
   * Can be active or inactive enrollment
   */
  async getTranscriptForSchool(
    studentId: string,
    schoolId: string
  ): Promise<
    | (Enrollment & {
        school: {
          id: string;
          name: string;
          schoolId: string | null;
        };
        grades: Grade[];
        attendances: Attendance[];
      })
    | null
  > {
    return this.prisma.enrollment.findFirst({
      where: {
        studentId,
        schoolId,
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            schoolId: true,
          },
        },
        grades: {
          orderBy: [{ academicYear: 'desc' }, { term: 'desc' }],
        },
        attendances: {
          orderBy: { date: 'desc' },
        },
      },
    });
  }
}
