import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service for validating school-related operations
 * Centralizes validation logic to ensure consistency
 */
@Injectable()
export class SchoolValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that a subdomain is unique
   */
  async validateSubdomainUnique(subdomain: string, excludeSchoolId?: string): Promise<void> {
    const existingSchool = await this.prisma.school.findUnique({
      where: { subdomain },
    });

    if (existingSchool && existingSchool.id !== excludeSchoolId) {
      throw new ConflictException('School with this subdomain already exists');
    }
  }

  /**
   * Validate that a school exists
   */
  async validateSchoolExists(schoolId: string): Promise<void> {
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [{ id: schoolId }, { subdomain: schoolId }],
      },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }
  }

  /**
   * Validate school data before creation/update
   */
  validateSchoolData(data: {
    name?: string;
    subdomain?: string;
    email?: string;
    phone?: string;
  }): void {
    if (data.name && data.name.trim().length < 2) {
      throw new BadRequestException('School name must be at least 2 characters');
    }

    if (data.subdomain) {
      const subdomainRegex = /^[a-z0-9-]+$/;
      if (!subdomainRegex.test(data.subdomain)) {
        throw new BadRequestException(
          'Subdomain can only contain lowercase letters, numbers, and hyphens'
        );
      }
      if (data.subdomain.length < 3 || data.subdomain.length > 50) {
        throw new BadRequestException('Subdomain must be between 3 and 50 characters');
      }
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
