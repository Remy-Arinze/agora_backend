import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SchoolRepository } from '../../domain/repositories/school.repository';
import { StaffRepository } from '../../domain/repositories/staff.repository';
import { StaffMapper } from '../../domain/mappers/staff.mapper';
import { IdGeneratorService } from '../../shared/id-generator.service';
import { StaffValidatorService } from '../../shared/staff-validator.service';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../../../auth/auth.service';

describe('AdminService', () => {
  let service: AdminService;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let staffRepository: jest.Mocked<StaffRepository>;
  let idGenerator: jest.Mocked<IdGeneratorService>;
  let staffValidator: jest.Mocked<StaffValidatorService>;
  let prisma: jest.Mocked<PrismaService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: SchoolRepository,
          useValue: {
            findByIdOrSubdomain: jest.fn(),
          },
        },
        {
          provide: StaffRepository,
          useValue: {
            findAdminById: jest.fn(),
            createAdmin: jest.fn(),
            updateAdmin: jest.fn(),
            deleteAdmin: jest.fn(),
            findAdminsBySchool: jest.fn(),
          },
        },
        {
          provide: StaffMapper,
          useValue: {
            toAdminDto: jest.fn(),
          },
        },
        {
          provide: IdGeneratorService,
          useValue: {
            generateAdminId: jest.fn(),
            generatePrincipalId: jest.fn(),
            generatePublicId: jest.fn(),
          },
        },
        {
          provide: StaffValidatorService,
          useValue: {
            validateStaffData: jest.fn(),
            validateEmailUniqueInSchool: jest.fn(),
            validatePhoneUniqueInSchool: jest.fn(),
            validatePrincipalRole: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            schoolAdmin: {
              findFirst: jest.fn(),
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

    service = module.get<AdminService>(AdminService);
    schoolRepository = module.get(SchoolRepository);
    staffRepository = module.get(StaffRepository);
    idGenerator = module.get(IdGeneratorService);
    staffValidator = module.get(StaffValidatorService);
    prisma = module.get(PrismaService);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addAdmin', () => {
    const mockSchool = { id: 'school-1', name: 'Test School' };
    const mockAdminData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      role: 'Administrator',
    };

    it('should successfully add an admin', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffValidator.validateStaffData.mockReturnValue(undefined);
      staffValidator.validateEmailUniqueInSchool.mockResolvedValue(undefined);
      staffValidator.validatePhoneUniqueInSchool.mockResolvedValue(undefined);
      idGenerator.generateAdminId.mockResolvedValue('AD-123');
      idGenerator.generatePublicId.mockResolvedValue('AG-TEST-ABC123');
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'user-1' }),
          },
        };
        return callback(mockTx);
      });
      staffRepository.createAdmin.mockResolvedValue({
        id: 'admin-1',
        ...mockAdminData,
      } as any);

      const result = await service.addAdmin('school-1', mockAdminData);

      expect(schoolRepository.findByIdOrSubdomain).toHaveBeenCalledWith('school-1');
      expect(staffValidator.validateStaffData).toHaveBeenCalledWith(mockAdminData);
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if school not found', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(null);

      await expect(service.addAdmin('invalid-school', mockAdminData)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffValidator.validateEmailUniqueInSchool.mockRejectedValue(
        new ConflictException('Email already exists')
      );

      await expect(service.addAdmin('school-1', mockAdminData)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateAdmin', () => {
    const mockSchool = { id: 'school-1' };
    const mockAdmin = {
      id: 'admin-1',
      schoolId: 'school-1',
      role: 'Administrator',
    };

    it('should successfully update an admin', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffRepository.findAdminById.mockResolvedValue(mockAdmin as any);
      staffRepository.updateAdmin.mockResolvedValue({
        ...mockAdmin,
        firstName: 'Updated',
      } as any);
      staffMapper.toAdminDto.mockReturnValue({ id: 'admin-1', firstName: 'Updated' } as any);

      const result = await service.updateAdmin('school-1', 'admin-1', {
        firstName: 'Updated',
      });

      expect(result).toBeDefined();
      expect(staffRepository.updateAdmin).toHaveBeenCalled();
    });

    it('should throw BadRequestException if admin not found', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffRepository.findAdminById.mockResolvedValue(null);

      await expect(
        service.updateAdmin('school-1', 'invalid-admin', { firstName: 'Updated' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAdmin', () => {
    const mockSchool = { id: 'school-1', isActive: true };
    const mockAdmin = {
      id: 'admin-1',
      schoolId: 'school-1',
      role: 'Administrator',
    };

    it('should successfully delete an admin', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffRepository.findAdminById.mockResolvedValue(mockAdmin as any);
      staffRepository.deleteAdmin.mockResolvedValue(undefined);

      await service.deleteAdmin('school-1', 'admin-1');

      expect(staffRepository.deleteAdmin).toHaveBeenCalledWith('admin-1');
    });

    it('should throw BadRequestException if admin is principal and active', async () => {
      const principalAdmin = { ...mockAdmin, role: 'Principal', user: { accountStatus: 'ACTIVE' } };
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffRepository.findAdminById.mockResolvedValue(principalAdmin as any);
      prisma.schoolAdmin.findFirst.mockResolvedValue(principalAdmin as any);

      await expect(service.deleteAdmin('school-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });
  });
});
