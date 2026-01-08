import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { SchoolRepository } from '../domain/repositories/school.repository';
import { StaffRepository } from '../domain/repositories/staff.repository';
import { SchoolMapper } from '../domain/mappers/school.mapper';
import { IdGeneratorService } from '../shared/id-generator.service';
import { SchoolValidatorService } from '../shared/school-validator.service';
import { StaffValidatorService } from '../shared/staff-validator.service';
import { CreateSchoolDto } from '../dto/create-school.dto';
import { UpdateSchoolDto } from '../dto/update-school.dto';
import { SchoolDto } from '../dto/school.dto';
import { generateSecurePasswordHash } from '../../common/utils/password.utils';

/**
 * Service for super admin school management operations
 * Handles creating, updating, deleting, and listing schools
 */
@Injectable()
export class SuperAdminSchoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly schoolRepository: SchoolRepository,
    private readonly staffRepository: StaffRepository,
    private readonly schoolMapper: SchoolMapper,
    private readonly idGenerator: IdGeneratorService,
    private readonly schoolValidator: SchoolValidatorService,
    private readonly staffValidator: StaffValidatorService
  ) {}

  /**
   * Create a school with optional principal and admins
   */
  async createSchool(createSchoolDto: CreateSchoolDto): Promise<SchoolDto> {
    const { principal, admins, levels, ...schoolData } = createSchoolDto;

    // Validate school data
    this.schoolValidator.validateSchoolData(schoolData);

    // Check if subdomain already exists
    await this.schoolValidator.validateSubdomainUnique(schoolData.subdomain);

    // Generate unique school ID
    const schoolId = await this.idGenerator.generateSchoolId();

    // Generate principal ID and public ID if principal is provided
    const principalId = principal ? await this.idGenerator.generatePrincipalId() : null;
    const principalPublicId = principal
      ? await this.idGenerator.generatePublicId(schoolData.name, 'admin')
      : null;

    // Generate admin IDs and public IDs for additional admins before transaction
    const adminIds: string[] = [];
    const adminPublicIds: string[] = [];
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        const roleLower = admin.role?.trim().toLowerCase() || '';
        const isPrincipal = roleLower === 'principal'; // Only exact match, not contains
        if (isPrincipal) {
          adminIds.push(await this.idGenerator.generatePrincipalId());
        } else {
          adminIds.push(await this.idGenerator.generateAdminId());
        }
        adminPublicIds.push(await this.idGenerator.generatePublicId(schoolData.name, 'admin'));
      }
    }

    // Generate default password for admins
    const defaultPassword = await generateSecurePasswordHash();

    try {
      // Create school with admins in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create school - use transaction client directly
        const newSchool = await tx.school.create({
          data: {
            ...schoolData,
            schoolId,
            country: schoolData.country || 'Nigeria',
            hasPrimary: levels?.primary || false,
            hasSecondary: levels?.secondary || false,
            hasTertiary: levels?.tertiary || false,
          },
        });

        const createdAdmins = [];
        const emailQueue: Array<{
          userId: string;
          email: string;
          name: string;
          role: string;
          publicId: string;
        }> = [];

        // Create principal if provided
        if (principal) {
          const principalData = await this.createAdminUser(
            tx,
            principal.email,
            principal.phone,
            defaultPassword
          );

          // Validate principal role
          await this.staffValidator.validatePrincipalRole(newSchool.id, 'Principal');

          // Create principal admin - use transaction client directly
          const principalAdmin = await tx.schoolAdmin.create({
            data: {
              adminId: principalId!,
              publicId: principalPublicId!,
              firstName: principal.firstName,
              lastName: principal.lastName,
              email: principal.email,
              phone: principal.phone,
              role: 'Principal',
              userId: principalData.user.id,
              schoolId: newSchool.id,
            },
            include: { user: true, school: true },
          });

          createdAdmins.push(principalAdmin);
          emailQueue.push({
            userId: principalData.user.id,
            email: principal.email,
            name: `${principal.firstName} ${principal.lastName}`,
            role: 'Principal',
            publicId: principalPublicId!,
          });
        }

        // Create additional admins if provided
        if (admins && admins.length > 0) {
          for (let i = 0; i < admins.length; i++) {
            const admin = admins[i];
            const adminId = adminIds[i];

            // Validate role - only check for exact "Principal" role
            const roleLower = admin.role?.trim().toLowerCase() || '';
            const isPrincipal = roleLower === 'principal'; // Only exact match, not contains
            if (isPrincipal) {
              await this.staffValidator.validatePrincipalRole(newSchool.id, admin.role);
            }

            // Validate staff data
            this.staffValidator.validateStaffData(admin);

            const adminData = await this.createAdminUser(
              tx,
              admin.email,
              admin.phone,
              defaultPassword
            );

            // Create admin - use transaction client directly
            const newAdmin = await tx.schoolAdmin.create({
              data: {
                adminId: adminId,
                publicId: adminPublicIds[i],
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
                phone: admin.phone,
                role: admin.role,
                userId: adminData.user.id,
                schoolId: newSchool.id,
              },
              include: { user: true, school: true },
            });

            createdAdmins.push(newAdmin);
            emailQueue.push({
              userId: adminData.user.id,
              email: admin.email,
              name: `${admin.firstName} ${admin.lastName}`,
              role: isPrincipal ? 'Principal' : admin.role || 'Administrator',
              publicId: adminPublicIds[i],
            });
          }
        }

        return { school: newSchool, admins: createdAdmins, emailQueue };
      });

      // Send password reset emails (outside transaction)
      for (const emailData of result.emailQueue) {
        try {
          await this.authService.sendPasswordResetForNewUser(
            emailData.userId,
            emailData.email,
            emailData.name,
            emailData.role,
            emailData.publicId,
            result.school.name
          );
        } catch (error) {
          console.error(`Failed to send password reset email to ${emailData.email}:`, error);
        }
      }

      // Fetch complete school data with relations
      const completeSchool = await this.prisma.school.findUnique({
        where: { id: result.school.id },
        include: {
          admins: {
            include: { user: true },
            orderBy: { role: 'asc' },
          },
          teachers: true,
          enrollments: {
            where: { isActive: true },
          },
        },
      });

      if (!completeSchool) {
        throw new BadRequestException('Failed to retrieve created school');
      }

      return this.schoolMapper.toDto(completeSchool);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create school: ' + error.message);
    }
  }

  /**
   * Get all schools
   */
  async findAll(): Promise<SchoolDto[]> {
    const schools = await this.prisma.school.findMany({
      include: {
        admins: {
          include: { user: true },
          orderBy: { role: 'asc' },
        },
        teachers: true,
        enrollments: {
          where: { isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.schoolMapper.toDtoArray(schools);
  }

  /**
   * Get school by ID or subdomain
   */
  async findOne(identifier: string): Promise<SchoolDto> {
    const school = await this.schoolRepository.findByIdOrSubdomain(identifier);

    if (!school) {
      throw new BadRequestException('School not found');
    }

    const completeSchool = await this.prisma.school.findUnique({
      where: { id: school.id },
      include: {
        admins: {
          include: { user: true },
          orderBy: { role: 'asc' },
        },
        teachers: true,
        enrollments: {
          where: { isActive: true },
        },
      },
    });

    if (!completeSchool) {
      throw new BadRequestException('School not found');
    }

    return this.schoolMapper.toDto(completeSchool);
  }

  /**
   * Update a school
   */
  async updateSchool(id: string, updateSchoolDto: UpdateSchoolDto): Promise<SchoolDto> {
    const { levels, ...schoolData } = updateSchoolDto;

    // Validate school exists
    await this.schoolValidator.validateSchoolExists(id);

    // Validate school data
    this.schoolValidator.validateSchoolData(schoolData);

    // Check if subdomain is being changed
    const existingSchool = await this.schoolRepository.findById(id);
    if (!existingSchool) {
      throw new BadRequestException('School not found');
    }

    if (schoolData.subdomain && schoolData.subdomain !== existingSchool.subdomain) {
      await this.schoolValidator.validateSubdomainUnique(schoolData.subdomain, id);
    }

    // Update school
    const updatedSchool = await this.prisma.school.update({
      where: { id },
      data: {
        ...schoolData,
        hasPrimary: levels?.primary !== undefined ? levels.primary : existingSchool.hasPrimary,
        hasSecondary:
          levels?.secondary !== undefined ? levels.secondary : existingSchool.hasSecondary,
        hasTertiary: levels?.tertiary !== undefined ? levels.tertiary : existingSchool.hasTertiary,
      },
      include: {
        admins: {
          include: { user: true },
          orderBy: { role: 'asc' },
        },
        teachers: true,
        enrollments: {
          where: { isActive: true },
        },
      },
    });

    return this.schoolMapper.toDto(updatedSchool);
  }

  /**
   * Delete a school
   */
  async deleteSchool(id: string): Promise<void> {
    await this.schoolValidator.validateSchoolExists(id);
    await this.schoolRepository.delete(id);
  }

  /**
   * Helper: Create or update admin user
   */
  private async createAdminUser(
    tx: any,
    email: string,
    phone: string,
    password: string
  ): Promise<{ user: any }> {
    let user = await tx.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          phone,
          passwordHash: password,
          accountStatus: 'SHADOW', // User needs to activate via email
          role: 'SCHOOL_ADMIN',
        },
      });
    } else {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: password,
          // Don't change accountStatus if user already exists
          role: 'SCHOOL_ADMIN',
        },
      });
    }

    return { user };
  }
}

