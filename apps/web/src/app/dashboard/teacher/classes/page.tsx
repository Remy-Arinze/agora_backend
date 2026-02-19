'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { BookOpen, Search, Users, Clock, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { useGetMyClassesQuery, useGetMyTeacherSchoolQuery, useGetMyTeacherProfileQuery } from '@/lib/store/api/schoolAdminApi';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology } from '@/lib/utils/terminology';

export default function TeacherClassesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { currentType } = useSchoolType();
  const terminology = getTerminology(currentType) || {
    courses: 'Classes',
    courseSingular: 'Class',
    staff: 'Teachers',
    staffSingular: 'Teacher',
    periods: 'Terms',
    periodSingular: 'Term',
    subjects: 'Subjects',
    subjectSingular: 'Subject',
  };

  // Get teacher's school and profile
  const { data: schoolResponse, isLoading: isLoadingSchool } = useGetMyTeacherSchoolQuery();
  const { data: teacherResponse, isLoading: isLoadingTeacher } = useGetMyTeacherProfileQuery();
  const school = schoolResponse?.data;
  const teacher = teacherResponse?.data;

  // Get teacher's classes (pass school type for proper filtering)
  const { data: classesResponse, isLoading: isLoadingClasses, error } = useGetMyClassesQuery(
    {
      schoolId: school?.id || '',
      teacherId: teacher?.id || '',
      type: currentType,
    },
    { 
      skip: !school?.id || !teacher?.id,
      // Refetch when school or teacher data changes
      refetchOnMountOrArgChange: true,
    }
  );

  const isLoading = isLoadingSchool || isLoadingTeacher || isLoadingClasses;

  // Debug logging (remove in production)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    if (school?.id && teacher?.id) {
      console.log('Teacher Classes Query:', {
        schoolId: school.id,
        teacherId: teacher.id,
        classesCount: classesResponse?.data?.length || 0,
        error: error,
      });
    }
  }

  const classes = classesResponse?.data || [];

  // Debug: Log teacher and school info
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    if (teacher && school) {
      console.log('[Teacher Classes] Teacher Profile:', {
        id: teacher.id,
        teacherId: teacher.teacherId,
        publicId: teacher.publicId,
        schoolId: school.id,
        classesFound: classes.length,
      });
    }
  }

  const filteredClasses = useMemo(() => {
    if (!searchQuery) return classes;
    
    const query = searchQuery.toLowerCase();
    return classes.filter(
      (classItem) =>
        classItem.name?.toLowerCase().includes(query) ||
        classItem.code?.toLowerCase().includes(query) ||
        classItem.classLevel?.toLowerCase().includes(query) ||
        classItem.teachers?.some((t: any) => 
          t.subject?.toLowerCase().includes(query)
        )
    );
  }, [classes, searchQuery]);

  if (isLoading) {
    return (
      <ProtectedRoute roles={['TEACHER']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Loading {terminology.courses.toLowerCase()}...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute roles={['TEACHER']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-2">
              Failed to load {terminology.courses.toLowerCase()}. Please try again.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-2">
                Error: {error?.toString() || 'Unknown error'}
                {school?.id && teacher?.id && (
                  <span className="block mt-1">
                    School ID: {school.id}, Teacher ID: {teacher.id}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['TEACHER']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            My {terminology.courses}
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Manage your {terminology.courses.toLowerCase()} and view student information
          </p>
        </motion.div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
              <Input
                placeholder="Search by subject, code, or class level..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <BookOpen className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                No classes found matching your search.
              </p>
            </div>
          ) : (
            filteredClasses.map((classItem, index) => (
              <motion.div
                key={classItem.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push(`/dashboard/teacher/classes/${classItem.id}`)}>
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <CardTitle className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                          {classItem.name}
                        </CardTitle>
                        {classItem.code && (
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            {classItem.code}
                          </p>
                        )}
                      </div>
                      {classItem.classLevel && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs font-medium rounded">
                          {classItem.classLevel}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Users className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                            {classItem.studentsCount || 0} Students
                          </p>
                        </div>
                      </div>
                      {classItem.teachers && classItem.teachers.length > 0 && (
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            {classItem.teachers
                              .filter((t: any) => t.teacherId === classItem.teachers?.[0]?.teacherId)
                              .map((teacher: any, idx: number) => (
                                <div key={idx} className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                  {teacher.subject && (
                                    <span className="font-medium">{teacher.subject}</span>
                                  )}
                                  {teacher.isPrimary && (
                                    <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 text-xs rounded">
                                      Primary Teacher
                                    </span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          Academic Year: {classItem.academicYear}
                        </p>
                      </div>
                      {classItem.description && (
                        <div className="pt-2 border-t border-light-border dark:border-dark-border">
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {classItem.description}
                          </p>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/teacher/classes/${classItem.id}`);
                        }}
                      >
                        View {terminology.courseSingular} Details →
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

