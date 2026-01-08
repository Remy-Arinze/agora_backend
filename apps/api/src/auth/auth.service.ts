import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { LoginDto, VerifyOtpDto, AuthTokensDto } from './dto/login.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { JwtPayload } from './types/user-with-context.type';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { generateSecurePasswordHash } from '../common/utils/password.utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService
  ) {}

  async login(loginDto: LoginDto): Promise<AuthTokensDto> {
    try {
      const { emailOrPublicId, password } = loginDto;

      // Determine if it's an email or public ID
      const isEmail = emailOrPublicId.includes('@');
      
      let user;
      let schoolAdmin = null;
      let teacherProfile = null;

      if (isEmail) {
        // Super admin or user logging in with email
        user = await this.prisma.user.findFirst({
          where: {
            email: emailOrPublicId,
          },
          include: {
            studentProfile: {
              include: {
                enrollments: {
                  where: { isActive: true },
                  orderBy: { enrollmentDate: 'desc' },
                  take: 1,
                  include: { school: true },
                },
              },
            },
            parentProfile: true,
            teacherProfiles: true,
            schoolAdmins: true,
          },
        });
      } else {
        // Admin, principal, teacher, or student logging in with public ID
        // Principals are SchoolAdmin records with role PRINCIPAL, so they're included here
        // Run all three queries in parallel for better performance
        const [adminResult, teacherResult, studentResult] = await Promise.all([
          this.prisma.schoolAdmin.findUnique({
            where: { publicId: emailOrPublicId },
            include: { user: true },
          }),
          this.prisma.teacher.findUnique({
            where: { publicId: emailOrPublicId },
            include: { user: true },
          }),
          this.prisma.student.findUnique({
            where: { publicId: emailOrPublicId },
            include: { user: true },
          }),
        ]);

        schoolAdmin = adminResult;
        teacherProfile = teacherResult;

        if (studentResult) {
          user = studentResult.user;
        }

        if (!schoolAdmin && !teacherProfile && !user) {
          throw new UnauthorizedException('Invalid credentials');
        }

        if (!user) {
          user = schoolAdmin?.user || teacherProfile?.user;
        }
        
        if (user) {
          // Reload user with all relations
          user = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
              studentProfile: {
                include: {
                  enrollments: {
                    where: { isActive: true },
                    orderBy: { enrollmentDate: 'desc' },
                    take: 1,
                    include: { school: true },
                  },
                },
              },
              parentProfile: true,
              teacherProfiles: true,
              schoolAdmins: true,
            },
          });
        }
      }

      if (!user || !user.passwordHash) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user is shadow (cannot login)
      if (user.accountStatus === 'SHADOW') {
        throw new UnauthorizedException(
          'Account not activated. Please verify your OTP to claim your account.'
        );
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Determine school context based on login method and role
      let currentSchoolId: string | null = null;
      let currentPublicId: string | null = null;
      let currentProfileId: string | null = null;

      if (isEmail) {
        // Email login - determine school context based on role
        if (user.role === 'STUDENT') {
          // ✅ STUDENT: Find active enrollment and set school context
          if (user.studentProfile && user.studentProfile.enrollments.length > 0) {
            const activeEnrollment = user.studentProfile.enrollments[0];
            currentSchoolId = activeEnrollment.schoolId;
            currentPublicId = user.studentProfile.publicId || null;
          }
          // If no active enrollment, schoolId remains null (student not enrolled anywhere)
        } else if (user.role === 'SCHOOL_ADMIN' && user.schoolAdmins && user.schoolAdmins.length > 0) {
          // ✅ SCHOOL_ADMIN via email: Use first school admin profile
          const adminProfile = user.schoolAdmins[0];
          currentSchoolId = adminProfile.schoolId;
          currentPublicId = adminProfile.publicId;
          currentProfileId = adminProfile.id; // This is the SchoolAdmin record ID used for permissions
        } else if (user.role === 'TEACHER' && user.teacherProfiles && user.teacherProfiles.length > 0) {
          // ✅ TEACHER via email: Use first teacher profile
          const teacherProf = user.teacherProfiles[0];
          currentSchoolId = teacherProf.schoolId;
          currentPublicId = teacherProf.publicId;
          currentProfileId = teacherProf.id;
        }
        // ✅ SUPER_ADMIN: No school context (can access all schools)
        // schoolId, publicId, profileId remain null for super admin
      } else {
        // Public ID login - capture school context
        if (schoolAdmin) {
          // ✅ SCHOOL_ADMIN or PRINCIPAL
          currentSchoolId = schoolAdmin.schoolId;
          currentPublicId = schoolAdmin.publicId;
          currentProfileId = schoolAdmin.id; // Use record ID for permission lookups
        } else if (teacherProfile) {
          // ✅ TEACHER
          currentSchoolId = teacherProfile.schoolId;
          currentPublicId = teacherProfile.publicId;
          currentProfileId = teacherProfile.id; // Use record ID for permission lookups
        } else if (user.role === 'STUDENT') {
          // ✅ STUDENT logging in with publicId
          if (user.studentProfile && user.studentProfile.enrollments.length > 0) {
            const activeEnrollment = user.studentProfile.enrollments[0];
            currentSchoolId = activeEnrollment.schoolId;
            currentPublicId = user.studentProfile.publicId || null;
          }
        }
      }

      // Generate tokens with school context
      const tokens = await this.generateTokens(
        user.id,
        user.role,
        currentSchoolId,
        currentPublicId,
        currentProfileId
      );

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          accountStatus: user.accountStatus,
          profileId: currentProfileId,
          publicId: currentPublicId,
          schoolId: currentSchoolId, // ✅ Include in response
        },
      };
    } catch (error) {
      // Log the full error for debugging
      this.logger.error('AuthService.login error:', error instanceof Error ? error.stack : error);
      // If it's already a NestJS exception, re-throw it
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      // Handle Prisma errors with better messages
      if (error instanceof Error) {
        // Check for Prisma-specific errors
        if (error.message.includes('Unknown field')) {
          throw new BadRequestException(
            'A system error occurred. Please contact support if this persists.'
          );
        }
        // Generic error message for other cases
        throw new BadRequestException(
          'Unable to complete login. Please check your credentials and try again.'
        );
      }
      // Fallback for unknown errors
      throw new BadRequestException('Login failed. Please try again later.');
    }
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<AuthTokensDto> {
    const { phone, code } = verifyOtpDto;

    const parent = await this.prisma.parent.findFirst({
      where: { phone },
      include: {
        user: true,
        otpCodes: {
          where: {
            code,
            expiresAt: { gt: new Date() },
            usedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!parent || parent.otpCodes.length === 0) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    const otpCode = parent.otpCodes[0];

    // Mark OTP as used
    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: { usedAt: new Date() },
    });

    // Get or create parent user account
    let updatedUser;
    if (!parent.userId) {
      // Create User account for parent (they're claiming their account via OTP)
      const defaultPassword = await generateSecurePasswordHash();
      const newUser = await this.prisma.user.create({
        data: {
          email: parent.email || null,
          phone: parent.phone,
          passwordHash: defaultPassword,
          accountStatus: 'ACTIVE',
          role: 'PARENT',
        },
      });

      // Link User to Parent
      await this.prisma.parent.update({
        where: { id: parent.id },
        data: { userId: newUser.id },
      });

      updatedUser = await this.prisma.user.findUnique({
        where: { id: newUser.id },
        include: {
          parentProfile: true,
          schoolAdmins: true,
          teacherProfiles: true,
        },
      });
    } else {
      // Activate existing parent account
      updatedUser = await this.prisma.user.update({
        where: { id: parent.userId },
        data: {
          accountStatus: 'ACTIVE',
        },
        include: {
          parentProfile: true,
          schoolAdmins: true,
          teacherProfiles: true,
        },
      });
    }

    // Lock student profiles linked to this parent
    const students = await this.prisma.studentGuardian.findMany({
      where: { parentId: parent.id },
      select: { studentId: true },
    });

    if (students.length > 0) {
      await this.prisma.student.updateMany({
        where: {
          id: { in: students.map((s: { studentId: string }) => s.studentId) },
        },
        data: {
          profileLocked: true,
        },
      });
    }

    const tokens = await this.generateTokens(updatedUser.id, updatedUser.role);

    // Get profile-specific ID (for parents, this would be null)
    let profileId: string | null = null;
    if (updatedUser.schoolAdmins && updatedUser.schoolAdmins.length > 0) {
      profileId = updatedUser.schoolAdmins[0].adminId;
    } else if (updatedUser.teacherProfiles && updatedUser.teacherProfiles.length > 0) {
      profileId = updatedUser.teacherProfiles[0].teacherId;
    }

    return {
      ...tokens,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        accountStatus: updatedUser.accountStatus,
        profileId: profileId,
      },
    };
  }

  private async generateTokens(
    userId: string,
    role: string,
    schoolId?: string | null,
    publicId?: string | null,
    profileId?: string | null
  ) {
    const payload: JwtPayload = {
      sub: userId,
      role,
      ...(schoolId && { schoolId }),      // ✅ Include if exists
      ...(publicId && { publicId }),      // ✅ Include if exists
      ...(profileId && { profileId }),    // ✅ Include if exists
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken);
      
      // Validate user still exists and is active
      const user = await this.validateUser(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if user account is active
      if (user.accountStatus !== 'ACTIVE' && user.accountStatus !== 'SHADOW') {
        throw new UnauthorizedException('Account is not active');
      }

      // Generate new tokens (preserve school context from original token)
      const newPayload: JwtPayload = {
        sub: user.id,
        role: user.role,
        ...(payload.schoolId && { schoolId: payload.schoolId }),
        ...(payload.publicId && { publicId: payload.publicId }),
        ...(payload.profileId && { profileId: payload.profileId }),
      };

      return {
        accessToken: this.jwtService.sign(newPayload),
        refreshToken: this.jwtService.sign(newPayload, { expiresIn: '7d' }),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Token verification failed (expired, invalid, etc.)
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        parentProfile: true,
        teacherProfiles: true,
        schoolAdmins: true,
      },
    });
  }

  /**
   * Generate and send password reset token
   */
  async requestPasswordReset(requestPasswordResetDto: RequestPasswordResetDto): Promise<void> {
    const { email } = requestPasswordResetDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        schoolAdmins: true,
        teacherProfiles: true,
      },
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return;
    }

    // Generate reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + 60 * 60 * 1000); // 1 hour expiry for security

    // Create reset token
    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Get user name, role, and ALL schools/profiles for multi-school users
    let name = email;
    let role = 'User';
    const schools: Array<{ name: string; publicId: string; role: string }> = [];
    
    // Collect ALL school admin profiles
    if (user.schoolAdmins && user.schoolAdmins.length > 0) {
      name = `${user.schoolAdmins[0].firstName} ${user.schoolAdmins[0].lastName}`;
      role = 'Administrator';
      
      // Get all schools for this admin
      const schoolIds = [...new Set(user.schoolAdmins.map(admin => admin.schoolId))];
      const schoolsData = await this.prisma.school.findMany({
        where: { id: { in: schoolIds } },
        select: { id: true, name: true },
      });
      
      for (const admin of user.schoolAdmins) {
        const school = schoolsData.find(s => s.id === admin.schoolId);
        if (school) {
          schools.push({
            name: school.name,
            publicId: admin.publicId,
            role: admin.role === 'Principal' ? 'Principal' : 'Administrator',
          });
        }
      }
    } 
    // Collect ALL teacher profiles
    else if (user.teacherProfiles && user.teacherProfiles.length > 0) {
      name = `${user.teacherProfiles[0].firstName} ${user.teacherProfiles[0].lastName}`;
      role = 'Teacher';
      
      // Get all schools for this teacher
      const schoolIds = [...new Set(user.teacherProfiles.map(teacher => teacher.schoolId))];
      const schoolsData = await this.prisma.school.findMany({
        where: { id: { in: schoolIds } },
        select: { id: true, name: true },
      });
      
      for (const teacher of user.teacherProfiles) {
        const school = schoolsData.find(s => s.id === teacher.schoolId);
        if (school) {
          schools.push({
            name: school.name,
            publicId: teacher.publicId,
            role: 'Teacher',
          });
        }
      }
    }

    // Send email with all schools information
    try {
      await this.emailService.sendPasswordResetEmail(
        email, 
        name, 
        token, 
        role, 
        schools.length > 0 ? schools : undefined
      );
    } catch (error) {
      // Log error but don't fail the request
      this.logger.error('Failed to send password reset email:', error instanceof Error ? error.stack : error);
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto;

    // Find valid reset token
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.usedAt) {
      throw new BadRequestException('Reset token has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Get user info before updating (for confirmation email)
    const user = resetToken.user;
    let name = user.email || 'User';
    let publicId: string | null = null;

    // Try to get public ID from school admin or teacher profile
    const userWithProfiles = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        schoolAdmins: true,
        teacherProfiles: true,
      },
    });

    if (userWithProfiles) {
      if (userWithProfiles.schoolAdmins && userWithProfiles.schoolAdmins.length > 0) {
        name = `${userWithProfiles.schoolAdmins[0].firstName} ${userWithProfiles.schoolAdmins[0].lastName}`;
        publicId = userWithProfiles.schoolAdmins[0].publicId;
      } else if (userWithProfiles.teacherProfiles && userWithProfiles.teacherProfiles.length > 0) {
        name = `${userWithProfiles.teacherProfiles[0].firstName} ${userWithProfiles.teacherProfiles[0].lastName}`;
        publicId = userWithProfiles.teacherProfiles[0].publicId;
      }
    }

    // Update user password and mark token as used
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          accountStatus: 'ACTIVE', // Activate account if it was shadow
        },
      });

      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });
    });

    // Get school name for confirmation email
    let schoolName: string | undefined;
    if (userWithProfiles) {
      if (userWithProfiles.schoolAdmins && userWithProfiles.schoolAdmins.length > 0) {
        const school = await this.prisma.school.findUnique({
          where: { id: userWithProfiles.schoolAdmins[0].schoolId },
          select: { name: true },
        });
        schoolName = school?.name;
      } else if (userWithProfiles.teacherProfiles && userWithProfiles.teacherProfiles.length > 0) {
        const school = await this.prisma.school.findUnique({
          where: { id: userWithProfiles.teacherProfiles[0].schoolId },
          select: { name: true },
        });
        schoolName = school?.name;
      }
    }

    // Send confirmation email (only if user has an email)
    if (user.email) {
      try {
        await this.emailService.sendPasswordResetConfirmationEmail(
          user.email,
          name,
          publicId || undefined,
          schoolName
        );
      } catch (error) {
        // Log error but don't fail the request
        this.logger.error('Failed to send password reset confirmation email:', error instanceof Error ? error.stack : error);
      }
    }
  }

  /**
   * Generate and send password reset token for new user (used when creating school/admin/teacher)
   */
  async sendPasswordResetForNewUser(
    userId: string,
    email: string,
    name: string,
    role: string,
    publicId?: string,
    schoolName?: string
  ): Promise<void> {
    // Generate reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours for new user activation

    // Create reset token
    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    // Send email with public ID and school name if provided
    try {
      await this.emailService.sendPasswordResetEmail(email, name, token, role, publicId || undefined, schoolName);
    } catch (error) {
      // Log error but don't fail the request
      this.logger.error('Failed to send password reset email:', error instanceof Error ? error.stack : error);
    }
  }

  /**
   * Resend password reset email for a user (admin function)
   * Invalidates any existing unused tokens and creates a new one
   */
  async resendPasswordResetEmail(
    userId: string,
    schoolId?: string
  ): Promise<void> {
    // Get user with profiles
    // If schoolId is provided, filter by it; otherwise get all schools
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        schoolAdmins: schoolId 
          ? {
              where: { schoolId },
              include: {
                school: {
                  select: { name: true },
                },
              },
            }
          : {
              include: {
                school: {
                  select: { name: true },
                },
              },
            },
        teacherProfiles: schoolId
          ? {
              where: { schoolId },
              include: {
                school: {
                  select: { name: true },
                },
              },
            }
          : {
              include: {
                school: {
                  select: { name: true },
                },
              },
            },
        studentProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.email) {
      throw new BadRequestException('User does not have an email address');
    }

    // Invalidate any existing unused tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Mark as used to invalidate
      },
    });

    // Get user name, role, and ALL schools/profiles for multi-school users
    let name = user.email;
    let role = 'User';
    const schools: Array<{ name: string; publicId: string; role: string }> = [];

    // Collect ALL school admin profiles (or filtered by schoolId if provided)
    if (user.schoolAdmins && user.schoolAdmins.length > 0) {
      name = `${user.schoolAdmins[0].firstName} ${user.schoolAdmins[0].lastName}`;
      role = 'Administrator';
      
      for (const admin of user.schoolAdmins) {
        if (admin.school) {
          schools.push({
            name: admin.school.name,
            publicId: admin.publicId,
            role: admin.role === 'Principal' ? 'Principal' : 'Administrator',
          });
        }
      }
    } 
    // Collect ALL teacher profiles (or filtered by schoolId if provided)
    else if (user.teacherProfiles && user.teacherProfiles.length > 0) {
      name = `${user.teacherProfiles[0].firstName} ${user.teacherProfiles[0].lastName}`;
      role = 'Teacher';
      
      for (const teacher of user.teacherProfiles) {
        if (teacher.school) {
          schools.push({
            name: teacher.school.name,
            publicId: teacher.publicId,
            role: 'Teacher',
          });
        }
      }
    } 
    // Students - single school only
    else if (user.studentProfile) {
      name = `${user.studentProfile.firstName} ${user.studentProfile.lastName}`;
      role = 'Student';
      
      // Get school name from student's enrollment
      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          studentId: user.studentProfile.id,
          isActive: true,
        },
        include: {
          school: {
            select: { name: true },
          },
        },
        orderBy: {
          enrollmentDate: 'desc',
        },
      });
      
      if (enrollment?.school && user.studentProfile.publicId) {
        schools.push({
          name: enrollment.school.name,
          publicId: user.studentProfile.publicId,
          role: 'Student',
        });
      }
    }

    // Generate new reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours for resent activation

    // Create new reset token
    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    // Send email with all schools information
    try {
      await this.emailService.sendPasswordResetEmail(
        user.email, 
        name, 
        token, 
        role, 
        schools.length > 0 ? schools : undefined
      );
    } catch (error) {
      // Log error but don't fail the request
      this.logger.error('Failed to resend password reset email:', error instanceof Error ? error.stack : error);
      throw error; // Re-throw so admin knows it failed
    }
  }
}

