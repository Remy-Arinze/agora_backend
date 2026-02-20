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
import { isPrincipalRole } from '../dto/permission.dto';

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

    // Sanitize and validate school data
    const sanitizedSchoolData = this.sanitizeSchoolData(schoolData);

    // Generate subdomain if not provided
    if (!sanitizedSchoolData.subdomain) {
      sanitizedSchoolData.subdomain = this.generateSubdomainFromName(sanitizedSchoolData.name);
      
      // Ensure uniqueness by appending a number if needed
      let baseSubdomain = sanitizedSchoolData.subdomain;
      let counter = 1;
      while (await this.prisma.school.findUnique({ where: { subdomain: sanitizedSchoolData.subdomain } })) {
        sanitizedSchoolData.subdomain = `${baseSubdomain}-${counter}`;
        counter++;
        // Safety check to prevent infinite loop
        if (counter > 1000) {
          throw new BadRequestException('Unable to generate unique subdomain. Please provide one manually.');
        }
      }
    }

    // Validate school data
    this.schoolValidator.validateSchoolData(sanitizedSchoolData);

    // Check if subdomain already exists
    await this.schoolValidator.validateSubdomainUnique(sanitizedSchoolData.subdomain);

    // Validate and sanitize school email if provided
    if (sanitizedSchoolData.email) {
      // Validate email format
      if (!this.isValidEmail(sanitizedSchoolData.email)) {
        throw new BadRequestException('Invalid school email format');
      }

      // Check if school email conflicts with principal or admin emails
      if (principal && principal.email.toLowerCase().trim() === sanitizedSchoolData.email) {
        throw new ConflictException(
          'School email cannot be the same as principal email. The principal will receive their own account.'
        );
      }

      if (admins && admins.length > 0) {
        const conflictingAdmin = admins.find(
          admin => admin.email.toLowerCase().trim() === sanitizedSchoolData.email
        );
        if (conflictingAdmin) {
          throw new ConflictException(
            'School email cannot be the same as an admin email. Each admin will receive their own account.'
          );
        }
      }
    }

    // Sanitize principal data if provided
    const sanitizedPrincipal = principal ? this.sanitizePrincipalData(principal) : null;

    // Sanitize admins data if provided
    const sanitizedAdmins = admins && admins.length > 0 
      ? admins.map(admin => this.sanitizeAdminData(admin))
      : null;

    // Generate unique school ID
    const schoolId = await this.idGenerator.generateSchoolId();

    // Generate principal ID and public ID if principal is provided
    const principalId = sanitizedPrincipal ? await this.idGenerator.generatePrincipalId() : null;
    const principalPublicId = sanitizedPrincipal
      ? await this.idGenerator.generatePublicId(sanitizedSchoolData.name, 'admin')
      : null;

    // Generate admin IDs and public IDs for additional admins before transaction
    const adminIds: string[] = [];
    const adminPublicIds: string[] = [];
    if (sanitizedAdmins && sanitizedAdmins.length > 0) {
      for (const admin of sanitizedAdmins) {
        // Use centralized isPrincipalRole function
        const isPrincipal = isPrincipalRole(admin.role);
        if (isPrincipal) {
          adminIds.push(await this.idGenerator.generatePrincipalId());
        } else {
          adminIds.push(await this.idGenerator.generateAdminId());
        }
        adminPublicIds.push(await this.idGenerator.generatePublicId(sanitizedSchoolData.name, 'admin'));
      }
    }

    // Generate School Owner ID and public ID if school email is provided
    const schoolOwnerId = sanitizedSchoolData.email ? await this.idGenerator.generatePrincipalId() : null;
    const schoolOwnerPublicId = sanitizedSchoolData.email
      ? await this.idGenerator.generatePublicId(sanitizedSchoolData.name, 'admin')
      : null;

    // Generate default password for admins
    const defaultPassword = await generateSecurePasswordHash();

    try {
      // Create school with admins in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create school - use transaction client directly
        const newSchool = await tx.school.create({
          data: {
            ...sanitizedSchoolData,
            schoolId,
            country: sanitizedSchoolData.country || 'Nigeria',
            hasPrimary: levels?.primary || false,
            hasSecondary: levels?.secondary || false,
            hasTertiary: levels?.tertiary || false,
          },
        });

        const createdAdmins: any[] = [];
        const emailQueue: Array<{
          userId: string;
          email: string;
          name: string;
          role: string;
          publicId: string;
        }> = [];

        // Create School Owner account if school email is provided
        // This must be done before principal to ensure proper validation
        if (sanitizedSchoolData.email) {
          // Extract name from email or use school name
          const emailParts = sanitizedSchoolData.email.split('@')[0];
          const nameParts = emailParts.split(/[._-]/);
          const ownerFirstName = nameParts[0] 
            ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase()
            : 'School';
          const ownerLastName = nameParts.length > 1
            ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1).toLowerCase()
            : 'Owner';

          const schoolOwnerData = await this.createAdminUser(
            tx,
            sanitizedSchoolData.email,
            sanitizedSchoolData.phone || '',
            defaultPassword
          );

          // Validate school owner role (should not conflict with existing principal roles)
          await this.staffValidator.validatePrincipalRole(newSchool.id, 'school_owner');

          // Create School Owner admin
          const schoolOwner = await tx.schoolAdmin.create({
            data: {
              adminId: schoolOwnerId!,
              publicId: schoolOwnerPublicId!,
              firstName: ownerFirstName,
              lastName: ownerLastName,
              email: sanitizedSchoolData.email,
              phone: sanitizedSchoolData.phone || '',
              role: 'school_owner',
              userId: schoolOwnerData.user.id,
              schoolId: newSchool.id,
            },
            include: { user: true, school: true },
          });

          createdAdmins.push(schoolOwner);
          emailQueue.push({
            userId: schoolOwnerData.user.id,
            email: sanitizedSchoolData.email,
            name: `${ownerFirstName} ${ownerLastName}`,
            role: 'School Owner',
            publicId: schoolOwnerPublicId!,
          });
        }

        // Create principal if provided
        if (sanitizedPrincipal) {
          const principalData = await this.createAdminUser(
            tx,
            sanitizedPrincipal.email,
            sanitizedPrincipal.phone,
            defaultPassword
          );

          // Validate principal role
          await this.staffValidator.validatePrincipalRole(newSchool.id, 'principal');

          // Create principal admin - use transaction client directly
          const principalAdmin = await tx.schoolAdmin.create({
            data: {
              adminId: principalId!,
              publicId: principalPublicId!,
              firstName: sanitizedPrincipal.firstName,
              lastName: sanitizedPrincipal.lastName,
              email: sanitizedPrincipal.email,
              phone: sanitizedPrincipal.phone,
              role: 'principal',
              userId: principalData.user.id,
              schoolId: newSchool.id,
            },
            include: { user: true, school: true },
          });

          createdAdmins.push(principalAdmin);
          emailQueue.push({
            userId: principalData.user.id,
            email: sanitizedPrincipal.email,
            name: `${sanitizedPrincipal.firstName} ${sanitizedPrincipal.lastName}`,
            role: 'Principal',
            publicId: principalPublicId!,
          });
        }

        // Create additional admins if provided
        if (sanitizedAdmins && sanitizedAdmins.length > 0) {
          for (let i = 0; i < sanitizedAdmins.length; i++) {
            const admin = sanitizedAdmins[i];
            const adminId = adminIds[i];

            // Validate role - use centralized isPrincipalRole function
            const isPrincipal = isPrincipalRole(admin.role);
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

            // Normalize role to use underscores for multi-word roles
            const normalizedRole = this.normalizeRoleName(admin.role);

            // Create admin - use transaction client directly
            const newAdmin = await tx.schoolAdmin.create({
              data: {
                adminId: adminId,
                publicId: adminPublicIds[i],
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
                phone: admin.phone,
                role: normalizedRole,
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
   * Get all schools with pagination, search, and filtering
   */
  async findAll(
    pagination?: {
      page?: number;
      limit?: number;
      search?: string;
      filter?: 'all' | 'active' | 'inactive';
    },
  ): Promise<{
    data: SchoolDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const skip = (page - 1) * limit;
    const search = pagination?.search?.trim();
    const filter = pagination?.filter || 'all';

    // Build where clause for search and filter
    const where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (filter !== 'all') {
      where.isActive = filter === 'active';
    }

    // Get total count for pagination
    const total = await this.prisma.school.count({ where });

    // Get paginated schools with bounded nested relations (list view)
    const schools = await this.prisma.school.findMany({
      where,
      include: {
        admins: {
          include: { user: true },
          orderBy: { role: 'asc' },
          take: 10,
        },
        teachers: {
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const schoolIds = schools.map((s) => s.id);
    if (schoolIds.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      };
    }

    // Batch counts for students (active enrollments) and teachers per school (indexed, scalable)
    const [enrollmentCounts, teacherCounts] = await Promise.all([
      this.prisma.enrollment.groupBy({
        by: ['schoolId'],
        where: { schoolId: { in: schoolIds }, isActive: true },
        _count: { id: true },
      }),
      this.prisma.teacher.groupBy({
        by: ['schoolId'],
        where: { schoolId: { in: schoolIds } },
        _count: { id: true },
      }),
    ]);

    const countsMap: Record<string, { studentsCount: number; teachersCount: number }> = {};
    schoolIds.forEach((id) => {
      countsMap[id] = { studentsCount: 0, teachersCount: 0 };
    });
    enrollmentCounts.forEach((row) => {
      countsMap[row.schoolId].studentsCount = row._count.id;
    });
    teacherCounts.forEach((row) => {
      countsMap[row.schoolId].teachersCount = row._count.id;
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: this.schoolMapper.toDtoArray(schools, countsMap),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
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

    // Sanitize school data
    const sanitizedSchoolData = this.sanitizeSchoolData(schoolData);

    // Validate school data
    this.schoolValidator.validateSchoolData(sanitizedSchoolData);

    // Prepare email queue for new school owner if email changed
    const emailQueue: Array<{
      userId: string;
      email: string;
      name: string;
      role: string;
      publicId: string;
    }> = [];

    try {
      // Update school and handle school owner in a transaction
      // Fetch school once inside transaction to avoid race conditions and reduce queries
      const result = await this.prisma.$transaction(async (tx) => {
        // Fetch existing school with admins (single query, inside transaction for consistency)
        const existingSchool = await tx.school.findUnique({
          where: { id },
          include: {
            admins: {
              include: { user: true },
            },
          },
        });

        if (!existingSchool) {
          throw new BadRequestException('School not found');
        }

        // Check if subdomain is being changed
        if (sanitizedSchoolData.subdomain && sanitizedSchoolData.subdomain !== existingSchool.subdomain) {
          // Validate subdomain uniqueness (check outside transaction context but before update)
          const subdomainConflict = await tx.school.findUnique({
            where: { subdomain: sanitizedSchoolData.subdomain },
          });
          if (subdomainConflict && subdomainConflict.id !== id) {
            throw new ConflictException('School with this subdomain already exists');
          }
        }

        // Check if email is being changed (compare sanitized versions)
        const oldEmail = existingSchool.email
          ? existingSchool.email.toLowerCase().trim()
          : null;
        const newEmail = sanitizedSchoolData.email
          ? sanitizedSchoolData.email.toLowerCase().trim()
          : null;
        const emailChanged = newEmail !== oldEmail;

        // Find existing school owner
        const existingSchoolOwner = existingSchool.admins.find((admin) => {
          const roleLower = admin.role?.trim().toLowerCase() || '';
          return roleLower === 'school_owner';
        });

        // Update school
        const updatedSchool = await tx.school.update({
          where: { id },
          data: {
            ...sanitizedSchoolData,
            hasPrimary: levels?.primary !== undefined ? levels.primary : existingSchool.hasPrimary,
            hasSecondary:
              levels?.secondary !== undefined ? levels.secondary : existingSchool.hasSecondary,
            hasTertiary: levels?.tertiary !== undefined ? levels.tertiary : existingSchool.hasTertiary,
          },
        });

        // Handle school owner if email changed
        if (emailChanged) {
          // Remove old school owner if it exists (school email changed, so old owner is no longer valid)
          if (existingSchoolOwner) {
            await tx.schoolAdmin.delete({
              where: { id: existingSchoolOwner.id },
            });
          }

          // If new email is provided, create new school owner account
          if (newEmail) {
            // Validate new email doesn't conflict with existing admins (query current state in transaction)
            const currentAdmins = await tx.schoolAdmin.findMany({
              where: { schoolId: id },
              include: { user: true },
            });

            const conflictingAdmin = currentAdmins.find(
              (admin) =>
                admin.id !== existingSchoolOwner?.id &&
                admin.email?.toLowerCase().trim() === newEmail
            );

            if (conflictingAdmin) {
              throw new ConflictException(
                `Email ${newEmail} is already used by another administrator (${conflictingAdmin.firstName} ${conflictingAdmin.lastName}).`
              );
            }

            // Generate School Owner ID and public ID
            const schoolOwnerId = await this.idGenerator.generatePrincipalId();
            const schoolOwnerPublicId = await this.idGenerator.generatePublicId(updatedSchool.name, 'admin');

            // Extract name from email or use school name
            const emailParts = newEmail.split('@')[0];
            const nameParts = emailParts.split(/[._-]/);
            const ownerFirstName = nameParts[0]
              ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase()
              : 'School';
            const ownerLastName = nameParts.length > 1
              ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1).toLowerCase()
              : 'Owner';

            // Generate default password
            const defaultPassword = await generateSecurePasswordHash();

            // Create or get user for new school owner
            const schoolOwnerData = await this.createAdminUser(
              tx,
              newEmail,
              sanitizedSchoolData.phone || existingSchool.phone || '',
              defaultPassword
            );

            // Create new School Owner admin
            const newSchoolOwner = await tx.schoolAdmin.create({
              data: {
                adminId: schoolOwnerId,
                publicId: schoolOwnerPublicId,
                firstName: ownerFirstName,
                lastName: ownerLastName,
                email: newEmail,
                phone: sanitizedSchoolData.phone || existingSchool.phone || '',
                role: 'school_owner',
                userId: schoolOwnerData.user.id,
                schoolId: updatedSchool.id,
              },
              include: { user: true, school: true },
            });

            emailQueue.push({
              userId: schoolOwnerData.user.id,
              email: newEmail,
              name: `${ownerFirstName} ${ownerLastName}`,
              role: 'school_owner',
              publicId: schoolOwnerPublicId,
            });
          }
          // If email is being removed (set to null/empty), old school owner is already deleted above
          // No new school owner will be created
        }

        // Return complete school data from transaction to avoid another query
        const completeSchool = await tx.school.findUnique({
          where: { id },
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
          throw new BadRequestException('Failed to retrieve updated school');
        }

        return completeSchool;
      });

      // Send password reset email for new school owner (outside transaction)
      if (emailQueue.length > 0) {
        for (const emailData of emailQueue) {
          try {
            await this.authService.sendPasswordResetForNewUser(
              emailData.userId,
              emailData.email,
              emailData.name,
              emailData.role,
              emailData.publicId,
              result.name
            );
          } catch (error) {
            console.error(`Failed to send password reset email to ${emailData.email}:`, error);
            // Don't throw - email failure shouldn't prevent school update
          }
        }
      }

      return this.schoolMapper.toDto(result);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update school: ' + error.message);
    }
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
   * Creates a new SHADOW user or updates existing user's password and phone
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
      // Create new user with SHADOW status (needs to activate via email)
      user = await tx.user.create({
        data: {
          email,
          phone: phone || null,
          passwordHash: password,
          accountStatus: 'SHADOW',
          role: 'SCHOOL_ADMIN',
        },
      });
    } else {
      // Update existing user: reset password and update phone if provided
      // Don't change accountStatus - let them activate if needed
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: password,
          phone: phone || user.phone, // Update phone if provided, otherwise keep existing
          role: 'SCHOOL_ADMIN', // Ensure correct role
        },
      });
    }

    return { user };
  }

  /**
   * Helper: Normalize role name to use underscores for multi-word roles
   * This ensures consistency with PRINCIPAL_ROLES array
   */
  private normalizeRoleName(role: string): string {
    if (!role) return 'Administrator';
    
    // Trim and normalize
    const normalized = role.trim();
    
    // If it's already a principal role (case-insensitive), return the canonical form
    if (isPrincipalRole(normalized)) {
      // Find the matching canonical form from PRINCIPAL_ROLES
      const lowerNormalized = normalized.toLowerCase();
      const principalRoles = ['principal', 'school_principal', 'head_teacher', 'headmaster', 'headmistress', 'school_owner'];
      const match = principalRoles.find(r => r.toLowerCase() === lowerNormalized);
      return match || normalized.toLowerCase();
    }
    
    // For non-principal roles, replace spaces with underscores and lowercase
    return normalized.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Helper: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitize school data to prevent injection attacks and ensure data consistency
   */
  private sanitizeSchoolData(data: any): any {
    return {
      name: data.name ? this.sanitizeString(data.name, 2, 200) : undefined,
      subdomain: data.subdomain ? this.sanitizeSubdomain(data.subdomain) : undefined,
      domain: data.domain ? this.sanitizeString(data.domain, 0, 255) : undefined,
      address: data.address ? this.sanitizeString(data.address, 0, 500) : undefined,
      city: data.city ? this.sanitizeString(data.city, 0, 100) : undefined,
      state: data.state ? this.sanitizeString(data.state, 0, 100) : undefined,
      country: data.country ? this.sanitizeString(data.country, 0, 100) : undefined,
      phone: data.phone ? this.sanitizePhone(data.phone) : undefined,
      email: data.email ? this.sanitizeEmail(data.email) : undefined,
    };
  }

  /**
   * Sanitize principal data
   */
  private sanitizePrincipalData(data: any): any {
    return {
      firstName: this.sanitizeString(data.firstName, 2, 50),
      lastName: this.sanitizeString(data.lastName, 2, 50),
      email: this.sanitizeEmail(data.email),
      phone: this.sanitizePhone(data.phone),
    };
  }

  /**
   * Sanitize admin data
   */
  private sanitizeAdminData(data: any): any {
    return {
      firstName: this.sanitizeString(data.firstName, 2, 50),
      lastName: this.sanitizeString(data.lastName, 2, 50),
      email: this.sanitizeEmail(data.email),
      phone: this.sanitizePhone(data.phone),
      role: this.sanitizeString(data.role, 2, 50) || 'Administrator',
    };
  }

  /**
   * Sanitize string input - removes dangerous characters and trims
   */
  private sanitizeString(input: string, minLength: number = 0, maxLength: number = 1000): string {
    if (!input || typeof input !== 'string') {
      throw new BadRequestException('Invalid string input');
    }

    // Remove null bytes and control characters (except newlines and tabs)
    let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Remove HTML tags to prevent XSS
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // Validate length
    if (minLength > 0 && sanitized.length < minLength) {
      throw new BadRequestException(`Input must be at least ${minLength} characters`);
    }
    if (sanitized.length > maxLength) {
      throw new BadRequestException(`Input must be at most ${maxLength} characters`);
    }
    
    return sanitized;
  }

  /**
   * Sanitize email input
   */
  private sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('Invalid email input');
    }

    // Trim and lowercase
    const sanitized = email.trim().toLowerCase();
    
    // Validate email format
    if (!this.isValidEmail(sanitized)) {
      throw new BadRequestException('Invalid email format');
    }
    
    // Additional security: check for dangerous patterns
    if (sanitized.includes('..') || sanitized.includes('@.') || sanitized.includes('.@')) {
      throw new BadRequestException('Invalid email format');
    }
    
    return sanitized;
  }

  /**
   * Sanitize phone input
   */
  private sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      throw new BadRequestException('Invalid phone input');
    }

    // Remove all whitespace and special characters except + and digits
    let sanitized = phone.replace(/[^\d+]/g, '');
    
    // Validate phone format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(sanitized)) {
      throw new BadRequestException('Invalid phone format');
    }
    
    return sanitized;
  }

  /**
   * Sanitize subdomain input
   */
  private sanitizeSubdomain(subdomain: string): string {
    if (!subdomain || typeof subdomain !== 'string') {
      throw new BadRequestException('Invalid subdomain input');
    }

    // Convert to lowercase and replace spaces/special chars with hyphens
    let sanitized = subdomain.toLowerCase().trim();
    
    // Remove all characters except lowercase letters, numbers, and hyphens
    sanitized = sanitized.replace(/[^a-z0-9-]/g, '-');
    
    // Remove consecutive hyphens
    sanitized = sanitized.replace(/-+/g, '-');
    
    // Remove leading and trailing hyphens
    sanitized = sanitized.replace(/^-+|-+$/g, '');
    
    // Validate length
    if (sanitized.length < 3 || sanitized.length > 50) {
      throw new BadRequestException('Subdomain must be between 3 and 50 characters');
    }
    
    return sanitized;
  }

  /**
   * Generate subdomain from school name
   */
  private generateSubdomainFromName(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new BadRequestException('School name is required to generate subdomain');
    }

    // Convert to lowercase and replace spaces/special chars with hyphens
    let subdomain = name.toLowerCase().trim();
    
    // Remove all characters except lowercase letters, numbers, and hyphens
    subdomain = subdomain.replace(/[^a-z0-9-]/g, '-');
    
    // Remove consecutive hyphens
    subdomain = subdomain.replace(/-+/g, '-');
    
    // Remove leading and trailing hyphens
    subdomain = subdomain.replace(/^-+|-+$/g, '');
    
    // Truncate to 50 characters
    subdomain = subdomain.substring(0, 50);
    
    // Remove trailing hyphen if exists
    subdomain = subdomain.replace(/-+$/, '');
    
    // Ensure minimum length
    if (subdomain.length < 3) {
      subdomain = subdomain + '-school';
    }
    
    // Add timestamp suffix to ensure uniqueness if needed (will be checked later)
    return subdomain;
  }
}
