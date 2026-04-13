import { Injectable, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service for validating school-related operations
 * Centralizes validation logic to ensure consistency
 */
@Injectable()
export class SchoolValidatorService {
  constructor(private readonly prisma: PrismaService) { }


  /**
   * Validate that a school exists
   */
  async validateSchoolExists(schoolId: string): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }
  }

  /**
   * Validate that a school is active
   */
  async validateSchoolActive(schoolId: string): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    if (!school.isActive) {
      throw new ForbiddenException('School is inactive. Please contact system administrator.');
    }

    if (school.registrationStatus === 'UNAPPROVED') {
      throw new ForbiddenException('School registration is pending approval.');
    }
  }

  validateSchoolData(data: {
    name?: string;
    email?: string;
    phone?: string;
  }): void {
    if (data.name && data.name.trim().length < 2) {
      throw new BadRequestException('School name must be at least 2 characters');
    }

    if (data.email && !this.isValidEmail(data.email)) {
      throw new BadRequestException('Invalid email format');
    }

    if (data.phone && !this.isValidPhone(data.phone)) {
      throw new BadRequestException('Invalid phone format');
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
