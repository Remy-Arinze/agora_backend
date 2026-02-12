import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { SchoolRepository } from '../../domain/repositories/school.repository';
import { StaffRepository } from '../../domain/repositories/staff.repository';
import { StaffMapper } from '../../domain/mappers/staff.mapper';
import { IdGeneratorService } from '../../shared/id-generator.service';
import { StaffValidatorService } from '../../shared/staff-validator.service';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../../../auth/auth.service';
import { CloudinaryService } from '../../../storage/cloudinary/cloudinary.service';
import { TestUtils } from '../../../common/test/test-utils';

describe('TeacherService', () => {
  let service: TeacherService;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let staffRepository: jest.Mocked<StaffRepository>;
  let staffMapper: jest.Mocked<StaffMapper>;
  let idGenerator: jest.Mocked<IdGeneratorService>;
  let staffValidator: jest.Mocked<StaffValidatorService>;
  let prisma: jest.Mocked<PrismaService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherService,
        {
          provide: SchoolRepository,
          useValue: {
            findByIdOrSubdomain: jest.fn(),
          },
        },
        {
          provide: StaffRepository,
          useValue: {
            findTeacherById: jest.fn(),
            createTeacher: jest.fn(),
            updateTeacher: jest.fn(),
            deleteTeacher: jest.fn(),
          },
        },
        {
          provide: StaffMapper,
          useValue: {
            toTeacherDto: jest.fn(),
          },
        },
        {
          provide: IdGeneratorService,
          useValue: {
            generateTeacherId: jest.fn(),
            generatePublicId: jest.fn(),
          },
        },
        {
          provide: StaffValidatorService,
          useValue: {
            validateStaffData: jest.fn(),
            validateEmailUniqueInSchool: jest.fn(),
            validatePhoneUniqueInSchool: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            ...TestUtils.createMockPrismaService(),
            $transaction: jest.fn((callback: (tx: any) => Promise<any>) =>
              callback(TestUtils.createMockPrismaService() as any)
            ),
          },
        },
        {
          provide: AuthService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
            sendPasswordResetForNewUser: jest.fn(),
          },
        },
        {
          provide: CloudinaryService,
          useValue: TestUtils.createMockCloudinaryService(),
        },
      ],
    }).compile();

    service = module.get<TeacherService>(TeacherService);
    schoolRepository = module.get(SchoolRepository);
    staffRepository = module.get(StaffRepository);
    staffMapper = module.get(StaffMapper);
    idGenerator = module.get(IdGeneratorService);
    staffValidator = module.get(StaffValidatorService);
    prisma = module.get(PrismaService);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addTeacher', () => {
    const mockSchool = { id: 'school-1', name: 'Test School' };
    const mockTeacherData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '+1234567890',
      subject: 'Mathematics',
      isTemporary: false,
    };

    it('should successfully add a teacher', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffValidator.validateStaffData.mockReturnValue(undefined);
      staffValidator.validateEmailUniqueInSchool.mockResolvedValue(undefined);
      staffValidator.validatePhoneUniqueInSchool.mockResolvedValue(undefined);
      idGenerator.generateTeacherId.mockResolvedValue('TE-123');
      idGenerator.generatePublicId.mockResolvedValue('AG-TEST-XYZ789');
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        const mockTx = TestUtils.createMockPrismaService();
        (mockTx.user.findUnique as jest.Mock).mockResolvedValue(null);
        (mockTx.user.create as jest.Mock).mockResolvedValue({ id: 'user-1' });
        (mockTx.teacher.create as jest.Mock).mockResolvedValue({
          id: 'teacher-1',
          publicId: 'AG-TEST-XYZ789',
          school: { id: 'school-1', name: 'Test School' },
          user: { id: 'user-1' },
        } as any);
        return callback(mockTx as any);
      });
      staffRepository.createTeacher.mockResolvedValue({
        id: 'teacher-1',
        ...mockTeacherData,
      } as any);
      staffMapper.toTeacherDto.mockReturnValue({ id: 'teacher-1' } as any);

      const result = await service.addTeacher('school-1', mockTeacherData);

      expect(schoolRepository.findByIdOrSubdomain).toHaveBeenCalledWith('school-1');
      expect(staffValidator.validateStaffData).toHaveBeenCalledWith(mockTeacherData);
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if school not found', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(null);

      await expect(service.addTeacher('invalid-school', mockTeacherData)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('updateTeacher', () => {
    const mockSchool = { id: 'school-1' };
    const mockTeacher = {
      id: 'teacher-1',
      schoolId: 'school-1',
    };

    it('should successfully update a teacher', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffRepository.findTeacherById.mockResolvedValue(mockTeacher as any);
      staffRepository.updateTeacher.mockResolvedValue({
        ...mockTeacher,
        subject: 'Updated Subject',
      } as any);
      staffMapper.toTeacherDto.mockReturnValue({
        id: 'teacher-1',
        subject: 'Updated Subject',
      } as any);

      const result = await service.updateTeacher('school-1', 'teacher-1', {
        subject: 'Updated Subject',
      });

      expect(result).toBeDefined();
      expect(staffRepository.updateTeacher).toHaveBeenCalled();
    });
  });

  describe('deleteTeacher', () => {
    const mockSchool = { id: 'school-1' };
    const mockTeacher = {
      id: 'teacher-1',
      schoolId: 'school-1',
    };

    it('should successfully delete a teacher', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffRepository.findTeacherById.mockResolvedValue(mockTeacher as any);
      staffRepository.deleteTeacher.mockResolvedValue(mockTeacher as any);

      await service.deleteTeacher('school-1', 'teacher-1');

      expect(staffRepository.deleteTeacher).toHaveBeenCalledWith('teacher-1');
    });
  });
});
