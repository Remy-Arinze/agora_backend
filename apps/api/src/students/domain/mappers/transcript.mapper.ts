import { Enrollment, Grade, Attendance } from '@prisma/client';

/**
 * Mapper for converting transcript-related entities to DTOs
 * Follows the mapper pattern for separation of concerns
 */
export class TranscriptMapper {
  /**
   * Compute letter grade from percentage
   */
  private getLetterGrade(percentage: number): string {
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }

  /**
   * Convert enrollment with grades and attendance to SchoolTranscriptDto
   */
  toSchoolTranscriptDto(
    enrollment: Enrollment & {
      school: any;
      grades?: Grade[];
      attendances?: Attendance[];
    }
  ) {
    return {
      school: {
        id: enrollment.school.id,
        name: enrollment.school.name,
        schoolId: enrollment.school.schoolId,
      },
      enrollment: {
        id: enrollment.id,
        academicYear: enrollment.academicYear,
        classLevel: enrollment.classLevel,
        enrollmentDate: enrollment.enrollmentDate,
        isActive: enrollment.isActive,
      },
      grades:
        enrollment.grades?.map((grade) => {
          const score = typeof grade.score === 'object' ? grade.score.toNumber() : grade.score;
          const maxScore = typeof grade.maxScore === 'object' ? grade.maxScore.toNumber() : grade.maxScore;
          const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
          const letterGrade = this.getLetterGrade(percentage);
          return {
            id: grade.id,
            subject: grade.subject,
            score,
            maxScore,
            grade: letterGrade,
            term: grade.term,
            academicYear: grade.academicYear,
            createdAt: grade.createdAt,
          };
        }) || [],
      attendance:
        enrollment.attendances?.map((attendance) => ({
          id: attendance.id,
          date: attendance.date,
          status: attendance.status,
          remarks: attendance.remarks,
        })) || [],
    };
  }

  /**
   * Convert multiple enrollments to CompleteTranscriptDto
   */
  toCompleteTranscriptDto(
    enrollments: (Enrollment & {
      school: any;
      grades?: Grade[];
      attendances?: Attendance[];
    })[]
  ) {
    return {
      enrollments: enrollments.map((enrollment) => this.toSchoolTranscriptDto(enrollment)),
      totalSchools: new Set(enrollments.map((e) => e.schoolId)).size,
      totalEnrollments: enrollments.length,
      activeEnrollments: enrollments.filter((e) => e.isActive).length,
    };
  }
}
