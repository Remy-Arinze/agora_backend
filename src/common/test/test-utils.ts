import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/email.service';
import { CloudinaryService } from '../../storage/cloudinary/cloudinary.service';

/**
 * Test utilities for creating mock services
 * This helps maintain consistency across all test files
 */
export class TestUtils {
  /**
   * Creates a mock PrismaService with common methods
   */
  static createMockPrismaService(): jest.Mocked<PrismaService> {
    return {
      user: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
        upsert: jest.fn() as jest.Mock,
        count: jest.fn() as jest.Mock,
      },
      school: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
        count: jest.fn() as jest.Mock,
      },
      schoolAdmin: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      teacher: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      student: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
        count: jest.fn() as jest.Mock,
      },
      class: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      classArm: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      classLevel: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      enrollment: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      academicSession: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      term: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      timetable: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      timetablePeriod: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      grade: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      subject: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      classTeacher: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      event: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
      },
      applicationError: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
        count: jest.fn() as jest.Mock,
        groupBy: jest.fn() as jest.Mock,
      },
      passwordResetToken: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
        deleteMany: jest.fn() as jest.Mock,
      },
      otpCode: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
        deleteMany: jest.fn() as jest.Mock,
      },
      loginSession: {
        findUnique: jest.fn() as jest.Mock,
        findFirst: jest.fn() as jest.Mock,
        findMany: jest.fn() as jest.Mock,
        create: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
        delete: jest.fn() as jest.Mock,
        deleteMany: jest.fn() as jest.Mock,
        updateMany: jest.fn() as jest.Mock,
        count: jest.fn() as jest.Mock,
      },
      $transaction: jest.fn((callback) => {
        const mockTx = TestUtils.createMockPrismaService();
        return callback(mockTx);
      }) as jest.Mock,
    } as any;
  }

  /**
   * Creates a mock JwtService
   */
  static createMockJwtService(): jest.Mocked<JwtService> {
    return {
      sign: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    } as any;
  }

  /**
   * Creates a mock ConfigService
   */
  static createMockConfigService(): jest.Mocked<ConfigService> {
    return {
      get: jest.fn(),
    } as any;
  }

  /**
   * Creates a mock EmailService
   */
  static createMockEmailService(): jest.Mocked<EmailService> {
    return {
      sendPasswordResetEmail: jest.fn(),
      sendPasswordResetConfirmationEmail: jest.fn(),
      sendLoginOtpEmail: jest.fn(),
      sendSchoolProfileEditVerificationEmail: jest.fn(),
      verifyConnection: jest.fn(),
    } as any;
  }

  /**
   * Creates a mock CloudinaryService
   */
  static createMockCloudinaryService(): jest.Mocked<CloudinaryService> {
    return {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(),
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    } as any;
  }

  /**
   * Creates a mock user object
   */
  static createMockUser(overrides?: any) {
    return {
      id: 'user-1',
      email: 'test@example.com',
      phone: '+1234567890',
      passwordHash: 'hashed-password',
      accountStatus: 'ACTIVE',
      role: 'SCHOOL_ADMIN',
      firstName: 'Test',
      lastName: 'User',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Creates a mock school object
   */
  static createMockSchool(overrides?: any) {
    return {
      id: 'school-1',
      name: 'Test School',
      subdomain: 'test-school',
      country: 'Nigeria',
      isActive: true,
      hasPrimary: true,
      hasSecondary: false,
      hasTertiary: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }
}
