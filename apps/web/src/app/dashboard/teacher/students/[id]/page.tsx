'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar,
  BookOpen,
  Clock,
  Award,
  ArrowLeft,
  GraduationCap,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useGetMyTeacherSchoolQuery, useGetMyTeacherProfileQuery } from '@/lib/store/api/schoolAdminApi';
import { useGetStudentByIdQuery, useGetStudentGradesQuery, useUpdateGradeMutation } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';

type TabType = 'profile' | 'grades' | 'attendance';

export default function TeacherStudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  // Get teacher's school and profile
  const { data: schoolResponse } = useGetMyTeacherSchoolQuery();
  const { data: teacherResponse } = useGetMyTeacherProfileQuery();
  const schoolId = schoolResponse?.data?.id;
  const teacher = teacherResponse?.data;

  // Get student data
  const { data: studentResponse, isLoading, error } = useGetStudentByIdQuery(
    { schoolId: schoolId!, id: studentId },
    { skip: !schoolId || !studentId }
  );

  const student = studentResponse?.data;

  // Get student grades
  const { data: gradesResponse, isLoading: isLoadingGrades } = useGetStudentGradesQuery(
    { schoolId: schoolId!, studentId },
    { skip: !schoolId || !studentId || activeTab !== 'grades' }
  );

  const grades = gradesResponse?.data || [];

  // Mutation for updating grades
  const [updateGrade, { isLoading: isPublishing }] = useUpdateGradeMutation();

  const handlePublishGrade = async (gradeId: string) => {
    if (!schoolId) return;
    
    try {
      await updateGrade({
        schoolId,
        gradeId,
        gradeData: { isPublished: true },
      }).unwrap();
      toast.success('Grade published successfully');
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to publish grade');
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
    { id: 'grades', label: 'Grades', icon: <Award className="h-4 w-4" /> },
    { id: 'attendance', label: 'Attendance', icon: <Calendar className="h-4 w-4" /> },
  ];

  if (isLoading || (activeTab === 'grades' && isLoadingGrades)) {
    return (
      <ProtectedRoute roles={['TEACHER']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Loading student details...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !student) {
    return (
      <ProtectedRoute roles={['TEACHER']}>
        <div className="w-full">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Student not found or error loading details.
            </p>
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
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                {student.firstName} {student.lastName}
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                {student.uid || student.publicId} • {student.enrollment?.classLevel || 'N/A'}
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
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Full Name
                        </p>
                        <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          {student.firstName} {student.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Admission Number
                        </p>
                        <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          {student.uid || student.publicId}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Class Level
                        </p>
                        <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          {student.enrollment?.classLevel || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Date of Birth
                        </p>
                        <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Gender
                        </p>
                        <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          {student.gender}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
                        <div>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            Email
                          </p>
                          <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                            {student.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
                        <div>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            Phone
                          </p>
                          <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                            {student.phone}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                      Quick Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              Attendance
                            </p>
                            <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                              {student.attendance}%
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              Average Score
                            </p>
                            <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                              {student.averageScore}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                      Current Classes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {student.classes.map((classItem) => (
                        <div
                          key={classItem.id}
                          className="flex items-center justify-between p-3 bg-light-bg dark:bg-dark-surface rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                              {classItem.subject}
                            </p>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              {classItem.code}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-blue-600 dark:text-blue-400">
                              {classItem.score}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Grades Tab */}
          {activeTab === 'grades' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                    Grades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingGrades ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        Loading grades...
                      </p>
                    </div>
                  ) : grades.length === 0 ? (
                    <div className="text-center py-8">
                      <Award className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        No grades found for this student
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {grades.map((grade: any) => (
                        <Card
                          key={grade.id}
                          className="border border-light-border dark:border-dark-border"
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                  <div>
                                    <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                      {grade.assessmentName || grade.subject || 'Assessment'}
                                    </h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                      {grade.subject || 'N/A'} • {grade.gradeType || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-light-text-secondary dark:text-dark-text-secondary ml-8">
                                  {grade.assessmentDate && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      {new Date(grade.assessmentDate).toLocaleDateString()}
                                    </div>
                                  )}
                                  {grade.term && (
                                    <div className="flex items-center gap-1">
                                      <BookOpen className="h-4 w-4" />
                                      {grade.term}
                                    </div>
                                  )}
                                  {grade.academicYear && (
                                    <div className="text-light-text-secondary dark:text-dark-text-secondary">
                                      {grade.academicYear}
                                    </div>
                                  )}
                                </div>
                                {grade.remarks && (
                                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2 ml-8">
                                    {grade.remarks}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                  {grade.score}
                                </p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                  / {grade.maxScore}
                                </p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                  {grade.percentage?.toFixed(1) || ((grade.score / grade.maxScore) * 100).toFixed(1)}%
                                </p>
                                {grade.isPublished ? (
                                  <span className="inline-block mt-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded">
                                    Published
                                  </span>
                                ) : (
                                  <div className="mt-2 flex flex-col items-end gap-1">
                                    <span className="inline-block px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-xs font-medium rounded">
                                      Draft
                                    </span>
                                    <button
                                      onClick={() => handlePublishGrade(grade.id)}
                                      disabled={isPublishing}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium disabled:opacity-50"
                                    >
                                      {isPublishing ? 'Publishing...' : 'Publish'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                    Attendance Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="w-32 h-32 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                      <Calendar className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                      {student.attendance}%
                    </p>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      Overall Attendance Rate
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}

