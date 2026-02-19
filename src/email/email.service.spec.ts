import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let configService: jest.Mocked<ConfigService>;
  let mockTransporter: any;

  beforeEach(async () => {
    mockTransporter = {
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                MAIL_HOST: 'smtp.example.com',
                MAIL_PORT: '587',
                MAIL_USER: 'test@example.com',
                MAIL_PASSWORD: 'password',
                MAIL_SECURE: 'false',
                FRONTEND_URL: 'http://localhost:3000',
                NODE_ENV: 'development',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPasswordResetEmail', () => {
    it('should successfully send password reset email', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const resetToken = 'reset-token-123';
      const role = 'SCHOOL_ADMIN';

      await service.sendPasswordResetEmail(email, name, resetToken, role);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: expect.stringContaining('Set Your Password'),
          html: expect.stringContaining(resetToken),
        })
      );
    });

    it('should successfully send password reset email for existing user with schools', async () => {
      const email = 'newuser@example.com';
      const name = 'New User';
      const resetToken = 'setup-token-123';
      const role = 'PRINCIPAL';
      const schools = [
        { name: 'School 1', publicId: 'SCH-001', role: 'Principal' },
      ];

      await service.sendPasswordResetEmail(email, name, resetToken, role, schools);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: expect.stringContaining('Reset Your Password'),
          html: expect.stringContaining(resetToken),
        })
      );
    });
  });

  describe('sendLoginOtpEmail', () => {
    it('should successfully send OTP email', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const otp = '123456';

      await service.sendLoginOtpEmail(email, name, otp);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: expect.stringContaining('Verification'),
          html: expect.stringContaining(otp),
        })
      );
    });
  });

  describe('sendSchoolProfileEditVerificationEmail', () => {
    it('should successfully send school profile edit verification email', async () => {
      const email = 'principal@example.com';
      const name = 'Principal Name';
      const schoolName = 'Test School';
      const token = 'verify-token-123';
      const verificationUrl = 'https://example.com/verify?token=verify-token-123';
      const changes = { name: 'New School Name' };

      await service.sendSchoolProfileEditVerificationEmail(
        email,
        name,
        schoolName,
        token,
        verificationUrl,
        changes
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: expect.stringContaining('Verify School Profile Changes'),
          html: expect.stringContaining(token),
        })
      );
    });
  });

  describe('verifyConnection', () => {
    it('should return true if connection is verified', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await service.verifyConnection();

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should return false if connection fails', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      const result = await service.verifyConnection();

      expect(result).toBe(false);
    });
  });

  describe('getFrontendUrl', () => {
    it('should return localhost in development', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'FRONTEND_URL') return undefined;
        return undefined;
      });

      // Access private method through any cast for testing
      const url = (service as any).getFrontendUrl();
      expect(url).toBe('http://localhost:3000');
    });

    it('should return production URL in production', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'FRONTEND_URL') return undefined;
        return undefined;
      });

      const url = (service as any).getFrontendUrl();
      expect(url).toBe('https://agora-schools.com');
    });

    it('should use explicit FRONTEND_URL if set', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://custom-url.com';
        return undefined;
      });

      const url = (service as any).getFrontendUrl();
      expect(url).toBe('https://custom-url.com');
    });
  });
});
