import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { CreateSchoolDto, AdminRole } from './dto/create-school.dto';
import { SchoolDto } from './dto/school.dto';
import { AddAdminDto } from './dto/add-admin.dto';
import { AddTeacherDto } from './dto/add-teacher.dto';
import { ConvertTeacherToAdminDto } from './dto/convert-teacher-to-admin.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { PermissionResource, PermissionType, isPrincipalRole } from './dto/permission.dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Generate a unique school ID
   */
  private async generateSchoolId(): Promise<string> {
    let schoolId: string = '';
    let exists = true;

    while (exists) {
      // Generate format: AG-SCH-{UUID}
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
   */
  private async generatePrincipalId(): Promise<string> {
    let principalId: string = '';
    let exists = true;

    while (exists) {
      // Generate format: AG-PR-{UUID}
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
   */
  private async generateAdminId(): Promise<string> {
    let adminId: string = '';
    let exists = true;

    while (exists) {
      // Generate format: AG-AD-{UUID}
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
   */
  private async generateTeacherId(): Promise<string> {
    let teacherId: string = '';
    let exists = true;

    while (exists) {
      // Generate format: AG-TE-{UUID}
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
   */
  private generateShortId(): string {
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
  private shortenSchoolName(schoolName: string): string {
    // Remove common words and special characters
    const cleaned = schoolName
      .toUpperCase()
      .replace(/\b(SCHOOL|ACADEMY|COLLEGE|UNIVERSITY|INSTITUTE|SECONDARY|PRIMARY|HIGH)\b/gi, '')
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 4);
    
    // If too short, pad with first letters
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
   * Generate a unique public ID for admin/teacher
   * Format: AG-{schoolname shortened}-{short alphanumeric}
   */
  private async generatePublicId(schoolName: string, type: 'admin' | 'teacher'): Promise<string> {
    let publicId: string = '';
    let exists = true;
    const schoolShort = this.shortenSchoolName(schoolName);

    while (exists) {
      const shortId = this.generateShortId();
      publicId = `AG-${schoolShort}-${shortId}`;
      
      // Check if it exists in either SchoolAdmin or Teacher
      const adminExists = await this.prisma.schoolAdmin.findFirst({
        where: { publicId },
      });
      const teacherExists = await this.prisma.teacher.findFirst({
        where: { publicId },
      });
      
      exists = !!(adminExists || teacherExists);
    }

    return publicId;
  }

  /**
   * Create a school with optional principal and admins
   */
  async createSchool(createSchoolDto: CreateSchoolDto): Promise<SchoolDto> {
    const { principal, admins, levels, ...schoolData } = createSchoolDto;

    // Check if subdomain already exists
    const existingSchool = await this.prisma.school.findUnique({
      where: { subdomain: schoolData.subdomain },
    });

    if (existingSchool) {
      throw new ConflictException('School with this subdomain already exists');
    }

    // Generate unique school ID
    const schoolId = await this.generateSchoolId();

    // Generate principal ID and public ID if principal is provided
    const principalId = principal ? await this.generatePrincipalId() : null;
    const principalPublicId = principal ? await this.generatePublicId(schoolData.name, 'admin') : null;

    // Generate admin IDs and public IDs for additional admins before transaction
    const adminIds: string[] = [];
    const adminPublicIds: string[] = [];
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        const roleLower = admin.role?.toLowerCase() || '';
        const isPrincipal = roleLower === 'principal' || roleLower.includes('principal');
        if (isPrincipal) {
          adminIds.push(await this.generatePrincipalId());
        } else {
          adminIds.push(await this.generateAdminId());
        }
        adminPublicIds.push(await this.generatePublicId(schoolData.name, 'admin'));
      }
    }

    // Generate default password for admins
    const defaultPassword = await bcrypt.hash('ChangeMe123!', 10);

    try {
      // Create school with admins in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create school
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
        const emailQueue: Array<{ userId: string; email: string; name: string; role: string; publicId: string }> = [];

        // Create principal if provided
        if (principal) {
          // Find or create user for principal (allow reusing existing User across schools)
          let principalUser = await tx.user.findUnique({
            where: { email: principal.email },
          });

          if (!principalUser) {
            // Create new user if doesn't exist
            principalUser = await tx.user.create({
              data: {
                email: principal.email,
                phone: principal.phone,
                passwordHash: defaultPassword,
                accountStatus: 'SHADOW', // User needs to activate via email
                role: 'SCHOOL_ADMIN',
              },
            });
          } else {
            // User exists, update password but don't change accountStatus
            principalUser = await tx.user.update({
              where: { id: principalUser.id },
              data: {
                passwordHash: defaultPassword,
                role: 'SCHOOL_ADMIN',
              },
            });
          }

          // Create principal admin (adminId and publicId generated before transaction)
          const principalAdmin = await tx.schoolAdmin.create({
            data: {
              adminId: principalId, // Generated before transaction
              publicId: principalPublicId!, // Generated before transaction
              firstName: principal.firstName,
              lastName: principal.lastName,
              email: principal.email,
              phone: principal.phone,
              role: 'Principal',
              userId: principalUser.id,
              schoolId: newSchool.id,
            },
          });

          createdAdmins.push(principalAdmin);
          emailQueue.push({
            userId: principalUser.id,
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

            // Check if role already exists for this school (especially for PRINCIPAL)
            const roleLower = admin.role?.toLowerCase() || '';
            const isPrincipal = roleLower === 'principal' || roleLower.includes('principal');
            if (isPrincipal) {
              const existingPrincipal = await tx.schoolAdmin.findFirst({
                where: {
                  schoolId: newSchool.id,
                  role: { contains: 'principal', mode: 'insensitive' },
                },
              });

              if (existingPrincipal) {
                throw new BadRequestException(
                  'School already has a principal. Use a different role.'
                );
              }
            }

            // Find or create user for admin (allow reusing existing User across schools)
            let adminUser = await tx.user.findUnique({
              where: { email: admin.email },
            });

            if (!adminUser) {
              // Create new user if doesn't exist
              adminUser = await tx.user.create({
                data: {
                  email: admin.email,
                  phone: admin.phone,
                  passwordHash: defaultPassword,
                  accountStatus: 'SHADOW', // User needs to activate via email
                  role: 'SCHOOL_ADMIN',
                },
              });
            } else {
              // User exists, update password but don't change accountStatus
              adminUser = await tx.user.update({
                where: { id: adminUser.id },
                data: {
                  passwordHash: defaultPassword,
                  role: 'SCHOOL_ADMIN',
                },
              });
            }

            // Create admin with pre-generated IDs
            const newAdmin = await tx.schoolAdmin.create({
              data: {
                adminId: adminId,
                publicId: adminPublicIds[i], // Generated before transaction
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
                phone: admin.phone,
                role: admin.role,
                userId: adminUser.id,
                schoolId: newSchool.id,
              },
            });

            createdAdmins.push(newAdmin);
            emailQueue.push({
              userId: adminUser.id,
              email: admin.email,
              name: `${admin.firstName} ${admin.lastName}`,
              role: isPrincipal ? 'Principal' : admin.role || 'Administrator',
              publicId: adminPublicIds[i],
            });
          }
        }

        return { school: newSchool, admins: createdAdmins, emailQueue };
      });

      // Send password reset emails (outside transaction to avoid blocking)
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
          this.logger.error(`Failed to send password reset email to ${emailData.email}:`, error instanceof Error ? error.stack : error);
          // Don't fail the request if email fails
        }
      }

      // Fetch complete school data with relations
      const completeSchool = await this.prisma.school.findUnique({
        where: { id: result.school.id },
        include: {
          admins: {
            include: {
              user: true,
            },
            orderBy: {
              role: 'asc',
            },
          },
          teachers: true,
        },
      });

      if (!completeSchool) {
        throw new BadRequestException('Failed to retrieve created school');
      }

      return {
        id: completeSchool.id,
        schoolId: completeSchool.schoolId,
        name: completeSchool.name,
        subdomain: completeSchool.subdomain,
        domain: completeSchool.domain,
        address: completeSchool.address,
        city: completeSchool.city,
        state: completeSchool.state,
        country: completeSchool.country,
        phone: completeSchool.phone,
        email: completeSchool.email,
        isActive: completeSchool.isActive,
        createdAt: completeSchool.createdAt,
        admins: completeSchool.admins.map((admin) => ({
          id: admin.id,
          adminId: admin.adminId,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
        role: admin.role, // Role is now stored as string
        createdAt: admin.createdAt,
      })),
      teachersCount: completeSchool.teachers.length,
    };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create school: ' + error.message);
    }
  }

  /**
   * Update a school
   */
  async updateSchool(id: string, updateSchoolDto: UpdateSchoolDto): Promise<SchoolDto> {
    const { levels, ...schoolData } = updateSchoolDto;

    // Check if school exists
    const existingSchool = await this.prisma.school.findUnique({
      where: { id },
    });

    if (!existingSchool) {
      throw new BadRequestException('School not found');
    }

    // Check if subdomain is being changed and if it already exists
    if (schoolData.subdomain && schoolData.subdomain !== existingSchool.subdomain) {
      const subdomainExists = await this.prisma.school.findUnique({
        where: { subdomain: schoolData.subdomain },
      });

      if (subdomainExists) {
        throw new ConflictException('School with this subdomain already exists');
      }
    }

    // Update school
    const updatedSchool = await this.prisma.school.update({
      where: { id },
      data: {
        ...schoolData,
        hasPrimary: levels?.primary !== undefined ? levels.primary : existingSchool.hasPrimary,
        hasSecondary: levels?.secondary !== undefined ? levels.secondary : existingSchool.hasSecondary,
        hasTertiary: levels?.tertiary !== undefined ? levels.tertiary : existingSchool.hasTertiary,
      },
      include: {
        admins: {
          include: {
            user: true,
          },
          orderBy: {
            role: 'asc',
          },
        },
        teachers: true,
        enrollments: {
          where: {
            isActive: true,
          },
        },
      },
    });

    return {
      id: updatedSchool.id,
      schoolId: updatedSchool.schoolId,
      name: updatedSchool.name,
      subdomain: updatedSchool.subdomain,
      domain: updatedSchool.domain,
      address: updatedSchool.address,
      city: updatedSchool.city,
      state: updatedSchool.state,
      country: updatedSchool.country,
      phone: updatedSchool.phone,
      email: updatedSchool.email,
      isActive: updatedSchool.isActive,
      hasPrimary: updatedSchool.hasPrimary,
      hasSecondary: updatedSchool.hasSecondary,
      hasTertiary: updatedSchool.hasTertiary,
      createdAt: updatedSchool.createdAt,
      admins: updatedSchool.admins.map((admin) => ({
        id: admin.id,
        adminId: admin.adminId,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        phone: admin.phone,
        role: admin.role, // Role is now stored as string
        createdAt: admin.createdAt,
      })),
      teachersCount: updatedSchool.teachers.length,
      studentsCount: updatedSchool.enrollments.length,
      teachers: updatedSchool.teachers.map((teacher) => ({
        id: teacher.id,
        teacherId: teacher.teacherId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        phone: teacher.phone,
        employeeId: teacher.employeeId,
        subject: teacher.subject,
        isTemporary: teacher.isTemporary,
        createdAt: teacher.createdAt,
      })),
    };
  }

  /**
   * Get all schools
   */
  async findAll(): Promise<SchoolDto[]> {
    const schools = await this.prisma.school.findMany({
      include: {
        admins: {
          include: {
            user: true,
          },
          orderBy: {
            role: 'asc',
          },
        },
        teachers: true,
        enrollments: {
          where: {
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return schools.map((school) => ({
      id: school.id,
      schoolId: school.schoolId,
      name: school.name,
      subdomain: school.subdomain,
      domain: school.domain,
      address: school.address,
      city: school.city,
      state: school.state,
      country: school.country,
      phone: school.phone,
      email: school.email,
      isActive: school.isActive,
      hasPrimary: school.hasPrimary,
      hasSecondary: school.hasSecondary,
      hasTertiary: school.hasTertiary,
      createdAt: school.createdAt,
      admins: school.admins.map((admin) => ({
        id: admin.id,
        adminId: admin.adminId,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        phone: admin.phone,
        role: admin.role, // Role is now stored as string
        createdAt: admin.createdAt,
      })),
      teachersCount: school.teachers.length,
      studentsCount: school.enrollments.length,
      teachers: school.teachers.map((teacher) => ({
        id: teacher.id,
        teacherId: teacher.teacherId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        phone: teacher.phone,
        employeeId: teacher.employeeId,
        subject: teacher.subject,
        isTemporary: teacher.isTemporary,
        createdAt: teacher.createdAt,
      })),
    }));
  }

  /**
   * Get school by ID (database ID) or subdomain
   */
  async findOne(id: string): Promise<SchoolDto> {
    // Try to find by database ID first, then by subdomain
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { id },
          { subdomain: id },
        ],
      },
      include: {
        admins: {
          include: {
            user: true,
          },
          orderBy: {
            role: 'asc',
          },
        },
        teachers: true,
      },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    return {
      id: school.id,
      schoolId: school.schoolId,
      name: school.name,
      subdomain: school.subdomain,
      domain: school.domain,
      address: school.address,
      city: school.city,
      state: school.state,
      country: school.country,
      phone: school.phone,
      email: school.email,
      isActive: school.isActive,
      hasPrimary: school.hasPrimary,
      hasSecondary: school.hasSecondary,
      hasTertiary: school.hasTertiary,
      createdAt: school.createdAt,
      admins: school.admins.map((admin) => ({
        id: admin.id,
        adminId: admin.adminId,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        phone: admin.phone,
        role: admin.role, // Role is now stored as string
        createdAt: admin.createdAt,
      })),
      teachersCount: school.teachers.length,
      teachers: school.teachers.map((teacher) => ({
        id: teacher.id,
        teacherId: teacher.teacherId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        phone: teacher.phone,
        employeeId: teacher.employeeId,
        subject: teacher.subject,
        isTemporary: teacher.isTemporary,
        createdAt: teacher.createdAt,
      })),
    };
  }

  /**
   * Add an administrator to a school
   */
  async addAdmin(schoolId: string, adminData: AddAdminDto): Promise<any> {
    // Log incoming data for debugging
    this.logger.log(`[AddAdmin] Received request for school ${schoolId}`);
    this.logger.log(`[AddAdmin] Admin data: role="${adminData.role}", permissions=${adminData.permissions?.length || 0} items`);
    if (adminData.permissions && adminData.permissions.length > 0) {
      this.logger.log(`[AddAdmin] First 3 permissions: ${JSON.stringify(adminData.permissions.slice(0, 3))}`);
    }
    
    // Support both database ID and subdomain
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { id: schoolId },
          { subdomain: schoolId },
        ],
      },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check if email already exists in THIS school (as admin or teacher)
    const existingAdminInSchool = await this.prisma.schoolAdmin.findFirst({
      where: {
        schoolId: schoolId,
        email: adminData.email,
      },
    });

    if (existingAdminInSchool) {
      throw new ConflictException(
        `An administrator with email ${adminData.email} already exists in this school`
      );
    }

    const existingTeacherInSchool = await this.prisma.teacher.findFirst({
      where: {
        schoolId: schoolId,
        email: adminData.email,
      },
    });

    if (existingTeacherInSchool) {
      throw new ConflictException(
        `A teacher with email ${adminData.email} already exists in this school`
      );
    }

    // Check if phone already exists in THIS school
    const existingAdminByPhone = await this.prisma.schoolAdmin.findFirst({
      where: {
        schoolId: schoolId,
        phone: adminData.phone,
      },
    });

    if (existingAdminByPhone) {
      throw new ConflictException(
        `An administrator with phone number ${adminData.phone} already exists in this school`
      );
    }

    const existingTeacherByPhone = await this.prisma.teacher.findFirst({
      where: {
        schoolId: schoolId,
        phone: adminData.phone,
      },
    });

    if (existingTeacherByPhone) {
      throw new ConflictException(
        `A teacher with phone number ${adminData.phone} already exists in this school`
      );
    }

    // Note: We removed the unique constraint on userId to allow a user to be admin in multiple schools
    // The check above (existingAdminInSchool) already ensures they're not an admin in THIS school

    // Validate that the role is not teaching-related
    const roleLower = adminData.role.trim().toLowerCase();
    const teachingKeywords = ['teacher', 'teaching', 'instructor', 'lecturer', 'professor', 'tutor', 'educator'];
    
    const isTeachingRole = teachingKeywords.some(keyword => 
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

    // Store role as-is (formatted by frontend)
    const roleToStore = adminData.role.trim();
    
    // Check if role is PRINCIPAL using strict match (exact match for security)
    // This ensures roles like "Vice Principal" don't get treated as principal
    const isPrincipal = isPrincipalRole(roleToStore);
    
    this.logger.log(`[AddAdmin] Role: "${roleToStore}", isPrincipal: ${isPrincipal}`);
    
    if (isPrincipal) {
      // Check for existing principal - use exact match for validation
      const existingPrincipal = await this.prisma.schoolAdmin.findFirst({
        where: {
          schoolId: schoolId,
          role: { equals: 'Principal', mode: 'insensitive' },
        },
      });

      if (existingPrincipal) {
        throw new BadRequestException('School already has a principal');
      }
    }

    const defaultPassword = await bcrypt.hash('Password123!', 10);

    // Generate admin ID and public ID based on role
    const adminId = isPrincipal 
      ? await this.generatePrincipalId()
      : await this.generateAdminId();
    const publicId = await this.generatePublicId(school.name, 'admin');

    // Create user and admin in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      try {
        // Find or create user (allow reusing existing User across schools)
        let adminUser = await tx.user.findUnique({
          where: { email: adminData.email },
        });

        if (!adminUser) {
          // Create new user if doesn't exist
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
          // User exists - update password but don't change accountStatus
          // Note: User can now be admin in multiple schools, so we don't check for existing SchoolAdmin
          adminUser = await tx.user.update({
            where: { id: adminUser.id },
            data: {
              passwordHash: defaultPassword,
              role: 'SCHOOL_ADMIN',
            },
          });
        }

            const newAdmin = await tx.schoolAdmin.create({
              data: {
                adminId: adminId,
                publicId: publicId,
                firstName: adminData.firstName,
                lastName: adminData.lastName,
                email: adminData.email,
                phone: adminData.phone,
                role: roleToStore, // Store role as-is
                userId: adminUser.id,
                schoolId: schoolId,
              },
            });

        return { admin: newAdmin, user: adminUser };
      } catch (error: any) {
        // Handle Prisma unique constraint violations
        if (error.code === 'P2002') {
          const target = error.meta?.target;
          if (Array.isArray(target) && target.includes('email')) {
            throw new ConflictException(`User with email ${adminData.email} already exists`);
          }
          if (Array.isArray(target) && target.includes('phone')) {
            throw new ConflictException(`User with phone number ${adminData.phone} already exists`);
          }
          if (Array.isArray(target) && target.includes('adminId')) {
            // Retry with new ID (shouldn't happen, but handle it)
            throw new ConflictException('Admin ID conflict. Please try again.');
          }
        }
        throw error;
      }
    });

    // Send password reset email to admin (outside transaction)
    try {
      await this.authService.sendPasswordResetForNewUser(
        result.user.id,
        adminData.email,
        `${adminData.firstName} ${adminData.lastName}`,
        isPrincipal ? 'Principal' : roleToStore,
        result.admin.publicId,
        school.name
      );
    } catch (error) {
      this.logger.error('Failed to send password reset email to admin:', error instanceof Error ? error.stack : error);
      // Don't fail the request if email fails
    }

    // Assign permissions to new admin
    // Principals automatically have full access via PermissionGuard, so skip for them
    this.logger.log(`[AddAdmin] isPrincipal: ${isPrincipal}, permissions provided: ${adminData.permissions?.length || 0}`);
    
    if (!isPrincipal) {
      try {
        if (adminData.permissions && adminData.permissions.length > 0) {
          // Use custom permissions provided in the request
          this.logger.log(`[AddAdmin] Assigning ${adminData.permissions.length} custom permissions to admin ${result.admin.id}`);
          await this.assignCustomPermissions(result.admin.id, adminData.permissions);
        } else {
          // Fall back to default READ permissions for all resources
          this.logger.log(`[AddAdmin] No custom permissions, assigning default READ permissions to admin ${result.admin.id}`);
          await this.assignDefaultReadPermissions(result.admin.id);
        }
      } catch (error) {
        this.logger.error('Failed to assign permissions:', error instanceof Error ? error.stack : error);
        // Don't fail the request if permission assignment fails
      }
    } else {
      this.logger.log(`[AddAdmin] Skipping permission assignment for Principal role`);
    }
    
    return {
      id: result.admin.id,
      adminId: result.admin.adminId,
      firstName: result.admin.firstName,
      lastName: result.admin.lastName,
      email: result.admin.email,
      phone: result.admin.phone,
      role: result.admin.role,
      createdAt: result.admin.createdAt,
    };
  }

  /**
   * Assign default READ permissions to a new admin
   * This ensures new admins can at least view all dashboard screens
   */
  private async assignDefaultReadPermissions(adminId: string): Promise<void> {
    this.logger.log(`[assignDefaultReadPermissions] Starting for admin ${adminId}`);
    
    // Get all READ permissions
    const readPermissions = await this.prisma.permission.findMany({
      where: {
        type: PermissionType.READ,
      },
    });

    this.logger.log(`[assignDefaultReadPermissions] Found ${readPermissions.length} READ permissions in database`);

    if (readPermissions.length === 0) {
      this.logger.warn('[assignDefaultReadPermissions] No READ permissions found in database! Permissions may not be initialized.');
      // Try to initialize permissions on the fly
      this.logger.log('[assignDefaultReadPermissions] Attempting to initialize permissions...');
      await this.initializePermissionsIfNeeded();
      
      // Try again
      const retryPermissions = await this.prisma.permission.findMany({
        where: { type: PermissionType.READ },
      });
      
      if (retryPermissions.length === 0) {
        this.logger.error('[assignDefaultReadPermissions] Still no permissions after initialization attempt!');
        return;
      }
      
      // Use the newly found permissions
      await this.prisma.staffPermission.createMany({
        data: retryPermissions.map((perm) => ({
          adminId: adminId,
          permissionId: perm.id,
        })),
        skipDuplicates: true,
      });
      
      this.logger.log(`[assignDefaultReadPermissions] Assigned ${retryPermissions.length} default READ permissions to admin ${adminId} (after init)`);
      return;
    }

    // Assign all READ permissions to the admin
    const result = await this.prisma.staffPermission.createMany({
      data: readPermissions.map((perm) => ({
        adminId: adminId,
        permissionId: perm.id,
      })),
      skipDuplicates: true, // In case any already exist
    });

    this.logger.log(`[assignDefaultReadPermissions] Created ${result.count} permission assignments for admin ${adminId}`);
  }

  /**
   * Initialize permissions if they don't exist
   */
  private async initializePermissionsIfNeeded(): Promise<void> {
    const count = await this.prisma.permission.count();
    if (count > 0) {
      return; // Already initialized
    }

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
            description: `${type} access to ${resource}`,
          },
          update: {},
        });
      }
    }

    this.logger.log(`[initializePermissionsIfNeeded] Initialized ${resources.length * types.length} permissions`);
  }

  /**
   * Assign custom permissions to a new admin
   * Used when the admin creator specifies specific permissions during creation
   */
  private async assignCustomPermissions(
    adminId: string,
    permissions: Array<{ resource: PermissionResource; type: PermissionType }>
  ): Promise<void> {
    this.logger.log(`[assignCustomPermissions] Starting for admin ${adminId} with ${permissions.length} permissions`);
    
    if (permissions.length === 0) {
      this.logger.warn('[assignCustomPermissions] Empty permissions array provided, skipping.');
      return;
    }

    // Build query conditions for all requested permissions
    const permissionConditions = permissions.map((p) => ({
      resource: p.resource,
      type: p.type,
    }));

    this.logger.log(`[assignCustomPermissions] Looking for permissions:`, JSON.stringify(permissionConditions.slice(0, 5)));

    // Fetch matching permissions from the database
    const dbPermissions = await this.prisma.permission.findMany({
      where: {
        OR: permissionConditions,
      },
    });

    this.logger.log(`[assignCustomPermissions] Found ${dbPermissions.length} matching permissions in database`);

    if (dbPermissions.length === 0) {
      this.logger.warn('[assignCustomPermissions] No matching permissions found in database!');
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

    this.logger.log(`[assignCustomPermissions] Created ${result.count} permission assignments for admin ${adminId}`);
  }

  /**
   * Add a teacher to a school
   */
  async addTeacher(schoolId: string, teacherData: AddTeacherDto): Promise<any> {
    // Support both database ID and subdomain
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { id: schoolId },
          { subdomain: schoolId },
        ],
      },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check if email already exists in THIS school (as admin or teacher)
    const existingAdminInSchool = await this.prisma.schoolAdmin.findFirst({
      where: {
        schoolId: schoolId,
        email: teacherData.email,
      },
    });

    if (existingAdminInSchool) {
      throw new ConflictException(
        `An administrator with email ${teacherData.email} already exists in this school`
      );
    }

    const existingTeacherInSchool = await this.prisma.teacher.findFirst({
      where: {
        schoolId: schoolId,
        email: teacherData.email,
      },
    });

    if (existingTeacherInSchool) {
      throw new ConflictException(
        `A teacher with email ${teacherData.email} already exists in this school`
      );
    }

    // Check if phone already exists in THIS school
    const existingAdminByPhone = await this.prisma.schoolAdmin.findFirst({
      where: {
        schoolId: schoolId,
        phone: teacherData.phone,
      },
    });

    if (existingAdminByPhone) {
      throw new ConflictException(
        `An administrator with phone number ${teacherData.phone} already exists in this school`
      );
    }

    const existingTeacherByPhone = await this.prisma.teacher.findFirst({
      where: {
        schoolId: schoolId,
        phone: teacherData.phone,
      },
    });

    if (existingTeacherByPhone) {
      throw new ConflictException(
        `A teacher with phone number ${teacherData.phone} already exists in this school`
      );
    }

    const defaultPassword = await bcrypt.hash('Password123!', 10);

    // Generate teacher ID and public ID
    const teacherId = await this.generateTeacherId();
    const publicId = await this.generatePublicId(school.name, 'teacher');

    // Create user and teacher in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      try {
        // Find or create user (allow reusing existing User across schools)
        let teacherUser = await tx.user.findUnique({
          where: { email: teacherData.email },
        });

        if (!teacherUser) {
          // Create new user if doesn't exist
          teacherUser = await tx.user.create({
            data: {
              email: teacherData.email,
              phone: teacherData.phone,
              passwordHash: defaultPassword,
              accountStatus: 'SHADOW', // User needs to activate via email
              role: 'TEACHER',
            },
          });
        } else {
          // User exists, update password but don't change accountStatus
          teacherUser = await tx.user.update({
            where: { id: teacherUser.id },
            data: {
              passwordHash: defaultPassword,
              role: 'TEACHER',
            },
          });
        }

        const newTeacher = await tx.teacher.create({
          data: {
            teacherId: teacherId,
            publicId: publicId,
            firstName: teacherData.firstName,
            lastName: teacherData.lastName,
            email: teacherData.email,
            phone: teacherData.phone,
            subject: teacherData.subject || null,
            isTemporary: teacherData.isTemporary || false,
            employeeId: teacherData.employeeId || null,
            userId: teacherUser.id,
            schoolId: schoolId,
          },
        });

        return { teacher: newTeacher, user: teacherUser };
      } catch (error: any) {
        // Handle Prisma unique constraint violations
        if (error.code === 'P2002') {
          const target = error.meta?.target;
          if (Array.isArray(target) && target.includes('email')) {
            throw new ConflictException(`User with email ${teacherData.email} already exists`);
          }
          if (Array.isArray(target) && target.includes('phone')) {
            throw new ConflictException(`User with phone number ${teacherData.phone} already exists`);
          }
          if (Array.isArray(target) && target.includes('teacherId')) {
            // Retry with new ID (shouldn't happen, but handle it)
            throw new ConflictException('Teacher ID conflict. Please try again.');
          }
        }
        throw error;
      }
    });

    // Send password reset email to teacher (outside transaction)
    try {
      await this.authService.sendPasswordResetForNewUser(
        result.user.id,
        teacherData.email,
        `${teacherData.firstName} ${teacherData.lastName}`,
        'Teacher',
        result.teacher.publicId,
        school.name
      );
    } catch (error) {
      this.logger.error('Failed to send password reset email to teacher:', error instanceof Error ? error.stack : error);
      // Don't fail the request if email fails
    }

    return {
      id: result.teacher.id,
      teacherId: result.teacher.teacherId,
      firstName: result.teacher.firstName,
      lastName: result.teacher.lastName,
      email: result.teacher.email,
      phone: result.teacher.phone,
      subject: result.teacher.subject,
      isTemporary: result.teacher.isTemporary,
      employeeId: result.teacher.employeeId,
      createdAt: result.teacher.createdAt,
    };
  }

    /**
   * Update a teacher in a school
   */
  async updateTeacher(
    schoolId: string,
    teacherId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      subject?: string;
      isTemporary?: boolean;
    }
  ): Promise<any> {
    // Support both database ID and subdomain
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { id: schoolId },
          { subdomain: schoolId },
        ],
      },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id: teacherId,
        schoolId: school.id,
      },
    });

    if (!teacher) {
      throw new BadRequestException('Teacher not found in this school');
    }

    // Update teacher
    const updatedTeacher = await this.prisma.teacher.update({
      where: { id: teacherId },
      data: {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        phone: updateData.phone,
        subject: updateData.subject,
        isTemporary: updateData.isTemporary,
      },
    });

    return {
      id: updatedTeacher.id,
      teacherId: updatedTeacher.teacherId,
      firstName: updatedTeacher.firstName,
      lastName: updatedTeacher.lastName,
      email: updatedTeacher.email,
      phone: updatedTeacher.phone,
      employeeId: updatedTeacher.employeeId,
      subject: updatedTeacher.subject,
      isTemporary: updatedTeacher.isTemporary,
      createdAt: updatedTeacher.createdAt,
    };
  }

  /**
   * Update a principal in a school
   */
  async updatePrincipal(
    schoolId: string,
    principalId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<any> {
    // Support both database ID and subdomain
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { id: schoolId },
          { subdomain: schoolId },
        ],
      },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Find principal (case-insensitive role check)
    const principal = await this.prisma.schoolAdmin.findFirst({
      where: {
        id: principalId,
        schoolId: school.id,
        role: { contains: 'principal', mode: 'insensitive' },
      },
      include: {
        user: true,
      },
    });

    if (!principal) {
      throw new BadRequestException('Principal not found in this school');
    }

    // Update principal
    const updatedPrincipal = await this.prisma.schoolAdmin.update({
      where: { id: principalId },
      data: {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        phone: updateData.phone,
      },
    });

    // Note: User model doesn't store firstName/lastName, only SchoolAdmin does

    return {
      id: updatedPrincipal.id,
      adminId: updatedPrincipal.adminId,
      firstName: updatedPrincipal.firstName,
      lastName: updatedPrincipal.lastName,
      email: updatedPrincipal.email,
      phone: updatedPrincipal.phone,
      role: updatedPrincipal.role,
      createdAt: updatedPrincipal.createdAt,
    };
  }

  /**
   * Update an admin in a school
   */
  async updateAdmin(
    schoolId: string,
    adminId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      role?: string;
    }
  ): Promise<any> {
    // Support both database ID and subdomain
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { id: schoolId },
          { subdomain: schoolId },
        ],
      },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    const admin = await this.prisma.schoolAdmin.findFirst({
      where: {
        id: adminId,
        schoolId: school.id,
      },
      include: {
        user: true,
      },
    });

    if (!admin) {
      throw new BadRequestException('Administrator not found in this school');
    }

    // If role is being updated, validate it
    if (updateData.role) {
      const roleLower = updateData.role.trim().toLowerCase();
      const teachingKeywords = ['teacher', 'teaching', 'instructor', 'lecturer', 'professor', 'tutor', 'educator'];
      
      const isTeachingRole = teachingKeywords.some(keyword => 
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

      // Check if trying to set role to Principal and school already has one
      const isPrincipal = roleLower === 'principal' || roleLower.includes('principal');
      if (isPrincipal) {
        const existingPrincipal = await this.prisma.schoolAdmin.findFirst({
          where: {
            schoolId: school.id,
            id: { not: adminId },
            role: { contains: 'principal', mode: 'insensitive' },
          },
        });

        if (existingPrincipal) {
          throw new BadRequestException('School already has a principal. Use "Make Principal" to switch principals.');
        }
      }
    }

    // Check if role changed to send email notification
    const roleChanged = updateData.role && updateData.role.trim() !== admin.role;

    // Update admin
    const updatedAdmin = await this.prisma.schoolAdmin.update({
      where: { id: adminId },
      data: {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        phone: updateData.phone,
        role: updateData.role ? updateData.role.trim() : undefined,
      },
    });

    // Note: User model doesn't store firstName/lastName, only SchoolAdmin does

    // Send role change email if role was updated
    if (roleChanged && admin.email) {
      try {
        await this.emailService.sendRoleChangeEmail(
          admin.email,
          `${updatedAdmin.firstName} ${updatedAdmin.lastName}`,
          admin.role, // old role
          updateData.role!.trim(), // new role
          updatedAdmin.publicId || '',
          school.name
        );
      } catch (error) {
        this.logger.error('Failed to send role change email:', error instanceof Error ? error.stack : error);
        // Don't fail the request if email fails
      }
    }

    return {
      id: updatedAdmin.id,
      adminId: updatedAdmin.adminId,
      firstName: updatedAdmin.firstName,
      lastName: updatedAdmin.lastName,
      email: updatedAdmin.email,
      phone: updatedAdmin.phone,
      role: updatedAdmin.role,
      createdAt: updatedAdmin.createdAt,
    };
  }

  /**
   * Delete a teacher from a school
   */
  async deleteTeacher(schoolId: string, teacherId: string): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id: teacherId,
        schoolId: schoolId,
      },
      include: {
        user: true,
      },
    });

    if (!teacher) {
      throw new BadRequestException('Teacher not found in this school');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teacher.delete({
        where: { id: teacherId },
      });

      if (teacher.userId) {
        const userInUse = await tx.schoolAdmin.findFirst({
          where: { userId: teacher.userId },
        });

        if (!userInUse) {
          await tx.user.delete({
            where: { id: teacher.userId },
          });
        }
      }
    });
  }

  /**
   * Delete an administrator from a school
   * Note: Principal cannot be deleted unless another admin is made principal first
   */
  async deleteAdmin(schoolId: string, adminId: string): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    const admin = await this.prisma.schoolAdmin.findFirst({
      where: {
        id: adminId,
        schoolId: schoolId,
      },
      include: {
        user: true,
      },
    });

    if (!admin) {
      throw new BadRequestException('Administrator not found in this school');
    }

    // Check if this is a principal (case-insensitive)
    const roleLower = admin.role?.toLowerCase() || '';
    const isPrincipal = roleLower === 'principal' || roleLower.includes('principal');
    
    if (isPrincipal) {
      // Check if principal is active (school is active and user account is active)
      const isPrincipalActive = school.isActive && admin.user?.accountStatus === 'ACTIVE';

      if (isPrincipalActive) {
        throw new BadRequestException(
          'Cannot delete an active principal. You must first transfer the principal role to another administrator before deletion. Use the "Make Principal" option to assign the role to another admin.'
        );
      }

      const otherAdmins = await this.prisma.schoolAdmin.findMany({
        where: {
          schoolId: schoolId,
          id: { not: adminId },
          role: { not: { contains: 'principal', mode: 'insensitive' } },
        },
      });

      if (otherAdmins.length === 0) {
        throw new BadRequestException(
          'Cannot delete principal. There must be at least one other administrator to assign the principal role to before deletion.'
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.schoolAdmin.delete({
        where: { id: adminId },
      });

      if (admin.userId) {
        const userInUse = await tx.teacher.findFirst({
          where: { userId: admin.userId },
        });

        if (!userInUse) {
          await tx.user.delete({
            where: { id: admin.userId },
          });
        }
      }
    });
  }

  /**
   * Make an admin the principal (switches current principal to admin)
   */
  async makePrincipal(schoolId: string, adminId: string): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    const adminToPromote = await this.prisma.schoolAdmin.findFirst({
      where: {
        id: adminId,
        schoolId: schoolId,
      },
      include: {
        user: true,
      },
    });

    if (!adminToPromote) {
      throw new BadRequestException('Administrator not found in this school');
    }

    // Check if the admin is already a principal (case-insensitive)
    const roleLower = adminToPromote.role?.toLowerCase() || '';
    const isAlreadyPrincipal = roleLower === 'principal' || roleLower.includes('principal');
    
    if (isAlreadyPrincipal) {
      throw new BadRequestException('This administrator is already the principal');
    }

    let currentPrincipal = null;

    await this.prisma.$transaction(async (tx) => {
      // Find and demote current principal to Administrator
      currentPrincipal = await tx.schoolAdmin.findFirst({
        where: {
          schoolId: schoolId,
          role: { contains: 'principal', mode: 'insensitive' },
        },
        include: {
          user: true,
        },
      });

      if (currentPrincipal) {
        await tx.schoolAdmin.update({
          where: { id: currentPrincipal.id },
          data: { role: 'Administrator' },
        });
      }

      // Promote the selected admin to PRINCIPAL
      await tx.schoolAdmin.update({
        where: { id: adminId },
        data: { role: 'Principal' },
      });
    });

    // Send role change emails (outside transaction)
    // Email to newly promoted principal
    try {
      await this.emailService.sendRoleChangeEmail(
        adminToPromote.email,
        `${adminToPromote.firstName} ${adminToPromote.lastName}`,
        this.getRoleDisplayName(adminToPromote.role),
        'Principal',
        adminToPromote.publicId,
        school.name
      );
    } catch (error) {
      this.logger.error(`Failed to send role change email to ${adminToPromote.email}:`, error instanceof Error ? error.stack : error);
    }

    // Email to demoted principal (if exists)
    if (currentPrincipal) {
      try {
        await this.emailService.sendRoleChangeEmail(
          currentPrincipal.email,
          `${currentPrincipal.firstName} ${currentPrincipal.lastName}`,
          'Principal',
          'Administrator',
          currentPrincipal.publicId,
          school.name
        );
      } catch (error) {
        this.logger.error(`Failed to send role change email to ${currentPrincipal.email}:`, error instanceof Error ? error.stack : error);
      }
    }
  }

  /**
   * Get display name for admin role
   * Role is now stored as string, so just return it as-is
   */
  private getRoleDisplayName(role: string): string {
    return role; // Return role as-is since it's already formatted
  }

  /**
   * Delete a principal (requires another admin to be made principal first)
   * Note: Cannot delete an active principal - must transfer role first
   */
  async deletePrincipal(schoolId: string, principalId: string): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    const principal = await this.prisma.schoolAdmin.findFirst({
      where: {
        id: principalId,
        schoolId: schoolId,
        role: { contains: 'principal', mode: 'insensitive' },
      },
      include: {
        user: true,
      },
    });

    if (!principal) {
      throw new BadRequestException('Principal not found in this school');
    }

    // Check if principal is active (school is active and user account is active)
    const isPrincipalActive = school.isActive && principal.user?.accountStatus === 'ACTIVE';

    if (isPrincipalActive) {
      throw new BadRequestException(
        'Cannot delete an active principal. You must first transfer the principal role to another administrator before deletion. Use the "Make Principal" option to assign the role to another admin.'
      );
    }

    const otherAdmins = await this.prisma.schoolAdmin.findMany({
      where: {
        schoolId: schoolId,
        id: { not: principalId },
        role: { not: { contains: 'principal', mode: 'insensitive' } },
      },
    });

    if (otherAdmins.length === 0) {
      throw new BadRequestException(
        'Cannot delete principal. There must be at least one other administrator to assign the principal role to before deletion.'
      );
    }

    await this.deleteAdmin(schoolId, principalId);
  }

  /**
   * Convert a teacher to an admin
   * Optionally keeps the teacher role if keepAsTeacher is true
   */
  async convertTeacherToAdmin(
    schoolId: string,
    teacherId: string,
    dto: ConvertTeacherToAdminDto
  ): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id: teacherId,
        schoolId: schoolId,
      },
      include: {
        user: true,
      },
    });

    if (!teacher) {
      throw new BadRequestException('Teacher not found in this school');
    }

    // Check if user already has a SchoolAdmin record
    const existingAdmin = await this.prisma.schoolAdmin.findUnique({
      where: { userId: teacher.userId },
    });

    if (existingAdmin) {
      throw new BadRequestException('This teacher is already an administrator');
    }

    await this.prisma.$transaction(async (tx) => {
      // Generate admin ID and public ID
      const roleLower = dto.role?.toLowerCase() || '';
      const isPrincipal = roleLower === 'principal' || roleLower.includes('principal');
      const adminId = isPrincipal
        ? await this.generatePrincipalId()
        : await this.generateAdminId();
      const publicId = await this.generatePublicId(school.name, 'admin');

      // Create SchoolAdmin record
      await tx.schoolAdmin.create({
        data: {
          adminId,
          publicId,
          userId: teacher.userId,
          schoolId: schoolId,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          phone: teacher.phone,
          email: teacher.email,
          role: dto.role.trim(), // Store role as-is (formatted by frontend)
        },
      });

      // Update User role to SCHOOL_ADMIN
      await tx.user.update({
        where: { id: teacher.userId },
        data: { role: 'SCHOOL_ADMIN' },
      });

      // If keepAsTeacher is false, delete the Teacher record
      if (!dto.keepAsTeacher) {
        await tx.teacher.delete({
          where: { id: teacherId },
        });
      }
    });

    // Get the created admin record with public ID
    const newAdmin = await this.prisma.schoolAdmin.findFirst({
      where: {
        userId: teacher.userId,
        schoolId: schoolId,
      },
    });

    // Send role change email (outside transaction)
    if (newAdmin) {
      try {
        const newRoleName = this.getRoleDisplayName(dto.role);
        await this.emailService.sendRoleChangeEmail(
          teacher.email,
          `${teacher.firstName} ${teacher.lastName}`,
          'Teacher',
          newRoleName,
          newAdmin.publicId,
          school.name
        );
      } catch (error) {
        this.logger.error(`Failed to send role change email to ${teacher.email}:`, error instanceof Error ? error.stack : error);
      }
    }
  }
}

