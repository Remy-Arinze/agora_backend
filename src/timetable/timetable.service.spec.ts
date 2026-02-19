import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { PrismaService } from '../database/prisma.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import { TestUtils } from '../common/test/test-utils';
import { CreateTimetablePeriodDto, DayOfWeek, PeriodType } from './dto/create-timetable-period.dto';

describe('TimetableService', () => {
  let service: TimetableService;
  let prisma: jest.Mocked<PrismaService>;
  let schoolRepository: jest.Mocked<SchoolRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableService,
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
      ],
    }).compile();

    service = module.get<TimetableService>(TimetableService);
    prisma = module.get(PrismaService);
    schoolRepository = module.get(SchoolRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPeriod', () => {
    const mockSchoolId = 'school-1';
    const mockDto: CreateTimetablePeriodDto = {
      termId: 'term-1',
      classId: 'class-1',
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '08:00',
      endTime: '09:00',
      type: PeriodType.LESSON,
      subjectId: 'subject-1',
      teacherId: 'teacher-1',
    };

    it('should successfully create a timetable period', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      const mockTerm = {
        id: 'term-1',
        academicSession: { schoolId: mockSchoolId },
      };
      const mockClass = {
        id: 'class-1',
        schoolId: mockSchoolId,
      };
      const mockPeriod = {
        id: 'period-1',
        ...mockDto,
        schoolId: mockSchoolId,
      };

      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      (prisma.term.findUnique as jest.Mock).mockResolvedValue(mockTerm as any);
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(mockClass as any);
      (prisma as any).timetablePeriod = {
        findMany: jest.fn().mockResolvedValue([]), // No conflicts
        create: jest.fn().mockResolvedValue(mockPeriod),
      };

      const result = await service.createPeriod(mockSchoolId, mockDto);

      expect(schoolRepository.findByIdOrSubdomain).toHaveBeenCalledWith(mockSchoolId);
      expect(result).toHaveProperty('id', 'period-1');
    });

    it('should throw BadRequestException if school not found', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(null);

      await expect(service.createPeriod(mockSchoolId, mockDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException if term not found', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      (prisma.term.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createPeriod(mockSchoolId, mockDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if neither classId nor classArmId provided', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      const mockTerm = {
        id: 'term-1',
        academicSession: { schoolId: mockSchoolId },
      };

      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      (prisma.term.findUnique as jest.Mock).mockResolvedValue(mockTerm as any);

      const invalidDto = { ...mockDto };
      delete invalidDto.classId;

      await expect(service.createPeriod(mockSchoolId, invalidDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('detectConflicts', () => {
    it('should detect teacher conflicts', async () => {
      const mockSchoolId = 'school-1';
      const mockDto: CreateTimetablePeriodDto = {
        termId: 'term-1',
        classId: 'class-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '08:00',
        endTime: '09:00',
        type: PeriodType.LESSON,
        subjectId: 'subject-1',
        teacherId: 'teacher-1',
      };

      const conflictingPeriod = {
        id: 'period-2',
        teacherId: 'teacher-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '08:00',
        endTime: '09:00',
      };

      (prisma as any).timetablePeriod = {
        findMany: jest.fn().mockResolvedValue([conflictingPeriod]),
      };

      const conflict = await (service as any).detectConflicts(mockDto, mockSchoolId);

      expect(conflict).toBeDefined();
      expect(conflict.type).toBe('TEACHER');
    });
  });
});
