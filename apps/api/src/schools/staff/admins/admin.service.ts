import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../../../auth/auth.service';
import { SchoolRepository } from '../../domain/repositories/school.repository';
import { StaffRepository } from '../../domain/repositories/staff.repository';
import { StaffMapper } from '../../domain/mappers/staff.mapper';
import { IdGeneratorService } from '../../shared/id-generator.service';
import { StaffValidatorService } from '../../shared/staff-validator.service';
import { SubscriptionsService } from '../../../subscriptions/subscriptions.service';
import { AddAdminDto } from '../../dto/add-admin.dto';
import { UpdateAdminDto } from '../../dto/update-admin.dto';
import { CloudinaryService } from '../../../storage/cloudinary/cloudinary.service';
import { PermissionResource, PermissionType, isPrincipalRole } from '../../dto/permission.dto';
import { generateSecurePasswordHash } from '../../../common/utils/password.utils';

/**
 * Service for managing school administrators
 * Handles creating, updating, and deleting administrators
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly schoolRepository: SchoolRepository,
    private readonly staffRepository: StaffRepository,
    private readonly staffMapper: StaffMapper,
    private readonly idGenerator: IdGeneratorService,
    private readonly staffValidator: StaffValidatorService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly subscriptionsService: SubscriptionsService
  ) {}

  /**
   * Add an administrator to a school
   */
  async addAdmin(schoolId: string, adminData: AddAdminDto): Promise<any> {
    // Validate school exists
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check admin limit based on subscription tier
    const adminLimit = await this.subscriptionsService.checkAdminLimit(school.id);
    if (!adminLimit.canAdd) {
      throw new ForbiddenException(adminLimit.message);
    }

    // Validate staff data
    this.staffValidator.validateStaffData(adminData);

    // Validate email and phone are unique in school
    await this.staffValidator.validateEmailUniqueInSchool(adminData.email, school.id);
    await this.staffValidator.validatePhoneUniqueInSchool(adminData.phone, school.id);

    // Validate role - use strict principal role check
    const roleLower = adminData.role.trim().toLowerCase();
    const isPrincipal = isPrincipalRole(adminData.role);
    this.logger.log(
      `[addAdmin] Role: "${adminData.role}", isPrincipal: ${isPrincipal}, permissions: ${adminData.permissions?.length || 0}`
    );

    if (isPrincipal) {
      await this.staffValidator.validatePrincipalRole(school.id, adminData.role);
    }

    // Validate that the role is not teaching-related
    const teachingKeywords = [
      'teacher',
      'teaching',
      'instructor',
      'lecturer',
      'professor',
      'tutor',
      'educator',
    ];
    const isTeachingRole = teachingKeywords.some(
      (keyword) =>
        roleLower === keyword ||
        roleLower.includes(` ${keyword}`) ||
        roleLower.includes(`${keyword} `) ||
        roleLower.startsWith(keyword) ||
        roleLower.endsWith(keyword)
    );

    if (isTeachingRole) {
      throw new BadRequestException(
        'Cannot set a teaching role as an administrative role. Please use the "Add Teacher" option to add teachers.'
      );
    }

    const defaultPassword = await generateSecurePasswordHash();

    // Generate admin ID and public ID
    const adminId = isPrincipal
      ? await this.idGenerator.generatePrincipalId()
      : await this.idGenerator.generateAdminId();
    const publicId = await this.idGenerator.generatePublicId(school.name, 'admin');

    // Create user and admin in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      try {
        // Find or create user
        let adminUser = await tx.user.findUnique({
          where: { email: adminData.email },
        });

        if (!adminUser) {
          adminUser = await tx.user.create({
            data: {
              email: adminData.email,
              phone: adminData.phone,
              passwordHash: defaultPassword,
              accountStatus: 'SHADOW', // User needs to activate via email
              role: 'SCHOOL_ADMIN',
            },
          });
        } else {
          adminUser = await tx.user.update({
            where: { id: adminUser.id },
            data: {
              passwordHash: defaultPassword,
              // Don't change accountStatus if user already exists - they may already be active
              role: 'SCHOOL_ADMIN',
            },
          });
        }

        // Create admin - use transaction client directly
        const newAdmin = await tx.schoolAdmin.create({
          data: {
            adminId: adminId,
            publicId: publicId,
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            email: adminData.email,
            phone: adminData.phone,
            role: adminData.role.trim(),
            profileImage: adminData.profileImage || null,
            userId: adminUser.id,
            schoolId: school.id,
          },
          include: { user: true, school: true },
        });

        return { admin: newAdmin, user: adminUser };
      } catch (error: any) {
        if (error.code === 'P2002') {
          const target = error.meta?.target;
          if (Array.isArray(target) && target.includes('email')) {
            throw new ConflictException(`User with email ${adminData.email} already exists`);
          }
          if (Array.isArray(target) && target.includes('phone')) {
            throw new ConflictException(`User with phone number ${adminData.phone} already exists`);
          }
        }
        throw error;
      }
    });

    // Send password reset email
    try {
      await this.authService.sendPasswordResetForNewUser(
        result.user.id,
        adminData.email,
        `${adminData.firstName} ${adminData.lastName}`,
        isPrincipal ? 'Principal' : adminData.role,
        result.admin.publicId,
        result.admin.school.name
      );
    } catch (error) {
      this.logger.error('Failed to send password reset email to admin:', error);
    }

    // Assign permissions to new admin
    // Principals automatically have full access via PermissionGuard, so skip for them
    if (!isPrincipal) {
      try {
        if (adminData.permissions && adminData.permissions.length > 0) {
          // Use custom permissions provided in the request
          this.logger.log(
            `[addAdmin] Assigning ${adminData.permissions.length} custom permissions to admin ${result.admin.id}`
          );
          await this.assignCustomPermissions(result.admin.id, adminData.permissions);
        } else {
          // Fall back to default READ permissions for all resources
          this.logger.log(
            `[addAdmin] No custom permissions, assigning default READ permissions to admin ${result.admin.id}`
          );
          await this.assignDefaultReadPermissions(result.admin.id);
        }
      } catch (error) {
        this.logger.error(
          'Failed to assign permissions:',
          error instanceof Error ? error.stack : error
        );
        // Don't fail the request if permission assignment fails
      }
    } else {
      this.logger.log(`[addAdmin] Skipping permission assignment for Principal role`);
    }

    return this.staffMapper.toAdminDto(result.admin);
  }

  /**
   * Update an administrator
   */
  async updateAdmin(schoolId: string, adminId: string, updateData: UpdateAdminDto): Promise<any> {
    // Validate school exists
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate admin exists in school
    const admin = await this.staffRepository.findAdminById(adminId);
    if (!admin || admin.schoolId !== school.id) {
      throw new BadRequestException('Administrator not found in this school');
    }

    // Validate staff data if provided
    if (updateData.firstName || updateData.lastName || updateData.phone || updateData.role) {
      this.staffValidator.validateStaffData({
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        phone: updateData.phone,
        role: updateData.role,
      });
    }

    // Validate role if being updated - only check for exact "Principal" role
    if (updateData.role) {
      const roleLower = updateData.role.trim().toLowerCase();
      const isPrincipal = roleLower === 'principal'; // Only exact match, not contains

      if (isPrincipal) {
        // Check if another principal exists (excluding current admin) - exact match only
        const existingPrincipal = await this.prisma.schoolAdmin.findFirst({
          where: {
            schoolId: school.id,
            id: { not: adminId },
            role: { equals: 'Principal', mode: 'insensitive' },
          },
        });

        if (existingPrincipal) {
          throw new BadRequestException('School already has a principal');
        }
      }
    }

    // Update admin
    const updatedAdmin = await this.staffRepository.updateAdmin(adminId, {
      firstName: updateData.firstName,
      lastName: updateData.lastName,
      phone: updateData.phone,
      role: updateData.role,
      profileImage: updateData.profileImage,
    });

    return this.staffMapper.toAdminDto(updatedAdmin);
  }

  /**
   * Delete an administrator
   */
  async deleteAdmin(schoolId: string, adminId: string): Promise<void> {
    // Validate school exists
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate admin exists in school
    const admin = await this.staffRepository.findAdminById(adminId);
    if (!admin || admin.schoolId !== school.id) {
      throw new BadRequestException('Administrator not found in this school');
    }

    // Check if it's a principal - only exact match
    const roleLower = admin.role?.trim().toLowerCase() || '';
    const isPrincipal = roleLower === 'principal'; // Only exact match, not contains

    if (isPrincipal) {
      // Check if there are other admins to take over
      const otherAdmins = await this.staffRepository.findAdminsBySchool(school.id);
      const nonPrincipalAdmins = otherAdmins.filter(
        (a) => a.id !== adminId && a.role?.trim().toLowerCase() !== 'principal'
      );

      if (nonPrincipalAdmins.length === 0) {
        throw new BadRequestException(
          'Cannot delete principal without another administrator to assign the role to'
        );
      }
    }

    await this.staffRepository.deleteAdmin(adminId);
  }

  /**
   * Make an admin the principal (switches current principal to admin)
   */
  async makePrincipal(schoolId: string, adminId: string): Promise<void> {
    // Validate school exists
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate admin exists in school
    const adminToPromote = await this.staffRepository.findAdminById(adminId);
    if (!adminToPromote || adminToPromote.schoolId !== school.id) {
      throw new BadRequestException('Administrator not found in this school');
    }

    // Check if already principal - only exact match
    const roleLower = adminToPromote.role?.trim().toLowerCase() || '';
    const isAlreadyPrincipal = roleLower === 'principal'; // Only exact match, not contains

    if (isAlreadyPrincipal) {
      throw new BadRequestException('This administrator is already the principal');
    }

    await this.prisma.$transaction(async (tx) => {
      // Find and demote current principal - exact match only
      const currentPrincipal = await tx.schoolAdmin.findFirst({
        where: {
          schoolId: school.id,
          role: { equals: 'Principal', mode: 'insensitive' },
        },
      });

      if (currentPrincipal) {
        await tx.schoolAdmin.update({
          where: { id: currentPrincipal.id },
          data: { role: 'Administrator' },
        });
      }

      // Promote selected admin to Principal
      await tx.schoolAdmin.update({
        where: { id: adminId },
        data: { role: 'Principal' },
      });
    });
  }

  /**
   * Update a principal
   */
  async updatePrincipal(
    schoolId: string,
    principalId: string,
    updateData: { firstName?: string; lastName?: string; phone?: string }
  ): Promise<any> {
    // Validate school exists
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Find principal - exact match only
    const principal = await this.prisma.schoolAdmin.findFirst({
      where: {
        id: principalId,
        schoolId: school.id,
        role: { equals: 'Principal', mode: 'insensitive' },
      },
    });

    if (!principal) {
      throw new BadRequestException('Principal not found in this school');
    }

    // Update principal
    const updatedPrincipal = await this.staffRepository.updateAdmin(principalId, {
      firstName: updateData.firstName,
      lastName: updateData.lastName,
      phone: updateData.phone,
    });

    return this.staffMapper.toAdminDto(updatedPrincipal);
  }

  /**
   * Delete a principal
   */
  async deletePrincipal(schoolId: string, principalId: string): Promise<void> {
    // Validate school exists
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Find principal - exact match only
    const principal = await this.prisma.schoolAdmin.findFirst({
      where: {
        id: principalId,
        schoolId: school.id,
        role: { equals: 'Principal', mode: 'insensitive' },
      },
      include: { user: true },
    });

    if (!principal) {
      throw new BadRequestException('Principal not found in this school');
    }

    // Check if principal is active
    const isPrincipalActive = school.isActive && principal.user?.accountStatus === 'ACTIVE';

    if (isPrincipalActive) {
      throw new BadRequestException(
        'Cannot delete an active principal. You must first transfer the principal role to another administrator before deletion.'
      );
    }

    // Check for other admins
    const otherAdmins = await this.staffRepository.findAdminsBySchool(school.id);
    const nonPrincipalAdmins = otherAdmins.filter(
      (a) => a.id !== principalId && a.role?.trim().toLowerCase() !== 'principal'
    );

    if (nonPrincipalAdmins.length === 0) {
      throw new BadRequestException(
        'Cannot delete principal. There must be at least one other administrator to assign the principal role to before deletion.'
      );
    }

    await this.staffRepository.deleteAdmin(principalId);
  }

  /**
   * Convert a teacher to an admin
   */
  async convertTeacherToAdmin(
    schoolId: string,
    teacherId: string,
    role: string,
    keepAsTeacher: boolean
  ): Promise<void> {
    // Validate school exists
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check admin limit based on subscription tier
    const adminLimit = await this.subscriptionsService.checkAdminLimit(school.id);
    if (!adminLimit.canAdd) {
      throw new ForbiddenException(adminLimit.message);
    }

    // Validate teacher exists
    const teacher = await this.staffRepository.findTeacherById(teacherId);
    if (!teacher || teacher.schoolId !== school.id) {
      throw new BadRequestException('Teacher not found in this school');
    }

    // Check if already an admin in this school
    const existingAdmin = await this.prisma.schoolAdmin.findFirst({
      where: { userId: teacher.userId, schoolId: school.id },
    });

    if (existingAdmin) {
      throw new BadRequestException('This teacher is already an administrator in this school');
    }

    // Validate role - only check for exact "Principal" role
    const roleLower = role?.trim().toLowerCase() || '';
    const isPrincipal = roleLower === 'principal'; // Only exact match, not contains

    if (isPrincipal) {
      await this.staffValidator.validatePrincipalRole(school.id, role);
    }

    await this.prisma.$transaction(async (tx) => {
      // Generate admin ID and public ID
      const adminId = isPrincipal
        ? await this.idGenerator.generatePrincipalId()
        : await this.idGenerator.generateAdminId();
      const publicId = await this.idGenerator.generatePublicId(school.name, 'admin');

      // Create SchoolAdmin record
      await tx.schoolAdmin.create({
        data: {
          adminId,
          publicId,
          userId: teacher.userId,
          schoolId: school.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
          phone: teacher.phone,
          role: role.trim(),
        },
      });

      // Update User role to SCHOOL_ADMIN
      await tx.user.update({
        where: { id: teacher.userId },
        data: { role: 'SCHOOL_ADMIN' },
      });

      // Optionally delete teacher record if not keeping as teacher
      if (!keepAsTeacher) {
        await tx.teacher.delete({
          where: { id: teacherId },
        });
      }
    });
  }

  /**
   * Get an admin by ID
   */
  async getAdminById(schoolId: string, adminId: string): Promise<any | null> {
    const admin = await this.staffRepository.findAdminById(adminId);
    if (!admin || admin.schoolId !== schoolId) {
      return null;
    }
    return this.staffMapper.toAdminDto(admin);
  }

  /**
   * Upload admin profile image
   */
  async uploadProfileImage(
    schoolId: string,
    adminId: string,
    file: Express.Multer.File
  ): Promise<any> {
    // Validate school exists
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate admin exists in school
    const admin = await this.staffRepository.findAdminById(adminId);
    if (!admin || admin.schoolId !== school.id) {
      throw new NotFoundException('Admin not found in this school');
    }

    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed'
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum limit of 5MB');
    }

    // Delete old image if exists
    if (admin.profileImage) {
      const oldPublicId = this.cloudinaryService.extractPublicId(admin.profileImage);
      if (oldPublicId) {
        try {
          await this.cloudinaryService.deleteImage(oldPublicId);
        } catch (error) {
          console.error('Error deleting old profile image:', error);
          // Continue even if deletion fails
        }
      }
    }

    // Upload to Cloudinary
    const { url } = await this.cloudinaryService.uploadImage(
      file,
      `schools/${schoolId}/staff/admins`,
      `admin-${adminId}`
    );

    // Update admin with new image URL
    const updatedAdmin = await this.staffRepository.updateAdmin(adminId, {
      profileImage: url,
    });

    return this.staffMapper.toAdminDto(updatedAdmin);
  }

  /**
   * Assign default READ permissions to a new admin
   * This ensures new admins can at least view all dashboard screens
   */
  private async assignDefaultReadPermissions(adminId: string): Promise<void> {
    this.logger.log(`[assignDefaultReadPermissions] Starting for admin ${adminId}`);

    // Get all READ permissions
    let readPermissions = await this.prisma.permission.findMany({
      where: {
        type: PermissionType.READ,
      },
    });

    this.logger.log(
      `[assignDefaultReadPermissions] Found ${readPermissions.length} READ permissions in database`
    );

    if (readPermissions.length === 0) {
      this.logger.warn(
        '[assignDefaultReadPermissions] No READ permissions found in database! Initializing...'
      );
      await this.initializePermissions();

      // Try again
      readPermissions = await this.prisma.permission.findMany({
        where: { type: PermissionType.READ },
      });

      if (readPermissions.length === 0) {
        this.logger.error(
          '[assignDefaultReadPermissions] Still no permissions after initialization!'
        );
        return;
      }
    }

    // Assign all READ permissions to the admin
    const result = await this.prisma.staffPermission.createMany({
      data: readPermissions.map((perm) => ({
        adminId: adminId,
        permissionId: perm.id,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `[assignDefaultReadPermissions] Created ${result.count} permission assignments for admin ${adminId}`
    );
  }

  /**
   * Assign custom permissions to a new admin
   */
  private async assignCustomPermissions(
    adminId: string,
    permissions: Array<{ resource: PermissionResource; type: PermissionType }>
  ): Promise<void> {
    this.logger.log(
      `[assignCustomPermissions] Starting for admin ${adminId} with ${permissions.length} permissions`
    );

    if (permissions.length === 0) {
      this.logger.warn(
        '[assignCustomPermissions] Empty permissions array, falling back to defaults'
      );
      await this.assignDefaultReadPermissions(adminId);
      return;
    }

    // Build query conditions for all requested permissions
    const permissionConditions = permissions.map((p) => ({
      resource: p.resource as PermissionResource,
      type: p.type as PermissionType,
    }));

    this.logger.log(
      `[assignCustomPermissions] Looking for ${permissionConditions.length} permissions`
    );

    // Fetch matching permissions from the database
    const dbPermissions = await this.prisma.permission.findMany({
      where: {
        OR: permissionConditions,
      },
    });

    this.logger.log(
      `[assignCustomPermissions] Found ${dbPermissions.length} matching permissions in database`
    );

    if (dbPermissions.length === 0) {
      this.logger.warn(
        '[assignCustomPermissions] No matching permissions found! Initializing and retrying...'
      );
      await this.initializePermissions();

      // Retry
      const retryPermissions = await this.prisma.permission.findMany({
        where: { OR: permissionConditions },
      });

      if (retryPermissions.length === 0) {
        this.logger.error('[assignCustomPermissions] Still no permissions after initialization!');
        return;
      }

      const result = await this.prisma.staffPermission.createMany({
        data: retryPermissions.map((perm) => ({
          adminId: adminId,
          permissionId: perm.id,
        })),
        skipDuplicates: true,
      });

      this.logger.log(
        `[assignCustomPermissions] Created ${result.count} permission assignments (after init)`
      );
      return;
    }

    // Create permission assignments
    const result = await this.prisma.staffPermission.createMany({
      data: dbPermissions.map((perm) => ({
        adminId: adminId,
        permissionId: perm.id,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `[assignCustomPermissions] Created ${result.count} permission assignments for admin ${adminId}`
    );
  }

  /**
   * Initialize permissions in the database
   */
  private async initializePermissions(): Promise<void> {
    const resources = Object.values(PermissionResource);
    const types = Object.values(PermissionType);

    this.logger.log(
      `[initializePermissions] Creating ${resources.length * types.length} permissions...`
    );

    for (const resource of resources) {
      for (const type of types) {
        await this.prisma.permission.upsert({
          where: {
            resource_type: {
              resource: resource,
              type: type,
            },
          },
          create: {
            resource: resource,
            type: type,
            description: `${type} access to ${resource}`,
          },
          update: {},
        });
      }
    }

    this.logger.log(`[initializePermissions] Done`);
  }
}
