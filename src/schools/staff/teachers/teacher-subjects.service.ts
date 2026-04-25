import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SchoolRepository } from '../../domain/repositories/school.repository';
import { StaffRepository } from '../../domain/repositories/staff.repository';
import {
  TeacherSubjectDto,
  TeacherWithSubjectsDto,
  AssignableSubjectDto,
  UpdateTeacherSubjectsDto,
} from '../../dto/teacher-subjects.dto';

/**
 * Service for managing teacher subject competencies
 * Handles what subjects a teacher is qualified to teach
 */
@Injectable()
export class TeacherSubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository,
    private readonly staffRepository: StaffRepository
  ) {}

  /**
   * Get all subjects a teacher is qualified to teach
   */
  async getTeacherSubjects(schoolId: string, teacherId: string): Promise<TeacherSubjectDto[]> {
    // Validate school exists
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Validate teacher exists in school
    const teacher = await this.staffRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    if (teacher.schoolId !== school.id) {
      throw new BadRequestException('Teacher does not belong to this school');
    }

    // Get teacher subjects with assignment counts
    const subjectTeachers = await this.staffRepository.getTeacherSubjects(teacherId);

    // Map to DTOs with assignment counts
    const subjects: TeacherSubjectDto[] = await Promise.all(
      subjectTeachers.map(async (st: any) => {
        const assignedClassCount = await this.staffRepository.getTeacherSubjectAssignmentCount(
          teacherId,
          st.subject.name,
          st.subject.id // Pass subjectId for TimetablePeriod lookup
        );

        return {
          id: st.subject.id,
          name: st.subject.name,
          code: st.subject.code,
          schoolType: st.subject.schoolType,
          classLevelId: st.subject.classLevelId,
          classLevelName: st.subject.classLevel?.name || null,
          assignedClassCount,
        };
      })
    );

    return subjects;
  }

  /**
   * Get teacher with all subjects and total assignments
   */
  async getTeacherWithSubjects(
    schoolId: string,
    teacherId: string
  ): Promise<TeacherWithSubjectsDto> {
    // Validate school exists
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Get teacher with subjects
    const teacher = await this.staffRepository.getTeacherWithSubjects(teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    if (teacher.schoolId !== school.id) {
      throw new BadRequestException('Teacher does not belong to this school');
    }

    // Map subjects with assignment counts
    const subjects: TeacherSubjectDto[] = await Promise.all(
      (teacher.subjectTeachers || []).map(async (st: any) => {
        const assignedClassCount = await this.staffRepository.getTeacherSubjectAssignmentCount(
          teacherId,
          st.subject.name,
          st.subject.id // Pass subjectId for TimetablePeriod lookup
        );

        return {
          id: st.subject.id,
          name: st.subject.name,
          code: st.subject.code,
          schoolType: st.subject.schoolType,
          classLevelId: st.subject.classLevelId,
          classLevelName: st.subject.classLevel?.name || null,
          assignedClassCount,
        };
      })
    );

    return {
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      subjects,
      totalAssignments: teacher.classTeachers?.length || 0,
    };
  }

  /**
   * Update all subjects for a teacher (replaces existing)
   */
  async updateTeacherSubjects(
    schoolId: string,
    teacherId: string,
    dto: UpdateTeacherSubjectsDto
  ): Promise<TeacherSubjectDto[]> {
    // Validate school exists
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Validate teacher exists in school
    const teacher = await this.staffRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    if (teacher.schoolId !== school.id) {
      throw new BadRequestException('Teacher does not belong to this school');
    }

    // Validate all subject IDs belong to this school
    const invalidSubjects: string[] = [];
    for (const subjectId of dto.subjectIds) {
      const subject = await this.staffRepository.findSubjectById(subjectId, school.id);
      if (!subject) {
        invalidSubjects.push(subjectId);
      }
    }

    if (invalidSubjects.length > 0) {
      throw new BadRequestException(
        `The following subject IDs are invalid or do not belong to this school: ${invalidSubjects.join(', ')}`
      );
    }

    // Update teacher subjects
    await this.staffRepository.setTeacherSubjects(teacherId, dto.subjectIds);

    // Return updated subjects list
    return this.getTeacherSubjects(schoolId, teacherId);
  }

  /**
   * Add a single subject to a teacher's competencies
   */
  async addTeacherSubject(
    schoolId: string,
    teacherId: string,
    subjectId: string
  ): Promise<TeacherSubjectDto> {
    // Validate school exists
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Validate teacher exists in school
    const teacher = await this.staffRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    if (teacher.schoolId !== school.id) {
      throw new BadRequestException('Teacher does not belong to this school');
    }

    // Validate subject exists and belongs to school
    const subject = await this.staffRepository.findSubjectById(subjectId, school.id);
    if (!subject) {
      throw new NotFoundException('Subject not found or does not belong to this school');
    }

    // Check if teacher already has this subject
    const hasSubject = await this.staffRepository.hasSubjectCompetency(teacherId, subjectId);
    if (hasSubject) {
      throw new ConflictException(`Teacher is already qualified to teach ${subject.name}`);
    }

    // Add subject to teacher
    const subjectTeacher = await this.staffRepository.addTeacherSubject(teacherId, subjectId);

    // Get assignment count (includes TimetablePeriod for SECONDARY schools)
    const assignedClassCount = await this.staffRepository.getTeacherSubjectAssignmentCount(
      teacherId,
      subject.name,
      subjectId // Pass subjectId for TimetablePeriod lookup
    );

    return {
      id: subjectTeacher.subject.id,
      name: subjectTeacher.subject.name,
      code: subjectTeacher.subject.code,
      schoolType: subjectTeacher.subject.schoolType,
      classLevelId: subjectTeacher.subject.classLevelId,
      classLevelName: subjectTeacher.subject.classLevel?.name || null,
      assignedClassCount,
    };
  }

  /**
   * Remove a subject from a teacher's competencies
   */
  async removeTeacherSubject(
    schoolId: string,
    teacherId: string,
    subjectId: string
  ): Promise<void> {
    // Validate school exists
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Validate teacher exists in school
    const teacher = await this.staffRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    if (teacher.schoolId !== school.id) {
      throw new BadRequestException('Teacher does not belong to this school');
    }

    // Validate subject exists
    const subject = await this.staffRepository.findSubjectById(subjectId, school.id);
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    // Check if teacher has this subject
    const hasSubject = await this.staffRepository.hasSubjectCompetency(teacherId, subjectId);
    if (!hasSubject) {
      throw new BadRequestException(`Teacher is not currently assigned to teach ${subject.name}`);
    }

    // Check if teacher is currently teaching this subject in any class (includes TimetablePeriod)
    const assignmentCount = await this.staffRepository.getTeacherSubjectAssignmentCount(
      teacherId,
      subject.name,
      subjectId // Pass subjectId for TimetablePeriod lookup
    );
    if (assignmentCount > 0) {
      throw new ConflictException(
        `Cannot remove ${subject.name} from teacher's competencies. ` +
          `Teacher is currently assigned to teach this subject in ${assignmentCount} class(es). ` +
          `Please remove the class assignments first.`
      );
    }

    // Remove subject from teacher
    await this.staffRepository.removeTeacherSubject(teacherId, subjectId);
  }

  /**
   * Get subjects a teacher can be assigned to teach in a specific class
   * Filters by teacher's competencies and checks for existing assignments
   */
  async getAssignableSubjects(
    schoolId: string,
    teacherId: string,
    classId: string
  ): Promise<AssignableSubjectDto[]> {
    // Validate school exists
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Validate teacher exists in school
    const teacher = await this.staffRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
    if (teacher.schoolId !== school.id) {
      throw new BadRequestException('Teacher does not belong to this school');
    }

    // Get teacher's subjects
    const teacherSubjects = await this.staffRepository.getTeacherSubjects(teacherId);

    // Get existing assignments for this class
    const existingAssignments = await this.prisma.classTeacher.findMany({
      where: {
        teacherId,
        OR: [{ classId }, { classArmId: classId }],
      },
      select: {
        subject: true,
      },
    });

    const assignedSubjectNames = new Set(
      existingAssignments.map((a: any) => a.subject).filter(Boolean)
    );

    // Map to assignable subjects
    return teacherSubjects.map((st: any) => ({
      id: st.subject.id,
      name: st.subject.name,
      code: st.subject.code,
      alreadyAssigned: assignedSubjectNames.has(st.subject.name),
    }));
  }

  /**
   * Validate if a teacher can be assigned to teach a specific subject
   * Updated to handle both agora subjects (ID-based) and custom subjects (school-type based)
   */
  async validateTeacherCanTeachSubject(
    teacherId: string,
    subjectId: string,
    schoolId: string
  ): Promise<{ valid: boolean; message?: string }> {
    // Get the subject to determine if it's an agora subject or custom subject
    const subject = await this.staffRepository.findSubjectById(subjectId, schoolId);
    if (!subject) {
      return { valid: false, message: 'Subject not found' };
    }

    // Get teacher's subject competencies
    const teacherSubjects = await this.staffRepository.getTeacherSubjects(teacherId);
    
    // Check if teacher has this exact subject
    const hasDirectSubject = teacherSubjects.some((st: any) => st.subject.id === subjectId);
    
    // LOGIC UPDATE: Handle agora subjects vs custom subjects differently
    if (subject.agoraSubjectId) {
      // For AGORA SUBJECTS: Check if teacher has this subject OR any subject with same agora subject
      const hasRelatedAgoraSubject = teacherSubjects.some((st: any) => st.subject.agoraSubjectId === subject.agoraSubjectId);

      if (!hasDirectSubject && !hasRelatedAgoraSubject) {
        return {
          valid: false,
          message:
            `Teacher is not qualified to teach ${subject.name}. ` +
            `Please add this subject to the teacher's competencies first.`,
        };
      }
    } else {
      // For CUSTOM SUBJECTS: Only check if teacher has this exact subject
      // Custom subjects don't have agora mapping, so we can't auto-match related subjects
      if (!hasDirectSubject) {
        return {
          valid: false,
          message:
            `Teacher is not qualified to teach ${subject.name}. ` +
            `This is a custom subject. Please add it to the teacher's competencies first.`,
        };
      }
    }

    return { valid: true };
  }
}
