'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { BackButton } from '@/components/ui/BackButton';
import { SearchInput } from '@/components/ui/SearchInput';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import { FadeInUp } from '@/components/ui/FadeInUp';
import {
  Users,
  GraduationCap,
  Loader2,
  Layers,
  BookMarked,
  FileText,
  Clock,
  FolderOpen,
  Library,
  Building2,
  Plus,
  Download,
  Calendar,
} from 'lucide-react';
import {
  useGetMySchoolQuery,
  useGetLevelQuery,
  useGetLevelStudentsQuery,
  useGetLevelCoursesQuery,
  useGetLevelTimetableQuery,
  useGetLevelCurriculumQuery,
  useGetLevelResourcesQuery,
  useGetActiveSessionQuery,
  type LevelStudent,
  type LevelCourse,
  type TimetablePeriod,
  type LevelCurriculum,
  type LevelResource,
} from '@/lib/store/api/schoolAdminApi';
import { useSchoolType } from '@/hooks/useSchoolType';

type TabType = 'students' | 'courses' | 'timetable' | 'curriculum' | 'resources';

const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

export default function LevelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const levelId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('students');
  const [studentSearch, setStudentSearch] = useState('');
  
  const { currentType } = useSchoolType();

  // Get school data
  const { data: schoolResponse, isLoading: isLoadingSchool } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;

  // Get active session for timetable
  const { data: activeSessionResponse } = useGetActiveSessionQuery(
    { schoolId: schoolId!, schoolType: 'TERTIARY' },
    { skip: !schoolId }
  );
  const termId = activeSessionResponse?.data?.term?.id;

  // Get level data
  const {
    data: levelResponse,
    isLoading: isLoadingLevel,
    error: levelError,
  } = useGetLevelQuery(
    { schoolId: schoolId!, levelId },
    { skip: !schoolId }
  );

  const level = levelResponse?.data;

  // Get students
  const { data: studentsResponse, isLoading: isLoadingStudents } = useGetLevelStudentsQuery(
    { schoolId: schoolId!, levelId },
    { skip: !schoolId || activeTab !== 'students' }
  );
  const students = studentsResponse?.data || [];

  // Get courses
  const { data: coursesResponse, isLoading: isLoadingCourses } = useGetLevelCoursesQuery(
    { schoolId: schoolId!, levelId },
    { skip: !schoolId || activeTab !== 'courses' }
  );
  const courses = coursesResponse?.data || [];

  // Get timetable
  const { data: timetableResponse, isLoading: isLoadingTimetable } = useGetLevelTimetableQuery(
    { schoolId: schoolId!, levelId, termId: termId! },
    { skip: !schoolId || !termId || activeTab !== 'timetable' }
  );
  const timetable = timetableResponse?.data || [];

  // Get curriculum
  const { data: curriculumResponse, isLoading: isLoadingCurriculum } = useGetLevelCurriculumQuery(
    { schoolId: schoolId!, levelId },
    { skip: !schoolId || activeTab !== 'curriculum' }
  );
  const curriculum = curriculumResponse?.data || [];

  // Get resources
  const { data: resourcesResponse, isLoading: isLoadingResources } = useGetLevelResourcesQuery(
    { schoolId: schoolId!, levelId },
    { skip: !schoolId || activeTab !== 'resources' }
  );
  const resources = resourcesResponse?.data || [];

  const isLoading = isLoadingSchool || isLoadingLevel;

  // Redirect if not tertiary
  if (currentType && currentType !== 'TERTIARY') {
    router.push('/dashboard/school/courses');
    return null;
  }

  if (isLoading) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </ProtectedRoute>
    );
  }

  if (levelError || !level) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full">
          <BackButton fallbackUrl="/dashboard/school/courses" />
          <Alert variant="error" className="mt-4">
            Level not found or failed to load.
          </Alert>
        </div>
      </ProtectedRoute>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'students', label: 'Students', icon: <Users className="h-4 w-4" /> },
    { id: 'courses', label: 'Courses', icon: <BookMarked className="h-4 w-4" /> },
    { id: 'timetable', label: 'Timetable', icon: <Clock className="h-4 w-4" /> },
    { id: 'curriculum', label: 'Curriculum', icon: <FileText className="h-4 w-4" /> },
    { id: 'resources', label: 'Resources', icon: <FolderOpen className="h-4 w-4" /> },
  ];

  // Filter students by search
  const filteredStudents = students.filter((student) => {
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    return fullName.includes(studentSearch.toLowerCase()) || student.uid.toLowerCase().includes(studentSearch.toLowerCase());
  });

  // Group timetable by day
  const timetableByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = timetable.filter((period) => period.dayOfWeek === day);
    return acc;
  }, {} as Record<string, TimetablePeriod[]>);

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <BackButton fallbackUrl={`/dashboard/school/departments/${level.departmentId}`} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Layers className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  {level.name}
                </h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                    <Building2 className="h-4 w-4" />
                    {level.departmentName}
                  </span>
                  {level.facultyName && (
                    <span className="flex items-center gap-1 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                      <Library className="h-4 w-4" />
                      {level.facultyName}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                    <Calendar className="h-4 w-4" />
                    {level.academicYear}
                  </span>
                </div>
                <p className="mt-2 text-sm text-light-text-muted dark:text-dark-text-muted flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  {level.studentsCount} student{level.studentsCount !== 1 ? 's' : ''} enrolled
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="border-b border-light-border dark:border-dark-border mb-6">
          <nav className="flex gap-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Students Tab */}
          {activeTab === 'students' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Students ({students.length})</CardTitle>
                  <div className="flex items-center gap-3">
                    <SearchInput
                      value={studentSearch}
                      onChange={setStudentSearch}
                      placeholder="Search students..."
                      size="md"
                    />
                    <PermissionGate resource={PermissionResource.STUDENTS} type={PermissionType.WRITE}>
                      <Button variant="primary" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Student
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingStudents ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      {studentSearch ? 'No students match your search.' : 'No students enrolled in this level yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-light-border dark:border-dark-border">
                          <th className="text-left py-3 px-4 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Student</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">ID</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Email</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Enrolled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr
                            key={student.id}
                            className="border-b border-light-border dark:border-dark-border hover:bg-light-bg-secondary dark:hover:bg-dark-bg-secondary cursor-pointer"
                            onClick={() => router.push(`/dashboard/school/students/${student.id}`)}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {student.profileImage ? (
                                  <img
                                    src={student.profileImage}
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                      {student.firstName[0]}{student.lastName[0]}
                                    </span>
                                  </div>
                                )}
                                <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                  {student.firstName} {student.lastName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              {student.uid}
                            </td>
                            <td className="py-3 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              {student.user?.email || '-'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                student.user?.accountStatus === 'ACTIVE'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                              }`}>
                                {student.user?.accountStatus || 'Shadow'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              {new Date(student.enrollmentDate).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Courses Tab */}
          {activeTab === 'courses' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Courses ({courses.length})</CardTitle>
                  <Button variant="primary" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Course
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCourses ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : courses.length === 0 ? (
                  <div className="text-center py-12">
                    <BookMarked className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      No courses assigned to this level yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {courses.map((course) => (
                      <CourseCard key={course.id} course={course} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timetable Tab */}
          {activeTab === 'timetable' && (
            <Card>
              <CardHeader>
                <CardTitle>Weekly Timetable</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTimetable ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : !termId ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      No active academic session found.
                    </p>
                  </div>
                ) : timetable.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      No timetable set for this level yet.
                    </p>
                    <Button variant="primary" className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Timetable
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day}>
                        <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                          {day.charAt(0) + day.slice(1).toLowerCase()}
                        </h4>
                        {timetableByDay[day].length === 0 ? (
                          <p className="text-sm text-light-text-muted dark:text-dark-text-muted italic">
                            No classes scheduled
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {timetableByDay[day]
                              .sort((a, b) => a.startTime.localeCompare(b.startTime))
                              .map((period) => (
                                <div
                                  key={period.id}
                                  className={`px-3 py-2 rounded-lg text-sm ${
                                    period.type === 'BREAK'
                                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                                      : period.type === 'ASSEMBLY'
                                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  }`}
                                >
                                  <div className="font-medium">{period.startTime} - {period.endTime}</div>
                                  <div>{period.subjectName || period.type}</div>
                                  {period.teacherName && (
                                    <div className="text-xs opacity-75">{period.teacherName}</div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Curriculum Tab */}
          {activeTab === 'curriculum' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Curriculum</CardTitle>
                  <Button variant="primary" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Curriculum
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCurriculum ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : curriculum.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      No curriculum added for this level yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {curriculum.map((item) => (
                      <CurriculumCard key={item.id} curriculum={item} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Resources</CardTitle>
                  <Button variant="primary" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Resource
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingResources ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : resources.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      No resources uploaded for this level yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {resources.map((resource) => (
                      <ResourceCard key={resource.id} resource={resource} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}

// Course Card Component
function CourseCard({ course }: { course: LevelCourse }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {course.name}
            </h4>
            {course.code && (
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                {course.code}
              </p>
            )}
          </div>
          {course.isCore !== undefined && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              course.isCore
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
            }`}>
              {course.isCore ? 'Core' : 'Elective'}
            </span>
          )}
        </div>
        {course.creditUnits && (
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
            {course.creditUnits} Credit Unit{course.creditUnits !== 1 ? 's' : ''}
          </p>
        )}
        {course.teachers.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-light-text-muted dark:text-dark-text-muted">
            <Users className="h-3 w-3" />
            {course.teachers.map((t) => t.name).join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Curriculum Card Component
function CurriculumCard({ curriculum }: { curriculum: LevelCurriculum }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {curriculum.subject || 'General Curriculum'}
            </h4>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {curriculum.academicYear}
            </p>
            {curriculum.teacher && (
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted mt-1">
                By {curriculum.teacher}
              </p>
            )}
          </div>
          <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
            {curriculum.itemsCount} item{curriculum.itemsCount !== 1 ? 's' : ''}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Resource Card Component
function ResourceCard({ resource }: { resource: LevelResource }) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toUpperCase()) {
      case 'PDF':
        return '📄';
      case 'IMAGE':
        return '🖼️';
      case 'VIDEO':
        return '🎥';
      case 'AUDIO':
        return '🎵';
      default:
        return '📁';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">{getFileIcon(resource.fileType)}</div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
              {resource.name}
            </h4>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {formatFileSize(resource.fileSize)} • {resource.fileType}
            </p>
            {resource.description && (
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted mt-1 line-clamp-2">
                {resource.description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

