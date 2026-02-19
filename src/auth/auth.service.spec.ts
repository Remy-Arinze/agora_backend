import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { OtpService } from './otp.service';
import { CloudinaryService } from '../storage/cloudinary/cloudinary.service';
import { TestUtils } from '../common/test/test-utils';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let emailService: jest.Mocked<EmailService>;
  let otpService: jest.Mocked<OtpService>;
  let cloudinaryService: jest.Mocked<CloudinaryService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: TestUtils.createMockPrismaService(),
        },
        {
          provide: JwtService,
          useValue: TestUtils.createMockJwtService(),
        },
        {
          provide: EmailService,
          useValue: TestUtils.createMockEmailService(),
        },
        {
          provide: OtpService,
          useValue: {
            createLoginSession: jest.fn(),
            verifyOtp: jest.fn(),
          },
        },
        {
          provide: CloudinaryService,
          useValue: TestUtils.createMockCloudinaryService(),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    emailService = module.get(EmailService);
    otpService = module.get(OtpService);
    cloudinaryService = module.get(CloudinaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const mockLoginDto = {
      emailOrPublicId: 'test@example.com',
      password: 'password123',
    };

    it('should successfully initiate login and request OTP', async () => {
      const mockUser = TestUtils.createMockUser();
      const mockSessionId = 'session-123';
      const mockOtp = '123456';

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      otpService.createLoginSession = jest.fn().mockResolvedValue(mockSessionId);

      const result = await service.login(mockLoginDto);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: mockLoginDto.emailOrPublicId },
        include: expect.any(Object),
      });
      expect(otpService.createLoginSession).toHaveBeenCalled();
      expect(result).toHaveProperty('sessionId', mockSessionId);
      expect(result).toHaveProperty('requiresOtp', true);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      const mockUser = TestUtils.createMockUser();
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyLoginOtp', () => {
    const mockVerifyOtpDto = {
      sessionId: 'session-123',
      code: '123456',
    };

    it('should successfully verify OTP and return tokens', async () => {
      const mockUser = TestUtils.createMockUser();
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      otpService.verifyOtp = jest.fn().mockResolvedValue(mockUser.id);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser as any);
      jwtService.sign.mockReturnValueOnce(mockTokens.accessToken);
      jwtService.sign.mockReturnValueOnce(mockTokens.refreshToken);

      const result = await service.verifyLoginOtp(mockVerifyOtpDto);

      expect(otpService.verifyOtp).toHaveBeenCalledWith(
        mockVerifyOtpDto.sessionId,
        mockVerifyOtpDto.code
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should throw UnauthorizedException for invalid OTP', async () => {
      otpService.verifyOtp = jest.fn().mockRejectedValue(new UnauthorizedException('Invalid OTP'));

      await expect(service.verifyLoginOtp(mockVerifyOtpDto)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'valid-refresh-token';

    it('should successfully refresh access token', async () => {
      const mockUser = TestUtils.createMockUser();
      const mockPayload = {
        sub: mockUser.id,
        role: mockUser.role,
      };
      const mockNewTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      jwtService.verify.mockReturnValue(mockPayload as any);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      jwtService.sign.mockReturnValueOnce(mockNewTokens.accessToken);
      jwtService.sign.mockReturnValueOnce(mockNewTokens.refreshToken);

      const result = await service.refreshToken(mockRefreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(mockRefreshToken);
      expect(result).toHaveProperty('accessToken', mockNewTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockNewTokens.refreshToken);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const mockPayload = { sub: 'user-id', role: 'SCHOOL_ADMIN' };
      jwtService.verify.mockReturnValue(mockPayload as any);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('requestPasswordReset', () => {
    const mockRequestDto = { email: 'test@example.com' };

    it('should successfully request password reset', async () => {
      const mockUser = TestUtils.createMockUser();
      const mockToken = 'reset-token-123';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (prisma.passwordResetToken.create as jest.Mock).mockResolvedValue({
        id: 'token-id',
        token: mockToken,
        userId: mockUser.id,
        expiresAt: new Date(),
      } as any);
      emailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      await service.requestPasswordReset(mockRequestDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockRequestDto.email },
        include: expect.any(Object),
      });
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should not reveal if user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await service.requestPasswordReset(mockRequestDto);

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const mockResetDto = {
      token: 'valid-token',
      newPassword: 'newPassword123',
    };

    it('should successfully reset password', async () => {
      const mockUser = TestUtils.createMockUser();
      const mockTokenRecord = {
        id: 'token-id',
        token: mockResetDto.token,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        usedAt: null,
        user: mockUser,
      };

      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(mockTokenRecord as any);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: any) => Promise<void>) => {
        const mockTx = {
          user: { update: jest.fn().mockResolvedValue(mockUser) },
          passwordResetToken: { update: jest.fn().mockResolvedValue(mockTokenRecord) },
        };
        return cb(mockTx as any);
      });

      await service.resetPassword(mockResetDto);

      expect(prisma.passwordResetToken.findUnique).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid token', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.resetPassword(mockResetDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      const mockTokenRecord = {
        id: 'token-id',
        token: mockResetDto.token,
        userId: 'user-id',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        usedAt: null,
      };

      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
        ...mockTokenRecord,
        user: { id: 'user-id', email: 'test@example.com' },
      } as any);

      await expect(service.resetPassword(mockResetDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    const mockChangeDto = {
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123',
    };
    const mockUserId = 'user-1';

    it('should successfully change password', async () => {
      const mockUser = TestUtils.createMockUser({
        id: mockUserId,
        passwordHash: 'hashed-old-password',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser as any);

      await service.changePassword(mockUserId, mockChangeDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserId },
        })
      );
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for incorrect current password', async () => {
      const mockUser = TestUtils.createMockUser({
        id: mockUserId,
        passwordHash: 'hashed-old-password',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(mockUserId, mockChangeDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.changePassword(mockUserId, mockChangeDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
