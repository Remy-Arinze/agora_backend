import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsDto {
  @ApiProperty({ description: 'Total number of students' })
  totalStudents: number;

  @ApiProperty({ description: 'Percentage change in students' })
  studentsChange: number;

  @ApiProperty({ description: 'Total number of teachers' })
  totalTeachers: number;

  @ApiProperty({ description: 'Percentage change in teachers' })
  teachersChange: number;

  @ApiProperty({ description: 'Total number of active courses' })
  activeCourses: number;

  @ApiProperty({ description: 'Percentage change in courses' })
  coursesChange: number;

  @ApiProperty({ description: 'Number of pending admissions' })
  pendingAdmissions: number;

  @ApiProperty({ description: 'Change in pending admissions' })
  pendingAdmissionsChange: number;
}

export class GrowthTrendDataDto {
  @ApiProperty({ description: 'Month name' })
  name: string;

  @ApiProperty({ description: 'Number of students' })
  students: number;

  @ApiProperty({ description: 'Number of teachers' })
  teachers: number;

  @ApiProperty({ description: 'Number of courses' })
  courses: number;
}

export class WeeklyActivityDataDto {
  @ApiProperty({ description: 'Day name' })
  name: string;

  @ApiProperty({ description: 'Number of admissions' })
  admissions: number;

  @ApiProperty({ description: 'Number of transfers' })
  transfers: number;
}

export class RecentStudentDto {
  @ApiProperty({ description: 'Student ID' })
  id: string;

  @ApiProperty({ description: 'Student full name' })
  name: string;

  @ApiProperty({ description: 'Class level' })
  classLevel: string;

  @ApiProperty({ description: 'Admission number' })
  admissionNumber: string;

  @ApiProperty({ description: 'Student status' })
  status: 'active' | 'inactive';

  @ApiProperty({ description: 'Date created' })
  createdAt: string;
}

export class SchoolDashboardDto {
  @ApiProperty({ description: 'Dashboard statistics', type: DashboardStatsDto })
  stats: DashboardStatsDto;

  @ApiProperty({ description: 'Growth trends data', type: [GrowthTrendDataDto] })
  growthTrends: GrowthTrendDataDto[];

  @ApiProperty({ description: 'Weekly activity data', type: [WeeklyActivityDataDto] })
  weeklyActivity: WeeklyActivityDataDto[];

  @ApiProperty({ description: 'Recent students', type: [RecentStudentDto] })
  recentStudents: RecentStudentDto[];
}

