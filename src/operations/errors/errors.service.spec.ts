import { Test, TestingModule } from '@nestjs/testing';
import { ErrorsService, CreateErrorDto } from './errors.service';
import { PrismaService } from '../../database/prisma.service';
import { TestUtils } from '../../common/test/test-utils';
import { ErrorSeverity, ErrorStatus } from '@prisma/client';

describe('ErrorsService', () => {
  let service: ErrorsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorsService,
        {
          provide: PrismaService,
          useValue: TestUtils.createMockPrismaService(),
        },
      ],
    }).compile();

    service = module.get<ErrorsService>(ErrorsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('captureError', () => {
    const mockErrorDto: CreateErrorDto = {
      errorType: 'BadRequestException',
      message: 'Test error message',
      stackTrace: 'Error stack trace',
      context: {
        method: 'POST',
        path: '/api/test',
        ip: '127.0.0.1',
      },
      severity: ErrorSeverity.MEDIUM,
      schoolId: 'school-1',
      userId: 'user-1',
    };

    it('should successfully capture a new error', async () => {
      const mockErrorId = 'ERR-1234567890-ABCDEF';
      const mockError = {
        id: 'error-id',
        errorId: mockErrorId,
        ...mockErrorDto,
        status: ErrorStatus.UNRESOLVED,
        occurrences: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
      };

      (prisma.applicationError.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.applicationError.create as jest.Mock).mockResolvedValue(mockError as any);

      await service.captureError(mockErrorDto);

      expect(prisma.applicationError.findFirst).toHaveBeenCalled();
      expect(prisma.applicationError.create).toHaveBeenCalled();
    });

    it('should update existing error and increment occurrences', async () => {
      const existingError = {
        id: 'error-id',
        errorId: 'ERR-1234567890-ABCDEF',
        occurrences: 5,
        lastSeen: new Date(Date.now() - 3600000),
      };

      (prisma.applicationError.findFirst as jest.Mock).mockResolvedValue(existingError as any);
      (prisma.applicationError.update as jest.Mock).mockResolvedValue({
        ...existingError,
        occurrences: 6,
        lastSeen: new Date(),
      } as any);

      await service.captureError(mockErrorDto);

      expect(prisma.applicationError.update).toHaveBeenCalled();
      expect(prisma.applicationError.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            occurrences: { increment: 1 },
          }),
        })
      );
    });
  });

  describe('getErrorsBySchool', () => {
    it('should return errors for a school with filters', async () => {
      const mockErrors = [
        {
          id: 'error-1',
          errorId: 'ERR-1',
          errorType: 'BadRequestException',
          message: 'Error 1',
          severity: ErrorSeverity.MEDIUM,
          status: ErrorStatus.UNRESOLVED,
        },
        {
          id: 'error-2',
          errorId: 'ERR-2',
          errorType: 'NotFoundException',
          message: 'Error 2',
          severity: ErrorSeverity.HIGH,
          status: ErrorStatus.UNRESOLVED,
        },
      ];

      (prisma.applicationError.findMany as jest.Mock).mockResolvedValue(mockErrors as any);
      (prisma.applicationError.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getErrorsBySchool('school-1', {
        severity: ErrorSeverity.MEDIUM,
        limit: 10,
        offset: 0,
      });

      expect(prisma.applicationError.findMany).toHaveBeenCalled();
      expect(result.errors).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('getErrorById', () => {
    it('should return error by errorId', async () => {
      const mockError = {
        id: 'error-id',
        errorId: 'ERR-1234567890-ABCDEF',
        errorType: 'BadRequestException',
        message: 'Test error',
        severity: ErrorSeverity.MEDIUM,
        status: ErrorStatus.UNRESOLVED,
      };

      (prisma.applicationError.findUnique as jest.Mock).mockResolvedValue(mockError as any);

      const result = await service.getErrorById('ERR-1234567890-ABCDEF');

      expect(prisma.applicationError.findUnique).toHaveBeenCalled();
      expect(result).toEqual(mockError);
    });
  });

  describe('updateErrorStatus', () => {
    it('should successfully update error status', async () => {
      const mockError = {
        id: 'error-id',
        errorId: 'ERR-1234567890-ABCDEF',
        status: ErrorStatus.UNRESOLVED,
      };

      (prisma.applicationError.findUnique as jest.Mock).mockResolvedValue(mockError as any);
      (prisma.applicationError.update as jest.Mock).mockResolvedValue({
        ...mockError,
        status: ErrorStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy: 'user-1',
      } as any);

      const result = await service.updateErrorStatus(
        'ERR-1234567890-ABCDEF',
        ErrorStatus.RESOLVED,
        'user-1'
      );

      expect(prisma.applicationError.update).toHaveBeenCalled();
      expect(result.status).toBe(ErrorStatus.RESOLVED);
    });
  });

  describe('getErrorStats', () => {
    it('should return error statistics for a school', async () => {
      const mockStats = {
        total: 10,
        bySeverity: {
          LOW: 2,
          MEDIUM: 5,
          HIGH: 2,
          CRITICAL: 1,
        },
        byStatus: {
          UNRESOLVED: 7,
          INVESTIGATING: 2,
          RESOLVED: 1,
          IGNORED: 0,
        },
      };

      (prisma.applicationError.count as jest.Mock).mockResolvedValue(10);
      (prisma.applicationError.findMany as jest.Mock).mockResolvedValue([
        { severity: ErrorSeverity.LOW, status: ErrorStatus.UNRESOLVED, errorType: 'Error1', firstSeen: new Date() },
        { severity: ErrorSeverity.LOW, status: ErrorStatus.UNRESOLVED, errorType: 'Error2', firstSeen: new Date() },
        { severity: ErrorSeverity.MEDIUM, status: ErrorStatus.UNRESOLVED, errorType: 'Error3', firstSeen: new Date() },
        { severity: ErrorSeverity.MEDIUM, status: ErrorStatus.UNRESOLVED, errorType: 'Error4', firstSeen: new Date() },
        { severity: ErrorSeverity.MEDIUM, status: ErrorStatus.UNRESOLVED, errorType: 'Error5', firstSeen: new Date() },
        { severity: ErrorSeverity.MEDIUM, status: ErrorStatus.UNRESOLVED, errorType: 'Error6', firstSeen: new Date() },
        { severity: ErrorSeverity.MEDIUM, status: ErrorStatus.UNRESOLVED, errorType: 'Error7', firstSeen: new Date() },
        { severity: ErrorSeverity.HIGH, status: ErrorStatus.INVESTIGATING, errorType: 'Error8', firstSeen: new Date() },
        { severity: ErrorSeverity.HIGH, status: ErrorStatus.INVESTIGATING, errorType: 'Error9', firstSeen: new Date() },
        { severity: ErrorSeverity.CRITICAL, status: ErrorStatus.RESOLVED, errorType: 'Error10', firstSeen: new Date() },
      ] as any);

      const result = await service.getErrorStats('school-1');

      expect(prisma.applicationError.count).toHaveBeenCalled();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('bySeverity');
      expect(result).toHaveProperty('byStatus');
    });
  });
});
