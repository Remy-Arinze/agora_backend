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

    if (month && year) {
      // Filter by specific month
      startDate = new Date(year, month - 1, 1); // First day of the month
      endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Get total counts filtered by date range
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
      this.prisma.school.count({
        where: {
          isActive: true,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.student.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.teacher.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.schoolAdmin.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.enrollment.count({
        where: {
          isActive: true,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.school.count({
        where: {
          isActive: true,
          hasPrimary: true,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.school.count({
        where: {
          isActive: true,
          hasSecondary: true,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.school.count({
        where: {
          isActive: true,
          hasTertiary: true,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    // Get active sessions (users who logged in within the selected month)
    const activeSessions = await this.prisma.user.count({
      where: {
        lastLoginAt: {
          gte: startDate,
          lte: endDate,
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

    // Weekly activity (for the selected month)
    const weeklyActivity = await this.calculateWeeklyActivity(startDate, endDate);

    // School distribution by state (for the selected month)
    const schoolDistribution = await this.calculateSchoolDistribution(startDate, endDate);

    // School distribution by level (for the selected month)
    const schoolDistributionByLevel = await this.calculateSchoolDistributionByLevel(
      startDate,
      endDate
    );

    // School distribution by location (for the selected month)
    const schoolDistributionByLocation = await this.calculateSchoolDistributionByLocation(
      startDate,
      endDate
    );
    const schoolDistributionByCity = await this.calculateSchoolDistributionByCity(
      startDate,
      endDate
    );

    // Recent activity (for the selected month)
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
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });

      const [schools, students, teachers, admins] = await Promise.all([
        this.prisma.school.count({
          where: {
            createdAt: {
              lt: nextMonth,
            },
            isActive: true,
          },
        }),
        this.prisma.student.count({
          where: {
            createdAt: {
              lt: nextMonth,
            },
          },
        }),
        this.prisma.teacher.count({
          where: {
            createdAt: {
              lt: nextMonth,
            },
          },
        }),
        this.prisma.schoolAdmin.count({
          where: {
            createdAt: {
              lt: nextMonth,
            },
          },
        }),
      ]);

      months.push({
        name: monthName,
        schools,
        students,
        teachers,
        admins,
      });
    }

    return months;
  }

  private async calculateWeeklyActivity(startDate: Date, endDate: Date): Promise<WeeklyActivity[]> {
    const days = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (currentDate <= end) {
      const dayDate = new Date(currentDate);
      dayDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(dayDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });

      const [logins, registrations] = await Promise.all([
        this.prisma.user.count({
          where: {
            lastLoginAt: {
              gte: dayDate,
              lt: nextDay,
            },
          },
        }),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: dayDate,
              lt: nextDay,
            },
          },
        }),
      ]);

      days.push({
        name: dayName,
        logins,
        registrations,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }

  private async calculateSchoolDistribution(
    startDate?: Date,
    endDate?: Date
  ): Promise<SchoolDistribution[]> {
    const whereClause: any = { isActive: true };
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    const schools = await this.prisma.school.findMany({
      where: whereClause,
      select: {
        state: true,
      },
    });

    const distribution = schools.reduce(
      (acc, school) => {
        const state = school.state || 'Unknown';
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 states
  }

  private async calculateSchoolDistributionByLevel(
    startDate?: Date,
    endDate?: Date
  ): Promise<SchoolLevelDistribution[]> {
    const whereClause: any = { isActive: true };
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    const schools = await this.prisma.school.findMany({
      where: whereClause,
      select: {
        hasPrimary: true,
        hasSecondary: true,
        hasTertiary: true,
      },
    });

    const distribution = {
      'Primary Only': 0,
      'Secondary Only': 0,
      'Tertiary Only': 0,
      'Primary + Secondary': 0,
      'Primary + Tertiary': 0,
      'Secondary + Tertiary': 0,
      'All Levels': 0,
    };

    schools.forEach((school) => {
      const hasPrimary = school.hasPrimary;
      const hasSecondary = school.hasSecondary;
      const hasTertiary = school.hasTertiary;

      if (hasPrimary && hasSecondary && hasTertiary) {
        distribution['All Levels']++;
      } else if (hasPrimary && hasSecondary) {
        distribution['Primary + Secondary']++;
      } else if (hasPrimary && hasTertiary) {
        distribution['Primary + Tertiary']++;
      } else if (hasSecondary && hasTertiary) {
        distribution['Secondary + Tertiary']++;
      } else if (hasPrimary) {
        distribution['Primary Only']++;
      } else if (hasSecondary) {
        distribution['Secondary Only']++;
      } else if (hasTertiary) {
        distribution['Tertiary Only']++;
      }
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
    const whereClause: any = { isActive: true };
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    const schools = await this.prisma.school.findMany({
      where: whereClause,
      select: {
        state: true,
      },
    });

    const distribution = schools.reduce(
      (acc, school) => {
        const state = school.state || 'Unknown';
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 states
  }

  private async calculateSchoolDistributionByCity(
    startDate?: Date,
    endDate?: Date
  ): Promise<LocationDistribution[]> {
    const whereClause: any = { isActive: true };
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    const schools = await this.prisma.school.findMany({
      where: whereClause,
      select: {
        city: true,
        state: true,
      },
    });

    const distribution = schools.reduce(
      (acc, school) => {
        const city = school.city ? `${school.city}, ${school.state || ''}`.trim() : 'Unknown';
        acc[city] = (acc[city] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 cities
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
