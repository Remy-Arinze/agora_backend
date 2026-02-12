import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { OtpService } from './otp.service';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { TestUtils } from '../common/test/test-utils';

describe('OtpService', () => {
  let service: OtpService;
  let prisma: jest.Mocked<PrismaService>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: PrismaService,
          useValue: TestUtils.createMockPrismaService(),
        },
        {
          provide: EmailService,
          useValue: TestUtils.createMockEmailService(),
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    prisma = module.get(PrismaService);
    emailService = module.get(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLoginSession', () => {
    const mockUserId = 'user-1';
    const mockEmail = 'test@example.com';

    it('should successfully create login session and send OTP', async () => {
      const mockSessionId = 'session-123';
      const mockOtp = '123456';
      const mockExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const mockUser = {
        id: mockUserId,
        firstName: 'Test',
        lastName: 'User',
      };

      (prisma.loginSession.count as jest.Mock).mockResolvedValue(0); // No recent requests
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (prisma.loginSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.loginSession.create as jest.Mock).mockResolvedValue({
        id: 'session-id',
        sessionId: mockSessionId,
        userId: mockUserId,
        email: mockEmail,
        otpCode: mockOtp,
        expiresAt: mockExpiresAt,
        attempts: 0,
        createdAt: new Date(),
      } as any);
      emailService.sendLoginOtpEmail = jest.fn().mockResolvedValue(undefined);

      const result = await service.createLoginSession(mockUserId, mockEmail);

      expect(prisma.loginSession.count).toHaveBeenCalled();
      expect(prisma.loginSession.create).toHaveBeenCalled();
      expect(emailService.sendLoginOtpEmail).toHaveBeenCalledWith(
        mockEmail,
        'Test User',
        expect.stringMatching(/^\d{6}$/)
      );
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should throw ThrottlerException if rate limit exceeded', async () => {
      (prisma.loginSession.count as jest.Mock).mockResolvedValue(3); // Exceeds limit

      await expect(service.createLoginSession(mockUserId, mockEmail)).rejects.toThrow(
        ThrottlerException
      );
    });
  });

  describe('verifyOtp', () => {
    const mockSessionId = 'session-123';
    const mockCode = '123456';

    it('should successfully verify OTP', async () => {
      const mockSession = {
        id: 'session-id',
        sessionId: mockSessionId,
        userId: 'user-1',
        email: 'test@example.com',
        otpCode: mockCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        attempts: 0,
        usedAt: null,
      };

      (prisma.loginSession.findUnique as jest.Mock).mockResolvedValue(mockSession as any);
      (prisma.loginSession.update as jest.Mock).mockResolvedValue({
        ...mockSession,
        usedAt: new Date(),
      } as any);

      const result = await service.verifyOtp(mockSessionId, mockCode);

      expect(prisma.loginSession.findUnique).toHaveBeenCalled();
      expect(prisma.loginSession.update).toHaveBeenCalled();
      expect(result).toBe(mockSession.userId);
    });

    it('should throw BadRequestException for invalid session', async () => {
      (prisma.loginSession.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyOtp(mockSessionId, mockCode)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException for expired OTP', async () => {
      const mockSession = {
        id: 'session-id',
        sessionId: mockSessionId,
        userId: 'user-1',
        email: 'test@example.com',
        otpCode: mockCode,
        expiresAt: new Date(Date.now() - 1000), // Expired
        attempts: 0,
        usedAt: null,
      };

      (prisma.loginSession.findUnique as jest.Mock).mockResolvedValue(mockSession as any);

      await expect(service.verifyOtp(mockSessionId, mockCode)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException for incorrect OTP', async () => {
      const mockSession = {
        id: 'session-id',
        sessionId: mockSessionId,
        userId: 'user-1',
        email: 'test@example.com',
        otpCode: '654321', // Different OTP
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        usedAt: null,
      };

      (prisma.loginSession.findUnique as jest.Mock).mockResolvedValue(mockSession as any);
      (prisma.loginSession.update as jest.Mock).mockResolvedValue({
        ...mockSession,
        attempts: 1,
      } as any);

      await expect(service.verifyOtp(mockSessionId, mockCode)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if max attempts exceeded', async () => {
      const mockSession = {
        id: 'session-id',
        sessionId: mockSessionId,
        userId: 'user-1',
        email: 'test@example.com',
        otpCode: '654321',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 5, // Max attempts
        usedAt: null,
      };

      (prisma.loginSession.findUnique as jest.Mock).mockResolvedValue(mockSession as any);

      await expect(service.verifyOtp(mockSessionId, mockCode)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
