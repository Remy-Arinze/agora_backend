'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import {
  Clock,
  Calendar,
  Loader2,
  Users,
  BookOpen,
  ChevronRight,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { TimetablePeriod } from '@/lib/store/api/schoolAdminApi';
import { 
  useTeacherDashboard, 
  getTodaySchedule, 
  getWeeklySchedule,
  getCurrentAndUpcomingPeriods 
} from '@/hooks/useTeacherDashboard';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

const PERIOD_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  LESSON: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  BREAK: {
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
  },
};

export default function TeacherOverviewPage() {
  const router = useRouter();
  
  // Use unified teacher dashboard hook - handles all data fetching correctly
  const {
    teacher,
    activeSession,
    activeTerm,
    timetable,
    classes,
    isLoading,
    hasError,
    errorMessage,
  } = useTeacherDashboard();

  // Get current day and time
  const now = useMemo(() => new Date(), []);
  const currentDay = useMemo(() => {
    const dayMap: Record<number, string> = {
      0: 'SUNDAY',
      1: 'MONDAY',
      2: 'TUESDAY',
      3: 'WEDNESDAY',
      4: 'THURSDAY',
      5: 'FRIDAY',
      6: 'SATURDAY',
    };
    return dayMap[now.getDay()];
  }, [now]);

  const currentTime = useMemo(() => {
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }, [now]);

  // Derived data using helper functions
  const todaysPeriods = useMemo(() => getTodaySchedule(timetable), [timetable]);
  const { currentPeriod, upcomingPeriods } = useMemo(
    () => getCurrentAndUpcomingPeriods(todaysPeriods, currentTime),
    [todaysPeriods, currentTime]
  );
  const weeklyOverview = useMemo(() => getWeeklySchedule(timetable), [timetable]);

  // Loading state
  if (isLoading) {
    return (
      <ProtectedRoute roles={['TEACHER']}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </ProtectedRoute>
    );
  }

  // Error state
  if (hasError) {
    return (
      <ProtectedRoute roles={['TEACHER']}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            {errorMessage || 'Failed to load dashboard data'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['TEACHER']}>
      <div className="w-full space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
                Welcome back, {teacher?.firstName || 'Teacher'}!
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                {DAY_LABELS[currentDay]}, {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            {activeTerm && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div className="text-sm">
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    {activeTerm.name}
                  </span>
                  {activeSession && (
                    <>
                      <span className="text-blue-600 dark:text-blue-400 mx-1">•</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {activeSession.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Today's Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Today&apos;s Schedule
                  </CardTitle>
                  <span className="text-sm text-light-text-muted dark:text-dark-text-muted">
                    {todaysPeriods.filter((p) => p.type === 'LESSON').length} lessons
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {todaysPeriods.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-3" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      No classes scheduled for today
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Current Period Highlight */}
                    {currentPeriod && (
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded animate-pulse">
                            NOW
                          </span>
                          <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                            {currentPeriod.startTime} - {currentPeriod.endTime}
                          </span>
                        </div>
                        <p className="font-semibold text-green-900 dark:text-green-100">
                          {currentPeriod.subjectName || 'Free Period'}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          {currentPeriod.classArmName || currentPeriod.className || ''}
                        </p>
                        {currentPeriod.roomName && (
                          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-2">
                            <MapPin className="h-3 w-3" />
                            {currentPeriod.roomName}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Upcoming Periods */}
                    {upcomingPeriods.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-light-text-muted dark:text-dark-text-muted uppercase tracking-wide">
                          Coming Up
                        </p>
                        {upcomingPeriods.map((period) => {
                          const colors = PERIOD_TYPE_COLORS[period.type] || PERIOD_TYPE_COLORS.LESSON;
                          return (
                            <div
                              key={period.id}
                              className={`p-3 rounded-lg border ${colors.bg} ${colors.border} ${colors.text}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-sm">
                                  {period.subjectName || period.type}
                                </span>
                                <span className="text-xs font-medium">
                                  {period.startTime} - {period.endTime}
                                </span>
                              </div>
                              {period.type === 'LESSON' && (
                                <p className="text-xs opacity-80">
                                  {period.classArmName || period.className || ''}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Full Today's List (collapsed) */}
                    {todaysPeriods.length > (currentPeriod ? 1 : 0) + upcomingPeriods.length && (
                      <div className="pt-3 border-t border-light-border dark:border-dark-border">
                        <p className="text-xs text-light-text-muted dark:text-dark-text-muted mb-2">
                          Full Schedule
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {todaysPeriods
                            .filter((p) => p.type === 'LESSON')
                            .map((period) => {
                              const isPast = period.endTime <= currentTime;
                              const isCurrent = currentPeriod?.id === period.id;
                              return (
                                <div
                                  key={period.id}
                                  className={`p-2 rounded text-xs ${
                                    isCurrent
                                      ? 'bg-green-100 dark:bg-green-900/30'
                                      : isPast
                                        ? 'bg-gray-100 dark:bg-gray-800'
                                        : 'bg-blue-50 dark:bg-blue-900/20'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <span className={`font-medium truncate ${
                                      isCurrent
                                        ? 'text-green-800 dark:text-green-200'
                                        : isPast
                                          ? 'text-gray-500 dark:text-gray-400 line-through'
                                          : 'text-gray-900 dark:text-gray-100'
                                    }`}>{period.subjectName}</span>
                                    <span className={`text-[10px] font-medium flex-shrink-0 ${
                                      isCurrent
                                        ? 'text-green-600 dark:text-green-400'
                                        : isPast
                                          ? 'text-gray-400 dark:text-gray-500'
                                          : 'text-blue-600 dark:text-blue-400'
                                    }`}>
                                      {period.startTime} - {period.endTime}
                                    </span>
                                  </div>
                                  <div className={`truncate font-medium ${
                                    isCurrent
                                      ? 'text-green-700 dark:text-green-300'
                                      : isPast
                                        ? 'text-gray-400 dark:text-gray-500 line-through'
                                        : 'text-purple-600 dark:text-purple-400'
                                  }`}>
                                    {period.classArmName || period.className}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

        {/* Weekly Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Weekly Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-5 gap-3 min-w-[600px]">
                  {DAYS.slice(0, 5).map((day) => {
                    const periods = weeklyOverview[day] || [];
                    const isToday = day === currentDay;
                    return (
                      <div
                        key={day}
                        className={`rounded-lg p-3 ${
                          isToday
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400'
                            : 'bg-[var(--light-surface)] dark:bg-[var(--dark-surface)] border border-light-border dark:border-dark-border'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3
                            className={`text-sm font-semibold ${
                              isToday
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-light-text-primary dark:text-dark-text-primary'
                            }`}
                          >
                            {DAY_LABELS[day].slice(0, 3)}
                          </h3>
                          <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                            {periods.length} lessons
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {periods.length === 0 ? (
                            <p className="text-xs text-light-text-muted dark:text-dark-text-muted text-center py-2">
                              Free day
                            </p>
                          ) : (
                            periods.slice(0, 4).map((period) => (
                              <div
                                key={period.id}
                                className="text-xs p-2 rounded-md bg-white dark:bg-[var(--dark-bg)] border border-gray-200 dark:border-gray-700"
                              >
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="font-medium truncate text-gray-900 dark:text-gray-100">
                                    {period.subjectName}
                                  </span>
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">
                                    {period.startTime}
                                  </span>
                                </div>
                                <div className="text-purple-600 dark:text-purple-400 truncate font-medium">
                                  {period.classArmName || period.className}
                                </div>
                              </div>
                            ))
                          )}
                          {periods.length > 4 && (
                            <p className="text-xs text-center text-light-text-muted dark:text-dark-text-muted">
                              +{periods.length - 4} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* My Classes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                  My Classes
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/dashboard/teacher/classes')}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                    No classes assigned yet
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {classes.slice(0, 6).map((cls) => (
                    <div
                      key={cls.id}
                      onClick={() => router.push(`/dashboard/teacher/classes/${cls.id}`)}
                      className="flex items-center justify-between p-3 rounded-lg border border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-[var(--dark-hover)] cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-light-text-primary dark:text-dark-text-primary truncate">
                          {cls.name}
                        </p>
                        {cls.teachers?.[0]?.subject && (
                          <p className="text-xs text-light-text-muted dark:text-dark-text-muted truncate">
                            {cls.teachers[0].subject}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                          {cls.studentsCount || 0}
                        </span>
                        <Users className="h-3 w-3 text-light-text-muted dark:text-dark-text-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}

