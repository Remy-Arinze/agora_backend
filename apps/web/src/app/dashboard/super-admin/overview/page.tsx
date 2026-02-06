'use client';

import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/dashboard/StatCard';
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { motion } from 'framer-motion';
import { useSchools } from '@/hooks/useSchools';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';

export default function OverviewPage() {
  const { schools, isLoading: schoolsLoading } = useSchools();
  const { analytics, isLoading: analyticsLoading } = useAnalytics();
  const { user } = useAuth();
  
  // Get user's first name for welcome message
  const userName = user?.firstName || user?.name?.split(' ')[0] || 'there';

  const isLoading = schoolsLoading || analyticsLoading;

  if (isLoading) {
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white dark:text-white mb-2">
            Welcome back, {userName}
          </h1>
          <p className="text-lg text-[#9ca3af] dark:text-[#9ca3af]">
            Here&apos;s your platform&apos;s performance
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Total Schools"
            value={analytics?.totalSchools ?? schools.length}
            change="+12%"
            changeType="positive"
            icon={
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            title="Total Students"
            value={analytics?.totalStudents?.toLocaleString() ?? '0'}
            change="+18%"
            changeType="positive"
            icon={
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <StatCard
            title="Total Teachers"
            value={analytics?.totalTeachers?.toLocaleString() ?? schools.reduce((sum, school) => sum + (school.teachersCount || 0), 0).toString()}
            change="+8%"
            changeType="positive"
            icon={
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            title="Total Admins"
            value={analytics?.totalAdmins?.toLocaleString() ?? '0'}
            change="+5%"
            changeType="positive"
            icon={
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
        </div>

        {/* Charts - Dynamic Layout with Varied Widths */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-6">
          {/* Main Growth Chart - Takes 65% (6.5/10 columns, rounded to 7) */}
          <div className="lg:col-span-7">
            <AnalyticsChart
              title="Platform Growth Trends"
              description="Overall enhancement in platform adoption and user engagement across various metrics over the past 6 months."
              data={analytics?.growthTrends ?? []}
              type="line"
              dataKeys={['schools', 'students', 'teachers', 'admins']}
              colors={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']}
            />
          </div>
          {/* User Distribution - Takes 35% (3.5/10 columns, rounded to 3) */}
          <div className="lg:col-span-3">
            <AnalyticsChart
              title="User Distribution"
              description="Breakdown of user types across the platform showing the distribution of students, teachers, and administrators."
              data={analytics?.userDistribution ? [{
                name: 'Users',
                students: analytics.userDistribution.students,
                teachers: analytics.userDistribution.teachers,
                admins: analytics.userDistribution.admins || 0,
              }] : []}
              type="donut"
              dataKeys={['students', 'teachers', 'admins']}
              colors={['#3b82f6', '#10b981', '#8b5cf6']}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-6">
          {/* Weekly Activity - Takes 60% (6/10 columns) */}
          <div className="lg:col-span-6">
            <AnalyticsChart
              title="Weekly Activity Trends"
              description="Tracking user logins and new registrations to monitor platform engagement and growth patterns."
              data={analytics?.weeklyActivity ?? []}
              type="line"
              dataKeys={['logins', 'registrations']}
              colors={['#3b82f6', '#10b981']}
            />
          </div>
          {/* State Distribution - Takes 40% (4/10 columns) */}
          <div className="lg:col-span-4">
            <AnalyticsChart
              title="School Distribution by State"
              description="Geographic distribution of schools across different states, providing insights into regional coverage."
              data={analytics?.schoolDistribution ?? []}
              type="pie"
              dataKeys={['value']}
              colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']}
            />
          </div>
        </div>

        {/* School Distribution by Level - Full width */}
        <div className="mb-6">
          <AnalyticsChart
            title="School Distribution by Level"
            description="Categorization of schools by educational level, showing the diversity of institutions on the platform."
            data={analytics?.schoolDistributionByLevel ?? []}
            type="donut"
            dataKeys={['value']}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']}
          />
        </div>

        {/* Recent Schools */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white dark:text-white">
              Recent Schools
            </CardTitle>
            <p className="text-sm text-[#9ca3af] dark:text-[#9ca3af] mt-1">
              Latest schools added to the platform
            </p>
          </CardHeader>
          <CardContent>
            {schools.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#9ca3af] dark:text-[#9ca3af]">
                  No schools found. Click &quot;Add School&quot; to create one.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {schools.slice(0, 3).map((school) => (
                  <Link
                    key={school.id}
                    href={`/dashboard/super-admin/schools/${school.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 border border-[#1a1f2e] dark:border-[#1a1f2e] rounded-lg hover:bg-[#1f2937] dark:hover:bg-[#1f2937] transition-colors cursor-pointer">
                      <div>
                        <p className="font-medium text-white dark:text-white">
                          {school.name}
                        </p>
                        <p className="text-sm text-[#9ca3af] dark:text-[#9ca3af]">
                          {school.city || 'N/A'}, {school.state || 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-white dark:text-white">
                            {school.teachersCount || 0} teachers
                          </p>
                          <p className="text-xs text-[#6b7280] dark:text-[#6b7280]">
                            {school.subdomain}.agora.com
                          </p>
                        </div>
                        <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                          View →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

