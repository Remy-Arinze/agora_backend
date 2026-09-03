import { AGORA_TOOLS } from './agora-chat-tools.definition';
import { AiStaffPermissionCheckerService } from './ai-staff-permission-checker.service';
import { ForbiddenException } from '@nestjs/common';
import { PermissionResource } from '../schools/dto/permission.dto';

describe('Lois typed tools', () => {
  it('does not expose execute_sql', () => {
    const names = AGORA_TOOLS.map((t) => t.function.name);
    expect(names).not.toContain('execute_sql');
    expect(names).toEqual(
      expect.arrayContaining([
        'list_students',
        'list_classes',
        'get_student_overview',
        'get_class_performance',
        'get_scheme_of_work',
        'get_now_in_class',
        'get_timetable',
        'list_staff',
        'who_teaches',
        'get_attendance_summary',
        'list_fee_debtors',
        'list_admissions',
        'get_calendar',
        'get_guardians',
        'list_lois_insights',
        'draft_parent_message',
        'get_academic_risk_summary',
      ]),
    );
  });
});

describe('AiStaffPermissionCheckerService', () => {
  const prisma = {
    schoolAdmin: { findFirst: jest.fn() },
    staffPermission: { findFirst: jest.fn() },
  };

  const checker = new AiStaffPermissionCheckerService(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks students from school data tools', async () => {
    await expect(
      checker.assertLoisToolAllowed({
        toolName: 'list_students',
        userRole: 'STUDENT',
        userId: 'u1',
        schoolId: 's1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows principals all tools without staff-permission rows', async () => {
    prisma.schoolAdmin.findFirst.mockResolvedValue({ id: 'a1', role: 'principal' });
    await expect(
      checker.assertLoisToolAllowed({
        toolName: 'get_student_overview',
        userRole: 'SCHOOL_ADMIN',
        userId: 'u1',
        schoolId: 's1',
      }),
    ).resolves.toBeUndefined();
    expect(prisma.staffPermission.findFirst).not.toHaveBeenCalled();
  });

  it('requires Students read for bursar-like admins on student lookup', async () => {
    prisma.schoolAdmin.findFirst.mockResolvedValue({ id: 'a1', role: 'bursar' });
    prisma.staffPermission.findFirst.mockResolvedValue(null);
    await expect(
      checker.assertLoisToolAllowed({
        toolName: 'get_student_overview',
        userRole: 'SCHOOL_ADMIN',
        userId: 'u1',
        schoolId: 's1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows bursar-like admins with Students READ', async () => {
    prisma.schoolAdmin.findFirst.mockResolvedValue({ id: 'a1', role: 'bursar' });
    prisma.staffPermission.findFirst
      .mockResolvedValueOnce(null) // ADMIN on resource
      .mockResolvedValueOnce({ id: 'p1' }); // READ/WRITE hit
    await expect(
      checker.assertLoisToolAllowed({
        toolName: 'list_students',
        userRole: 'SCHOOL_ADMIN',
        userId: 'u1',
        schoolId: 's1',
      }),
    ).resolves.toBeUndefined();
    expect(prisma.staffPermission.findFirst).toHaveBeenCalled();
    void PermissionResource.STUDENTS;
  });

  it('blocks teachers from fee debtors and admissions', async () => {
    await expect(
      checker.assertLoisToolAllowed({
        toolName: 'list_fee_debtors',
        userRole: 'TEACHER',
        userId: 'u1',
        schoolId: 's1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      checker.assertLoisToolAllowed({
        toolName: 'list_admissions',
        userRole: 'TEACHER',
        userId: 'u1',
        schoolId: 's1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows school admins to list insights (results are filtered separately)', async () => {
    prisma.schoolAdmin.findFirst.mockResolvedValue({ id: 'a1', role: 'bursar' });
    await expect(
      checker.assertLoisToolAllowed({
        toolName: 'list_lois_insights',
        userRole: 'SCHOOL_ADMIN',
        userId: 'u1',
        schoolId: 's1',
      }),
    ).resolves.toBeUndefined();
    expect(prisma.staffPermission.findFirst).not.toHaveBeenCalled();
  });

  it('gives principals every insight type', async () => {
    prisma.schoolAdmin.findFirst.mockResolvedValue({ id: 'a1', role: 'principal' });
    const types = await checker.allowedInsightTypes('u1', 's1', 'SCHOOL_ADMIN');
    expect(types).toEqual(
      expect.arrayContaining(['ACADEMIC_RISK', 'STUDENT_DROP', 'SOW_GAP', 'ATTENDANCE_RISK', 'FEE_ARREARS', 'ADMISSIONS_BACKLOG']),
    );
    expect(prisma.staffPermission.findFirst).not.toHaveBeenCalled();
  });

  it('requires Admissions read for bursar-like admins', async () => {
    prisma.schoolAdmin.findFirst.mockResolvedValue({ id: 'a1', role: 'bursar' });
    prisma.staffPermission.findFirst.mockResolvedValue(null);
    await expect(
      checker.assertLoisToolAllowed({
        toolName: 'list_admissions',
        userRole: 'SCHOOL_ADMIN',
        userId: 'u1',
        schoolId: 's1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
