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

export default function OverviewPage() {
  const { schools, isLoading: schoolsLoading } = useSchools();
  const { analytics, isLoading: analyticsLoading } = useAnalytics();

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
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Overview
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Platform statistics and recent activity
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <AnalyticsChart
            title="Growth Trends (6 Months)"
            data={analytics?.growthTrends ?? []}
            type="line"
            dataKeys={['schools', 'students', 'teachers', 'admins']}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']}
          />
          <AnalyticsChart
            title="User Distribution"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <AnalyticsChart
            title="Weekly Activity"
            data={analytics?.weeklyActivity ?? []}
            type="line"
            dataKeys={['logins', 'registrations']}
            colors={['#3b82f6', '#10b981']}
          />
          <AnalyticsChart
            title="School Distribution by State"
            data={analytics?.schoolDistribution ?? []}
            type="pie"
            dataKeys={['value']}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']}
          />
          <AnalyticsChart
            title="School Distribution by Level"
            data={analytics?.schoolDistributionByLevel ?? []}
            type="donut"
            dataKeys={['value']}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']}
          />
        </div>

        {/* Recent Schools */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
              Recent Schools
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schools.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  No schools found. Click "Add School" to create one.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {schools.slice(0, 3).map((school) => (
                  <Link
                    key={school.id}
                    href={`/dashboard/super-admin/schools/${school.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 border border-light-border dark:border-dark-border rounded-lg hover:bg-light-bg dark:hover:bg-dark-surface/50 transition-colors cursor-pointer">
                      <div>
                        <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          {school.name}
                        </p>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          {school.city || 'N/A'}, {school.state || 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                            {school.teachersCount || 0} teachers
                          </p>
                          <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
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

