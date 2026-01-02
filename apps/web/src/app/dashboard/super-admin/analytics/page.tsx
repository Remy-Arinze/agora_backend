'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card } from '@/components/ui/Card';
import { motion } from 'framer-motion';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Calendar } from 'lucide-react';

export default function AnalyticsPage() {
  const now = new Date();
  // Format: YYYY-MM for month picker
  const [selectedDate, setSelectedDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  
  // Parse the selected date to get month and year
  const [selectedYear, selectedMonth] = selectedDate.split('-').map(Number);
  
  const { analytics, isLoading, error } = useAnalytics(selectedMonth, selectedYear);

  if (isLoading) {
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !analytics) {
    const errorMessage = error && 'status' in error 
      ? (error as any).data?.message || 'Failed to fetch analytics'
      : 'Failed to load analytics data';
    
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
              Analytics
            </h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Platform analytics and insights
            </p>
          </motion.div>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }
  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                Analytics
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                Platform analytics and insights
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
              <input
                type="month"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min="2010-01" // Set a reasonable minimum date
                max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`} // Max is current month
                className="px-4 py-2 border border-light-border dark:border-dark-border rounded-lg bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Total Schools"
            value={analytics.totalSchools?.toLocaleString() ?? '0'}
            icon={
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            title="Primary Schools"
            value={analytics.primarySchools?.toLocaleString() ?? '0'}
            icon={
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />
          <StatCard
            title="Secondary Schools"
            value={analytics.secondarySchools?.toLocaleString() ?? '0'}
            icon={
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />
          <StatCard
            title="Universities"
            value={analytics.tertiarySchools?.toLocaleString() ?? '0'}
            icon={
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v9" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v9" />
              </svg>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <AnalyticsChart
            title="User Growth (6 Months)"
            data={analytics.growthTrends}
            type="line"
            dataKeys={['schools', 'students', 'teachers', 'admins']}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']}
          />
          <AnalyticsChart
            title="User Distribution"
            data={[{
              name: 'Users',
              students: analytics.userDistribution.students,
              teachers: analytics.userDistribution.teachers,
              admins: analytics.userDistribution.admins,
            }]}
            type="donut"
            dataKeys={['students', 'teachers', 'admins']}
            colors={['#3b82f6', '#10b981', '#8b5cf6']}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <AnalyticsChart
            title="Platform Activity (7 Days)"
            data={analytics.weeklyActivity}
            type="line"
            dataKeys={['logins', 'registrations']}
            colors={['#3b82f6', '#10b981']}
          />
          <AnalyticsChart
            title="School Distribution by State"
            data={analytics.schoolDistribution}
            type="pie"
            dataKeys={['value']}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <AnalyticsChart
            title="School Distribution by Level"
            data={analytics.schoolDistributionByLevel ?? []}
            type="donut"
            dataKeys={['value']}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']}
          />
          <AnalyticsChart
            title="School Distribution by City"
            data={analytics.schoolDistributionByCity ?? []}
            type="pie"
            dataKeys={['value']}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#a855f7']}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <AnalyticsChart
            title="School Distribution by Location (State)"
            data={analytics.schoolDistributionByLocation ?? []}
            type="horizontal"
            dataKeys={['value']}
            colors={['#3b82f6']}
          />
          <AnalyticsChart
            title="Weekly Activity Breakdown"
            data={analytics.weeklyActivity}
            type="horizontal"
            dataKeys={['logins', 'registrations']}
            colors={['#3b82f6', '#10b981']}
          />
        </div>

        {/* Recent Activity Feed */}
        {analytics.recentActivity && analytics.recentActivity.length > 0 && (
          <Card className="mt-6">
            <div className="p-6">
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
                Recent Activity
              </h3>
              <div className="space-y-3">
                {analytics.recentActivity.slice(0, 10).map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-light-bg dark:bg-dark-bg rounded-lg border border-light-border dark:border-dark-border"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                        {activity.description}
                      </p>
                      <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}

