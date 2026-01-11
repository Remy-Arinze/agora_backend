import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserWithContext } from '../../auth/types/user-with-context.type';
import { StudentTranscriptRepository } from '../domain/repositories/student-transcript.repository';

/**
 * Service for student transcript operations
 * Allows access to all enrollments (active and inactive) across all schools
 */
@Injectable()
export class StudentTranscriptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transcriptRepository: StudentTranscriptRepository
  ) {}

  /**
   * Get complete transcript across all schools (active and inactive enrollments)
   */
  async getMyCompleteTranscript(user: UserWithContext) {
    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // ✅ Get ALL enrollments (active and inactive) across all schools
    const enrollments = await this.transcriptRepository.findAllEnrollmentsForStudent(student.id);

    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      enrollments: enrollments.map((enrollment) => ({
        school: {
          id: enrollment.school.id,
          name: enrollment.school.name,
          schoolId: enrollment.school.schoolId,
          level: this.determineLevel(enrollment.school),
        },
        enrollmentId: enrollment.id,
        academicYear: enrollment.academicYear,
        classLevel: enrollment.classLevel,
        enrollmentDate: enrollment.enrollmentDate,
        isActive: enrollment.isActive,
        grades: enrollment.grades.map((grade) => ({
          id: grade.id,
          subject: grade.subject,
          score: grade.score,
          maxScore: grade.maxScore,
          term: grade.term,
          academicYear: grade.academicYear,
          remarks: grade.remarks,
          signedAt: grade.signedAt,
        })),
        attendance: {
          totalDays: enrollment.attendances.length,
          present: enrollment.attendances.filter((a) => a.status === 'PRESENT').length,
          absent: enrollment.attendances.filter((a) => a.status === 'ABSENT').length,
          late: enrollment.attendances.filter((a) => a.status === 'LATE').length,
        },
      })),
    };
  }

  /**
   * Get transcript for a specific school (can be current or previous school)
   */
  async getMyTranscriptForSchool(user: UserWithContext, schoolId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // ✅ Verify student was enrolled in this school (active or inactive)
    const enrollment = await this.transcriptRepository.getTranscriptForSchool(student.id, schoolId);

    if (!enrollment) {
      throw new NotFoundException('You were not enrolled in this school');
    }

    return {
      school: {
        id: enrollment.school.id,
        name: enrollment.school.name,
        schoolId: enrollment.school.schoolId,
      },
      enrollmentId: enrollment.id,
      academicYear: enrollment.academicYear,
      classLevel: enrollment.classLevel,
      enrollmentDate: enrollment.enrollmentDate,
      isActive: enrollment.isActive,
      grades: enrollment.grades.map((grade) => ({
        id: grade.id,
        subject: grade.subject,
        score: grade.score,
        maxScore: grade.maxScore,
        term: grade.term,
        academicYear: grade.academicYear,
        remarks: grade.remarks,
        signedAt: grade.signedAt,
      })),
      attendance: {
        totalDays: enrollment.attendances.length,
        present: enrollment.attendances.filter((a) => a.status === 'PRESENT').length,
        absent: enrollment.attendances.filter((a) => a.status === 'ABSENT').length,
        late: enrollment.attendances.filter((a) => a.status === 'LATE').length,
      },
    };
  }

  /**
   * Get list of all schools student has been enrolled in
   */
  async getMySchools(user: UserWithContext) {
    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
      include: {
        enrollments: {
          include: {
            school: {
              select: {
                id: true,
                name: true,
                schoolId: true,
              },
            },
          },
          orderBy: { enrollmentDate: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // Return unique schools (student may have multiple enrollments in same school)
    const schoolMap = new Map();
    for (const enrollment of student.enrollments) {
      if (!schoolMap.has(enrollment.schoolId)) {
        schoolMap.set(enrollment.schoolId, {
          schoolId: enrollment.school.id,
          schoolName: enrollment.school.name,
          isCurrentSchool: enrollment.schoolId === user.currentSchoolId,
          enrollments: [],
        });
      }
      schoolMap.get(enrollment.schoolId).enrollments.push({
        enrollmentId: enrollment.id,
        academicYear: enrollment.academicYear,
        classLevel: enrollment.classLevel,
        enrollmentDate: enrollment.enrollmentDate,
        isActive: enrollment.isActive,
      });
    }

    return Array.from(schoolMap.values());
  }

  private determineLevel(school: {
    hasPrimary: boolean;
    hasSecondary: boolean;
    hasTertiary: boolean;
  }): 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'MIXED' {
    const levels = [];
    if (school.hasPrimary) levels.push('PRIMARY');
    if (school.hasSecondary) levels.push('SECONDARY');
    if (school.hasTertiary) levels.push('TERTIARY');
    return levels.length > 1 ? 'MIXED' : (levels[0] as 'PRIMARY' | 'SECONDARY' | 'TERTIARY');
  }
}
