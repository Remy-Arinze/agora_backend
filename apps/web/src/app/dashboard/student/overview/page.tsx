'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { 
  BookOpen, 
  Clock, 
  FileText, 
  GraduationCap, 
  Award, 
  TrendingUp,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  useGetUpcomingEventsQuery,
  useGetMyStudentCalendarQuery,
} from '@/lib/store/api/schoolAdminApi';
import { 
  useStudentDashboard, 
  getStudentTodaySchedule, 
  getStudentTerminology 
} from '@/hooks/useStudentDashboard';
import { format, parseISO } from 'date-fns';

export default function StudentOverviewPage() {
  // Use unified dashboard hook for core data
  const {
    student,
    school,
    schoolType,
    activeEnrollment,
    activeClass,
    activeTerm,
    timetable,
    stats,
    isLoading,
    hasError,
    errorMessage,
  } = useStudentDashboard();
  
  const terminology = getStudentTerminology(schoolType);
  const schoolId = school?.id;
  const activeTermId = activeTerm?.id;
  
  // Get today's schedule
  const todaySchedule = useMemo(() => {
    return getStudentTodaySchedule(timetable);
  }, [timetable]);

  // Get calendar data (events) for next 7 days
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data: calendarResponse } = useGetMyStudentCalendarQuery(
    { startDate, endDate: endDateStr },
    { skip: !schoolId }
  );
  const calendarData = calendarResponse?.data;
  const calendarEvents = calendarData?.events || [];

  // Get upcoming events (fallback to events query if calendar doesn't have events)
  const { data: upcomingEventsResponse } = useGetUpcomingEventsQuery(
    { schoolId: schoolId!, days: 7, schoolType: schoolType || undefined },
    { skip: !schoolId || (calendarEvents && calendarEvents.length > 0) }
  );
  const upcomingEvents = calendarEvents.length > 0 ? calendarEvents : (upcomingEventsResponse?.data || []);

  if (isLoading) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Loading dashboard...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (hasError || !student) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              {errorMessage || 'Unable to load student profile'}
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const studentName = `${student.firstName} ${student.lastName}`.trim();

  return (
    <ProtectedRoute roles={['STUDENT']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Welcome back, {studentName}!
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            {activeEnrollment?.classLevel ? (
              <>Currently enrolled in <span className="font-semibold">{activeEnrollment.classLevel}</span></>
            ) : (
              'View your academic progress, classes, and results'
            )}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                    Average Score
                  </p>
                  <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mt-2">
                    {stats.averageScore}%
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                    Current {terminology.classLabel}
                  </p>
                  <p className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mt-2">
                    {activeClass?.name || activeEnrollment?.classLevel || 'N/A'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                    Grades Published
                  </p>
                  <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mt-2">
                    {stats.totalGrades}
                  </p>
                  {stats.recentGradesCount > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {stats.recentGradesCount} new this week
                    </p>
                  )}
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                    Today&apos;s Classes
                  </p>
                  <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mt-2">
                    {todaySchedule.length}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Today's Schedule */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  Today&apos;s Schedule
                </CardTitle>
                <Link href="/dashboard/student/timetables">
                  <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400">
                    View Timetable →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {todaySchedule.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide pr-2">
                  {todaySchedule.map((period: any, index: number) => {
                    // Check if class is currently ongoing
                    const now = new Date();
                    const [startHour, startMin] = period.startTime.split(':').map(Number);
                    const [endHour, endMin] = period.endTime.split(':').map(Number);
                    const startTime = new Date();
                    startTime.setHours(startHour, startMin, 0, 0);
                    const endTime = new Date();
                    endTime.setHours(endHour, endMin, 0, 0);
                    const isOngoing = now >= startTime && now <= endTime;
                    const isUpcoming = now < startTime;
                    
                    // Check if it's a free period (no subject/course or type is not LESSON)
                    const isFreePeriod = period.type !== 'LESSON' || 
                      (!period.subjectName && !period.subject?.name && !period.courseName && !period.course?.name);
                    
                    const periodTitle = isFreePeriod 
                      ? 'Free Period'
                      : (period.subjectName || period.subject?.name || period.courseName || period.course?.name || 'Class');
                    
                    return (
                      <motion.div
                        key={period.id || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isOngoing 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500' 
                            : isUpcoming
                            ? 'bg-gray-50 dark:bg-dark-surface border-gray-200 dark:border-dark-border'
                            : 'bg-gray-50 dark:bg-dark-surface border-gray-200 dark:border-dark-border opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                {periodTitle}
                              </h4>
                              {isOngoing && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                                  Now
                                </span>
                              )}
                              {period.isFromCourseRegistration && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-purple-500 text-white rounded-full">
                                  CO
                                </span>
                              )}
                            </div>
                            {period.roomName || period.room?.name ? (
                              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                {period.roomName || period.room.name}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                              {period.startTime} - {period.endTime}
                            </p>
                            {period.hasConflict && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                Conflict
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">
                    No classes scheduled for today
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  Upcoming Events
                </CardTitle>
                <Link href="/dashboard/student/calendar">
                  <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400">
                    View Calendar →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingEvents.slice(0, 5).map((event: any) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-gray-50 dark:bg-dark-surface rounded-lg flex items-center gap-4"
                  >
                    <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                        {event.title}
                      </h4>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {format(parseISO(event.startDate), 'MMM d, yyyy • h:mm a')}
                        {event.location && ` • ${event.location}`}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
              Quick Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/dashboard/student/classes">
                <Button className="w-full" variant="primary">
                  <BookOpen className="h-4 w-4 mr-2" />
                  My Classes
                </Button>
              </Link>
              <Link href="/dashboard/student/results">
                <Button className="w-full" variant="secondary">
                  <FileText className="h-4 w-4 mr-2" />
                  View Results
                </Button>
              </Link>
              <Link href="/dashboard/student/resources">
                <Button className="w-full" variant="secondary">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Resources
                </Button>
              </Link>
              <Link href="/dashboard/student/calendar">
                <Button className="w-full" variant="secondary">
                  <Calendar className="h-4 w-4 mr-2" />
                  Calendar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
