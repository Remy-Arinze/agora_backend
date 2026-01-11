import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { SuperAdminSchoolsService } from './super-admin-schools.service';
import { SchoolRepository } from '../domain/repositories/school.repository';
import { StaffRepository } from '../domain/repositories/staff.repository';
import { SchoolMapper } from '../domain/mappers/school.mapper';
import { IdGeneratorService } from '../shared/id-generator.service';
import { SchoolValidatorService } from '../shared/school-validator.service';
import { StaffValidatorService } from '../shared/staff-validator.service';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../../auth/auth.service';

describe('SuperAdminSchoolsService', () => {
  let service: SuperAdminSchoolsService;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let schoolMapper: jest.Mocked<SchoolMapper>;
  let idGenerator: jest.Mocked<IdGeneratorService>;
  let schoolValidator: jest.Mocked<SchoolValidatorService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminSchoolsService,
        {
          provide: SchoolRepository,
          useValue: {
            findById: jest.fn(),
            findByIdOrSubdomain: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: StaffRepository,
          useValue: {
            createAdmin: jest.fn(),
          },
        },
        {
          provide: SchoolMapper,
          useValue: {
            toDto: jest.fn(),
            toDtoArray: jest.fn(),
          },
        },
        {
          provide: IdGeneratorService,
          useValue: {
            generateSchoolId: jest.fn(),
            generatePrincipalId: jest.fn(),
            generateAdminId: jest.fn(),
            generatePublicId: jest.fn(),
          },
        },
        {
          provide: SchoolValidatorService,
          useValue: {
            validateSchoolData: jest.fn(),
            validateSubdomainUnique: jest.fn(),
            validateSchoolExists: jest.fn(),
          },
        },
        {
          provide: StaffValidatorService,
          useValue: {
            validatePrincipalRole: jest.fn(),
            validateStaffData: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            school: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
          },
        },
        {
          provide: AuthService,
          useValue: {
            sendPasswordResetForNewUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SuperAdminSchoolsService>(SuperAdminSchoolsService);
    schoolRepository = module.get(SchoolRepository);
    schoolMapper = module.get(SchoolMapper);
    idGenerator = module.get(IdGeneratorService);
    schoolValidator = module.get(SchoolValidatorService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSchool', () => {
    const mockCreateSchoolDto = {
      name: 'Test School',
      subdomain: 'test-school',
      country: 'Nigeria',
    };

    it('should successfully create a school', async () => {
      schoolValidator.validateSchoolData.mockReturnValue(undefined);
      schoolValidator.validateSubdomainUnique.mockResolvedValue(undefined);
      idGenerator.generateSchoolId.mockResolvedValue('SCH-123');
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          school: {
            create: jest.fn().mockResolvedValue({ id: 'school-1', ...mockCreateSchoolDto }),
          },
          user: {
            findUnique: jest.fn(),
            create: jest.fn(),
          },
        };
        return callback(mockTx);
      });
      prisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        admins: [],
        teachers: [],
        enrollments: [],
      } as any);
      schoolMapper.toDto.mockReturnValue({ id: 'school-1' } as any);

      const result = await service.createSchool(mockCreateSchoolDto);

      expect(schoolValidator.validateSubdomainUnique).toHaveBeenCalledWith('test-school');
      expect(result).toBeDefined();
    });

    it('should throw ConflictException if subdomain already exists', async () => {
      schoolValidator.validateSubdomainUnique.mockRejectedValue(
        new ConflictException('Subdomain already exists')
      );

      await expect(service.createSchool(mockCreateSchoolDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all schools', async () => {
      const mockSchools = [{ id: 'school-1' }, { id: 'school-2' }];
      prisma.school.findMany.mockResolvedValue(mockSchools as any);
      schoolMapper.toDtoArray.mockReturnValue(mockSchools as any);

      const result = await service.findAll();

      expect(result).toEqual(mockSchools);
      expect(schoolMapper.toDtoArray).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a school by ID', async () => {
      const mockSchool = { id: 'school-1' };
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      prisma.school.findUnique.mockResolvedValue({
        ...mockSchool,
        admins: [],
        teachers: [],
        enrollments: [],
      } as any);
      schoolMapper.toDto.mockReturnValue(mockSchool as any);

      const result = await service.findOne('school-1');

      expect(result).toEqual(mockSchool);
    });

    it('should throw BadRequestException if school not found', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(BadRequestException);
    });
  });
});
