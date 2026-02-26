import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for generating unique IDs for schools, staff, and other entities
 * Centralizes ID generation logic to ensure consistency
 */
@Injectable()
export class IdGeneratorService {
  /** Default when STUDENT_UID_SUFFIX_LENGTH env is not set or invalid. 6 gives ~1B combinations per school per year. */
  private static readonly DEFAULT_STUDENT_UID_SUFFIX_LENGTH = 6;
  private static readonly MIN_SUFFIX_LENGTH = 4;
  private static readonly MAX_SUFFIX_LENGTH = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Student UID suffix length from env STUDENT_UID_SUFFIX_LENGTH (default 6), clamped to 4–10.
   */
  private getStudentUidSuffixLength(): number {
    const raw = this.configService.get<string>('STUDENT_UID_SUFFIX_LENGTH');
    if (raw == null || raw === '') return IdGeneratorService.DEFAULT_STUDENT_UID_SUFFIX_LENGTH;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return IdGeneratorService.DEFAULT_STUDENT_UID_SUFFIX_LENGTH;
    return Math.max(
      IdGeneratorService.MIN_SUFFIX_LENGTH,
      Math.min(IdGeneratorService.MAX_SUFFIX_LENGTH, n),
    );
  }

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
   * Generate a short alphanumeric string
   * Used for public IDs and student UID suffix (avoid 0, O, I, 1 for readability)
   * @param length Number of characters (default 6 for public IDs, 4 for student UID suffix)
   */
  generateShortId(length: number = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, I, 1)
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Shorten school name for public ID / student UID
   * Takes exactly 2 uppercase letters from the school name (after removing common words and non-letters).
   */
  shortenSchoolName(schoolName: string): string {
    const cleaned = schoolName
      .toUpperCase()
      .replace(/\b(SCHOOL|ACADEMY|COLLEGE|UNIVERSITY|INSTITUTE|SECONDARY|PRIMARY|HIGH)\b/gi, '')
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 2);

    if (cleaned.length < 2) {
      return schoolName
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .substring(0, 2)
        .padEnd(2, 'X');
    }

    return cleaned;
  }

  /**
   * Generate a unique student UID (admission number)
   * Format: AG-{SchoolInitials}-{YY}-{suffix}
   * e.g. AG-ST-26-A3K9MN (Agora, school initials, year, alphanumeric suffix).
   * Suffix length is STUDENT_UID_SUFFIX_LENGTH (default 6) for ~1B combinations per school per year.
   * Existing students keep their current UID; only new admissions use this format.
   * @param schoolName School name (used to derive initials via shortenSchoolName)
   */
  async generateStudentId(schoolName: string): Promise<string> {
    const schoolShort = this.shortenSchoolName(schoolName);
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);

    let uid: string = '';
    let exists = true;
    const maxAttempts = 50;
    let attempts = 0;

    while (exists && attempts < maxAttempts) {
      const suffixLength = this.getStudentUidSuffixLength();
      const suffix = this.generateShortId(suffixLength);
      uid = `AG-${schoolShort}-${yy}-${suffix}`;

      const student = await this.prisma.student.findFirst({
        where: { uid },
      });
      exists = !!student;
      attempts++;
    }

    if (exists) {
      // Fallback to legacy format if collision after retries (extremely rare)
      const uuid = uuidv4().replace(/-/g, '').toUpperCase();
      uid = `AG-ST-${uuid}`;
      const student = await this.prisma.student.findFirst({
        where: { uid },
      });
      if (student) {
        throw new Error('Unable to generate unique student UID. Please try again.');
      }
    }

    return uid;
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
