import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { PrismaService } from '../database/prisma.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import { StaffRepository } from '../schools/domain/repositories/staff.repository';
import { TestUtils } from '../common/test/test-utils';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { CreateGradeDto, GradeType } from './dto/grade.dto';

describe('GradesService', () => {
  let service: GradesService;
  let prisma: jest.Mocked<PrismaService>;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let staffRepository: jest.Mocked<StaffRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradesService,
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
          provide: StaffRepository,
          useValue: {
            findTeacherByTeacherId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GradesService>(GradesService);
    prisma = module.get(PrismaService);
    schoolRepository = module.get(SchoolRepository);
    staffRepository = module.get(StaffRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGrade', () => {
    const mockSchoolId = 'school-1';
    const mockUser: UserWithContext = {
      id: 'user-1',
      currentProfileId: 'teacher-1',
    } as UserWithContext;
    const mockDto: CreateGradeDto = {
      enrollmentId: 'enrollment-1',
      subjectId: 'subject-1',
      gradeType: GradeType.CA,
      score: 75,
      maxScore: 100,
      assessmentDate: new Date().toISOString(),
      term: 'First Term',
    };

    it('should successfully create a grade', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      const mockTeacher = {
        id: 'teacher-1',
        schoolId: mockSchoolId,
      };
      const mockEnrollment = {
        id: 'enrollment-1',
        schoolId: mockSchoolId,
        isActive: true,
        academicYear: '2024/2025',
        classArmId: 'class-arm-1',
        classId: null,
        student: { id: 'student-1' },
        school: { id: mockSchoolId },
      };
      const mockGrade = {
        id: 'grade-1',
        enrollmentId: mockDto.enrollmentId,
        subjectId: 'subject-1',
        subject: 'Math',
        gradeType: mockDto.gradeType,
        assessmentName: null,
        assessmentDate: new Date(mockDto.assessmentDate!),
        sequence: null,
        score: { toNumber: () => 75 },
        maxScore: { toNumber: () => 100 },
        term: 'First Term',
        academicYear: '2024/2025',
        teacherId: 'teacher-1',
        remarks: null,
        isPublished: false,
        signedAt: new Date(),
        createdAt: new Date(),
        enrollment: {
          student: {
            id: 'student-1',
            firstName: 'John',
            lastName: 'Doe',
            uid: 'STU-001',
          },
        },
        teacher: {
          id: 'teacher-1',
          firstName: 'Jane',
          lastName: 'Smith',
          subject: 'Mathematics',
        },
      };

      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffRepository.findTeacherByTeacherId.mockResolvedValue(mockTeacher as any);
      (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment as any);
      (prisma.subject.findUnique as jest.Mock).mockResolvedValue({ id: 'subject-1', name: 'Math' } as any);
      (prisma.classTeacher.findFirst as jest.Mock).mockResolvedValue({ id: 'ct-1' } as any);
      (prisma.grade.create as jest.Mock).mockResolvedValue(mockGrade as any);

      const result = await service.createGrade(mockSchoolId, mockDto, mockUser);

      expect(schoolRepository.findByIdOrSubdomain).toHaveBeenCalledWith(mockSchoolId);
      expect(result).toHaveProperty('id', 'grade-1');
    });

    it('should throw ForbiddenException if teacher profile not found', async () => {
      const mockUserWithoutProfile: UserWithContext = {
        id: 'user-1',
        currentProfileId: null,
      } as UserWithContext;

      await expect(service.createGrade(mockSchoolId, mockDto, mockUserWithoutProfile)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw NotFoundException if school not found', async () => {
      schoolRepository.findByIdOrSubdomain.mockResolvedValue(null);

      await expect(service.createGrade(mockSchoolId, mockDto, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException if score is invalid', async () => {
      const mockSchool = TestUtils.createMockSchool({ id: mockSchoolId });
      const mockTeacher = {
        id: 'teacher-1',
        schoolId: mockSchoolId,
      };
      const mockEnrollment = {
        id: 'enrollment-1',
        schoolId: mockSchoolId,
        isActive: true,
      };

      schoolRepository.findByIdOrSubdomain.mockResolvedValue(mockSchool as any);
      staffRepository.findTeacherByTeacherId.mockResolvedValue(mockTeacher as any);
      (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment as any);

      const invalidDto = { ...mockDto, score: 150, maxScore: 100 };

      await expect(service.createGrade(mockSchoolId, invalidDto, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
