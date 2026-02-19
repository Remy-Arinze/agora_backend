import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventService } from './event.service';
import { PrismaService } from '../database/prisma.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import { GoogleCalendarService } from '../integrations/google-calendar/google-calendar.service';
import { TestUtils } from '../common/test/test-utils';
import { CreateEventDto } from './dto/create-event.dto';

describe('EventService', () => {
  let service: EventService;
  let prisma: jest.Mocked<PrismaService>;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let googleCalendarService: jest.Mocked<GoogleCalendarService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
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
          provide: GoogleCalendarService,
          useValue: {
            createEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    prisma = module.get(PrismaService);
    schoolRepository = module.get(SchoolRepository);
    googleCalendarService = module.get(GoogleCalendarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEvent', () => {
    const mockSchoolId = 'school-1';
    const mockDto: CreateEventDto = {
      title: 'Test Event',
      description: 'Test Description',
      startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endDate: new Date(Date.now() + 86400000 + 3600000).toISOString(), // Tomorrow + 1 hour
      type: 'MEETING',
      schoolType: 'PRIMARY',
    };

    it('should successfully create an event', async () => {
      const mockSchool = TestUtils.createMockSchool({
        id: mockSchoolId,
        hasPrimary: true,
      });
      const mockEvent = {
        id: 'event-1',
        ...mockDto,
        schoolId: mockSchoolId,
      };

      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      (prisma as any).event = {
        create: jest.fn().mockResolvedValue(mockEvent),
      };

      const result = await service.createEvent(mockSchoolId, mockDto);

      expect(schoolRepository.findByIdOrSubdomain).toHaveBeenCalledWith(mockSchoolId);
      expect(result).toHaveProperty('id', 'event-1');
    });

    it('should throw BadRequestException if school not found', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(null);

      await expect(service.createEvent(mockSchoolId, mockDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if start date is after end date', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);

      const invalidDto = {
        ...mockDto,
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now()).toISOString(), // Before start date
      };

      await expect(service.createEvent(mockSchoolId, invalidDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if school does not have the specified type', async () => {
      const mockSchool = TestUtils.createMockSchool({
        id: mockSchoolId,
        hasPrimary: false,
        hasSecondary: true,
      });
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);

      await expect(service.createEvent(mockSchoolId, mockDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
