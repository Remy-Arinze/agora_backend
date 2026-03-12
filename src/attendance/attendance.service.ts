import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAttendanceDto, BulkAttendanceDto, AttendanceStatus } from './dto/create-attendance.dto';
import { UserWithContext } from '../auth/types/user-with-context.type';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async markAttendance(user: UserWithContext, dto: CreateAttendanceDto) {
    const teacher = await this.getTeacherProfile(user);

    return this.prisma.attendance.upsert({
      where: {
        enrollmentId_date: {
          enrollmentId: dto.enrollmentId,
          date: new Date(dto.date),
        },
      },
      update: {
        status: dto.status,
        remarks: dto.remarks,
        teacherId: teacher.id,
      },
      create: {
        enrollmentId: dto.enrollmentId,
        date: new Date(dto.date),
        status: dto.status,
        remarks: dto.remarks,
        teacherId: teacher.id,
      },
    });
  }

  async markBulkAttendance(user: UserWithContext, dto: BulkAttendanceDto) {
    const teacher = await this.getTeacherProfile(user);
    const date = new Date(dto.date);

    const operations = dto.students.map((s) =>
      this.prisma.attendance.upsert({
        where: {
          enrollmentId_date: {
            enrollmentId: s.enrollmentId,
            date,
          },
        },
        update: {
          status: s.status,
          remarks: s.remarks,
          teacherId: teacher.id,
        },
        create: {
          enrollmentId: s.enrollmentId,
          date,
          status: s.status,
          remarks: s.remarks,
          teacherId: teacher.id,
        },
      })
    );

    return Promise.all(operations);
  }

  async getClassAttendance(schoolId: string, classId: string, classType: 'CLASS' | 'CLASS_ARM', date: string) {
    const parsedDate = new Date(date);
    
    // Set time to midnight UTC for consistent comparison
    parsedDate.setUTCHours(0, 0, 0, 0);

    const where: any = {
      enrollment: {
        schoolId,
        isActive: true,
      },
      date: parsedDate,
    };

    if (classType === 'CLASS_ARM') {
      where.enrollment.classArmId = classId;
    } else {
      where.enrollment.classId = classId;
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        enrollment: {
          include: {
            student: true,
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getClassAttendanceSummary(
    schoolId: string,
    classId: string,
    classType: 'CLASS' | 'CLASS_ARM',
    startDate: string,
    endDate: string
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const where: any = {
      enrollment: {
        schoolId,
        isActive: true,
      },
      date: {
        gte: start,
        lte: end,
      },
    };

    if (classType === 'CLASS_ARM') {
      where.enrollment.classArmId = classId;
    } else {
      where.enrollment.classId = classId;
    }

    const attendanceRecords = await this.prisma.attendance.findMany({
      where,
      include: {
        enrollment: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                uid: true,
              },
            },
          },
        },
      },
    });

    // Grouping and aggregating logic
    const studentStats = new Map<string, any>();

    attendanceRecords.forEach((record) => {
      const studentId = record.enrollment.studentId;
      if (!studentStats.has(studentId)) {
        studentStats.set(studentId, {
          student: record.enrollment.student,
          present: 0,
          absent: 0,
          late: 0,
          total: 0,
        });
      }

      const stats = studentStats.get(studentId);
      stats.total++;
      if (record.status === AttendanceStatus.PRESENT) stats.present++;
      else if (record.status === AttendanceStatus.ABSENT) stats.absent++;
      else if (record.status === AttendanceStatus.LATE) stats.late++;
    });

    return Array.from(studentStats.values());
  }

  private async getTeacherProfile(user: UserWithContext) {
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        userId: user.id,
        schoolId: user.currentSchoolId as string,
      },
    });

    if (!teacher) {
      throw new ForbiddenException('Teacher profile not found for this school');
    }

    return teacher;
  }
}
