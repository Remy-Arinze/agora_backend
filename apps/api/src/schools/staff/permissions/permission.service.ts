import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EmailService } from '../../../email/email.service';
import {
  PermissionDto,
  PermissionResource,
  PermissionType,
  StaffPermissionsDto,
  isPrincipalRole,
} from '../../dto/permission.dto';
import { UserWithContext } from '../../../auth/types/user-with-context.type';

@Injectable()
export class PermissionService implements OnModuleInit {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async onModuleInit() {
    // Initialize default permissions on module startup
    await this.initializeDefaultPermissions();
  }

  /**
   * Get all available permissions
   */
  async getAllPermissions(): Promise<PermissionDto[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { type: 'asc' }],
    });

    return permissions.map((p) => ({
      id: p.id,
      resource: p.resource as PermissionResource,
      type: p.type as PermissionType,
      description: p.description || undefined,
    }));
  }

  /**
   * Get permissions for a specific admin
   */
  async getAdminPermissions(schoolId: string, adminId: string): Promise<StaffPermissionsDto> {
    const admin = await this.prisma.schoolAdmin.findFirst({
      where: {
        id: adminId,
        schoolId: schoolId,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return {
      adminId: admin.id,
      adminName: `${admin.firstName} ${admin.lastName}`,
      role: admin.role,
      permissions: admin.permissions.map((sp) => ({
        id: sp.permission.id,
        resource: sp.permission.resource as PermissionResource,
        type: sp.permission.type as PermissionType,
        description: sp.permission.description || undefined,
      })),
    };
  }

  /**
   * Assign permissions to an admin
   * Note: Principal permissions cannot be modified - they have permanent full access
   *
   * @param schoolId - The school ID
   * @param adminId - The target admin's ID
   * @param permissionIds - Array of permission IDs to assign
   * @param callerUser - The user making the request (for IDOR protection and audit)
   * @param callerIp - The IP address of the caller (for audit logging)
   */
  async assignPermissions(
    schoolId: string,
    adminId: string,
    permissionIds: string[],
    callerUser?: UserWithContext,
    callerIp?: string
  ): Promise<StaffPermissionsDto> {
    // Verify target admin exists
    const targetAdmin = await this.prisma.schoolAdmin.findFirst({
      where: {
        id: adminId,
        schoolId: schoolId,
      },
    });

    if (!targetAdmin) {
      throw new NotFoundException('Admin not found');
    }

    // Prevent modifying Principal permissions - they have permanent full access
    if (isPrincipalRole(targetAdmin.role)) {
      throw new BadRequestException(
        'Principal permissions cannot be modified. Principals have permanent full access to all school resources.'
      );
    }

    // IDOR Protection: Verify caller has authority to modify target's permissions
    if (callerUser && callerUser.role === 'SCHOOL_ADMIN') {
      const callerAdmin = await this.prisma.schoolAdmin.findFirst({
        where: {
          userId: callerUser.id,
          schoolId: schoolId,
        },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });

      if (!callerAdmin) {
        throw new ForbiddenException('You do not have access to this school');
      }

      // Principals can modify anyone's permissions
      const callerIsPrincipal = isPrincipalRole(callerAdmin.role);

      if (!callerIsPrincipal) {
        // Non-principals need STAFF:ADMIN permission to modify other admins' permissions
        const hasStaffAdmin = callerAdmin.permissions.some(
          (sp) =>
            sp.permission.resource === PermissionResource.STAFF &&
            sp.permission.type === PermissionType.ADMIN
        );

        if (!hasStaffAdmin) {
          throw new ForbiddenException(
            "You need STAFF:ADMIN permission to modify other administrators' permissions"
          );
        }

        // Non-principals cannot give permissions they don't have themselves
        const callerPermissionTypes = new Set(
          callerAdmin.permissions.map((sp) => `${sp.permission.resource}:${sp.permission.type}`)
        );

        // Get the permissions being assigned
        const permissionsToAssign = await this.prisma.permission.findMany({
          where: { id: { in: permissionIds } },
        });

        for (const perm of permissionsToAssign) {
          // ADMIN type can only be assigned by principals or those with ADMIN for that resource
          if (perm.type === PermissionType.ADMIN) {
            const hasResourceAdmin = callerPermissionTypes.has(
              `${perm.resource}:${PermissionType.ADMIN}`
            );
            if (!hasResourceAdmin) {
              throw new ForbiddenException(
                `You cannot assign ${perm.resource}:ADMIN permission as you don't have it yourself`
              );
            }
          }
        }
      }
    }

    // Verify all permissions exist
    const permissions = await this.prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions not found');
    }

    // Get current permissions for audit log (before change)
    const previousPermissions = await this.prisma.staffPermission.findMany({
      where: { adminId: adminId },
      include: { permission: true },
    });

    // Get school name for email
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });

    // Remove existing permissions and assign new ones
    await this.prisma.$transaction(async (tx) => {
      // Delete existing permissions
      await tx.staffPermission.deleteMany({
        where: {
          adminId: adminId,
        },
      });

      // Create new permissions
      if (permissionIds.length > 0) {
        await tx.staffPermission.createMany({
          data: permissionIds.map((permId) => ({
            adminId: adminId,
            permissionId: permId,
          })),
        });
      }
    });

    // Get updated permissions with details
    const updatedPermissions = await this.getAdminPermissions(schoolId, adminId);

    // Audit logging
    const previousPermIds = previousPermissions.map((p) => p.permission.id).sort();
    const newPermIds = permissionIds.sort();
    const added = permissionIds.filter((id) => !previousPermIds.includes(id));
    const removed = previousPermIds.filter((id) => !newPermIds.includes(id));

    this.logger.log({
      event: 'PERMISSION_CHANGE',
      timestamp: new Date().toISOString(),
      schoolId,
      targetAdminId: adminId,
      targetAdminName: `${targetAdmin.firstName} ${targetAdmin.lastName}`,
      targetAdminRole: targetAdmin.role,
      callerUserId: callerUser?.id || 'system',
      callerIp: callerIp || 'unknown',
      previousPermissionCount: previousPermissions.length,
      newPermissionCount: permissionIds.length,
      permissionsAdded: added.length,
      permissionsRemoved: removed.length,
      addedPermissionIds: added,
      removedPermissionIds: removed,
    });

    // Send email to admin if email exists
    if (targetAdmin.email && school && updatedPermissions.permissions.length > 0) {
      try {
        await this.emailService.sendPermissionAssignmentEmail(
          targetAdmin.email,
          `${targetAdmin.firstName} ${targetAdmin.lastName}`,
          updatedPermissions.permissions.map((p) => ({
            resource: p.resource,
            type: p.type,
            description: p.description,
          })),
          school.name
        );
      } catch (error) {
        this.logger.error('Failed to send permission assignment email:', error);
      }
    }

    return updatedPermissions;
  }

  /**
   * Check if admin has a specific permission
   */
  async hasPermission(
    adminId: string,
    resource: PermissionResource,
    type: PermissionType
  ): Promise<boolean> {
    // Check if admin has ADMIN permission (full access)
    const hasAdmin = await this.prisma.staffPermission.findFirst({
      where: {
        adminId: adminId,
        permission: {
          resource: resource,
          type: PermissionType.ADMIN,
        },
      },
    });

    if (hasAdmin) {
      return true; // ADMIN permission grants all access
    }

    // Check for specific permission
    const permission = await this.prisma.staffPermission.findFirst({
      where: {
        adminId: adminId,
        permission: {
          resource: resource,
          type: type,
        },
      },
    });

    return !!permission;
  }

  /**
   * Check if admin has admin permission (full access like principal)
   */
  async hasAdminPermission(adminId: string, resource: PermissionResource): Promise<boolean> {
    return this.hasPermission(adminId, resource, PermissionType.ADMIN);
  }

  /**
   * Initialize default permissions in the database
   * This should be called during app startup or migration
   */
  async initializeDefaultPermissions(): Promise<void> {
    const resources = Object.values(PermissionResource);
    const types = Object.values(PermissionType);

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
            description: this.getPermissionDescription(resource, type),
          },
          update: {},
        });
      }
    }
  }

  private getPermissionDescription(resource: PermissionResource, type: PermissionType): string {
    const resourceNames: Record<PermissionResource, string> = {
      OVERVIEW: 'Dashboard Overview',
      ANALYTICS: 'Analytics',
      SUBSCRIPTIONS: 'Subscriptions',
      STUDENTS: 'Students',
      STAFF: 'Staff',
      CLASSES: 'Classes',
      SUBJECTS: 'Subjects',
      TIMETABLES: 'Timetables',
      CALENDAR: 'Calendar',
      ADMISSIONS: 'Admissions',
      SESSIONS: 'Sessions',
      EVENTS: 'Events',
      GRADES: 'Grades',
      CURRICULUM: 'Curriculum',
      RESOURCES: 'Class Resources',
      TRANSFERS: 'Student Transfers',
      INTEGRATIONS: 'External Integrations',
    };

    const typeNames: Record<PermissionType, string> = {
      READ: 'Read',
      WRITE: 'Write',
      ADMIN: 'Admin',
    };

    return `${typeNames[type]} access to ${resourceNames[resource]}`;
  }

  /**
   * Migrate existing admins by assigning default READ permissions
   * This is for backward compatibility with accounts created before the permission system
   * Skips Principals (they have permanent full access) and admins who already have permissions
   */
  async migrateExistingAdmins(schoolId: string): Promise<{ migrated: number; skipped: number }> {
    // Get all READ permissions
    const readPermissions = await this.prisma.permission.findMany({
      where: { type: PermissionType.READ },
    });

    if (readPermissions.length === 0) {
      throw new BadRequestException(
        'No READ permissions found. Please initialize permissions first.'
      );
    }

    // Get all admins for this school
    const admins = await this.prisma.schoolAdmin.findMany({
      where: { schoolId },
      include: {
        permissions: true,
      },
    });

    let migrated = 0;
    let skipped = 0;

    for (const admin of admins) {
      // Skip principals - they have permanent full access
      if (isPrincipalRole(admin.role)) {
        skipped++;
        continue;
      }

      // Skip admins who already have permissions
      if (admin.permissions.length > 0) {
        skipped++;
        continue;
      }

      // Assign default READ permissions
      await this.prisma.staffPermission.createMany({
        data: readPermissions.map((perm) => ({
          adminId: admin.id,
          permissionId: perm.id,
        })),
        skipDuplicates: true,
      });

      migrated++;
    }

    return { migrated, skipped };
  }
}
