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
import { TestUtils } from '../common/test/test-utils';
import { InitializeSessionDto, SessionType } from './dto/initialize-session.dto';
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
            findByIdOrSubdomain: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: TestUtils.createMockEmailService(),
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

  describe('initializeSession', () => {
    const mockSchoolId = 'school-1';
    const startDate = new Date('2024-09-01');
    const endDate = new Date('2025-07-31');
    const mockDto: InitializeSessionDto = {
      name: '2024/2025',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      schoolType: 'PRIMARY',
      type: SessionType.NEW_SESSION,
    };

    it('should successfully initialize a new session', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      const mockSession = {
        id: 'session-1',
        name: mockDto.name,
        schoolId: mockSchoolId,
        status: SessionStatus.DRAFT,
        schoolType: mockDto.schoolType,
      };

      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      (prisma.academicSession.findFirst as jest.Mock).mockResolvedValue(null); // No active session
      (prisma.academicSession.create as jest.Mock).mockResolvedValue(mockSession as any);

      const result = await service.initializeSession(mockSchoolId, mockDto);

      expect(schoolRepository.findByIdOrSubdomain).toHaveBeenCalledWith(mockSchoolId);
      expect(result).toHaveProperty('id', 'session-1');
    });

    it('should throw BadRequestException if school not found', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(null);

      await expect(service.initializeSession(mockSchoolId, mockDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw ConflictException if active session exists', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      const activeSession = {
        id: 'active-session',
        name: '2023/2024',
        status: SessionStatus.ACTIVE,
        schoolType: 'PRIMARY',
      };

      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      (prisma.academicSession.findFirst as jest.Mock).mockResolvedValue(activeSession as any);

      await expect(service.initializeSession(mockSchoolId, mockDto)).rejects.toThrow(
        ConflictException
      );
    });

    it('should throw BadRequestException if session duration is too short', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      const shortEndDate = new Date(startDate);
      shortEndDate.setMonth(shortEndDate.getMonth() + 5); // Only 5 months

      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      (prisma.academicSession.findFirst as jest.Mock).mockResolvedValue(null);

      const invalidDto = {
        ...mockDto,
        endDate: shortEndDate.toISOString(),
      };

      await expect(service.initializeSession(mockSchoolId, invalidDto)).rejects.toThrow(
        BadRequestException
      );
    });
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

      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      (prisma.academicSession.findFirst as jest.Mock).mockResolvedValue(mockSession as any);
      (prisma.term.findFirst as jest.Mock).mockResolvedValue(null); // No overlapping term
      (prisma.term.create as jest.Mock).mockResolvedValue(mockTerm as any);

      const result = await service.createTerm(mockSchoolId, mockSessionId, mockDto);

      expect(result).toHaveProperty('id', 'term-1');
    });

    it('should throw NotFoundException if session not found', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      (prisma.academicSession.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.createTerm(mockSchoolId, mockSessionId, mockDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
