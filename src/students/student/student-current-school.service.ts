import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserWithContext } from '../../auth/types/user-with-context.type';

/**
 * Service for student operations scoped to their current/active school
 * All operations here are filtered by the student's active enrollment
 */
@Injectable()
export class StudentCurrentSchoolService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get student's current classes (scoped to active enrollment's school)
   */
  async getMyCurrentClasses(user: UserWithContext) {
    const schoolId = user.currentSchoolId; // ✅ From JWT (active enrollment's school)

    if (!schoolId) {
      throw new BadRequestException('You are not enrolled in any school');
    }

    // Get active enrollment
    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
      include: {
        enrollments: {
          where: { schoolId, isActive: true },
          take: 1,
        },
      },
    });

    if (!student || student.enrollments.length === 0) {
      throw new BadRequestException('No active enrollment found');
    }

    const enrollment = student.enrollments[0];

    // TODO: Implement class fetching when Class model is available
    // For now, return enrollment info
    return {
      enrollmentId: enrollment.id,
      classLevel: enrollment.classLevel,
      academicYear: enrollment.academicYear,
      schoolId: enrollment.schoolId,
      // classes: await this.schoolScopedRepository.findClassesByEnrollment(enrollment.id),
    };
  }

  /**
   * Get current grades (only from active enrollment)
   */
  async getMyCurrentGrades(user: UserWithContext) {
    const schoolId = user.currentSchoolId;

    if (!schoolId) {
      throw new BadRequestException('You are not enrolled in any school');
    }

    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // Get grades only from active enrollment
    const grades = await this.prisma.grade.findMany({
      where: {
        enrollment: {
          studentId: student.id,
          schoolId,
          isActive: true, // ✅ Only active enrollment
        },
      },
      include: {
        enrollment: {
          include: {
            school: {
              select: {
                id: true,
                name: true,
                schoolId: true,
              },
            },
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            subject: true,
          },
        },
      },
      orderBy: [{ academicYear: 'desc' }, { term: 'desc' }],
    });

    return grades.map((grade) => ({
      id: grade.id,
      subject: grade.subject,
      score: grade.score,
      maxScore: grade.maxScore,
      term: grade.term,
      academicYear: grade.academicYear,
      remarks: grade.remarks,
      signedAt: grade.signedAt,
      teacher: grade.teacher,
      enrollment: {
        id: grade.enrollment.id,
        classLevel: grade.enrollment.classLevel,
        school: grade.enrollment.school,
      },
    }));
  }

  /**
   * Get current attendance (only from active enrollment)
   */
  async getMyCurrentAttendance(user: UserWithContext) {
    const schoolId = user.currentSchoolId;

    if (!schoolId) {
      throw new BadRequestException('You are not enrolled in any school');
    }

    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // Get attendance only from active enrollment
    const attendances = await this.prisma.attendance.findMany({
      where: {
        enrollment: {
          studentId: student.id,
          schoolId,
          isActive: true, // ✅ Only active enrollment
        },
      },
      include: {
        enrollment: {
          include: {
            school: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return attendances.map((attendance) => ({
      id: attendance.id,
      date: attendance.date,
      status: attendance.status,
      remarks: attendance.remarks,
      teacher: attendance.teacher,
      enrollment: {
        id: attendance.enrollment.id,
        classLevel: attendance.enrollment.classLevel,
        school: attendance.enrollment.school,
      },
    }));
  }
}
