import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaService } from '../database/prisma.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import { EmailService } from '../email/email.service';
import { SchoolValidatorService } from '../schools/shared/school-validator.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationInboxService } from '../notification/notification-inbox.service';
import { SchoolSettingsService } from '../school-settings/school-settings.service';
import { TestUtils } from '../common/test/test-utils';
import { SessionStatus, TermStatus } from '@prisma/client';

describe('SessionService', () => {
  let service: SessionService;
  let prisma: jest.Mocked<PrismaService>;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: TestUtils.createMockPrismaService(),
        },
        {
          provide: SchoolRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: TestUtils.createMockEmailService(),
        },
        {
          provide: SchoolValidatorService,
          useValue: { validateSchoolActive: jest.fn() },
        },
        {
          provide: NotificationService,
          useValue: {},
        },
        {
          provide: NotificationInboxService,
          useValue: { createAndFanOut: jest.fn(), getAllSchoolMemberUserIds: jest.fn() },
        },
        {
          provide: SchoolSettingsService,
          useValue: {
            getWorkingDays: jest.fn().mockResolvedValue(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']),
            getTimetablePolicy: jest.fn().mockResolvedValue({ examBlackoutEnabled: true }),
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prisma = module.get(PrismaService);
    schoolRepository = module.get(SchoolRepository);
    emailService = module.get(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTerm', () => {
    const mockSchoolId = 'school-1';
    const mockSessionId = 'session-1';
    const mockDto = {
      name: 'First Term',
      number: '1',
      startDate: new Date('2024-09-01').toISOString(),
      endDate: new Date('2024-12-20').toISOString(),
    };

    it('should successfully create a term', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      const mockSession = {
        id: mockSessionId,
        schoolId: mockSchoolId,
        status: SessionStatus.ACTIVE,
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-07-31'),
      };
      const mockTerm = {
        id: 'term-1',
        name: mockDto.name,
        sessionId: mockSessionId,
        status: TermStatus.DRAFT,
      };

      schoolRepository.findById.mockResolvedValue(mockSchool as any);
      (prisma.academicSession.findFirst as jest.Mock).mockResolvedValue(mockSession as any);
      (prisma.term.findFirst as jest.Mock).mockResolvedValue(null); // No overlapping term
      (prisma.term.create as jest.Mock).mockResolvedValue(mockTerm as any);

      const result = await service.createTerm(mockSchoolId, mockSessionId, mockDto);

      expect(result).toHaveProperty('id', 'term-1');
    });

    it('should throw NotFoundException if session not found', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      schoolRepository.findById.mockResolvedValue(mockSchool as any);
      (prisma.academicSession.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.createTerm(mockSchoolId, mockSessionId, mockDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
