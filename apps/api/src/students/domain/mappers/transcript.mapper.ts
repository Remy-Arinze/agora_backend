import { Enrollment, Grade, Attendance } from '@prisma/client';

/**
 * Mapper for converting transcript-related entities to DTOs
 * Follows the mapper pattern for separation of concerns
 */
export class TranscriptMapper {
  /**
   * Convert enrollment with grades and attendance to SchoolTranscriptDto
   */
  toSchoolTranscriptDto(enrollment: Enrollment & {
    school: any;
    grades?: Grade[];
    attendances?: Attendance[];
  }) {
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
        graduationDate: enrollment.graduationDate,
        isActive: enrollment.isActive,
      },
      grades: enrollment.grades?.map((grade) => ({
        id: grade.id,
        subject: grade.subject,
        score: grade.score,
        maxScore: grade.maxScore,
        grade: grade.grade,
        term: grade.term,
        academicYear: grade.academicYear,
        createdAt: grade.createdAt,
      })) || [],
      attendance: enrollment.attendances?.map((attendance) => ({
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
  toCompleteTranscriptDto(enrollments: (Enrollment & {
    school: any;
    grades?: Grade[];
    attendances?: Attendance[];
  })[]) {
    return {
      enrollments: enrollments.map((enrollment) => this.toSchoolTranscriptDto(enrollment)),
      totalSchools: new Set(enrollments.map((e) => e.schoolId)).size,
      totalEnrollments: enrollments.length,
      activeEnrollments: enrollments.filter((e) => e.isActive).length,
    };
  }
}

