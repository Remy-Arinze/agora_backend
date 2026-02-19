'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';
import { AutoGenerateButton } from '@/components/ui/AutoGenerateButton';
import { EntityAvatar } from '@/components/ui/EntityAvatar';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import { FadeInUp } from '@/components/ui/FadeInUp';
import {
  Library,
  Users,
  BookOpen,
  Edit2,
  Plus,
  Calendar,
  Building2,
  GraduationCap,
  Loader2,
  AlertCircle,
  UserCheck,
  Mail,
  Phone,
} from 'lucide-react';
import {
  useGetMySchoolQuery,
  useGetFacultyQuery,
  useGetDepartmentsQuery,
  useGenerateDepartmentsForFacultyMutation,
  type Department,
} from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';
import { EditFacultyModal } from '@/components/modals/EditFacultyModal';
import { CreateDepartmentModal } from '@/components/modals/CreateDepartmentModal';

export default function FacultyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const facultyId = params.id as string;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateDeptModal, setShowCreateDeptModal] = useState(false);

  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;

  const {
    data: facultyResponse,
    isLoading: isLoadingFaculty,
    error: facultyError,
  } = useGetFacultyQuery(
    { schoolId: schoolId!, facultyId },
    { skip: !schoolId || !facultyId }
  );

  const { data: departmentsResponse, isLoading: isLoadingDepts } = useGetDepartmentsQuery(
    { schoolId: schoolId!, facultyId },
    { skip: !schoolId || !facultyId }
  );

  const [generateDepartments, { isLoading: isGenerating }] = useGenerateDepartmentsForFacultyMutation();

  const faculty = facultyResponse?.data;
  const departments = departmentsResponse?.data || [];

  // Calculate faculty statistics
  const stats = useMemo(() => {
    const totalStudents = departments.reduce((sum, dept) => sum + (dept.studentsCount || 0), 0);
    const totalLevels = departments.reduce((sum, dept) => sum + (dept.levelsCount || 0), 0);
    
    return {
      departmentsCount: departments.length,
      totalStudents,
      totalLevels,
    };
  }, [departments]);

  const handleGenerateDepartments = async () => {
    if (!schoolId || !facultyId) return;

    try {
      const result = await generateDepartments({ schoolId, facultyId }).unwrap();
      if (result.data.created > 0) {
        toast.success(result.data.message);
      } else {
        toast.success(result.data.message);
      }
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to generate departments');
    }
  };

  const navigateToDepartment = (deptId: string) => {
    router.push(`/dashboard/school/departments/${deptId}`);
  };

  if (isLoadingFaculty) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </ProtectedRoute>
    );
  }

  if (facultyError || !faculty) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
            Faculty Not Found
          </h2>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
            The faculty you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <BackButton />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <BackButton className="mb-4" />

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <EntityAvatar
                name={faculty.name}
                imageUrl={faculty.imageUrl}
                size="xl"
                variant="square"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {faculty.name}
                  </h1>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                    {faculty.code}
                  </span>
                </div>
                {faculty.description && (
                  <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-2xl">
                    {faculty.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-light-text-muted dark:text-dark-text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Created {new Date(faculty.createdAt).toLocaleDateString()}
                  </span>
                  {!faculty.isActive && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setShowEditModal(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Faculty
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Departments</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.departmentsCount}</p>
                </div>
                <div className="p-3 bg-blue-200 dark:bg-blue-800 rounded-full">
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Students</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.totalStudents}</p>
                </div>
                <div className="p-3 bg-green-200 dark:bg-green-800 rounded-full">
                  <GraduationCap className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Active Levels</p>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{stats.totalLevels}</p>
                </div>
                <div className="p-3 bg-amber-200 dark:bg-amber-800 rounded-full">
                  <BookOpen className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Dean Information */}
        {faculty.deanId && faculty.deanName && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Dean of Faculty
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold">
                    {faculty.deanName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                      {faculty.deanName}
                    </h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      Faculty Dean
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Departments Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Departments ({departments.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  {departments.length === 0 && (
                    <AutoGenerateButton
                      onClick={handleGenerateDepartments}
                      isLoading={isGenerating}
                      label="Generate Departments"
                      loadingLabel="Generating..."
                    />
                  )}
                  <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
                    <Button variant="primary" onClick={() => setShowCreateDeptModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Department
                    </Button>
                  </PermissionGate>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingDepts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : departments.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    No departments in this faculty yet.
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <AutoGenerateButton
                      onClick={handleGenerateDepartments}
                      isLoading={isGenerating}
                      label="Generate Default Departments"
                      loadingLabel="Generating..."
                      variant="primary"
                    />
                    <p className="text-xs text-light-text-muted dark:text-dark-text-muted max-w-sm">
                      Auto-generates common departments based on this faculty type 
                      (e.g., Physics, Chemistry, Biology for Science)
                    </p>
                    <div className="flex items-center gap-2 text-light-text-muted dark:text-dark-text-muted">
                      <span className="h-px w-8 bg-light-border dark:bg-dark-border" />
                      <span className="text-xs">or</span>
                      <span className="h-px w-8 bg-light-border dark:bg-dark-border" />
                    </div>
                    <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
                      <Button variant="secondary" onClick={() => setShowCreateDeptModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Custom Department
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <DepartmentCard
                      key={dept.id}
                      department={dept}
                      onClick={() => navigateToDepartment(dept.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Faculty Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-8"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Library className="h-5 w-5" />
                Faculty Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-light-text-muted dark:text-dark-text-muted mb-1">
                    Faculty Name
                  </h4>
                  <p className="text-light-text-primary dark:text-dark-text-primary font-medium">
                    {faculty.name}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-light-text-muted dark:text-dark-text-muted mb-1">
                    Faculty Code
                  </h4>
                  <p className="text-light-text-primary dark:text-dark-text-primary font-medium">
                    {faculty.code}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <h4 className="text-sm font-medium text-light-text-muted dark:text-dark-text-muted mb-1">
                    Description
                  </h4>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">
                    {faculty.description || 'No description provided'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-light-text-muted dark:text-dark-text-muted mb-1">
                    Status
                  </h4>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    faculty.isActive
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {faculty.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-light-text-muted dark:text-dark-text-muted mb-1">
                    Last Updated
                  </h4>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">
                    {new Date(faculty.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Modals */}
        {showEditModal && schoolId && (
          <EditFacultyModal
            schoolId={schoolId}
            faculty={faculty}
            onClose={() => setShowEditModal(false)}
          />
        )}

        {showCreateDeptModal && schoolId && (
          <CreateDepartmentModal
            schoolId={schoolId}
            defaultFacultyId={facultyId}
            onClose={() => setShowCreateDeptModal(false)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

// Department Card Component
function DepartmentCard({
  department,
  onClick,
}: {
  department: Department;
  onClick: () => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer"
      onClick={onClick}
    >
      <Card className="h-full hover:shadow-lg transition-all hover:border-purple-300 dark:hover:border-purple-700">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <EntityAvatar
              name={department.name}
              imageUrl={department.imageUrl}
              size="md"
              variant="square"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                {department.name}
              </h3>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                {department.code}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1 text-light-text-secondary dark:text-dark-text-secondary">
              <BookOpen className="h-3.5 w-3.5" />
              <span>{department.levelsCount} Levels</span>
            </div>
            <div className="flex items-center gap-1 text-light-text-secondary dark:text-dark-text-secondary">
              <Users className="h-3.5 w-3.5" />
              <span>{department.studentsCount} Students</span>
            </div>
          </div>

          {department.description && (
            <p className="mt-3 text-xs text-light-text-muted dark:text-dark-text-muted line-clamp-2">
              {department.description}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

