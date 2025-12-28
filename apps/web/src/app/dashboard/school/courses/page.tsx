'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Alert } from '@/components/ui/Alert';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Users, GraduationCap, Calendar, Loader2 } from 'lucide-react';
import { AutoGenerateButton } from '@/components/ui/AutoGenerateButton';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology } from '@/lib/utils/terminology';
import {
  useGetMySchoolQuery,
  useGetClassesQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
  useGetActiveSessionQuery,
  useGenerateDefaultClassesMutation,
  type Class,
} from '@/lib/store/api/schoolAdminApi';
import { CreateClassModal } from '@/components/modals/CreateClassModal';
import { DeleteClassModal } from '@/components/modals/DeleteClassModal';
import { EditClassModal } from '@/components/modals/EditClassModal';
import { TertiaryDepartments } from '@/components/tertiary/TertiaryDepartments';
import toast from 'react-hot-toast';

export default function ClassesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddClass, setShowAddClass] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    classId: string;
    className: string;
    classLevel?: string;
    studentsCount?: number;
    isClassArm?: boolean;
  }>({
    isOpen: false,
    classId: '',
    className: '',
  });
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    classId: string;
    currentName: string;
  }>({
    isOpen: false,
    classId: '',
    currentName: '',
  });
  const { currentType } = useSchoolType();
  const terminology = getTerminology(currentType);

  // Get school data
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;

  // Get active session
  const { data: activeSessionResponse } = useGetActiveSessionQuery(
    { schoolId: schoolId! },
    { skip: !schoolId }
  );
  const activeSession = activeSessionResponse?.data;

  // Get classes filtered by current school type
  const {
    data: classesResponse,
    isLoading: isLoadingClasses,
    error: classesError,
    refetch: refetchClasses,
  } = useGetClassesQuery(
    { schoolId: schoolId!, type: currentType || undefined },
    { skip: !schoolId }
  );

  // Refetch classes when school type changes
  useEffect(() => {
    if (schoolId && currentType) {
      refetchClasses();
    }
  }, [currentType, schoolId, refetchClasses]);

  const classes = classesResponse?.data || [];

  // Mutations
  const [deleteClass, { isLoading: isDeletingClass }] = useDeleteClassMutation();
  const [updateClass] = useUpdateClassMutation();
  const [generateDefaultClasses, { isLoading: isGenerating }] = useGenerateDefaultClassesMutation();

  // Handle generating default classes
  const handleGenerateClasses = async () => {
    if (!schoolId || !currentType) return;

    try {
      const result = await generateDefaultClasses({ schoolId, schoolType: currentType }).unwrap();
      toast.success(result.message || `Successfully generated ${result.data?.created || 0} classes`);
    } catch (error: any) {
      const message = error?.data?.message || 'Failed to generate classes';
      toast.error(message);
    }
  };

  const filteredClasses = useMemo(() => {
    if (!searchQuery) return classes;
    const query = searchQuery.toLowerCase();
    return classes.filter(
      (classItem: Class) =>
        classItem.name.toLowerCase().includes(query) ||
        classItem.classLevel?.toLowerCase().includes(query) ||
        classItem.teachers?.some((t) =>
          `${t.firstName} ${t.lastName}`.toLowerCase().includes(query)
        )
    );
  }, [classes, searchQuery]);

  const handleClassClick = (classId: string) => {
    router.push(`/dashboard/school/courses/${classId}`);
  };

  const handleDeleteClass = async (classId: string, className: string, classLevel?: string, studentsCount?: number, isClassArm?: boolean) => {
    if (!schoolId) return;
    
    setDeleteModal({
      isOpen: true,
      classId,
      className,
      classLevel,
      studentsCount,
      isClassArm,
    });
  };

  const confirmDelete = async (forceDelete?: boolean) => {
    if (!schoolId || !deleteModal.classId) return;

    try {
      await deleteClass({ schoolId, classId: deleteModal.classId, forceDelete }).unwrap();
      toast.success(`${deleteModal.isClassArm ? 'ClassArm' : 'Class'} deleted successfully`);
      setDeleteModal({ isOpen: false, classId: '', className: '' });
    } catch (error: any) {
      throw error; // Let the modal handle the error display
    }
  };

  const confirmEdit = async (newName: string) => {
    if (!schoolId || !editModal.classId) return;

    await updateClass({
      schoolId,
      classId: editModal.classId,
      classData: { name: newName },
    }).unwrap();
    toast.success('Class name updated successfully');
    setEditModal({ isOpen: false, classId: '', currentName: '' });
  };

  if (isLoadingClasses) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </ProtectedRoute>
    );
  }

  if (classesError) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full">
          <Alert variant="error" className="mb-4">
            Failed to load classes. Please try again.
          </Alert>
        </div>
      </ProtectedRoute>
    );
  }

  // For TERTIARY schools, show the departments view
  if (currentType === 'TERTIARY' && schoolId) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <TertiaryDepartments schoolId={schoolId} />
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
                {terminology.courses}
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary mb-1">
                Manage all {terminology.courses.toLowerCase()} in your school
              </p>
              {activeSession?.session && (
                <div className="flex items-center gap-2 mt-2">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Active Session: {activeSession.session.name}
                    {activeSession.term && ` - ${activeSession.term.name}`}
                  </span>
                </div>
              )}
            </div>
            <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
              <Button variant="primary" onClick={() => setShowAddClass(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add {terminology.courseSingular}
              </Button>
            </PermissionGate>
          </div>
        </motion.div>

        {/* Search */}
        <div className="mb-6 flex justify-end">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={`Search by ${terminology.courseSingular.toLowerCase()} name, level, or teacher...`}
            containerClassName="w-80"
            size="lg"
          />
        </div>

        {/* Classes Grid */}
        {filteredClasses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
              <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                {searchQuery
                  ? `No ${terminology.courses.toLowerCase()} found matching your search.`
                  : `No ${terminology.courses.toLowerCase()} found.`}
              </p>
              {!searchQuery && currentType && (
                <div className="flex flex-col items-center gap-3">
                  <AutoGenerateButton
                    onClick={handleGenerateClasses}
                    isLoading={isGenerating}
                    label={`Generate Default ${currentType === 'PRIMARY' ? 'Primary 1-6' : currentType === 'SECONDARY' ? 'JSS/SS Classes' : 'Year 1-4'}`}
                    variant="primary"
                  />
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                    {currentType === 'PRIMARY' && 'Creates Primary 1, Primary 2, ... Primary 6 with default arms'}
                    {currentType === 'SECONDARY' && 'Creates JSS 1-3, SS 1-3 with default arms'}
                    {currentType === 'TERTIARY' && 'Creates Year 1-4 with default arms'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map((classItem: Class, index: number) => {
              const primaryTeacher = classItem.teachers?.find((t) => t.isPrimary);
              const teacherName = primaryTeacher
                ? `${primaryTeacher.firstName} ${primaryTeacher.lastName}`
                : classItem.teachers && classItem.teachers.length > 0
                ? `${classItem.teachers.length} ${terminology.staff.toLowerCase()}`
                : 'No teacher assigned';

              return (
                <motion.div
                  key={classItem.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                    <CardContent
                      className="pt-6 flex-1 cursor-pointer"
                      onClick={() => handleClassClick(classItem.id)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                              {classItem.name}
                            </h3>
                            {classItem.classArmId && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                ClassArm
                              </span>
                            )}
                          </div>
                          {classItem.classLevel && (
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                              {classItem.classLevel}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            classItem.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {classItem.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                            {teacherName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                            {classItem.studentsCount || 0} students
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                            {classItem.academicYear}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <div className="px-6 pb-4 pt-0 border-t border-light-border dark:border-dark-border flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditModal({
                            isOpen: true,
                            classId: classItem.id,
                            currentName: classItem.name,
                          });
                        }}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClass(
                            classItem.id,
                            classItem.name,
                            classItem.classLevel,
                            classItem.studentsCount,
                            !!classItem.classArmId
                          );
                        }}
                        disabled={isDeletingClass}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Create Class Modal */}
        {schoolId && (
          <CreateClassModal
            isOpen={showAddClass}
            onClose={() => setShowAddClass(false)}
            schoolId={schoolId}
          />
        )}

        {/* Delete Class Modal */}
        <DeleteClassModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, classId: '', className: '' })}
          onConfirm={confirmDelete}
          className={deleteModal.className}
          classLevel={deleteModal.classLevel}
          studentsCount={deleteModal.studentsCount}
          isClassArm={deleteModal.isClassArm}
          isLoading={isDeletingClass}
        />

        {/* Edit Class Modal */}
        <EditClassModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, classId: '', currentName: '' })}
          onConfirm={confirmEdit}
          currentName={editModal.currentName}
          isLoading={false}
        />
      </div>
    </ProtectedRoute>
  );
}
