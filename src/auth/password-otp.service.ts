import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PasswordOtpType } from '@prisma/client';
import { randomBytes } from 'crypto';

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class PasswordOtpService {
  private readonly logger = new Logger(PasswordOtpService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create a password OTP record (change or reset). Returns sessionId and otpCode (caller sends email).
   */
  async create(
    type: PasswordOtpType,
    email: string,
    userId?: string,
  ): Promise<{ sessionId: string; otpCode: string }> {
    const otpCode = this.generateOtpCode();
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.passwordOtp.create({
      data: {
        sessionId,
        type,
        userId: userId ?? null,
        email,
        otpCode,
        expiresAt,
      },
    });

    this.logger.log(
      `[PASSWORD_OTP] Created ${type} OTP for ${email}, sessionId: ${sessionId.substring(0, 8)}...`,
    );
    return { sessionId, otpCode };
  }

  /**
   * Verify OTP for change-password flow (by sessionId). Returns userId and email.
   */
  async verifyChangePassword(
    sessionId: string,
    code: string,
  ): Promise<{ userId: string; email: string }> {
    const record = await this.prisma.passwordOtp.findUnique({
      where: { sessionId, type: 'CHANGE_PASSWORD' },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired verification. Please request a new code.');
    }
    if (record.usedAt) {
      throw new BadRequestException('This code has already been used. Please request a new code.');
    }
    if (new Date() > record.expiresAt) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException('Too many failed attempts. Please request a new code.');
    }
    if (record.otpCode !== code) {
      await this.prisma.passwordOtp.update({
        where: { id: record.id },
        data: { attempts: record.attempts + 1 },
      });
      throw new BadRequestException('Invalid verification code.');
    }
    if (!record.userId) {
      throw new BadRequestException('Invalid session.');
    }

    await this.prisma.passwordOtp.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { userId: record.userId, email: record.email };
  }

  /**
   * Verify OTP for reset-password flow (by email). Returns userId and email.
   */
  async verifyResetPassword(
    email: string,
    code: string,
  ): Promise<{ userId: string; email: string }> {
    const record = await this.prisma.passwordOtp.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        type: 'RESET_PASSWORD',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired verification. Please request a new code.');
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException('Too many failed attempts. Please request a new code.');
    }
    if (record.otpCode !== code) {
      await this.prisma.passwordOtp.update({
        where: { id: record.id },
        data: { attempts: record.attempts + 1 },
      });
      throw new BadRequestException('Invalid verification code.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: record.email },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    await this.prisma.passwordOtp.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { userId: user.id, email: record.email };
  }
}
