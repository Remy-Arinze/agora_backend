'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { motion } from 'framer-motion';
import { UserPlus, Users } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { useAddTeacher, useAddAdmin } from '@/hooks/useSchools';
import { addTeacherFormSchema, addAdminFormSchema } from '@/lib/validations/school-forms';
import { z } from 'zod';
import type { RootState } from '@/lib/store/store';
import { useApi } from '@/hooks/useApi';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology } from '@/lib/utils/terminology';
import { useUploadTeacherImageMutation, useUploadAdminImageMutation, AdminPermissionInput } from '@/lib/store/api/schoolsApi';
import { SubjectMultiSelect } from '@/components/teachers/SubjectMultiSelect';
import { PermissionSelector, getDefaultReadPermissions } from '@/components/permissions';
import toast from 'react-hot-toast';

type StaffType = 'teacher' | 'admin';

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  subject?: string;
  adminRole?: string;
  employeeId?: string;
  [key: string]: string | undefined;
}

export default function AddStaffPage() {
  const router = useRouter();
  const { apiCall } = useApi();
  const user = useSelector((state: RootState) => state.auth.user);
  const [isLoading, setIsLoading] = useState(false);
  const [staffType, setStaffType] = useState<StaffType>('teacher');
  const [adminRole, setAdminRole] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  // Admin permissions - initialized with default READ permissions
  const [adminPermissions, setAdminPermissions] = useState<AdminPermissionInput[]>(getDefaultReadPermissions());
  
  const { addTeacher, isLoading: isAddingTeacher } = useAddTeacher(schoolId);
  const { addAdmin, isLoading: isAddingAdmin } = useAddAdmin(schoolId);
  
  // Get school type and terminology
  const { currentType } = useSchoolType();
  const terminology = getTerminology(currentType);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: '',
    subjectIds: [] as string[], // For SECONDARY schools - multiple subjects
    employeeId: '',
    isTemporary: false,
    profileImage: null as string | null,
  });

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [uploadTeacherImage] = useUploadTeacherImageMutation();
  const [uploadAdminImage] = useUploadAdminImageMutation();

  // Get school ID from localStorage (stored during login) or fetch from API
  useEffect(() => {
    const getSchoolId = async () => {
      if (!user?.id || user.role !== 'SCHOOL_ADMIN') return;

      // First, try to get from localStorage (stored during login)
      const storedSchoolId = typeof window !== 'undefined' 
        ? localStorage.getItem('currentSchoolId') 
        : null;
      
      if (storedSchoolId) {
        setSchoolId(storedSchoolId);
        return;
      }

      // Fallback: Fetch from API (get first school admin is associated with)
      try {
        const response = await apiCall<Array<{ id: string }>>('/schools', {
          requireAuth: true,
        });

        if (response.success && Array.isArray(response.data) && response.data.length > 0) {
          // For now, use the first school (works for single-school admins)
          // In a multi-tenant setup, this would be determined by the JWT context
          setSchoolId(response.data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch school ID:', error);
      }
    };

    getSchoolId();
  }, [user, apiCall]);

  // Helper function to capitalize first letter of each word
  const capitalizeWords = (str: string): string => {
    if (!str) return str;
    return str
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper function to capitalize first letter only
  const capitalizeFirst = (str: string): string => {
    if (!str) return str;
    return str.trim().charAt(0).toUpperCase() + str.trim().slice(1).toLowerCase();
  };

  const validateForm = (): boolean => {
    setErrors({});
    setSubmitError(null);

    try {
      if (staffType === 'teacher') {
        addTeacherFormSchema.parse({
          ...formData,
          subject: formData.subject || undefined,
          employeeId: formData.employeeId || undefined,
        });
      } else {
        if (!adminRole.trim()) {
          setErrors({ adminRole: 'Role is required' });
          return false;
        }
        addAdminFormSchema.parse({
          ...formData,
          role: adminRole,
          employeeId: formData.employeeId || undefined,
        });
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError && error.errors) {
        const fieldErrors: FormErrors = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error('Validation error:', error);
        setSubmitError('Validation failed. Please check your inputs.');
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    if (!schoolId) {
      setSubmitError('Unable to determine school. Please try refreshing the page.');
      return;
    }

    setIsLoading(true);

    try {
      let profileImageUrl: string | undefined = undefined;

      // Upload image first if selected
      if (selectedImageFile && schoolId) {
        try {
          // For now, we'll upload the image after creating the staff member
          // We'll need to get the staff ID from the response
          // For simplicity, we'll include the image URL in the creation payload if we have it
          // Otherwise, we'll upload it after creation
          profileImageUrl = formData.profileImage || undefined;
        } catch (error: any) {
          console.error('Image upload error:', error);
          toast.error('Failed to upload image. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      if (staffType === 'teacher') {
        const teacherData: {
          firstName: string;
          lastName: string;
          email: string;
          phone: string;
          subject?: string;
          subjectIds?: string[];
          isTemporary: boolean;
          employeeId?: string;
          profileImage?: string;
        } = {
          firstName: capitalizeWords(formData.firstName),
          lastName: capitalizeWords(formData.lastName),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          isTemporary: formData.isTemporary,
          employeeId: formData.employeeId.trim() || undefined,
          profileImage: profileImageUrl,
        };

        // For SECONDARY schools, use subjectIds for multi-subject support
        if (currentType === 'SECONDARY' && formData.subjectIds.length > 0) {
          teacherData.subjectIds = formData.subjectIds;
        } else if (formData.subject.trim()) {
          // For PRIMARY/TERTIARY or if no subjectIds, use single subject
          teacherData.subject = capitalizeWords(formData.subject);
        }

        const result = await addTeacher(teacherData);
        
        // Upload image after creation if we have a file but no URL
        if (selectedImageFile && result?.data?.id && schoolId) {
          try {
            await uploadTeacherImage({
              schoolId,
              teacherId: result.data.id,
              file: selectedImageFile,
            }).unwrap();
          } catch (error: any) {
            console.error('Failed to upload image after creation:', error);
            // Don't fail the whole operation, just log the error
          }
        }

        router.push('/dashboard/school/teachers');
      } else {
        // Check if the role is a Principal role - they don't need custom permissions
        const isPrincipalRole = ['principal', 'school principal', 'head teacher', 'headmaster', 'headmistress']
          .includes(capitalizeWords(adminRole).toLowerCase());

        // Debug logging
        console.log('🔐 [AddStaff] Permission assignment debug:', {
          role: capitalizeWords(adminRole),
          isPrincipalRole,
          adminPermissionsCount: adminPermissions.length,
          willSendPermissions: !isPrincipalRole,
        });

        const adminData = {
          firstName: capitalizeWords(formData.firstName),
          lastName: capitalizeWords(formData.lastName),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          role: capitalizeWords(adminRole),
          employeeId: formData.employeeId.trim() || undefined,
          profileImage: profileImageUrl,
          // Only include permissions for non-principal roles
          permissions: isPrincipalRole ? undefined : adminPermissions,
        };

        console.log('🔐 [AddStaff] Sending admin data with permissions:', {
          permissionsIncluded: !!adminData.permissions,
          permissionsCount: adminData.permissions?.length || 0,
        });

        const result = await addAdmin(adminData);
        
        // Upload image after creation if we have a file but no URL
        if (selectedImageFile && result?.data?.id && schoolId) {
          try {
            await uploadAdminImage({
              schoolId,
              adminId: result.data.id,
              file: selectedImageFile,
            }).unwrap();
          } catch (error: any) {
            console.error('Failed to upload image after creation:', error);
            // Don't fail the whole operation, just log the error
          }
        }

        router.push('/dashboard/school/teachers');
      }
    } catch (error: any) {
      // Error handling is done in the hooks (toast notifications)
      // But we can also set a local error state for additional feedback
      const errorMessage =
        error?.data?.message ||
        error?.message ||
        'Failed to add staff member. Please try again.';
      setSubmitError(errorMessage);
      setIsLoading(false);
    }
  };

  const isTeacher = staffType === 'teacher';
  const isLoadingState = isLoading || isAddingTeacher || isAddingAdmin;

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <BackButton fallbackUrl="/dashboard/school/teachers" className="mb-4" />
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Add New {terminology.staffSingular}
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Register a new {terminology.staffSingular.toLowerCase()} in your school
          </p>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
              Staff Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submitError && (
              <Alert variant="error" className="mb-6">
                {submitError}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Staff Type Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                  Staff Type *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStaffType('teacher');
                      setErrors({});
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      staffType === 'teacher'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-light-border dark:border-dark-border hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users
                        className={`h-5 w-5 ${
                          staffType === 'teacher'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-light-text-secondary dark:text-dark-text-secondary'
                        }`}
                      />
                      <div className="text-left">
                        <p
                          className={`font-semibold ${
                            staffType === 'teacher'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-light-text-primary dark:text-dark-text-primary'
                          }`}
                        >
                          {terminology.staffSingular}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          Teaching staff
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStaffType('admin');
                      setErrors({});
                      // Reset permissions to defaults when switching to admin
                      setAdminPermissions(getDefaultReadPermissions());
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      staffType === 'admin'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-light-border dark:border-dark-border hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <UserPlus
                        className={`h-5 w-5 ${
                          staffType === 'admin'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-light-text-secondary dark:text-dark-text-secondary'
                        }`}
                      />
                      <div className="text-left">
                        <p
                          className={`font-semibold ${
                            staffType === 'admin'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-light-text-primary dark:text-dark-text-primary'
                          }`}
                        >
                          Administrator
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          Admin staff (VP, Bursar, etc.)
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Profile Image - moved above role input */}
              <div className="pt-4 border-t border-light-border dark:border-dark-border">
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                  Profile Image
                </h3>
                <ImageUpload
                  value={formData.profileImage}
                  onChange={(url) => {
                    setFormData({ ...formData, profileImage: url });
                  }}
                  onUpload={async (file) => {
                    setSelectedImageFile(file);
                    // Return a temporary URL for preview
                    return URL.createObjectURL(file);
                  }}
                  helperText="Upload a passport-sized profile image (optional). Image will be cropped to square format."
                  maxSizeMB={5}
                />
              </div>

              {/* Role Input for Admin */}
              {staffType === 'admin' && (
                <div className="space-y-3 pt-4 border-t border-light-border dark:border-dark-border">
                  <Input
                    label="Role *"
                    name="adminRole"
                    value={adminRole}
                    onChange={(e) => {
                      setAdminRole(e.target.value);
                      if (errors.adminRole) {
                        setErrors({ ...errors, adminRole: undefined });
                      }
                    }}
                    onBlur={(e) => {
                      const capitalized = capitalizeWords(e.target.value);
                      if (capitalized !== e.target.value) {
                        setAdminRole(capitalized);
                      }
                    }}
                    placeholder="e.g., Administrator, Vice Principal, Bursar, Guidance Counselor"
                    required
                    helperText="Enter the administrative role (e.g., Vice Principal, Bursar, Administrator, etc.)"
                    error={errors.adminRole}
                  />
                </div>
              )}

              {/* Personal Information */}
              <div className="pt-4 border-t border-light-border dark:border-dark-border">
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name *"
                    name="firstName"
                    value={formData.firstName}
                    onChange={(e) => {
                      setFormData({ ...formData, firstName: e.target.value });
                      if (errors.firstName) {
                        setErrors({ ...errors, firstName: undefined });
                      }
                    }}
                    onBlur={(e) => {
                      const capitalized = capitalizeWords(e.target.value);
                      if (capitalized !== e.target.value) {
                        setFormData({ ...formData, firstName: capitalized });
                      }
                    }}
                    required
                    error={errors.firstName}
                  />
                  <Input
                    label="Last Name *"
                    name="lastName"
                    value={formData.lastName}
                    onChange={(e) => {
                      setFormData({ ...formData, lastName: e.target.value });
                      if (errors.lastName) {
                        setErrors({ ...errors, lastName: undefined });
                      }
                    }}
                    onBlur={(e) => {
                      const capitalized = capitalizeWords(e.target.value);
                      if (capitalized !== e.target.value) {
                        setFormData({ ...formData, lastName: capitalized });
                      }
                    }}
                    required
                    error={errors.lastName}
                  />
                  <Input
                    label="Email *"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (errors.email) {
                        setErrors({ ...errors, email: undefined });
                      }
                    }}
                    required
                    error={errors.email}
                  />
                  <Input
                    label="Phone *"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (errors.phone) {
                        setErrors({ ...errors, phone: undefined });
                      }
                    }}
                    required
                    placeholder="+234 801 234 5678"
                    error={errors.phone}
                  />
                  <Input
                    label="Employee ID"
                    name="employeeId"
                    value={formData.employeeId}
                    onChange={(e) => {
                      setFormData({ ...formData, employeeId: e.target.value });
                      if (errors.employeeId) {
                        setErrors({ ...errors, employeeId: undefined });
                      }
                    }}
                    placeholder="Optional employee ID"
                    helperText="Optional internal identifier for this staff member"
                    error={errors.employeeId}
                  />
                </div>
              </div>

              {/* Teacher-Specific Fields */}
              {isTeacher && (
                <div className="pt-4 border-t border-light-border dark:border-dark-border">
                  <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                    Teaching Information
                  </h3>
                  
                  {/* For SECONDARY schools - Multi-subject selection */}
                  {currentType === 'SECONDARY' && schoolId && (
                    <div className="mb-4 relative">
                      <SubjectMultiSelect
                        schoolId={schoolId}
                        selectedSubjectIds={formData.subjectIds}
                        onChange={(ids) => setFormData({ ...formData, subjectIds: ids })}
                        schoolType="SECONDARY"
                        label="Subjects Teacher Can Teach *"
                        helperText="Select all subjects this teacher is qualified to teach. They can be assigned to different classes for these subjects."
                        error={errors.subject}
                        disabled={isLoadingState}
                      />
                    </div>
                  )}

                  {/* For PRIMARY/TERTIARY - Single subject input */}
                  {currentType !== 'SECONDARY' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Subject"
                        name="subject"
                        value={formData.subject}
                        onChange={(e) => {
                          setFormData({ ...formData, subject: e.target.value });
                          if (errors.subject) {
                            setErrors({ ...errors, subject: undefined });
                          }
                        }}
                        onBlur={(e) => {
                          const capitalized = capitalizeWords(e.target.value);
                          if (capitalized !== e.target.value) {
                            setFormData({ ...formData, subject: capitalized });
                          }
                        }}
                        placeholder="e.g., Mathematics, English"
                        error={errors.subject}
                      />
                    </div>
                  )}

                  {/* Temporary staff checkbox - applies to all school types */}
                  <div className="flex items-center gap-3 mt-4">
                    <input
                      type="checkbox"
                      id="isTemporary"
                      checked={formData.isTemporary}
                      onChange={(e) =>
                        setFormData({ ...formData, isTemporary: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 border-light-border dark:border-dark-border rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="isTemporary"
                      className="text-sm text-light-text-primary dark:text-dark-text-primary cursor-pointer"
                    >
                      Temporary Staff
                    </label>
                  </div>
                </div>
              )}

              {/* Permissions Section for Admin - shown at the end of the form */}
              {staffType === 'admin' && (
                <div className="pt-4 border-t border-light-border dark:border-dark-border">
                  <PermissionSelector
                    value={adminPermissions}
                    onChange={setAdminPermissions}
                    disabled={isLoadingState}
                  />
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-2">
                    💡 Tip: Principals automatically have full access and their permissions cannot be modified.
                  </p>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-light-border dark:border-dark-border">
                <Link href="/dashboard/school/teachers">
                  <Button type="button" variant="ghost" disabled={isLoadingState}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" isLoading={isLoadingState}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Continue
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
