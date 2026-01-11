import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service for validating staff-related operations
 * Centralizes validation logic to ensure consistency
 */
@Injectable()
export class StaffValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that email is unique within a school
   */
  async validateEmailUniqueInSchool(
    email: string,
    schoolId: string,
    excludeAdminId?: string,
    excludeTeacherId?: string
  ): Promise<void> {
    const existingAdmin = await this.prisma.schoolAdmin.findFirst({
      where: {
        email,
        schoolId,
        ...(excludeAdminId && { id: { not: excludeAdminId } }),
      },
    });

    if (existingAdmin) {
      throw new ConflictException(
        `An administrator with email ${email} already exists in this school`
      );
    }

    const existingTeacher = await this.prisma.teacher.findFirst({
      where: {
        email,
        schoolId,
        ...(excludeTeacherId && { id: { not: excludeTeacherId } }),
      },
    });

    if (existingTeacher) {
      throw new ConflictException(`A teacher with email ${email} already exists in this school`);
    }
  }

  /**
   * Validate that phone is unique within a school
   */
  async validatePhoneUniqueInSchool(
    phone: string,
    schoolId: string,
    excludeAdminId?: string,
    excludeTeacherId?: string
  ): Promise<void> {
    const existingAdmin = await this.prisma.schoolAdmin.findFirst({
      where: {
        phone,
        schoolId,
        ...(excludeAdminId && { id: { not: excludeAdminId } }),
      },
    });

    if (existingAdmin) {
      throw new ConflictException(
        `An administrator with phone number ${phone} already exists in this school`
      );
    }

    const existingTeacher = await this.prisma.teacher.findFirst({
      where: {
        phone,
        schoolId,
        ...(excludeTeacherId && { id: { not: excludeTeacherId } }),
      },
    });

    if (existingTeacher) {
      throw new ConflictException(
        `A teacher with phone number ${phone} already exists in this school`
      );
    }
  }

  /**
   * Validate staff data before creation/update
   */
  validateStaffData(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: string;
  }): void {
    if (data.firstName && data.firstName.trim().length < 2) {
      throw new BadRequestException('First name must be at least 2 characters');
    }

    if (data.lastName && data.lastName.trim().length < 2) {
      throw new BadRequestException('Last name must be at least 2 characters');
    }

    if (data.email && !this.isValidEmail(data.email)) {
      throw new BadRequestException('Invalid email format');
    }

    if (data.phone && !this.isValidPhone(data.phone)) {
      throw new BadRequestException('Invalid phone format');
    }

    if (data.role && data.role.trim().length < 2) {
      throw new BadRequestException('Role must be at least 2 characters');
    }

    if (data.role && data.role.length > 50) {
      throw new BadRequestException('Role must be at most 50 characters');
    }
  }

  /**
   * Check if a role is exactly "Principal" (case-insensitive)
   * This distinguishes between "Principal" and roles like "Vice Principal", "Assistant Principal", etc.
   */
  private isPrincipalRole(role: string): boolean {
    const roleLower = role?.trim().toLowerCase() || '';
    // Only exact match for "principal" - not roles containing "principal"
    return roleLower === 'principal';
  }

  /**
   * Validate that a principal role is not being assigned if one already exists
   * Only blocks if the role is exactly "Principal", not roles containing "principal"
   */
  async validatePrincipalRole(schoolId: string, role: string): Promise<void> {
    // Only validate if the role is exactly "Principal"
    if (!this.isPrincipalRole(role)) {
      return; // Not a principal role, no validation needed
    }

    // Check for existing principal (exact match only)
    const existingPrincipal = await this.prisma.schoolAdmin.findFirst({
      where: {
        schoolId,
        role: {
          equals: 'Principal',
          mode: 'insensitive',
        },
      },
    });

    if (existingPrincipal) {
      throw new ConflictException('School already has a principal');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    // Basic phone validation - can be enhanced
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }
}
