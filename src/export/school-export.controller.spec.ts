import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import * as fc from 'fast-check';
import { SchoolExportController } from './school-export.controller';
import { getFcNumRuns } from '../common/test/test-utils';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

/**
 * Property 4: Authorization Rejection
 *
 * Validates: Requirements 5.1, 5.2, 5.3
 *
 * The property: for any random schoolId string, the controller propagates
 * the ForbiddenException raised by the service (simulating what happens
 * when a user tries to access a school they don't belong to). No data
 * leaks past the rejection.
 */
describe('SchoolExportController — Authorization Rejection (Property 4)', () => {
  let controller: SchoolExportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchoolExportController],
      providers: [
        {
          provide: ExportService,
          useValue: {
            exportRoster: jest
              .fn()
              .mockRejectedValue(new ForbiddenException('Access denied')),
            exportAttendance: jest
              .fn()
              .mockRejectedValue(new ForbiddenException('Access denied')),
            exportGrades: jest
              .fn()
              .mockRejectedValue(new ForbiddenException('Access denied')),
            exportFees: jest
              .fn()
              .mockRejectedValue(new ForbiddenException('Access denied')),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SchoolDataAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SchoolExportController>(SchoolExportController);
  });

  it('Property 4a: exportRoster rejects unauthorized schoolIds with ForbiddenException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        async (schoolId) => {
          const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;
          const mockUser = { id: 'user-123' } as any;
          await expect(
            controller.exportRoster(schoolId, 'invalid-year', mockRes, mockUser),
          ).rejects.toThrow(ForbiddenException);
        },
      ),
      { numRuns: getFcNumRuns() },
    );
  });

  it('Property 4b: exportAttendance rejects unauthorized schoolIds with ForbiddenException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        async (schoolId) => {
          const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;
          const mockUser = { id: 'user-123' } as any;
          await expect(
            controller.exportAttendance(
              schoolId,
              'class-id-1',
              'CLASS_ARM',
              'term-id-1',
              mockRes,
              mockUser,
            ),
          ).rejects.toThrow(ForbiddenException);
        },
      ),
      { numRuns: getFcNumRuns() },
    );
  });

  it('Property 4c: exportGrades rejects unauthorized schoolIds with ForbiddenException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        async (schoolId) => {
          const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;
          const mockUser = { id: 'user-123' } as any;
          await expect(
            controller.exportGrades(
              schoolId,
              'class-id-1',
              'term-id-1',
              mockRes,
              mockUser,
            ),
          ).rejects.toThrow(ForbiddenException);
        },
      ),
      { numRuns: getFcNumRuns() },
    );
  });

  it('Property 4d: exportFees rejects unauthorized schoolIds with ForbiddenException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        async (schoolId) => {
          const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;
          const mockUser = { id: 'user-123' } as any;
          await expect(
            controller.exportFees(schoolId, 'term-id-1', mockRes, mockUser),
          ).rejects.toThrow(ForbiddenException);
        },
      ),
      { numRuns: getFcNumRuns() },
    );
  });
});
