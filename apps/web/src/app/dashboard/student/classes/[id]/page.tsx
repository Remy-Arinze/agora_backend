'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Users, 
  FileText,
  ArrowLeft,
  Clock,
  User,
  Mail,
  Phone,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { 
  useGetSessionsQuery,
  useGetMyStudentTimetableQuery,
} from '@/lib/store/api/schoolAdminApi';
import { TeacherTimetableGrid } from '@/components/timetable/TeacherTimetableGrid';
import { useStudentDashboard, getStudentTerminology, ClassData } from '@/hooks/useStudentDashboard';

type TabType = 'overview' | 'teachers' | 'resources' | 'timetable';

export default function StudentClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  // Use unified dashboard hook - single source of truth for student data
  const {
    school,
    schoolType,
    classes,
    activeSession,
    activeTerm,
    timetable: dashboardTimetable,
    isLoading: isDashboardLoading,
    isLoadingTimetable: isDashboardLoadingTimetable,
    hasError,
  } = useStudentDashboard();

  const schoolId = school?.id;
  const terminology = getStudentTerminology(schoolType);

  // Find the specific class by ID
  const classData = useMemo((): ClassData | undefined => {
    return classes.find((c) => c.id === classId);
  }, [classes, classId]);

  // Get all sessions for term selector
  const { data: sessionsResponse } = useGetSessionsQuery(
    { schoolId: schoolId! },
    { skip: !schoolId }
  );

  // Determine which term to use
  const currentTermId = selectedTermId || activeTerm?.id || '';

  // If user selected a different term, fetch that timetable separately
  const needsSeparateFetch = selectedTermId && selectedTermId !== activeTerm?.id;
  
  const { 
    data: selectedTermTimetableResponse, 
    isLoading: isLoadingSelectedTerm,
  } = useGetMyStudentTimetableQuery(
    { termId: selectedTermId },
    { skip: !needsSeparateFetch || !selectedTermId }
  );

  // Use selected term's timetable if fetched, otherwise use dashboard's timetable (same as timetables page)
  const timetable = needsSeparateFetch 
    ? (selectedTermTimetableResponse?.data || [])
    : dashboardTimetable;

  // Track loading state: either loading selected term OR dashboard timetable
  const isLoadingTimetable = needsSeparateFetch 
    ? isLoadingSelectedTerm 
    : isDashboardLoadingTimetable;

  // Extract all terms from sessions for selector - filtered by school type and deduplicated
  const allTerms = useMemo(() => {
    if (!sessionsResponse?.data) return [];
    
    // Filter sessions by current school type to avoid duplicates
    const filteredSessions = sessionsResponse.data.filter((session: any) => {
      if (!schoolType) return !session.schoolType;
      return session.schoolType === schoolType;
    });
    
    // Deduplicate sessions by name (keep first/latest)
    const uniqueSessionsMap = new Map<string, any>();
    filteredSessions.forEach((session: any) => {
      if (!uniqueSessionsMap.has(session.name)) {
        uniqueSessionsMap.set(session.name, session);
      }
    });
    
    const terms: Array<{ id: string; name: string; sessionName: string }> = [];
    Array.from(uniqueSessionsMap.values()).forEach((session: any) => {
      if (session.terms) {
        session.terms.forEach((term: any) => {
          terms.push({
            id: term.id,
            name: term.name,
            sessionName: session.name,
          });
        });
      }
    });
    
    return terms.sort((a, b) => {
      if (a.sessionName !== b.sessionName) {
        return b.sessionName.localeCompare(a.sessionName);
      }
      return b.name.localeCompare(a.name);
    });
  }, [sessionsResponse, schoolType]);

  // Main page loading only depends on dashboard loading (not timetable)
  // Timetable has its own loading state in the tab
  const isLoading = isDashboardLoading;

  // Combine teachers from BOTH sources:
  // 1. ClassTeacher records (classData.teachers) - primary/secondary class teachers
  // 2. Timetable periods - teachers assigned to specific subjects/periods
  const teachers = useMemo(() => {
    const teacherMap = new Map<string, any>();
    
    // Add teachers directly assigned to class (from ClassTeacher records)
    const directTeachers = classData?.teachers || [];
    directTeachers.forEach((teacher: any) => {
      if (teacher.id && !teacherMap.has(teacher.id)) {
        teacherMap.set(teacher.id, {
          id: teacher.id,
          firstName: teacher.firstName || '',
          lastName: teacher.lastName || '',
          email: teacher.email || '',
          phone: teacher.phone || '',
          subject: teacher.subject || '',
          isPrimary: teacher.isPrimary || false,
          profileImage: teacher.profileImage || null,
        });
      }
    });
    
    // Also extract teachers from timetable periods (for teachers assigned to specific subjects)
    if (timetable && timetable.length > 0) {
      timetable.forEach((period: any) => {
        // Check for nested teacher object first, then fall back to flat fields
        const teacherId = period.teacher?.id || period.teacherId;
        const teacherName = period.teacher 
          ? `${period.teacher.firstName} ${period.teacher.lastName}` 
          : period.teacherName;
        
        if (teacherId && !teacherMap.has(teacherId)) {
          if (period.teacher) {
            // Use nested teacher object if available
            teacherMap.set(teacherId, {
              id: period.teacher.id,
              firstName: period.teacher.firstName || '',
              lastName: period.teacher.lastName || '',
              email: period.teacher.email || '',
              phone: period.teacher.phone || '',
              subject: period.subjectName || period.courseName || '',
              isPrimary: false,
              profileImage: period.teacher.profileImage || null,
            });
          } else if (teacherName) {
            // Fall back to flat fields
            const nameParts = teacherName.split(' ');
            teacherMap.set(teacherId, {
              id: teacherId,
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              email: '',
              phone: '',
              subject: period.subjectName || period.courseName || '',
              isPrimary: false,
              profileImage: null,
            });
          }
        }
      });
    }
    
    return Array.from(teacherMap.values());
  }, [classData?.teachers, timetable]);

  const tabs = [
    {
      id: 'overview' as TabType,
      label: 'Overview',
      icon: <BookOpen className="h-4 w-4" />,
      available: true,
    },
    {
      id: 'teachers' as TabType,
      label: terminology.staff,
      icon: <Users className="h-4 w-4" />,
      available: true,
    },
    {
      id: 'resources' as TabType,
      label: 'Resources',
      icon: <FileText className="h-4 w-4" />,
      available: true,
    },
    {
      id: 'timetable' as TabType,
      label: 'Timetable',
      icon: <Clock className="h-4 w-4" />,
      available: true,
    },
  ];

  if (isLoading) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Loading {terminology.courseSingular.toLowerCase()}...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!classData) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
              {terminology.courseSingular} not found
            </p>
            <Link href="/dashboard/student/classes">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to {terminology.courses}
              </Button>
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['STUDENT']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link href="/dashboard/student/classes">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {terminology.courses}
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                {classData.name}
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                {classData.code && `${classData.code} • `}
                {classData.classLevel && `${classData.classLevel} • `}
                {classData.academicYear}
                {activeTerm && ` • ${activeTerm.name}`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="mb-6 border-b border-light-border dark:border-dark-border">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                    {terminology.courseSingular} Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {classData.description && (
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                          Description
                        </p>
                        <p className="text-light-text-primary dark:text-dark-text-primary">
                          {classData.description}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                          Academic Year
                        </p>
                        <p className="text-light-text-primary dark:text-dark-text-primary">
                          {classData.academicYear}
                        </p>
                      </div>
                      {classData.type && (
                        <div>
                          <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                            Type
                          </p>
                          <p className="text-light-text-primary dark:text-dark-text-primary capitalize">
                            {classData.type.toLowerCase()}
                          </p>
                        </div>
                      )}
                    </div>
                    {classData.enrollment && (
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                          Enrollment Date
                        </p>
                        <p className="text-light-text-primary dark:text-dark-text-primary">
                          {new Date(classData.enrollment.enrollmentDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Teachers Tab */}
          {activeTab === 'teachers' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                    {terminology.staff}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teachers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {teachers.map((teacher: any) => {
                        const initials = `${teacher.firstName?.charAt(0) || ''}${teacher.lastName?.charAt(0) || ''}`.toUpperCase();
                        return (
                        <Card key={teacher.id} className="border border-light-border dark:border-dark-border">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                              {teacher.profileImage ? (
                                <img
                                  src={teacher.profileImage}
                                  alt={`${teacher.firstName} ${teacher.lastName}`}
                                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                                />
                              ) : initials ? (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white font-semibold text-sm">
                                    {initials}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                  <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-1">
                                  {teacher.firstName} {teacher.lastName}
                                  {teacher.isPrimary && (
                                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Primary)</span>
                                  )}
                                </h3>
                                {teacher.subject && (
                                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
                                    {teacher.subject}
                                  </p>
                                )}
                                <div className="space-y-1">
                                  {teacher.email && (
                                    <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                      <Mail className="h-4 w-4" />
                                      <a href={`mailto:${teacher.email}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                                        {teacher.email}
                                      </a>
                                    </div>
                                  )}
                                  {teacher.phone && (
                                    <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                      <Phone className="h-4 w-4" />
                                      <a href={`tel:${teacher.phone}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                                        {teacher.phone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        No {terminology.staffSingular.toLowerCase()} assigned to this {terminology.courseSingular.toLowerCase()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                    Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {classData.resources && classData.resources.length > 0 ? (
                    <div className="space-y-3">
                      {classData.resources.map((resource: any) => (
                        <Card key={resource.id} className="border border-light-border dark:border-dark-border">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                                    {resource.name}
                                  </h3>
                                  {resource.description && (
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">
                                      {resource.description}
                                    </p>
                                  )}
                                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                                    {resource.fileType} • {new Date(resource.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        No resources available for this {terminology.courseSingular.toLowerCase()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Timetable Tab */}
          {activeTab === 'timetable' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                    Weekly Timetable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingTimetable ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted animate-spin" />
                    </div>
                  ) : timetable.length > 0 ? (
                    <TeacherTimetableGrid
                      timetable={timetable}
                      schoolType={schoolType}
                      isLoading={isLoading}
                      allTerms={allTerms}
                      selectedTermId={currentTermId}
                      onTermChange={setSelectedTermId}
                      activeTermId={activeTerm?.id}
                      terminology={terminology}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <Clock className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        No timetable available for the selected {terminology.periodSingular.toLowerCase()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}

