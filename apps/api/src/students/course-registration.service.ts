import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UserWithContext } from '../auth/types/user-with-context.type';
import {
  CreateCourseRegistrationDto,
  UpdateCourseRegistrationDto,
  CourseRegistrationDto,
} from './dto/course-registration.dto';

/**
 * Service for managing course registrations (TERTIARY institutions only)
 * Allows students to register for specific subjects/courses independent of their class level
 */
@Injectable()
export class CourseRegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all course registrations for a student
   * Only available for TERTIARY institutions
   */
  async getStudentCourseRegistrations(
    user: UserWithContext,
    termId?: string
  ): Promise<CourseRegistrationDto[]> {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Access denied. Student role required.');
    }

    // Get student
    const student = await this.prisma.student.findFirst({
      where: {
        userId: user.id,
      },
      include: {
        enrollments: {
          where: {
            isActive: true,
            ...(user.currentSchoolId ? { schoolId: user.currentSchoolId } : {}),
          },
          include: {
            school: true,
            class: true,
          },
        },
      },
    });

    if (!student || student.enrollments.length === 0) {
      throw new NotFoundException('Student not found or not enrolled in any school');
    }

    const enrollment = student.enrollments[0];
    const school = enrollment.school;
    const classData = enrollment.class;

    // Verify this is a TERTIARY institution
    if (!school.hasTertiary) {
      throw new BadRequestException('Course registration is only available for TERTIARY institutions');
    }

    // Verify student's class is TERTIARY type
    if (classData && classData.type !== 'TERTIARY') {
      throw new BadRequestException('Course registration is only available for TERTIARY students');
    }

    // Get course registrations
    const where: any = {
      studentId: student.id,
      isActive: true,
    };

    if (termId) {
      where.termId = termId;
    }

    const registrations = await (this.prisma as any).courseRegistration.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return registrations.map((reg: any) => this.mapToDto(reg));
  }

  /**
   * Create a new course registration
   * Only available for TERTIARY institutions
   */
  async createCourseRegistration(
    user: UserWithContext,
    dto: CreateCourseRegistrationDto
  ): Promise<CourseRegistrationDto> {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Access denied. Student role required.');
    }

    // Get student
    const student = await this.prisma.student.findFirst({
      where: {
        userId: user.id,
      },
      include: {
        enrollments: {
          where: {
            isActive: true,
            ...(user.currentSchoolId ? { schoolId: user.currentSchoolId } : {}),
          },
          include: {
            school: true,
            class: true,
          },
        },
      },
    });

    if (!student || student.enrollments.length === 0) {
      throw new NotFoundException('Student not found or not enrolled in any school');
    }

    const enrollment = student.enrollments[0];
    const school = enrollment.school;
    const classData = enrollment.class;

    // Verify this is a TERTIARY institution
    if (!school.hasTertiary) {
      throw new BadRequestException('Course registration is only available for TERTIARY institutions');
    }

    // Verify student's class is TERTIARY type
    if (classData && classData.type !== 'TERTIARY') {
      throw new BadRequestException('Course registration is only available for TERTIARY students');
    }

    // Verify subject exists and belongs to the school
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: dto.subjectId,
        schoolId: school.id,
        isActive: true,
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found or not available');
    }

    // Verify subject is for TERTIARY
    if (subject.schoolType && subject.schoolType !== 'TERTIARY') {
      throw new BadRequestException('Subject is not available for TERTIARY students');
    }

    // Check if registration already exists
    const existing = await (this.prisma as any).courseRegistration.findFirst({
      where: {
        studentId: student.id,
        subjectId: dto.subjectId,
        termId: dto.termId || null,
      },
    });

    if (existing && existing.isActive) {
      throw new BadRequestException('Course registration already exists for this subject and term');
    }

    // Create registration
    const registration = await (this.prisma as any).courseRegistration.create({
      data: {
        studentId: student.id,
        subjectId: dto.subjectId,
        semester: dto.semester || null,
        academicYear: dto.academicYear,
        termId: dto.termId || null,
        isCarryOver: dto.isCarryOver || false,
        isActive: true,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return this.mapToDto(registration);
  }

  /**
   * Update a course registration
   */
  async updateCourseRegistration(
    user: UserWithContext,
    registrationId: string,
    dto: UpdateCourseRegistrationDto
  ): Promise<CourseRegistrationDto> {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Access denied. Student role required.');
    }

    // Get student
    const student = await this.prisma.student.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Get registration and verify ownership
    const registration = await (this.prisma as any).courseRegistration.findFirst({
      where: {
        id: registrationId,
        studentId: student.id,
      },
    });

    if (!registration) {
      throw new NotFoundException('Course registration not found or access denied');
    }

    // Update registration
    const updated = await (this.prisma as any).courseRegistration.update({
      where: {
        id: registrationId,
      },
      data: {
        ...(dto.semester !== undefined ? { semester: dto.semester } : {}),
        ...(dto.academicYear !== undefined ? { academicYear: dto.academicYear } : {}),
        ...(dto.termId !== undefined ? { termId: dto.termId } : {}),
        ...(dto.isCarryOver !== undefined ? { isCarryOver: dto.isCarryOver } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Delete (deactivate) a course registration
   */
  async deleteCourseRegistration(
    user: UserWithContext,
    registrationId: string
  ): Promise<void> {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Access denied. Student role required.');
    }

    // Get student
    const student = await this.prisma.student.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Get registration and verify ownership
    const registration = await (this.prisma as any).courseRegistration.findFirst({
      where: {
        id: registrationId,
        studentId: student.id,
      },
    });

    if (!registration) {
      throw new NotFoundException('Course registration not found or access denied');
    }

    // Deactivate instead of deleting (soft delete)
    await (this.prisma as any).courseRegistration.update({
      where: {
        id: registrationId,
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Map Prisma model to DTO
   */
  private mapToDto(registration: any): CourseRegistrationDto {
    return {
      id: registration.id,
      studentId: registration.studentId,
      subjectId: registration.subjectId,
      subjectName: registration.subject?.name,
      subjectCode: registration.subject?.code,
      semester: registration.semester,
      academicYear: registration.academicYear,
      termId: registration.termId,
      isCarryOver: registration.isCarryOver,
      isActive: registration.isActive,
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt,
    };
  }
}

