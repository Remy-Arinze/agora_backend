'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/Modal';
import {
  useSchool,
  useAddAdmin,
  useUpdateAdmin,
  useAddTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
  useDeleteAdmin,
  useUpdatePrincipal,
  useDeletePrincipal,
  useMakePrincipal,
  useConvertTeacherToAdmin,
  SchoolAdmin,
  Teacher,
} from '@/hooks/useSchools';
import {
  adminFormSchema,
  updateAdminFormSchema,
  updatePrincipalFormSchema,
  updateTeacherFormSchema,
} from '@/lib/validations/school-forms';
import { getAddonsData } from '@/lib/data/mock-addons';
import { SchoolHeader } from '@/components/schools/SchoolHeader';
import { SchoolDetailsCard } from '@/components/schools/SchoolDetailsCard';
import { SchoolStatsCard } from '@/components/schools/SchoolStatsCard';
import { PersonCard } from '@/components/schools/PersonCard';
import { PersonDetailModal } from '@/components/schools/PersonDetailModal';
import { PersonFormModal } from '@/components/schools/PersonFormModal';
import { TeacherConvertModal } from '@/components/schools/TeacherConvertModal';
import { PluginCard } from '@/components/schools/PluginCard';
import {
  UserCog,
  Users,
  GraduationCap,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';

export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.id as string;

  // State for modals
  const [showDeleteSchoolModal, setShowDeleteSchoolModal] = useState(false);
  const [showAddPrincipalModal, setShowAddPrincipalModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [showDeletePrincipalModal, setShowDeletePrincipalModal] = useState(false);
  const [showPrincipalDetailModal, setShowPrincipalDetailModal] = useState(false);
  const [showAdminDetailModal, setShowAdminDetailModal] = useState<string | null>(null);
  const [showMakePrincipalModal, setShowMakePrincipalModal] = useState<string | null>(null);
  const [showTeacherEditModal, setShowTeacherEditModal] = useState<string | null>(null);

  // Track which item is being edited (null means adding new)
  const [editingPrincipalId, setEditingPrincipalId] = useState<string | null>(null);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [deleteAdminId, setDeleteAdminId] = useState<string | null>(null);
  const [deleteTeacherId, setDeleteTeacherId] = useState<string | null>(null);

  // Form states
  const [principalForm, setPrincipalForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [adminForm, setAdminForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
  });
  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: '',
    isTemporary: false,
  });
  const [teacherEditForm, setTeacherEditForm] = useState({
    role: '',
    keepAsTeacher: true,
    showPromoteOption: false,
  });

  // Use RTK Query hooks
  const { school, isLoading, error, refetch } = useSchool(schoolId);
  const { addAdmin, isLoading: isAddingAdmin } = useAddAdmin(schoolId);
  const { updateAdmin, isLoading: isUpdatingAdmin } = useUpdateAdmin(schoolId);
  const { addTeacher, isLoading: isAddingTeacher } = useAddTeacher(schoolId);
  const { updateTeacher, isLoading: isUpdatingTeacher } = useUpdateTeacher(schoolId);
  const { deleteTeacher, isLoading: isDeletingTeacher } = useDeleteTeacher(schoolId);
  const { deleteAdmin, isLoading: isDeletingAdmin } = useDeleteAdmin(schoolId);
  const { updatePrincipal, isLoading: isUpdatingPrincipal } = useUpdatePrincipal(schoolId);
  const { deletePrincipal, isLoading: isDeletingPrincipal } = useDeletePrincipal(schoolId);
  const { makePrincipal, isLoading: isMakingPrincipal } = useMakePrincipal(schoolId);
  const { convertTeacherToAdmin, isLoading: isConvertingTeacher } = useConvertTeacherToAdmin(schoolId);

  // Get principal (admin with exact "Principal" role - case-insensitive)
  const principal = school?.admins.find((admin) => {
    const roleLower = admin.role?.trim().toLowerCase() || '';
    return roleLower === 'principal'; // Only exact match, not contains
  }) || null;

  // Get other admins (excluding principal - only exact "Principal" role)
  const admins = school?.admins.filter((admin) => {
    const roleLower = admin.role?.trim().toLowerCase() || '';
    return roleLower !== 'principal'; // Only exact match, not contains
  }) || [];

  // Get teachers
  const teachers = school?.teachers || [];

  // Mock plugins data
  const addons = getAddonsData(schoolId);

  // Handlers
  const handleDeleteSchool = () => {
    router.push('/dashboard/super-admin/schools');
  };

  const handleAddPrincipal = async () => {
    try {
      const validationResult = editingPrincipalId
        ? updatePrincipalFormSchema.safeParse(principalForm)
        : adminFormSchema.safeParse({
            ...principalForm,
            role: 'PRINCIPAL',
          });

      if (!validationResult.success) {
        const issues = validationResult.error.issues;
        const firstError = issues[0];
        toast.error(firstError?.message || 'Please fill in all required fields correctly');
        return;
      }

      if (editingPrincipalId) {
        await updatePrincipal(editingPrincipalId, {
          firstName: principalForm.firstName,
          lastName: principalForm.lastName,
          phone: principalForm.phone,
        });
      } else {
        await addAdmin({
          firstName: principalForm.firstName,
          lastName: principalForm.lastName,
          email: principalForm.email,
          phone: principalForm.phone,
          role: 'PRINCIPAL',
        });
      }

      setShowAddPrincipalModal(false);
      setEditingPrincipalId(null);
      setPrincipalForm({ firstName: '', lastName: '', email: '', phone: '' });
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleAddAdmin = async () => {
    try {
      const validationResult = editingAdminId
        ? updateAdminFormSchema.safeParse(adminForm)
        : adminFormSchema.safeParse(adminForm);

      if (!validationResult.success) {
        const issues = validationResult.error.issues;
        const firstError = issues[0];
        toast.error(firstError?.message || 'Please fill in all required fields correctly');
        return;
      }

      const roleToUse = adminForm.role.trim();

      if (editingAdminId) {
        await updateAdmin(editingAdminId, {
          firstName: adminForm.firstName,
          lastName: adminForm.lastName,
          phone: adminForm.phone,
          role: roleToUse,
        });
      } else {
        await addAdmin({
          firstName: adminForm.firstName,
          lastName: adminForm.lastName,
          email: adminForm.email,
          phone: adminForm.phone,
          role: roleToUse,
        });
      }

      setShowAddAdminModal(false);
      setEditingAdminId(null);
      setAdminForm({ firstName: '', lastName: '', email: '', phone: '', role: '' });
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleAddTeacher = async () => {
    try {
      const validationResult = editingTeacherId
        ? updateTeacherFormSchema.safeParse(teacherForm)
        : adminFormSchema.safeParse({
            firstName: teacherForm.firstName,
            lastName: teacherForm.lastName,
            email: teacherForm.email,
            phone: teacherForm.phone,
            role: 'TEACHER',
          });

      if (!validationResult.success) {
        const issues = validationResult.error.issues;
        const firstError = issues[0];
        toast.error(firstError?.message || 'Please fill in all required fields correctly');
        return;
      }

      if (editingTeacherId) {
        await updateTeacher(editingTeacherId, {
          firstName: teacherForm.firstName,
          lastName: teacherForm.lastName,
          phone: teacherForm.phone,
          subject: teacherForm.subject || undefined,
          isTemporary: teacherForm.isTemporary,
        });
      } else {
        await addTeacher({
          firstName: teacherForm.firstName,
          lastName: teacherForm.lastName,
          email: teacherForm.email,
          phone: teacherForm.phone,
          subject: teacherForm.subject || undefined,
          isTemporary: teacherForm.isTemporary,
        });
      }

      setShowAddTeacherModal(false);
      setEditingTeacherId(null);
      setTeacherForm({ firstName: '', lastName: '', email: '', phone: '', subject: '', isTemporary: false });
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDeletePrincipal = async () => {
    if (!principal) return;
    try {
      await deletePrincipal(principal.id);
      setShowDeletePrincipalModal(false);
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDeleteAdmin = (adminId: string) => {
    setDeleteAdminId(adminId);
  };

  const confirmDeleteAdmin = async () => {
    if (!deleteAdminId) return;
    try {
      await deleteAdmin(deleteAdminId);
      setDeleteAdminId(null);
      setShowAdminDetailModal(null);
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDeleteTeacher = (teacherId: string) => {
    setDeleteTeacherId(teacherId);
  };

  const confirmDeleteTeacher = async () => {
    if (!deleteTeacherId) return;
    try {
      await deleteTeacher(deleteTeacherId);
      setDeleteTeacherId(null);
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleMakePrincipal = (adminId: string) => {
    setShowMakePrincipalModal(adminId);
  };

  const handleViewTeacherDetails = (teacherId: string) => {
    setShowTeacherEditModal(teacherId);
    setTeacherEditForm({ role: '', keepAsTeacher: true, showPromoteOption: false });
  };

  const handleConvertTeacherToAdmin = async () => {
    if (!showTeacherEditModal) return;

    if (!teacherEditForm.role || !teacherEditForm.role.trim()) {
      toast.error('Please enter an admin role');
      return;
    }

    try {
      const roleToUse = teacherEditForm.role.trim();
      await convertTeacherToAdmin(showTeacherEditModal, roleToUse, teacherEditForm.keepAsTeacher);
      setShowTeacherEditModal(null);
      setTeacherEditForm({ role: '', keepAsTeacher: true, showPromoteOption: false });
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  // Open edit modals with pre-filled data
  const openEditPrincipalModal = () => {
    if (principal) {
      setPrincipalForm({
        firstName: principal.firstName,
        lastName: principal.lastName,
        email: principal.email || '',
        phone: principal.phone,
      });
      setEditingPrincipalId(principal.id);
      setShowPrincipalDetailModal(false);
      setShowAddPrincipalModal(true);
    }
  };

  const openEditAdminModal = (adminId: string) => {
    const admin = admins.find((a) => a.id === adminId);
    if (admin) {
      setAdminForm({
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email || '',
        phone: admin.phone,
        role: admin.role,
      });
      setEditingAdminId(adminId);
      setShowAdminDetailModal(null);
      setShowAddAdminModal(true);
    }
  };

  const openEditTeacherModal = (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (teacher) {
      setTeacherForm({
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email || '',
        phone: teacher.phone,
        subject: teacher.subject || '',
        isTemporary: teacher.isTemporary,
      });
      setEditingTeacherId(teacherId);
      setShowTeacherEditModal(null);
      setShowAddTeacherModal(true);
    }
  };

  const confirmMakePrincipal = async () => {
    if (!showMakePrincipalModal) return;
    try {
      await makePrincipal(showMakePrincipalModal);
      setShowMakePrincipalModal(null);
      setShowAdminDetailModal(null);
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    const errorMessage =
      error && 'status' in error
        ? (error as any).data?.message || 'Failed to fetch school data'
        : 'Failed to load school data';

    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/super-admin/schools')}
            className="mb-4"
          >
            Back to Schools
          </Button>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!school) {
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/super-admin/schools')}
            className="mb-4"
          >
            Back to Schools
          </Button>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">School not found</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const selectedAdmin = showAdminDetailModal ? (admins.find((a) => a.id === showAdminDetailModal) || null) : null;
  const selectedTeacher = showTeacherEditModal ? (teachers.find((t) => t.id === showTeacherEditModal) || null) : null;

  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="w-full">
        <SchoolHeader
          school={school}
          onEdit={() => router.push(`/dashboard/super-admin/schools/${schoolId}/edit`)}
          onDelete={() => setShowDeleteSchoolModal(true)}
        />

        {/* School Details */}
        <SchoolDetailsCard school={school} />

        {/* Principal Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserCog className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  School Principal
                </CardTitle>
              </div>
              {principal ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeletePrincipalModal(true)}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddPrincipalModal(true)}
                  className="text-blue-600 dark:text-blue-400"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Principal
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {principal ? (
              <PersonCard
                person={principal}
                type="principal"
                onClick={() => setShowPrincipalDetailModal(true)}
                onDelete={(e) => {
                  e.stopPropagation();
                  setShowDeletePrincipalModal(true);
                }}
              />
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-dark-text-secondary">
                No principal assigned. Click "Add Principal" to assign one.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admins Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  School Administrators ({admins.length})
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddAdminModal(true)}
                  className="text-blue-600 dark:text-blue-400"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Admin
                </Button>
                <Link href={`/dashboard/super-admin/schools/${schoolId}/admins`}>
                  <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400">
                    View All →
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {admins.slice(0, 4).map((admin, index) => (
                <PersonCard
                  key={admin.id}
                  person={admin}
                  type="admin"
                  onClick={() => setShowAdminDetailModal(admin.id)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    handleDeleteAdmin(admin.id);
                  }}
                  index={index}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Teachers Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  Teachers ({teachers.length})
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddTeacherModal(true)}
                  className="text-blue-600 dark:text-blue-400"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Teacher
                </Button>
                <Link href={`/dashboard/super-admin/schools/${schoolId}/teachers`}>
                  <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400">
                    View All →
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teachers.slice(0, 4).map((teacher, index) => (
                <PersonCard
                  key={teacher.id}
                  person={teacher}
                  type="teacher"
                  onClick={() => handleViewTeacherDetails(teacher.id)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    handleDeleteTeacher(teacher.id);
                  }}
                  index={index}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Addons Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
                Plugins ({addons.filter((a) => a.status === 'active').length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {addons.map((addon, index) => (
                <PluginCard key={addon.id} plugin={addon} index={index} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Modals */}
        <PersonDetailModal
          isOpen={showPrincipalDetailModal}
          onClose={() => setShowPrincipalDetailModal(false)}
          person={principal}
          type="principal"
          onEdit={openEditPrincipalModal}
          onDelete={() => {
            setShowPrincipalDetailModal(false);
            setShowDeletePrincipalModal(true);
          }}
        />

        <PersonDetailModal
          isOpen={showAdminDetailModal !== null}
          onClose={() => setShowAdminDetailModal(null)}
          person={selectedAdmin}
          type="admin"
          onEdit={() => {
            if (showAdminDetailModal) {
              openEditAdminModal(showAdminDetailModal);
            }
          }}
          onDelete={() => {
            if (showAdminDetailModal) {
              handleDeleteAdmin(showAdminDetailModal);
            }
          }}
          onMakePrincipal={() => {
            if (showAdminDetailModal) {
              handleMakePrincipal(showAdminDetailModal);
            }
          }}
          showMakePrincipal={true}
        />

        <PersonFormModal
          isOpen={showAddPrincipalModal}
          onClose={() => {
            setShowAddPrincipalModal(false);
            setEditingPrincipalId(null);
            setPrincipalForm({ firstName: '', lastName: '', email: '', phone: '' });
          }}
          type="principal"
          isEditing={editingPrincipalId !== null}
          formData={principalForm}
          setFormData={setPrincipalForm}
          onSubmit={handleAddPrincipal}
          isLoading={isAddingAdmin || isUpdatingPrincipal}
          existingPerson={principal}
        />

        <PersonFormModal
          isOpen={showAddAdminModal}
          onClose={() => {
            setShowAddAdminModal(false);
            setEditingAdminId(null);
            setAdminForm({ firstName: '', lastName: '', email: '', phone: '', role: '' });
          }}
          type="admin"
          isEditing={editingAdminId !== null}
          formData={adminForm}
          setFormData={setAdminForm}
          onSubmit={handleAddAdmin}
          isLoading={isAddingAdmin || isUpdatingAdmin}
          existingPerson={selectedAdmin}
        />

        <PersonFormModal
          isOpen={showAddTeacherModal}
          onClose={() => {
            setShowAddTeacherModal(false);
            setEditingTeacherId(null);
            setTeacherForm({ firstName: '', lastName: '', email: '', phone: '', subject: '', isTemporary: false });
          }}
          type="teacher"
          isEditing={editingTeacherId !== null}
          formData={teacherForm}
          setFormData={setTeacherForm}
          onSubmit={handleAddTeacher}
          isLoading={isAddingTeacher || isUpdatingTeacher}
          existingPerson={selectedTeacher}
        />

        <TeacherConvertModal
          isOpen={showTeacherEditModal !== null}
          onClose={() => {
            setShowTeacherEditModal(null);
            setTeacherEditForm({ role: '', keepAsTeacher: true, showPromoteOption: false });
          }}
          teacher={selectedTeacher}
          formData={teacherEditForm}
          setFormData={setTeacherEditForm}
          onConvert={handleConvertTeacherToAdmin}
          onEdit={() => {
            if (showTeacherEditModal) {
              openEditTeacherModal(showTeacherEditModal);
            }
          }}
          isLoading={isConvertingTeacher}
        />

        {/* Confirmation Modals */}
        {showMakePrincipalModal && (() => {
          const adminToPromote = admins.find((a) => a.id === showMakePrincipalModal);
          if (!adminToPromote) return null;
          const currentPrincipalText = principal
            ? `The current principal "${principal.firstName} ${principal.lastName}" will be automatically switched to an administrator role.`
            : '';
          return (
            <ConfirmModal
              isOpen={true}
              onClose={() => setShowMakePrincipalModal(null)}
              onConfirm={confirmMakePrincipal}
              title="Make Administrator Principal"
              message={`Are you sure you want to make "${adminToPromote.firstName} ${adminToPromote.lastName}" the principal? ${currentPrincipalText} There can only be one principal at a time.`}
              confirmText="Make Principal"
              variant="warning"
              isLoading={isMakingPrincipal}
            />
          );
        })()}

        <ConfirmModal
          isOpen={showDeleteSchoolModal}
          onClose={() => setShowDeleteSchoolModal(false)}
          onConfirm={handleDeleteSchool}
          title="Delete School"
          message={`Are you sure you want to delete "${school.name}"? This action cannot be undone and will delete all associated data including students, teachers, and administrators.`}
          confirmText="Delete School"
          variant="danger"
        />

        {principal && (
          <ConfirmModal
            isOpen={showDeletePrincipalModal}
            onClose={() => setShowDeletePrincipalModal(false)}
            onConfirm={handleDeletePrincipal}
            title="Delete Principal"
            message={`Are you sure you want to remove ${principal.firstName} ${principal.lastName} as the principal of this school? ${
              admins.length > 0
                ? 'There are other administrators who can be assigned the principal role.'
                : 'Warning: There must be at least one other administrator to assign the principal role to before deletion.'
            } ${school?.isActive ? 'Note: If this is an active principal, you must first transfer the role to another administrator.' : ''}`}
            confirmText="Delete"
            variant="danger"
            isLoading={isDeletingPrincipal}
          />
        )}

        {deleteAdminId && (() => {
          const adminToDelete = admins.find((a) => a.id === deleteAdminId);
          return (
            <ConfirmModal
              isOpen={true}
              onClose={() => setDeleteAdminId(null)}
              onConfirm={confirmDeleteAdmin}
              title="Delete Administrator"
              message={
                adminToDelete
                  ? `Are you sure you want to remove ${adminToDelete.firstName} ${adminToDelete.lastName} from this school? This action cannot be undone.`
                  : 'Are you sure you want to remove this administrator from the school? This action cannot be undone.'
              }
              confirmText="Delete"
              variant="danger"
              isLoading={isDeletingAdmin}
            />
          );
        })()}

        {deleteTeacherId && (() => {
          const teacherToDelete = teachers.find((t) => t.id === deleteTeacherId);
          return (
            <ConfirmModal
              isOpen={true}
              onClose={() => setDeleteTeacherId(null)}
              onConfirm={confirmDeleteTeacher}
              title="Delete Teacher"
              message={
                teacherToDelete
                  ? `Are you sure you want to remove ${teacherToDelete.firstName} ${teacherToDelete.lastName} from this school? This action cannot be undone.`
                  : 'Are you sure you want to remove this teacher from the school? This action cannot be undone.'
              }
              confirmText="Delete"
              variant="danger"
              isLoading={isDeletingTeacher}
            />
          );
        })()}
      </div>
    </ProtectedRoute>
  );
}
