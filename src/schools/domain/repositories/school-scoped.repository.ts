import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Enrollment, Student, Grade, Attendance } from '@prisma/client';

/**
 * Repository for school-scoped queries
 * All queries are automatically filtered by schoolId
 * This ensures data isolation between schools
 */
@Injectable()
export class SchoolScopedRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all active enrollments for a school
   */
  async findEnrollmentsBySchool(schoolId: string): Promise<Enrollment[]> {
    return this.prisma.enrollment.findMany({
      where: { schoolId, isActive: true },
      include: {
        student: {
          include: { user: true },
        },
        school: true,
      },
      orderBy: { enrollmentDate: 'desc' },
    });
  }

  /**
   * Find all students enrolled in a school
   */
  async findStudentsBySchool(schoolId: string): Promise<Student[]> {
    return this.prisma.student.findMany({
      where: {
        enrollments: {
          some: {
            schoolId,
            isActive: true,
          },
        },
      },
      include: {
        user: true,
        enrollments: {
          where: { schoolId, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find all grades for a school
   */
  async findGradesBySchool(schoolId: string): Promise<Grade[]> {
    return this.prisma.grade.findMany({
      where: {
        enrollment: {
          schoolId,
          isActive: true,
        },
      },
      include: {
        enrollment: {
          include: {
            student: {
              include: { user: true },
            },
          },
        },
        teacher: true,
      },
      orderBy: [{ academicYear: 'desc' }, { term: 'desc' }],
    });
  }

  /**
   * Find all attendance records for a school
   */
  async findAttendanceBySchool(schoolId: string): Promise<Attendance[]> {
    return this.prisma.attendance.findMany({
      where: {
        enrollment: {
          schoolId,
          isActive: true,
        },
      },
      include: {
        enrollment: {
          include: {
            student: {
              include: { user: true },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Find enrollment by ID (scoped to school)
   */
  async findEnrollmentById(enrollmentId: string, schoolId: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        schoolId,
        isActive: true,
      },
      include: {
        student: {
          include: { user: true },
        },
        school: true,
      },
    });
  }

  /**
   * Find student by ID (scoped to school - must have active enrollment)
   */
  async findStudentById(studentId: string, schoolId: string): Promise<Student | null> {
    return this.prisma.student.findFirst({
      where: {
        id: studentId,
        enrollments: {
          some: {
            schoolId,
            isActive: true,
          },
        },
      },
      include: {
        user: true,
        enrollments: {
          where: { schoolId, isActive: true },
        },
      },
    });
  }
}
