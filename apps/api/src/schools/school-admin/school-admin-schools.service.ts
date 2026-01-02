import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolRepository } from '../domain/repositories/school.repository';
import { SchoolMapper } from '../domain/mappers/school.mapper';
import { SchoolDto } from '../dto/school.dto';
import { SchoolDashboardDto, DashboardStatsDto, GrowthTrendDataDto, WeeklyActivityDataDto, RecentStudentDto } from '../dto/dashboard.dto';
import { StaffListResponseDto, StaffListItemDto, StaffListMetaDto, GetStaffListQueryDto } from '../dto/staff-list.dto';
import { UpdateSchoolDto } from '../dto/update-school.dto';
import { UserWithContext } from '../../auth/types/user-with-context.type';
import { CloudinaryService } from '../../storage/cloudinary/cloudinary.service';
import { EmailService } from '../../email/email.service';
import { randomBytes } from 'crypto';

/**
 * Service for school admin operations on their own school
 * Handles viewing and updating their own school information
 */
@Injectable()
export class SchoolAdminSchoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository,
    private readonly schoolMapper: SchoolMapper,
    private readonly cloudinaryService: CloudinaryService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Get school admin's own school
   */
  async getMySchool(user: UserWithContext): Promise<SchoolDto & { currentAdmin?: { id: string; role: string } }> {
    const schoolId = user.currentSchoolId;
    const profileId = user.currentProfileId;

    if (!schoolId) {
      throw new BadRequestException('You are not associated with any school');
    }

    const school = await this.schoolRepository.findById(schoolId);

    if (!school) {
      throw new BadRequestException('School not found');
    }

    const completeSchool = await this.prisma.school.findUnique({
      where: { id: school.id },
      include: {
        admins: {
          include: { user: true },
          orderBy: { role: 'asc' },
        },
        teachers: true,
        enrollments: {
          where: { isActive: true },
        },
      },
    });

    if (!completeSchool) {
      throw new BadRequestException('School not found');
    }

    const schoolDto = this.schoolMapper.toDto(completeSchool);
    
    // Include current admin info for permission checks
    let currentAdmin: { id: string; role: string } | undefined;
    if (profileId) {
      const admin = completeSchool.admins.find(a => a.id === profileId);
      if (admin) {
        currentAdmin = { id: admin.id, role: admin.role };
      }
    }

    return { ...schoolDto, currentAdmin };
  }

  /**
   * Get dashboard data for school admin
   */
  async getDashboard(user: UserWithContext, schoolType?: string): Promise<SchoolDashboardDto> {
    const schoolId = user.currentSchoolId;

    if (!schoolId) {
      throw new BadRequestException('You are not associated with any school');
    }

    // If schoolType is provided, get classes of that type to filter enrollments
    let classIds: string[] | undefined;
    let classLevels: string[] | undefined;
    if (schoolType) {
      const classes = await this.prisma.class.findMany({
        where: {
          schoolId,
          type: schoolType as any,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });
      classIds = classes.map((c) => c.id);
      classLevels = classes.map((c) => c.name);
    }

    // Get current date and calculate date ranges
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1);
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Get all data in parallel
    const [
      currentEnrollments,
      previousEnrollments,
      currentTeachers,
      previousTeachers,
      currentCourses,
      previousCourses,
      pendingAdmissions,
      previousPendingAdmissions,
      allEnrollments,
      recentEnrollments,
      weeklyAdmissions,
      weeklyTransfers,
    ] = await Promise.all([
      // Current counts - filter by schoolType if provided
      this.prisma.enrollment.count({
        where: {
          schoolId,
          isActive: true,
          ...(schoolType && classIds && classLevels && (classIds.length > 0 || classLevels.length > 0)
            ? {
                OR: [
                  ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
                  ...(classLevels.length > 0 ? [{ classLevel: { in: classLevels } }] : []),
                ],
              }
            : {}),
        },
      }),
      // Previous month counts for comparison
      this.prisma.enrollment.count({
        where: {
          schoolId,
          isActive: true,
          createdAt: { lte: lastMonth },
          ...(schoolType && classIds && classLevels && (classIds.length > 0 || classLevels.length > 0)
            ? {
                OR: [
                  ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
                  ...(classLevels.length > 0 ? [{ classLevel: { in: classLevels } }] : []),
                ],
              }
            : {}),
        },
      }),
      // Teachers - count all teachers for the school
      // (teachers may or may not be assigned to classes yet)
      this.prisma.teacher.count({
        where: { schoolId },
      }),
      this.prisma.teacher.count({
        where: {
          schoolId,
          createdAt: { lte: lastMonth },
        },
      }),
      // Classes/Courses - count classes filtered by schoolType if provided
      this.prisma.class.count({
        where: {
          schoolId,
          isActive: true,
          ...(schoolType ? { type: schoolType as any } : {}),
        },
      }),
      this.prisma.class.count({
        where: {
          schoolId,
          isActive: true,
          createdAt: { lte: lastMonth },
          ...(schoolType ? { type: schoolType as any } : {}),
        },
      }),
      // Pending admissions (placeholder - will be 0 if Admission model doesn't exist)
      this.getPendingAdmissionsCount(schoolId).catch(() => 0),
      this.getPendingAdmissionsCount(schoolId, lastMonth).catch(() => 0),
      // All enrollments for growth trends - filter by schoolType if provided
      this.prisma.enrollment.findMany({
        where: {
          schoolId,
          createdAt: { gte: sixMonthsAgo },
          ...(schoolType && classIds && classLevels && (classIds.length > 0 || classLevels.length > 0)
            ? {
                OR: [
                  ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
                  ...(classLevels.length > 0 ? [{ classLevel: { in: classLevels } }] : []),
                ],
              }
            : {}),
        },
        select: { createdAt: true },
      }),
      // Recent students (last 5) - filter by schoolType if provided
      this.prisma.enrollment.findMany({
        where: {
          schoolId,
          isActive: true,
          ...(schoolType && classIds && classLevels && (classIds.length > 0 || classLevels.length > 0)
            ? {
                OR: [
                  ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
                  ...(classLevels.length > 0 ? [{ classLevel: { in: classLevels } }] : []),
                ],
              }
            : {}),
        },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              uid: true,
              publicId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Weekly admissions - filter by schoolType if provided
      this.prisma.enrollment.findMany({
        where: {
          schoolId,
          createdAt: { gte: lastWeek },
          ...(schoolType && classIds && classLevels && (classIds.length > 0 || classLevels.length > 0)
            ? {
                OR: [
                  ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
                  ...(classLevels.length > 0 ? [{ classLevel: { in: classLevels } }] : []),
                ],
              }
            : {}),
        },
        select: { createdAt: true },
      }),
      // Weekly transfers (assuming there's a transfer model or we track it via enrollment changes)
      Promise.resolve([]), // Placeholder for transfers
    ]);

    // Calculate stats with percentage changes
    const stats: DashboardStatsDto = {
      totalStudents: currentEnrollments,
      studentsChange: previousEnrollments > 0
        ? Math.round(((currentEnrollments - previousEnrollments) / previousEnrollments) * 100)
        : currentEnrollments > 0 ? 100 : 0,
      totalTeachers: currentTeachers,
      teachersChange: previousTeachers > 0
        ? Math.round(((currentTeachers - previousTeachers) / previousTeachers) * 100)
        : currentTeachers > 0 ? 100 : 0,
      activeCourses: currentCourses,
      coursesChange: previousCourses > 0
        ? Math.round(((currentCourses - previousCourses) / previousCourses) * 100)
        : currentCourses > 0 ? 100 : 0,
      pendingAdmissions: pendingAdmissions,
      pendingAdmissionsChange: pendingAdmissions - previousPendingAdmissions,
    };

    // Calculate growth trends (last 6 months)
    const growthTrends: GrowthTrendDataDto[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentYear, currentMonth - i, 1);
      const nextMonthDate = new Date(currentYear, currentMonth - i + 1, 1);
      
      const monthEnrollments = allEnrollments.filter(
        (e) => e.createdAt >= monthDate && e.createdAt < nextMonthDate
      ).length;

      // Get teachers created in this month
      const monthTeachers = await this.prisma.teacher.count({
        where: {
          schoolId,
          createdAt: { gte: monthDate, lt: nextMonthDate },
        },
      });

      // Get classes created in this month
      const monthCourses = await this.prisma.class.count({
        where: {
          schoolId,
          isActive: true,
          createdAt: { gte: monthDate, lt: nextMonthDate },
        },
      });

      growthTrends.push({
        name: monthNames[monthDate.getMonth()],
        students: monthEnrollments,
        teachers: monthTeachers,
        courses: monthCourses,
      });
    }

    // Calculate weekly activity (last 7 days)
    const weeklyActivity: WeeklyActivityDataDto[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(now);
      dayDate.setDate(dayDate.getDate() - i);
      dayDate.setHours(0, 0, 0, 0);
      const nextDayDate = new Date(dayDate);
      nextDayDate.setDate(nextDayDate.getDate() + 1);

      const dayAdmissions = weeklyAdmissions.filter(
        (e) => e.createdAt >= dayDate && e.createdAt < nextDayDate
      ).length;

      // Transfers placeholder (would need Transfer model)
      const dayTransfers = 0;

      weeklyActivity.push({
        name: dayNames[dayDate.getDay()],
        admissions: dayAdmissions,
        transfers: dayTransfers,
      });
    }

    // Map recent students
    const recentStudents: RecentStudentDto[] = recentEnrollments.map((enrollment) => ({
      id: enrollment.student.id,
      name: `${enrollment.student.firstName} ${enrollment.student.middleName ? `${enrollment.student.middleName} ` : ''}${enrollment.student.lastName}`.trim(),
      classLevel: enrollment.classLevel || 'N/A',
      admissionNumber: enrollment.student.uid || enrollment.student.publicId || 'N/A',
      status: enrollment.isActive ? 'active' : 'inactive',
      createdAt: enrollment.createdAt.toISOString().split('T')[0],
    }));

    return {
      stats,
      growthTrends,
      weeklyActivity,
      recentStudents,
    };
  }

  /**
   * Helper method to get course count (handles missing Course model)
   */
  private async getCourseCount(schoolId: string, startDate?: Date, endDate?: Date): Promise<number> {
    try {
      const where: any = { schoolId };
      if (startDate) {
        where.createdAt = { gte: startDate };
        if (endDate) {
          where.createdAt.lt = endDate;
        } else {
          where.createdAt.lte = new Date();
        }
      }
      return await (this.prisma as any).course?.count({ where }) || 0;
    } catch {
      return 0; // Course model doesn't exist or error
    }
  }

  /**
   * Helper method to get pending admissions count (handles missing Admission model)
   */
  private async getPendingAdmissionsCount(schoolId: string, beforeDate?: Date): Promise<number> {
    try {
      const where: any = { schoolId, status: 'PENDING' };
      if (beforeDate) {
        where.createdAt = { lte: beforeDate };
      }
      return await (this.prisma as any).admission?.count({ where }) || 0;
    } catch {
      return 0; // Admission model doesn't exist or error
    }
  }

  /**
   * Get paginated staff list with search and filtering
   */
  async getStaffList(
    user: UserWithContext,
    query: GetStaffListQueryDto
  ): Promise<StaffListResponseDto> {
    const schoolId = user.currentSchoolId;

    if (!schoolId) {
      throw new BadRequestException('You are not associated with any school');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10)); // Max 100 items per page
    const skip = (page - 1) * limit;
    const search = query.search?.trim() || '';
    const roleFilter = query.role?.trim() || '';
    const schoolType = query.schoolType?.trim();

    // Note: schoolType is kept for potential future filtering but doesn't restrict teacher visibility
    // Teachers are shown regardless of class assignment to ensure newly imported teachers are visible

    // Build search conditions for both admins and teachers
    const searchCondition = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Build role filter condition
    const isTeacherFilter = roleFilter === 'Teacher';
    const isSpecificRoleFilter = roleFilter && roleFilter !== 'All' && roleFilter !== 'Teacher';

    // Build teacher filter condition - include schoolType filtering if provided
    const teacherWhereCondition: any = {
      schoolId,
      ...searchCondition,
      ...(isSpecificRoleFilter ? { id: { in: [] } } : {}), // Exclude teachers if filtering by admin role
    };

    // If schoolType is provided, filter teachers by:
    // - For PRIMARY: Teachers assigned to classes/classArms of that type
    // - For SECONDARY/TERTIARY: Teachers assigned to subjects of that type OR form teachers for classes/classArms of that type
    // - All: Unassigned teachers (newly imported)
    let teacherIdsForSchoolType: string[] | undefined;
    if (schoolType) {
      const teacherIdSets = new Set<string>();

      // Get all Class records of the specified school type (for backward compatibility)
      const classesOfType = await this.prisma.class.findMany({
        where: {
          schoolId,
          type: schoolType,
          isActive: true,
        },
        select: { id: true },
      });
      const classIds = classesOfType.map((c) => c.id);

      // Also get ClassArm IDs for PRIMARY/SECONDARY (new ClassLevel + ClassArm system)
      let classArmIds: string[] = [];
      if (schoolType === 'PRIMARY' || schoolType === 'SECONDARY') {
        const classLevels = await this.prisma.classLevel.findMany({
          where: {
            schoolId,
            type: schoolType,
            isActive: true,
          },
          include: {
            classArms: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        });
        classArmIds = classLevels.flatMap((cl) => cl.classArms.map((arm) => arm.id));
      }

      // Get teachers assigned to Classes (backward compatibility)
      if (classIds.length > 0) {
        if (schoolType === 'PRIMARY') {
          // For PRIMARY: Include all teachers assigned to primary classes
          const classTeachers = await this.prisma.classTeacher.findMany({
            where: {
              classId: { in: classIds },
            },
            select: { teacherId: true },
            distinct: ['teacherId'],
          });
          classTeachers.forEach((ct) => teacherIdSets.add(ct.teacherId));
        } else {
          // For SECONDARY/TERTIARY: Include form teachers (isPrimary: true) for classes of that type
          const formTeachers = await this.prisma.classTeacher.findMany({
            where: {
              classId: { in: classIds },
              isPrimary: true,
            },
            select: { teacherId: true },
            distinct: ['teacherId'],
          });
          formTeachers.forEach((ft) => teacherIdSets.add(ft.teacherId));
        }
      }

      // Get teachers assigned to ClassArms (new system for PRIMARY/SECONDARY)
      if (classArmIds.length > 0) {
        if (schoolType === 'PRIMARY') {
          // For PRIMARY: Include all teachers assigned to primary class arms
          const classArmTeachers = await this.prisma.classTeacher.findMany({
            where: {
              classArmId: { in: classArmIds },
            },
            select: { teacherId: true },
            distinct: ['teacherId'],
          });
          classArmTeachers.forEach((ct) => teacherIdSets.add(ct.teacherId));
        } else if (schoolType === 'SECONDARY') {
          // For SECONDARY: Include form teachers for class arms
          const formTeachers = await this.prisma.classTeacher.findMany({
            where: {
              classArmId: { in: classArmIds },
              isPrimary: true,
            },
            select: { teacherId: true },
            distinct: ['teacherId'],
          });
          formTeachers.forEach((ft) => teacherIdSets.add(ft.teacherId));
        }
      }

      // For SECONDARY/TERTIARY: Also include teachers assigned to subjects of that schoolType
      if (schoolType === 'SECONDARY' || schoolType === 'TERTIARY') {
        const subjectsOfType = await this.prisma.subject.findMany({
          where: {
            schoolId,
            schoolType,
            isActive: true,
          },
          select: { id: true },
        });
        const subjectIds = subjectsOfType.map((s) => s.id);

        if (subjectIds.length > 0) {
          const subjectTeachers = await this.prisma.subjectTeacher.findMany({
            where: {
              subjectId: { in: subjectIds },
            },
            select: { teacherId: true },
            distinct: ['teacherId'],
          });
          subjectTeachers.forEach((st) => teacherIdSets.add(st.teacherId));
        }
      }

      teacherIdsForSchoolType = Array.from(teacherIdSets);
    }

    // Get all staff (admins and teachers) with filters
    const [allAdmins, allTeachers] = await Promise.all([
      // Get all admins (filtered by search and role if needed)
      // Note: Admins are not filtered by schoolType as they can manage all types
      this.prisma.schoolAdmin.findMany({
        where: {
          schoolId,
          ...searchCondition,
          ...(isSpecificRoleFilter ? { role: { equals: roleFilter, mode: 'insensitive' as const } } : {}),
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      }),
      // Get all teachers (filtered by search, exclude if filtering by specific admin role)
      this.prisma.teacher.findMany({
        where: teacherWhereCondition,
        include: { 
          user: true,
          classTeachers: {
            include: {
              class: {
                select: {
                  id: true,
                  type: true,
                },
              },
              classArm: {
                include: {
                  classLevel: {
                    select: {
                      id: true,
                      type: true,
                    },
                  },
                },
              },
            },
          },
          subjectTeachers: {
            include: {
              subject: {
                select: {
                  id: true,
                  name: true,
                  schoolType: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Filter teachers by schoolType if provided
    // Include teachers who:
    // 1. Are assigned to classes/classArms/subjects of the specified schoolType, OR
    // 2. Are not assigned to any class/classArm/subject yet (newly imported teachers)
    let filteredTeachers = allTeachers;
    if (schoolType && teacherIdsForSchoolType !== undefined) {
      filteredTeachers = allTeachers.filter((teacher) => {
        // Check class assignments (both Class and ClassArm)
        const hasNoClassAssignments = !teacher.classTeachers || teacher.classTeachers.length === 0;
        const hasNoSubjectAssignments = !teacher.subjectTeachers || teacher.subjectTeachers.length === 0;
        
        // If teacher has no assignments at all, include them (newly imported)
        if (hasNoClassAssignments && hasNoSubjectAssignments) {
          return true;
        }

        // Check if teacher is in the list of teachers for this schoolType
        // (includes class/classArm assignments for PRIMARY, subject assignments and form teachers for SECONDARY/TERTIARY)
        return teacherIdsForSchoolType!.includes(teacher.id);
      });
    }

    // Combine and map to DTO format
    const allStaff: StaffListItemDto[] = [
      ...allAdmins.map((admin) => ({
        id: admin.id,
        type: 'admin' as const,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        subject: null,
        employeeId: null,
        isTemporary: false,
        status: (admin.user?.accountStatus === 'ACTIVE' ? 'active' : 'inactive') as 'active' | 'inactive',
        accountStatus: (admin.user?.accountStatus || 'SHADOW') as 'SHADOW' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
        profileImage: admin.profileImage,
        createdAt: admin.createdAt,
      })),
      ...filteredTeachers.map((teacher) => {
        // Get subject names from SubjectTeacher relationships, fallback to legacy subject field
        const subjectNames = teacher.subjectTeachers
          ?.map((st: any) => st.subject?.name)
          .filter(Boolean) || [];
        const displaySubject = subjectNames.length > 0 
          ? subjectNames.join(', ') 
          : teacher.subject;
        
        return {
          id: teacher.id,
          type: 'teacher' as const,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
          phone: teacher.phone,
          role: 'Teacher',
          subject: displaySubject,
          employeeId: teacher.employeeId,
          isTemporary: teacher.isTemporary,
          status: (teacher.user?.accountStatus === 'ACTIVE' ? 'active' : 'inactive') as 'active' | 'inactive',
          accountStatus: (teacher.user?.accountStatus || 'SHADOW') as 'SHADOW' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
          profileImage: teacher.profileImage,
          createdAt: teacher.createdAt,
        };
      }),
    ];

    // Apply additional search on subject field (for teachers)
    let filteredStaff = allStaff;
    if (search) {
      filteredStaff = allStaff.filter((staff) => {
        const searchLower = search.toLowerCase();
        return (
          staff.firstName.toLowerCase().includes(searchLower) ||
          staff.lastName.toLowerCase().includes(searchLower) ||
          staff.email?.toLowerCase().includes(searchLower) ||
          staff.subject?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by creation date (newest first)
    filteredStaff.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Extract unique roles from all staff (before pagination)
    const availableRoles = new Set<string>();
    allAdmins.forEach((admin) => {
      if (admin.role) {
        availableRoles.add(admin.role);
      }
    });
    if (filteredTeachers.length > 0) {
      availableRoles.add('Teacher');
    }

    // Apply pagination
    const totalCount = filteredStaff.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedStaff = filteredStaff.slice(skip, skip + limit);

    const meta: StaffListMetaDto = {
      total: totalCount,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return {
      items: paginatedStaff,
      meta,
      availableRoles: Array.from(availableRoles).sort(),
    };
  }

  /**
   * Upload school logo
   */
  async uploadLogo(user: UserWithContext, file: Express.Multer.File): Promise<SchoolDto> {
    const schoolId = user.currentSchoolId;

    if (!schoolId) {
      throw new BadRequestException('You are not associated with any school');
    }

    const school = await this.schoolRepository.findById(schoolId);

    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum limit of 5MB');
    }

    // Delete old logo if exists
    if (school.logo) {
      const oldPublicId = this.cloudinaryService.extractPublicId(school.logo);
      if (oldPublicId) {
        try {
          await this.cloudinaryService.deleteImage(oldPublicId);
        } catch (error) {
          console.error('Error deleting old logo:', error);
          // Continue even if deletion fails
        }
      }
    }

    // Upload to Cloudinary
    const { url } = await this.cloudinaryService.uploadImage(
      file,
      `schools/${schoolId}/logo`,
      `school-${schoolId}-logo`
    );

    // Update school with new logo URL
    const updatedSchool = await this.prisma.school.update({
      where: { id: school.id },
      data: { logo: url },
      include: {
        admins: {
          include: { user: true },
          orderBy: { role: 'asc' },
        },
        teachers: true,
        enrollments: {
          where: { isActive: true },
        },
      },
    });

    return this.schoolMapper.toDto(updatedSchool);
  }

  /**
   * Update school information
   * School admins can update basic fields directly, but sensitive changes require token verification
   */
  async updateSchool(user: UserWithContext, updateSchoolDto: UpdateSchoolDto, verificationToken?: string): Promise<SchoolDto> {
    const schoolId = user.currentSchoolId;

    if (!schoolId) {
      throw new BadRequestException('You are not associated with any school');
    }

    const school = await this.schoolRepository.findById(schoolId);

    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Fields that school admins CANNOT change
    const restrictedFields = ['subdomain', 'isActive', 'schoolId'];
    const hasRestrictedFields = restrictedFields.some(field => updateSchoolDto[field as keyof UpdateSchoolDto] !== undefined);
    
    if (hasRestrictedFields) {
      throw new BadRequestException('You do not have permission to change restricted fields (subdomain, isActive, schoolId)');
    }

    // Check for sensitive changes that require token verification
    const { levels, ...basicFields } = updateSchoolDto;
    const hasSchoolTypeChange = levels && (
      (levels.primary !== undefined && levels.primary !== school.hasPrimary) ||
      (levels.secondary !== undefined && levels.secondary !== school.hasSecondary) ||
      (levels.tertiary !== undefined && levels.tertiary !== school.hasTertiary)
    );

    // If school type is changing, require token verification
    if (hasSchoolTypeChange) {
      if (!verificationToken) {
        throw new BadRequestException('Token verification required for school type changes. Please request a verification token first.');
      }

      // Verify token
      const tokenRecord = await this.prisma.schoolProfileEditToken.findUnique({
        where: { token: verificationToken },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid verification token');
      }

      if (tokenRecord.schoolId !== school.id) {
        throw new UnauthorizedException('Token does not belong to this school');
      }

      if (tokenRecord.usedAt) {
        throw new UnauthorizedException('Verification token has already been used');
      }

      if (tokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('Verification token has expired');
      }

      // Verify the changes match what was requested
      const requestedChanges = tokenRecord.changes as any;
      if (JSON.stringify(levels) !== JSON.stringify(requestedChanges.levels)) {
        throw new BadRequestException('Changes do not match the verification token');
      }

      // Mark token as used
      await this.prisma.schoolProfileEditToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });
    }

    // Prepare update data
    const updateData: any = { ...basicFields };
    
    // Only update school type if levels are provided and verified
    if (levels && (hasSchoolTypeChange ? verificationToken : true)) {
      if (levels.primary !== undefined) updateData.hasPrimary = levels.primary;
      if (levels.secondary !== undefined) updateData.hasSecondary = levels.secondary;
      if (levels.tertiary !== undefined) updateData.hasTertiary = levels.tertiary;
    }

    // Update school
    const updatedSchool = await this.prisma.school.update({
      where: { id: school.id },
      data: updateData,
      include: {
        admins: {
          include: { user: true },
          orderBy: { role: 'asc' },
        },
        teachers: true,
        enrollments: {
          where: { isActive: true },
        },
      },
    });

    return this.schoolMapper.toDto(updatedSchool);
  }

  /**
   * Request verification token for sensitive school profile changes
   * Sends an email with verification token
   */
  async requestEditToken(user: UserWithContext, changes: UpdateSchoolDto): Promise<{ message: string; token?: string }> {
    const schoolId = user.currentSchoolId;

    if (!schoolId) {
      throw new BadRequestException('You are not associated with any school');
    }

    const school = await this.schoolRepository.findById(schoolId);

    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check if changes include sensitive fields
    const { levels } = changes;
    const hasSchoolTypeChange = levels && (
      (levels.primary !== undefined && levels.primary !== school.hasPrimary) ||
      (levels.secondary !== undefined && levels.secondary !== school.hasSecondary) ||
      (levels.tertiary !== undefined && levels.tertiary !== school.hasTertiary)
    );

    if (!hasSchoolTypeChange) {
      throw new BadRequestException('No sensitive changes detected. You can update these fields directly without verification.');
    }

    // Get principal email for verification
    const principal = await this.prisma.schoolAdmin.findFirst({
      where: {
        schoolId: school.id,
        role: { equals: 'Principal', mode: 'insensitive' },
      },
      include: { user: true },
    });

    if (!principal || !principal.user?.email) {
      throw new BadRequestException('Principal email not found. Please ensure your school has a principal with an email address.');
    }

    // Generate token
    const token = `SPET-${randomBytes(32).toString('hex').toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

    // Store token with proposed changes
    await this.prisma.schoolProfileEditToken.create({
      data: {
        token,
        schoolId: school.id,
        changes: changes as any,
        expiresAt,
      },
    });

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/dashboard/school/settings/profile?token=${token}`;

    await this.emailService.sendSchoolProfileEditVerificationEmail(
      principal.user.email,
      `${principal.firstName} ${principal.lastName}`,
      school.name,
      token,
      verificationUrl,
      changes
    );

    return {
      message: `Verification email sent to ${principal.user.email}. Please check your email to complete the profile update.`,
    };
  }

  /**
   * Verify edit token and get proposed changes
   */
  async verifyEditToken(token: string, user: UserWithContext): Promise<{ changes: UpdateSchoolDto; school: SchoolDto }> {
    const schoolId = user.currentSchoolId;

    if (!schoolId) {
      throw new BadRequestException('You are not associated with any school');
    }

    const tokenRecord = await this.prisma.schoolProfileEditToken.findUnique({
      where: { token },
      include: {
        school: {
          include: {
            admins: {
              include: { user: true },
              orderBy: { role: 'asc' },
            },
            teachers: true,
            enrollments: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new NotFoundException('Invalid verification token');
    }

    if (tokenRecord.schoolId !== schoolId) {
      throw new UnauthorizedException('Token does not belong to your school');
    }

    if (tokenRecord.usedAt) {
      throw new BadRequestException('This verification token has already been used');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired. Please request a new token.');
    }

    return {
      changes: tokenRecord.changes as UpdateSchoolDto,
      school: this.schoolMapper.toDto(tokenRecord.school),
    };
  }
}

