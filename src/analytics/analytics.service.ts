import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AnalyticsStats {
  totalSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  primarySchools: number;
  secondarySchools: number;
  tertiarySchools: number;
  activeSessions: number;
  growthTrends: MonthlyData[];
  userDistribution: {
    students: number;
    teachers: number;
    admins: number;
  };
  weeklyActivity: WeeklyActivity[];
  schoolDistribution: SchoolDistribution[];
  schoolDistributionByLevel: SchoolLevelDistribution[];
  schoolDistributionByLocation: LocationDistribution[];
  schoolDistributionByCity: LocationDistribution[];
  recentActivity: RecentActivity[];
}

export interface MonthlyData {
  name: string;
  schools: number;
  students: number;
  teachers: number;
}

export interface WeeklyActivity {
  name: string;
  logins: number;
  registrations: number;
}

export interface SchoolDistribution {
  name: string;
  value: number;
}

export interface SchoolLevelDistribution {
  name: string;
  value: number;
}

export interface LocationDistribution {
  name: string;
  value: number;
}

export interface RecentActivity {
  type: string;
  description: string;
  timestamp: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getAnalytics(month?: number, year?: number): Promise<AnalyticsStats> {
    // Determine the date range for filtering
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    const filterByDate = month && year; // Only filter by date if both month and year are provided

    if (filterByDate) {
      // Filter by specific month
      startDate = new Date(year, month - 1, 1); // First day of the month
      endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month
    }
    // If no month/year provided, show all-time totals (no date filtering)

    // Build where clauses based on whether we're filtering by date
    const schoolWhereClause: any = { isActive: true };
    const studentWhereClause: any = {};
    const teacherWhereClause: any = {};
    const adminWhereClause: any = {};
    const enrollmentWhereClause: any = { isActive: true };
    const activeSessionsWhereClause: any = {};

    if (filterByDate && startDate && endDate) {
      schoolWhereClause.createdAt = { gte: startDate, lte: endDate };
      studentWhereClause.createdAt = { gte: startDate, lte: endDate };
      teacherWhereClause.createdAt = { gte: startDate, lte: endDate };
      adminWhereClause.createdAt = { gte: startDate, lte: endDate };
      enrollmentWhereClause.createdAt = { gte: startDate, lte: endDate };
      activeSessionsWhereClause.lastLoginAt = { gte: startDate, lte: endDate };
    }

    // Get total counts (filtered by date range if provided, otherwise all-time)
    const [
      totalSchools,
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalEnrollments,
      primarySchools,
      secondarySchools,
      tertiarySchools,
    ] = await Promise.all([
      this.prisma.school.count({ where: schoolWhereClause }),
      this.prisma.student.count({ where: studentWhereClause }),
      this.prisma.teacher.count({ where: teacherWhereClause }),
      this.prisma.schoolAdmin.count({ where: adminWhereClause }),
      this.prisma.enrollment.count({ where: enrollmentWhereClause }),
      this.prisma.school.count({
        where: {
          ...schoolWhereClause,
          hasPrimary: true,
        },
      }),
      this.prisma.school.count({
        where: {
          ...schoolWhereClause,
          hasSecondary: true,
        },
      }),
      this.prisma.school.count({
        where: {
          ...schoolWhereClause,
          hasTertiary: true,
        },
      }),
    ]);

    // Get active sessions (users who logged in within the selected period, or all-time if no filter)
    const activeSessions = await this.prisma.user.count({
      where: filterByDate && startDate && endDate ? activeSessionsWhereClause : {
        lastLoginAt: {
          not: null, // Only count users who have logged in at least once
        },
      },
    });

    // Calculate growth trends (last 6 months) - not filtered by month
    const growthTrends = await this.calculateGrowthTrends();

    // User distribution
    const userDistribution = {
      students: totalStudents,
      teachers: totalTeachers,
      admins: totalAdmins,
    };

    // Weekly activity (for the selected month, or last 30 days if no filter)
    const weeklyActivity = filterByDate && startDate && endDate
      ? await this.calculateWeeklyActivity(startDate, endDate)
      : await this.calculateWeeklyActivity(
          (() => {
            const date = new Date();
            date.setDate(date.getDate() - 30);
            return date;
          })(),
          new Date()
        );

    // School distribution by state (all-time if no filter, or filtered by date)
    const schoolDistribution = await this.calculateSchoolDistribution(startDate, endDate);

    // School distribution by level (all-time if no filter, or filtered by date)
    const schoolDistributionByLevel = await this.calculateSchoolDistributionByLevel(
      startDate,
      endDate
    );

    // School distribution by location (all-time if no filter, or filtered by date)
    const schoolDistributionByLocation = await this.calculateSchoolDistributionByLocation(
      startDate,
      endDate
    );
    const schoolDistributionByCity = await this.calculateSchoolDistributionByCity(
      startDate,
      endDate
    );

    // Recent activity (last 30 days if no filter, or filtered by date)
    const recentActivity = await this.calculateRecentActivity(startDate, endDate);

    return {
      totalSchools,
      totalStudents,
      totalTeachers,
      totalAdmins,
      primarySchools,
      secondarySchools,
      tertiarySchools,
      activeSessions,
      growthTrends,
      userDistribution,
      weeklyActivity,
      schoolDistribution,
      schoolDistributionByLevel,
      schoolDistributionByLocation,
      schoolDistributionByCity,
      recentActivity,
    };
  }

  private async calculateGrowthTrends(): Promise<MonthlyData[]> {
    const now = new Date();
    const monthRanges: { monthDate: Date; nextMonth: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      monthRanges.push({
        monthDate: new Date(now.getFullYear(), now.getMonth() - i, 1),
        nextMonth: new Date(now.getFullYear(), now.getMonth() - i + 1, 1),
      });
    }

    // Single batched round-trip: all count queries in parallel (indexed)
    const allCounts = await Promise.all(
      monthRanges.flatMap(({ nextMonth }) => [
        this.prisma.school.count({
          where: { createdAt: { lt: nextMonth }, isActive: true },
        }),
        this.prisma.student.count({
          where: { createdAt: { lt: nextMonth } },
        }),
        this.prisma.teacher.count({
          where: { createdAt: { lt: nextMonth } },
        }),
        this.prisma.schoolAdmin.count({
          where: { createdAt: { lt: nextMonth } },
        }),
      ])
    );

    return monthRanges.map(({ monthDate }, i) => {
      const base = i * 4;
      return {
        name: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        schools: allCounts[base],
        students: allCounts[base + 1],
        teachers: allCounts[base + 2],
        admins: allCounts[base + 3],
      };
    });
  }

  private async calculateWeeklyActivity(startDate: Date, endDate: Date): Promise<WeeklyActivity[]> {
    const dayRanges: { dayDate: Date; nextDay: Date }[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      const dayDate = new Date(current);
      dayDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(dayDate);
      nextDay.setDate(nextDay.getDate() + 1);
      dayRanges.push({ dayDate, nextDay });
      current.setDate(current.getDate() + 1);
    }

    const allCounts = await Promise.all(
      dayRanges.flatMap(({ dayDate, nextDay }) => [
        this.prisma.user.count({
          where: { lastLoginAt: { gte: dayDate, lt: nextDay } },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: dayDate, lt: nextDay } },
        }),
      ])
    );

    return dayRanges.map(({ dayDate }, i) => ({
      name: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
      logins: allCounts[i * 2],
      registrations: allCounts[i * 2 + 1],
    }));
  }

  private async calculateSchoolDistribution(
    startDate?: Date,
    endDate?: Date
  ): Promise<SchoolDistribution[]> {
    const where: { isActive: true; createdAt?: { gte: Date; lte: Date } } = { isActive: true };
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const byState = await this.prisma.school.groupBy({
      by: ['state'],
      where,
      _count: { id: true },
    });

    return byState
      .map((row) => ({ name: row.state ?? 'Unknown', value: row._count.id }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  private async calculateSchoolDistributionByLevel(
    startDate?: Date,
    endDate?: Date
  ): Promise<SchoolLevelDistribution[]> {
    const where: { isActive: true; createdAt?: { gte: Date; lte: Date } } = { isActive: true };
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const byLevel = await this.prisma.school.groupBy({
      by: ['hasPrimary', 'hasSecondary', 'hasTertiary'],
      where,
      _count: { id: true },
    });

    const distribution: Record<string, number> = {
      'Primary Only': 0,
      'Secondary Only': 0,
      'Tertiary Only': 0,
      'Primary + Secondary': 0,
      'Primary + Tertiary': 0,
      'Secondary + Tertiary': 0,
      'All Levels': 0,
    };

    byLevel.forEach((row) => {
      const { hasPrimary, hasSecondary, hasTertiary } = row;
      if (hasPrimary && hasSecondary && hasTertiary) distribution['All Levels'] += row._count.id;
      else if (hasPrimary && hasSecondary) distribution['Primary + Secondary'] += row._count.id;
      else if (hasPrimary && hasTertiary) distribution['Primary + Tertiary'] += row._count.id;
      else if (hasSecondary && hasTertiary) distribution['Secondary + Tertiary'] += row._count.id;
      else if (hasPrimary) distribution['Primary Only'] += row._count.id;
      else if (hasSecondary) distribution['Secondary Only'] += row._count.id;
      else if (hasTertiary) distribution['Tertiary Only'] += row._count.id;
    });

    return Object.entries(distribution)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  private async calculateSchoolDistributionByLocation(
    startDate?: Date,
    endDate?: Date
  ): Promise<LocationDistribution[]> {
    const where: { isActive: true; createdAt?: { gte: Date; lte: Date } } = { isActive: true };
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const byState = await this.prisma.school.groupBy({
      by: ['state'],
      where,
      _count: { id: true },
    });

    return byState
      .map((row) => ({ name: row.state ?? 'Unknown', value: row._count.id }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private async calculateSchoolDistributionByCity(
    startDate?: Date,
    endDate?: Date
  ): Promise<LocationDistribution[]> {
    const where: { isActive: true; createdAt?: { gte: Date; lte: Date } } = { isActive: true };
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const byCityState = await this.prisma.school.groupBy({
      by: ['city', 'state'],
      where,
      _count: { id: true },
    });

    return byCityState
      .map((row) => ({
        name: row.city ? `${row.city}, ${row.state ?? ''}`.trim() : 'Unknown',
        value: row._count.id,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private async calculateRecentActivity(
    startDate?: Date,
    endDate?: Date
  ): Promise<RecentActivity[]> {
    const activities: RecentActivity[] = [];

    // Use provided date range or default to last 7 days
    const activityStartDate =
      startDate ||
      (() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date;
      })();
    const activityEndDate = endDate || new Date();

    const recentSchools = await this.prisma.school.findMany({
      where: {
        createdAt: {
          gte: activityStartDate,
          lte: activityEndDate,
        },
      },
      select: {
        name: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    recentSchools.forEach((school) => {
      activities.push({
        type: 'school_signup',
        description: `New school "${school.name}" signed up`,
        timestamp: school.createdAt,
      });
    });

    // Recent teacher additions
    const recentTeachers = await this.prisma.teacher.findMany({
      where: {
        createdAt: {
          gte: activityStartDate,
          lte: activityEndDate,
        },
      },
      include: {
        school: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    recentTeachers.forEach((teacher) => {
      activities.push({
        type: 'teacher_added',
        description: `Teacher "${teacher.firstName} ${teacher.lastName}" added to ${teacher.school.name}`,
        timestamp: teacher.createdAt,
      });
    });

    // Recent admin additions
    const recentAdmins = await this.prisma.schoolAdmin.findMany({
      where: {
        createdAt: {
          gte: activityStartDate,
          lte: activityEndDate,
        },
      },
      include: {
        school: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    recentAdmins.forEach((admin) => {
      activities.push({
        type: 'admin_added',
        description: `Admin "${admin.firstName} ${admin.lastName}" (${admin.role}) added to ${admin.school.name}`,
        timestamp: admin.createdAt,
      });
    });

    // Sort by timestamp and return most recent
    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20);
  }
}
