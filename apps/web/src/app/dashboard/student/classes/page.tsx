'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { 
  BookOpen, 
  Users, 
  FileText,
  Clock,
  User,
  Mail,
  Phone,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { 
  useGetMyStudentProfileQuery,
  useGetMyStudentClassesQuery,
  useGetMyStudentTimetableQuery,
  useGetActiveSessionQuery,
  useGetSessionsQuery,
  useGetCurriculumForClassQuery,
  useGetMyClassmatesQuery,
} from '@/lib/store/api/schoolAdminApi';
import { TeacherTimetableGrid } from '@/components/timetable/TeacherTimetableGrid';
import { useStudentSchoolType, getStudentTerminology } from '@/hooks/useStudentDashboard';
import toast from 'react-hot-toast';

type TabType = 'overview' | 'teachers' | 'resources' | 'curriculum' | 'timetable' | 'classmates';

// Classmate Card Component
function ClassmateCard({ classmate }: { classmate: any }) {
  const [imageError, setImageError] = useState(false);

  const getInitials = () => {
    const first = classmate.firstName?.[0]?.toUpperCase() || '';
    const last = classmate.lastName?.[0]?.toUpperCase() || '';
    return first + last || '?';
  };

  const fullName = `${classmate.firstName || ''} ${classmate.lastName || ''}`.trim() || 'Unknown';
  const shouldShowImage = classmate.profileImage && !imageError && classmate.profileImage.trim() !== '';

  return (
    <Link href={`/dashboard/school/students/${classmate.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border border-light-border dark:border-dark-border rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer bg-light-card dark:bg-dark-surface"
      >
        <div className="flex items-center gap-4">
          {shouldShowImage ? (
            <img
              src={classmate.profileImage}
              alt={fullName}
              className="w-12 h-12 rounded-full object-cover border-2 border-light-border dark:border-dark-border"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white font-semibold text-sm border-2 border-light-border dark:border-dark-border">
              {getInitials()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
              {fullName}
            </h3>
            {classmate.enrollment?.classLevel && (
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                {classmate.enrollment.classLevel}
              </p>
            )}
            {classmate.uid && (
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                ID: {classmate.uid}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function StudentClassesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  // Get school type from student's enrollment (not localStorage)
  const { schoolType: currentType, schoolId, isLoading: isLoadingSchoolType } = useStudentSchoolType();
  const terminology = getStudentTerminology(currentType);

  // Get student's classes
  const { data: classesResponse, isLoading: isLoadingClasses } = useGetMyStudentClassesQuery();
  const classes = classesResponse?.data || [];
  
  // Get the active/primary class (first one, or could filter by isActive enrollment)
  const classData = useMemo(() => {
    // If multiple classes, show the first one (most recent enrollment)
    // In practice, students typically have one active class
    return classes[0] || null;
  }, [classes]);

  // Get active session
  const { data: activeSessionResponse } = useGetActiveSessionQuery(
    { schoolId: schoolId! },
    { skip: !schoolId }
  );
  const activeSession = activeSessionResponse?.data;

  // Get curriculum for class
  // Note: For students, we don't filter by subject - they should see all curriculum for their class
  const { data: curriculumResponse } = useGetCurriculumForClassQuery(
    {
      schoolId: schoolId!,
      classId: classData?.id!,
      // Don't filter by subject for students - show all curriculum for the class
      subject: undefined,
      academicYear: classData?.academicYear || activeSession?.session?.name,
      termId: activeSession?.term?.id || undefined,
    },
    { skip: !schoolId || !classData?.id || activeTab !== 'curriculum' }
  );

  // Get classmates
  const { data: classmatesResponse, isLoading: isLoadingClassmates } = useGetMyClassmatesQuery(
    { classId: classData?.id },
    { skip: !classData?.id || activeTab !== 'classmates' }
  );
  const classmates = classmatesResponse?.data || [];

  // Get all sessions for term selector
  const { data: sessionsResponse } = useGetSessionsQuery(
    { schoolId: schoolId! },
    { skip: !schoolId }
  );

  // Determine which term to use
  const currentTermId = selectedTermId || activeSession?.term?.id || '';

  // Get student's timetable - unified endpoint handles all school types
  const { data: timetableResponse, isLoading: isLoadingTimetable } = useGetMyStudentTimetableQuery(
    { termId: currentTermId || undefined },
    { skip: !classData } // Skip until we know student is enrolled
  );
  const timetable = timetableResponse?.data || [];

  // Extract all terms from sessions for selector - filtered by school type and deduplicated
  const allTerms = useMemo(() => {
    if (!sessionsResponse?.data) return [];
    
    // Filter sessions by current school type to avoid duplicates
    const filteredSessions = sessionsResponse.data.filter((session: any) => {
      if (!currentType) return !session.schoolType;
      return session.schoolType === currentType;
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
  }, [sessionsResponse, currentType]);

  const isLoading = isLoadingSchoolType || isLoadingClasses || isLoadingTimetable;

  // Handle resource download
  const handleDownload = async (resource: any) => {
    try {
      if (!schoolId || !classData?.id) {
        toast.error('Unable to download resource');
        return;
      }

      const baseUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000/api';
      const downloadUrl = `${baseUrl}/schools/${schoolId}/classes/${classData.id}/resources/${resource.id}/download`;

      // Get auth token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || localStorage.getItem('token') : null;
      
      // Fetch and create blob for download
      const response = await fetch(downloadUrl, {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });
      
      if (!response.ok) {
        throw new Error('Failed to download resource');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resource.name || resource.fileName || 'resource';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to download resource');
    }
  };

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
      id: 'curriculum' as TabType,
      label: 'Curriculum',
      icon: <BookOpen className="h-4 w-4" />,
      available: true,
    },
    {
      id: 'timetable' as TabType,
      label: 'Timetable',
      icon: <Clock className="h-4 w-4" />,
      available: true,
    },
    {
      id: 'classmates' as TabType,
      label: 'Classmates',
      icon: <Users className="h-4 w-4" />,
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
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-2">
              No {terminology.courseSingular.toLowerCase()} found
            </p>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
              You may not be enrolled in any {terminology.courses.toLowerCase()} for the current term.
            </p>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                {classData.name}
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                {classData.code && `${classData.code} • `}
                {classData.classLevel && `${classData.classLevel} • `}
                {classData.academicYear}
                {activeSession?.term && ` • ${activeSession.term.name}`}
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
                  {classData.teachers && classData.teachers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {classData.teachers.map((teacher: any) => (
                        <Card key={teacher.id} className="border border-light-border dark:border-dark-border">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                              </div>
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
                      ))}
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

          {/* Curriculum Tab */}
          {activeTab === 'curriculum' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                    Curriculum Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {curriculumResponse?.data ? (
                    <div className="space-y-6">
                      {curriculumResponse.data.items.map((item: any, index: number) => (
                        <div
                          key={item.id || index}
                          className="pb-6 border-b border-light-border dark:border-dark-border last:border-0 last:pb-0"
                        >
                          <div className="flex items-start gap-4 mb-4">
                            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-400 font-bold text-sm text-center leading-tight">
                                Week {item.week}
                              </span>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                                {item.topic}
                              </h3>
                              {item.objectives && item.objectives.length > 0 && (
                                <div className="space-y-2 mb-3">
                                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                    Learning Objectives:
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 ml-2">
                                    {item.objectives.map((objective: string, objIndex: number) => (
                                      <li
                                        key={objIndex}
                                        className="text-sm text-light-text-secondary dark:text-dark-text-secondary"
                                      >
                                        {objective}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {item.resources && item.resources.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                                    Resources:
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {item.resources.map((resource: string, resIndex: number) => (
                                      <span
                                        key={resIndex}
                                        className="px-3 py-1 bg-light-bg dark:bg-dark-surface rounded-md text-xs text-light-text-secondary dark:text-dark-text-secondary"
                                      >
                                        {resource}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                        No curriculum created yet.
                      </p>
                      <p className="text-sm text-light-text-muted dark:text-dark-text-muted mb-4">
                        Teachers can create a curriculum with weekly topics, objectives, and resources.
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
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDownload(resource)}
                              >
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
                  {timetable.length > 0 ? (
                    <TeacherTimetableGrid
                      timetable={timetable}
                      schoolType={currentType}
                      isLoading={isLoadingTimetable}
                      allTerms={allTerms}
                      selectedTermId={currentTermId}
                      onTermChange={setSelectedTermId}
                      activeTermId={activeSession?.term?.id}
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

          {/* Classmates Tab */}
          {activeTab === 'classmates' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                    Classmates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingClassmates ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted animate-spin" />
                    </div>
                  ) : classmates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {classmates.map((classmate: any) => (
                        <ClassmateCard key={classmate.id} classmate={classmate} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        No classmates found in this {terminology.courseSingular.toLowerCase()}
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

