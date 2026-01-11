import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for generating unique IDs for schools, staff, and other entities
 * Centralizes ID generation logic to ensure consistency
 */
@Injectable()
export class IdGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique school ID
   * Format: AG-SCH-{UUID}
   */
  async generateSchoolId(): Promise<string> {
    let schoolId: string = '';
    let exists = true;

    while (exists) {
      const uuid = uuidv4().replace(/-/g, '').toUpperCase();
      schoolId = `AG-SCH-${uuid}`;
      const school = await this.prisma.school.findFirst({
        where: { schoolId },
      });
      exists = !!school;
    }

    return schoolId;
  }

  /**
   * Generate a unique principal ID
   * Format: AG-PR-{UUID}
   */
  async generatePrincipalId(): Promise<string> {
    let principalId: string = '';
    let exists = true;

    while (exists) {
      const uuid = uuidv4().replace(/-/g, '').toUpperCase();
      principalId = `AG-PR-${uuid}`;
      const admin = await this.prisma.schoolAdmin.findFirst({
        where: { adminId: principalId },
      });
      exists = !!admin;
    }

    return principalId;
  }

  /**
   * Generate a unique admin ID
   * Format: AG-AD-{UUID}
   */
  async generateAdminId(): Promise<string> {
    let adminId: string = '';
    let exists = true;

    while (exists) {
      const uuid = uuidv4().replace(/-/g, '').toUpperCase();
      adminId = `AG-AD-${uuid}`;
      const admin = await this.prisma.schoolAdmin.findFirst({
        where: { adminId },
      });
      exists = !!admin;
    }

    return adminId;
  }

  /**
   * Generate a unique teacher ID
   * Format: AG-TE-{UUID}
   */
  async generateTeacherId(): Promise<string> {
    let teacherId: string = '';
    let exists = true;

    while (exists) {
      const uuid = uuidv4().replace(/-/g, '').toUpperCase();
      teacherId = `AG-TE-${uuid}`;
      const teacher = await this.prisma.teacher.findFirst({
        where: { teacherId },
      });
      exists = !!teacher;
    }

    return teacherId;
  }

  /**
   * Generate a short alphanumeric string (6-8 characters)
   * Used for public IDs
   */
  generateShortId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, I, 1)
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Shorten school name for public ID
   * Takes first 3-4 uppercase letters, removes spaces and special chars
   */
  shortenSchoolName(schoolName: string): string {
    const cleaned = schoolName
      .toUpperCase()
      .replace(/\b(SCHOOL|ACADEMY|COLLEGE|UNIVERSITY|INSTITUTE|SECONDARY|PRIMARY|HIGH)\b/gi, '')
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 4);

    if (cleaned.length < 3) {
      return schoolName
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .substring(0, 3)
        .padEnd(3, 'X');
    }

    return cleaned;
  }

  /**
   * Generate a unique student ID
   * Format: AG-ST-{UUID}
   */
  async generateStudentId(): Promise<string> {
    let studentId: string = '';
    let exists = true;

    while (exists) {
      const uuid = uuidv4().replace(/-/g, '').toUpperCase();
      studentId = `AG-ST-${uuid}`;
      const student = await this.prisma.student.findFirst({
        where: { uid: studentId },
      });
      exists = !!student;
    }

    return studentId;
  }

  /**
   * Generate a unique public ID for admin/teacher/student
   * Format: AG-{schoolname shortened}-{short alphanumeric}
   */
  async generatePublicId(
    schoolName: string,
    type: 'admin' | 'teacher' | 'student'
  ): Promise<string> {
    let publicId: string = '';
    let exists = true;
    const schoolShort = this.shortenSchoolName(schoolName);

    while (exists) {
      const shortId = this.generateShortId();
      publicId = `AG-${schoolShort}-${shortId}`;

      const adminExists = await this.prisma.schoolAdmin.findFirst({
        where: { publicId },
      });
      const teacherExists = await this.prisma.teacher.findFirst({
        where: { publicId },
      });
      const studentExists =
        type === 'student'
          ? await this.prisma.student.findFirst({
              where: { publicId },
            })
          : null;

      exists = !!(adminExists || teacherExists || studentExists);
    }

    return publicId;
  }
}
