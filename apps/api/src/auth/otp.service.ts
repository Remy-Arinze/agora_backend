import {
  Injectable,
  BadRequestException,
  Logger,
  TooManyRequestsException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { randomBytes } from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_OTP_ATTEMPTS = 5;
  private readonly MAX_OTP_REQUESTS_PER_HOUR = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate a 6-digit OTP code
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Check if user has exceeded OTP request rate limit
   */
  private async checkRateLimit(userId: string, email: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentRequests = await this.prisma.loginSession.count({
      where: {
        OR: [{ userId }, { email }],
        createdAt: { gte: oneHourAgo },
        usedAt: null,
      },
    });

    if (recentRequests >= this.MAX_OTP_REQUESTS_PER_HOUR) {
      throw new TooManyRequestsException(
        'Too many OTP requests. Please try again later.',
      );
    }
  }

  /**
   * Create a login session and send OTP to user's email
   */
  async createLoginSession(userId: string, email: string): Promise<string> {
    this.logger.log(`Creating login session for userId: ${userId}, email: ${email}`);
    
    try {
      // Check rate limit
      await this.checkRateLimit(userId, email);
      this.logger.log('Rate limit check passed');
    } catch (error) {
      this.logger.error('Rate limit check failed:', error);
      throw error;
    }

    // Generate OTP and session ID
    const otpCode = this.generateOtpCode();
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(
      Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
    );
    this.logger.log(`Generated OTP code and sessionId: ${sessionId.substring(0, 8)}...`);

    // Invalidate any existing unused sessions for this user
    try {
      await this.prisma.loginSession.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: {
          usedAt: new Date(), // Mark as used to invalidate
        },
      });
    } catch (error: any) {
      // If LoginSession model doesn't exist, this will fail
      if (error?.message?.includes('loginSession') || error?.code === 'P2001') {
        this.logger.error(
          'LoginSession model not found. Please run: npx prisma generate',
        );
        throw new BadRequestException(
          'Database schema not up to date. Please contact support.',
        );
      }
      throw error;
    }

    // Create new login session
    let session;
    try {
      session = await this.prisma.loginSession.create({
        data: {
          userId,
          sessionId,
          otpCode,
          email,
          expiresAt,
          attempts: 0,
        },
      });
    } catch (error: any) {
      if (error?.message?.includes('loginSession') || error?.code === 'P2001') {
        this.logger.error(
          'LoginSession model not found. Please run: npx prisma generate',
        );
        throw new BadRequestException(
          'Database schema not up to date. Please run: npx prisma generate',
        );
      }
      throw error;
    }

    // Get user's name for email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        teacherProfiles: { take: 1 },
        schoolAdmins: { take: 1 },
      },
    });

    let userName = 'User';
    // Check if user has firstName/lastName directly (for SUPER_ADMIN)
    if (user?.firstName && user?.lastName) {
      userName = `${user.firstName} ${user.lastName}`;
    } else if (user?.studentProfile) {
      userName = `${user.studentProfile.firstName} ${user.studentProfile.lastName}`;
    } else if (user?.teacherProfiles?.[0]) {
      userName = `${user.teacherProfiles[0].firstName} ${user.teacherProfiles[0].lastName}`;
    } else if (user?.schoolAdmins?.[0]) {
      userName = `${user.schoolAdmins[0].firstName} ${user.schoolAdmins[0].lastName}`;
    }

    // Send OTP email
    try {
      this.logger.log(`Attempting to send OTP email to ${email} for user ${userName}`);
      await this.emailService.sendLoginOtpEmail(email, userName, otpCode);
      this.logger.log(`✅ OTP email sent successfully to ${email} for user ${userId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send OTP email to ${email}:`, error);
      // Delete the session if email fails
      try {
        await this.prisma.loginSession.delete({
          where: { id: session.id },
        });
        this.logger.log('Cleaned up login session after email failure');
      } catch (deleteError) {
        this.logger.error('Failed to delete session after email failure:', deleteError);
      }
      throw new BadRequestException(
        'Failed to send OTP email. Please check your email configuration and try again.',
      );
    }

    this.logger.log(`✅ Login session created successfully. SessionId: ${sessionId.substring(0, 8)}...`);
    return sessionId;
  }

  /**
   * Verify OTP code and return user ID if valid
   */
  async verifyOtp(sessionId: string, code: string): Promise<string> {
    const session = await this.prisma.loginSession.findUnique({
      where: { sessionId },
      include: { user: true },
    });

    if (!session) {
      throw new BadRequestException('Invalid session');
    }

    // Check if session is already used
    if (session.usedAt) {
      throw new BadRequestException('This OTP has already been used');
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    // Check if max attempts exceeded
    if (session.attempts >= this.MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        'Too many failed attempts. Please request a new OTP.',
      );
    }

    // Verify OTP code
    if (session.otpCode !== code) {
      // Increment attempts
      await this.prisma.loginSession.update({
        where: { id: session.id },
        data: { attempts: { increment: 1 } },
      });

      const remainingAttempts = this.MAX_OTP_ATTEMPTS - session.attempts - 1;
      throw new BadRequestException(
        `Invalid OTP code. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining.` : 'Please request a new OTP.'}`,
      );
    }

    // Mark session as used
    await this.prisma.loginSession.update({
      where: { id: session.id },
      data: { usedAt: new Date() },
    });

    return session.userId;
  }

  /**
   * Clean up expired OTP sessions (should be run periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.loginSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        usedAt: null,
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired login sessions`);
    return result.count;
  }
}
