'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { BackButton } from '@/components/ui/BackButton';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Users,
  GraduationCap,
  Loader2,
  Layers,
  BookMarked,
  Plus,
  Settings,
  Library,
  Sparkles,
} from 'lucide-react';
import { AutoGenerateButton } from '@/components/ui/AutoGenerateButton';
import {
  useGetMySchoolQuery,
  useGetDepartmentQuery,
  useGetDepartmentLevelsQuery,
  useGenerateDepartmentLevelsMutation,
  type DepartmentLevel,
} from '@/lib/store/api/schoolAdminApi';
import { useSchoolType } from '@/hooks/useSchoolType';
import toast from 'react-hot-toast';

type TabType = 'levels' | 'courses' | 'lecturers';

export default function DepartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const departmentId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('levels');
  
  const { currentType } = useSchoolType();

  // Get school data
  const { data: schoolResponse, isLoading: isLoadingSchool } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;

  // Get department data
  const {
    data: departmentResponse,
    isLoading: isLoadingDept,
    error: deptError,
  } = useGetDepartmentQuery(
    { schoolId: schoolId!, departmentId },
    { skip: !schoolId }
  );

  const department = departmentResponse?.data;

  // Get department levels
  const {
    data: levelsResponse,
    isLoading: isLoadingLevels,
    refetch: refetchLevels,
  } = useGetDepartmentLevelsQuery(
    { schoolId: schoolId!, departmentId },
    { skip: !schoolId || !departmentId }
  );
  const levels = levelsResponse?.data || [];

  // Generate levels mutation
  const [generateLevels, { isLoading: isGeneratingLevels }] = useGenerateDepartmentLevelsMutation();

  const handleGenerateLevels = async () => {
    if (!schoolId) return;
    try {
      const result = await generateLevels({ schoolId, departmentId }).unwrap();
      toast.success(result.message || 'Levels generated successfully');
      refetchLevels();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to generate levels');
    }
  };

  const isLoading = isLoadingSchool || isLoadingDept;

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

  if (deptError || !department) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full">
          <BackButton fallbackUrl="/dashboard/school/courses" />
          <Alert variant="error" className="mt-4">
            Department not found or failed to load.
          </Alert>
        </div>
      </ProtectedRoute>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'levels', label: 'Levels', icon: <Layers className="h-4 w-4" /> },
    { id: 'courses', label: 'Courses', icon: <BookMarked className="h-4 w-4" /> },
    { id: 'lecturers', label: 'Lecturers', icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <BackButton fallbackUrl="/dashboard/school/courses" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  {department.name}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium">
                    {department.code}
                  </span>
                  {department.facultyName && (
                    <span className="flex items-center gap-1 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                      <Library className="h-4 w-4" />
                      {department.facultyName}
                    </span>
                  )}
                </div>
                {department.description && (
                  <p className="mt-2 text-light-text-secondary dark:text-dark-text-secondary max-w-2xl">
                    {department.description}
                  </p>
                )}
                <p className="mt-2 text-sm text-light-text-muted dark:text-dark-text-muted flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  {department.studentsCount} student{department.studentsCount !== 1 ? 's' : ''} enrolled
                </p>
              </div>
            </div>
            <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
              <Button variant="secondary" onClick={() => router.push(`/dashboard/school/departments/${departmentId}/settings`)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </PermissionGate>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="border-b border-light-border dark:border-dark-border mb-6">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-colors ${
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
          {activeTab === 'levels' && (
            <Card className='bg-[transparent] border-none'>
              <CardHeader >
                <div className="flex items-center justify-between">
                  <CardTitle>Levels</CardTitle>
                  {department.levelsCount === 0 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleGenerateLevels}
                      disabled={isGeneratingLevels}
                    >
                      {isGeneratingLevels ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Generate Levels
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Level
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingLevels ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : levels.length === 0 ? (
                  <div className="text-center py-12">
                    <Layers className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                      No levels created yet
                    </p>
                    <AutoGenerateButton
                      onClick={handleGenerateLevels}
                      isLoading={isGeneratingLevels}
                      label="Generate Default Levels (100L-400L)"
                      variant="primary"
                    />
                    <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-3">
                      Creates 100 Level, 200 Level, 300 Level, and 400 Level
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {levels.map((level) => (
                      <LevelCard key={level.id} level={level} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'courses' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Courses</CardTitle>
                  <Button variant="primary" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Course
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BookMarked className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    No courses added yet
                  </p>
                  <Button variant="primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Course
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'lecturers' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lecturers</CardTitle>
                  <Button variant="primary" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Lecturer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    No lecturers assigned yet
                  </p>
                  <Button variant="primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Assign First Lecturer
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </motion.div>
      </div>
    </ProtectedRoute>
  );
}

// Level Card Component
function LevelCard({ level }: { level: DepartmentLevel }) {
  const router = useRouter();
  
  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/dashboard/school/levels/${level.id}`)}
    >
      <CardContent className="pt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {level.name}
            </h4>
            {level.academicYear && (
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                {level.academicYear}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
          <Users className="h-4 w-4" />
          <span>{level.studentsCount} Student{level.studentsCount !== 1 ? 's' : ''}</span>
        </div>
      </CardContent>
    </Card>
  );
}

