import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SchoolAdmin, Teacher, Prisma } from '@prisma/client';

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Admin methods
  async findAdminById(adminId: string): Promise<SchoolAdmin | null> {
    return this.prisma.schoolAdmin.findUnique({
      where: { id: adminId },
      include: { user: true, school: true },
    });
  }

  async findAdminByPublicId(publicId: string): Promise<SchoolAdmin | null> {
    return this.prisma.schoolAdmin.findUnique({
      where: { publicId },
      include: { user: true, school: true },
    });
  }

  async findAdminsBySchool(schoolId: string): Promise<SchoolAdmin[]> {
    return this.prisma.schoolAdmin.findMany({
      where: { schoolId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAdmin(data: Prisma.SchoolAdminCreateInput): Promise<SchoolAdmin> {
    return this.prisma.schoolAdmin.create({
      data,
      include: { user: true, school: true },
    });
  }

  async updateAdmin(
    id: string,
    data: Prisma.SchoolAdminUpdateInput
  ): Promise<SchoolAdmin> {
    return this.prisma.schoolAdmin.update({
      where: { id },
      data,
      include: { user: true, school: true },
    });
  }

  async deleteAdmin(id: string): Promise<SchoolAdmin> {
    return this.prisma.schoolAdmin.delete({
      where: { id },
    });
  }

  // Teacher methods
  async findTeacherById(teacherId: string): Promise<Teacher | null> {
    return this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: true, school: true },
    });
  }

  async findTeacherByPublicId(publicId: string): Promise<Teacher | null> {
    return this.prisma.teacher.findUnique({
      where: { publicId },
      include: { user: true, school: true },
    });
  }

  async findTeacherByTeacherId(teacherId: string): Promise<Teacher | null> {
    return this.prisma.teacher.findUnique({
      where: { teacherId },
      include: { user: true, school: true },
    });
  }

  async findTeachersBySchool(schoolId: string): Promise<Teacher[]> {
    return this.prisma.teacher.findMany({
      where: { schoolId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTeacher(data: Prisma.TeacherCreateInput): Promise<Teacher> {
    return this.prisma.teacher.create({
      data,
      include: { user: true, school: true },
    });
  }

  async updateTeacher(
    id: string,
    data: Prisma.TeacherUpdateInput
  ): Promise<Teacher> {
    return this.prisma.teacher.update({
      where: { id },
      data,
      include: { user: true, school: true },
    });
  }

  async deleteTeacher(id: string): Promise<Teacher> {
    return this.prisma.teacher.delete({
      where: { id },
    });
  }

  // Check for existing staff
  async findAdminByEmailInSchool(
    email: string,
    schoolId: string
  ): Promise<SchoolAdmin | null> {
    return this.prisma.schoolAdmin.findFirst({
      where: { email, schoolId },
    });
  }

  async findTeacherByEmailInSchool(
    email: string,
    schoolId: string
  ): Promise<Teacher | null> {
    return this.prisma.teacher.findFirst({
      where: { email, schoolId },
    });
  }

  async findAdminByPhoneInSchool(
    phone: string,
    schoolId: string
  ): Promise<SchoolAdmin | null> {
    return this.prisma.schoolAdmin.findFirst({
      where: { phone, schoolId },
    });
  }

  async findTeacherByPhoneInSchool(
    phone: string,
    schoolId: string
  ): Promise<Teacher | null> {
    return this.prisma.teacher.findFirst({
      where: { phone, schoolId },
    });
  }

  // =====================
  // Teacher Subject Methods
  // =====================

  /**
   * Get all subjects a teacher is qualified to teach
   */
  async getTeacherSubjects(teacherId: string): Promise<any[]> {
    return this.prisma.subjectTeacher.findMany({
      where: { teacherId },
      include: {
        subject: {
          include: {
            classLevel: true,
          },
        },
      },
      orderBy: {
        subject: {
          name: 'asc',
        },
      },
    });
  }

  /**
   * Get teacher with subjects and assignment counts
   */
  async getTeacherWithSubjects(teacherId: string): Promise<any> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        subjectTeachers: {
          include: {
            subject: {
              include: {
                classLevel: true,
              },
            },
          },
        },
        classTeachers: true,
      },
    });

    return teacher;
  }

  /**
   * Add a subject to a teacher's competencies
   */
  async addTeacherSubject(teacherId: string, subjectId: string): Promise<any> {
    return this.prisma.subjectTeacher.create({
      data: {
        teacherId,
        subjectId,
      },
      include: {
        subject: {
          include: {
            classLevel: true,
          },
        },
      },
    });
  }

  /**
   * Remove a subject from a teacher's competencies
   */
  async removeTeacherSubject(teacherId: string, subjectId: string): Promise<void> {
    await this.prisma.subjectTeacher.deleteMany({
      where: {
        teacherId,
        subjectId,
      },
    });
  }

  /**
   * Set all subjects for a teacher (replaces existing)
   */
  async setTeacherSubjects(teacherId: string, subjectIds: string[]): Promise<void> {
    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // Remove all existing subject assignments
      await tx.subjectTeacher.deleteMany({
        where: { teacherId },
      });

      // Add new subjects if any
      if (subjectIds.length > 0) {
        await tx.subjectTeacher.createMany({
          data: subjectIds.map((subjectId) => ({
            teacherId,
            subjectId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  /**
   * Check if a teacher has a specific subject competency
   */
  async hasSubjectCompetency(teacherId: string, subjectId: string): Promise<boolean> {
    const count = await this.prisma.subjectTeacher.count({
      where: {
        teacherId,
        subjectId,
      },
    });
    return count > 0;
  }

  /**
   * Get count of class assignments for a teacher-subject combination
   * Counts from both ClassTeacher (PRIMARY) and TimetablePeriod (SECONDARY) tables
   */
  async getTeacherSubjectAssignmentCount(
    teacherId: string, 
    subjectName: string,
    subjectId?: string
  ): Promise<number> {
    // Count from ClassTeacher (legacy/PRIMARY school assignments)
    const classTeacherCount = await this.prisma.classTeacher.count({
      where: {
        teacherId,
        subject: subjectName,
      },
    });

    // Count unique classes from TimetablePeriod (SECONDARY school assignments)
    let timetablePeriodClassCount = 0;
    if (subjectId) {
      const timetablePeriods = await this.prisma.timetablePeriod.findMany({
        where: {
          teacherId,
          subjectId,
        },
        select: {
          classArmId: true,
          classId: true,
        },
        distinct: ['classArmId', 'classId'],
      });
      
      // Count unique classes (either classArmId or classId)
      const uniqueClasses = new Set<string>();
      timetablePeriods.forEach(period => {
        if (period.classArmId) {
          uniqueClasses.add(period.classArmId);
        } else if (period.classId) {
          uniqueClasses.add(period.classId);
        }
      });
      timetablePeriodClassCount = uniqueClasses.size;
    }

    // Return the higher count (a teacher is either assigned via ClassTeacher or TimetablePeriod, not both)
    return Math.max(classTeacherCount, timetablePeriodClassCount);
  }

  /**
   * Check if subject exists and belongs to school
   */
  async findSubjectById(subjectId: string, schoolId: string): Promise<any | null> {
    return this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
        isActive: true,
      },
      include: {
        classLevel: true,
      },
    });
  }

  /**
   * Get all subjects for a school, optionally filtered by type
   */
  async getSchoolSubjects(schoolId: string, schoolType?: string): Promise<any[]> {
    const where: any = {
      schoolId,
      isActive: true,
    };

    if (schoolType) {
      where.OR = [
        { schoolType },
        { schoolType: null }, // Include subjects that apply to all types
      ];
    }

    return this.prisma.subject.findMany({
      where,
      include: {
        classLevel: true,
      },
      orderBy: [
        { schoolType: 'asc' },
        { name: 'asc' },
      ],
    });
  }
}

