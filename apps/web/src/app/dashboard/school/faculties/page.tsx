'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Alert } from '@/components/ui/Alert';
import { motion } from 'framer-motion';
import {
  Library,
  Plus,
  Users,
  Building2,
  Loader2,
  Edit2,
  Trash2,
  MoreVertical,
  BookOpen,
} from 'lucide-react';
import { AutoGenerateButton } from '@/components/ui/AutoGenerateButton';
import { EntityAvatar } from '@/components/ui/EntityAvatar';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import { useGetMySchoolQuery } from '@/lib/store/api/schoolAdminApi';
import { useFaculties } from '@/hooks/useFaculties';
import { useSchoolType } from '@/hooks/useSchoolType';
import { CreateFacultyModal } from '@/components/modals/CreateFacultyModal';
import { EditFacultyModal } from '@/components/modals/EditFacultyModal';
import { DeleteFacultyModal } from '@/components/modals/DeleteFacultyModal';
import type { Faculty } from '@/lib/store/api/schoolAdminApi';

export default function FacultiesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{ isOpen: boolean; faculty: Faculty | null }>({
    isOpen: false,
    faculty: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; faculty: Faculty | null }>({
    isOpen: false,
    faculty: null,
  });

  const { currentType } = useSchoolType();

  // Get school data
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;
  const hasTertiary = schoolResponse?.data?.hasTertiary;

  // Get faculties
  const {
    faculties,
    isLoading,
    error,
    createFaculty,
    updateFaculty,
    deleteFaculty,
    generateDefaults,
    isCreating,
    isUpdating,
    isDeleting,
    isGenerating,
  } = useFaculties({
    schoolId,
    skip: !schoolId || currentType !== 'TERTIARY',
  });

  // Filter faculties by search
  const filteredFaculties = useMemo(() => {
    if (!searchQuery) return faculties;
    const query = searchQuery.toLowerCase();
    return faculties.filter(
      (faculty) =>
        faculty.name.toLowerCase().includes(query) ||
        faculty.code.toLowerCase().includes(query) ||
        faculty.deanName?.toLowerCase().includes(query)
    );
  }, [faculties, searchQuery]);

  const handleFacultyClick = (facultyId: string) => {
    router.push(`/dashboard/school/faculties/${facultyId}`);
  };

  const handleCreateFaculty = async (data: { name: string; code: string; description?: string; deanId?: string }) => {
    const result = await createFaculty(data);
    if (result) {
      setShowCreateModal(false);
    }
    return result;
  };

  const handleUpdateFaculty = async (data: { name?: string; code?: string; description?: string; deanId?: string }) => {
    if (!editModal.faculty) return;
    const result = await updateFaculty(editModal.faculty.id, data);
    if (result) {
      setEditModal({ isOpen: false, faculty: null });
    }
    return result;
  };

  const handleDeleteFaculty = async (force?: boolean) => {
    if (!deleteModal.faculty) return false;
    const result = await deleteFaculty(deleteModal.faculty.id, force);
    if (result) {
      setDeleteModal({ isOpen: false, faculty: null });
    }
    return result;
  };

  // Show error if not tertiary
  if (currentType !== 'TERTIARY') {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full max-w-2xl mx-auto mt-8">
          <Alert variant="warning">
            <div className="flex items-center gap-3">
              <Library className="h-5 w-5" />
              <div>
                <p className="font-medium">Faculties are only available for Tertiary institutions</p>
                <p className="text-sm mt-1">
                  Switch to your tertiary school type to manage faculties and departments.
                </p>
              </div>
            </div>
          </Alert>
        </div>
      </ProtectedRoute>
    );
  }

  // Show error if school doesn't have tertiary
  if (schoolResponse && !hasTertiary) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full max-w-2xl mx-auto mt-8">
          <Alert variant="error">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5" />
              <div>
                <p className="font-medium">Your school does not have tertiary level</p>
                <p className="text-sm mt-1">
                  Contact support to enable tertiary level for your institution.
                </p>
              </div>
            </div>
          </Alert>
        </div>
      </ProtectedRoute>
    );
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

  if (error) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full">
          <Alert variant="error" className="mb-4">
            Failed to load faculties. Please try again.
          </Alert>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                Faculties
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                Manage faculties and their departments
              </p>
            </div>
            <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => generateDefaults()}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Library className="h-4 w-4 mr-2" />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate Defaults'}
                </Button>
                <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Faculty
                </Button>
              </div>
            </PermissionGate>
          </div>
        </motion.div>

        {/* Search */}
        <div className="mb-6 flex justify-end">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by faculty name, code, or dean..."
            containerClassName="w-80"
            size="lg"
          />
        </div>

        {/* Faculties Grid */}
        {filteredFaculties.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Library className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
              <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                {searchQuery
                  ? 'No faculties found matching your search.'
                  : 'No faculties created yet.'}
              </p>
              {!searchQuery && (
                <div className="flex flex-col items-center gap-4">
                  <AutoGenerateButton
                    onClick={() => generateDefaults()}
                    isLoading={isGenerating}
                    label="Generate Default Faculties"
                    loadingLabel="Generating..."
                    variant="primary"
                    className="min-w-[200px]"
                  />
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                    Creates 10 common university faculties (Science, Engineering, Arts, etc.)
                  </p>
                  <div className="flex items-center gap-2 text-light-text-muted dark:text-dark-text-muted">
                    <span className="h-px w-8 bg-light-border dark:bg-dark-border" />
                    <span className="text-xs">or</span>
                    <span className="h-px w-8 bg-light-border dark:bg-dark-border" />
                  </div>
                  <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
                    <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Custom Faculty
                    </Button>
                  </PermissionGate>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFaculties.map((faculty, index) => (
              <motion.div
                key={faculty.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardContent
                    className="pt-6 flex-1 cursor-pointer"
                    onClick={() => handleFacultyClick(faculty.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <EntityAvatar
                          name={faculty.name}
                          imageUrl={faculty.imageUrl}
                          size="md"
                          variant="square"
                        />
                        <div>
                          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                            {faculty.name}
                          </h3>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {faculty.code}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          faculty.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {faculty.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {faculty.description && (
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4 line-clamp-2">
                        {faculty.description}
                      </p>
                    )}

                    <div className="space-y-2">
                      {faculty.deanName && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                          <span className="text-light-text-secondary dark:text-dark-text-secondary">
                            Dean: {faculty.deanName}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <BookOpen className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                        <span className="text-light-text-secondary dark:text-dark-text-secondary">
                          {faculty.departmentsCount} Department{faculty.departmentsCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <div className="px-6 pb-4 pt-2 border-t border-light-border dark:border-dark-border flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditModal({ isOpen: true, faculty });
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModal({ isOpen: true, faculty });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        <CreateFacultyModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateFaculty}
          isLoading={isCreating}
          schoolId={schoolId}
        />

        {/* Edit Modal */}
        {editModal.faculty && (
          <EditFacultyModal
            isOpen={editModal.isOpen}
            onClose={() => setEditModal({ isOpen: false, faculty: null })}
            onSubmit={handleUpdateFaculty}
            isLoading={isUpdating}
            faculty={editModal.faculty}
            schoolId={schoolId}
          />
        )}

        {/* Delete Modal */}
        {deleteModal.faculty && (
          <DeleteFacultyModal
            isOpen={deleteModal.isOpen}
            onClose={() => setDeleteModal({ isOpen: false, faculty: null })}
            onConfirm={handleDeleteFaculty}
            isLoading={isDeleting}
            faculty={deleteModal.faculty}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

