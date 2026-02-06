import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  useGetSchoolsQuery,
  useGetSchoolQuery,
  useCreateSchoolMutation,
  useUpdateSchoolMutation,
  useAddAdminMutation,
  useUpdateAdminMutation,
  useAddTeacherMutation,
  useUpdateTeacherMutation,
  useDeleteTeacherMutation,
  useDeleteAdminMutation,
  useUpdatePrincipalMutation,
  useDeletePrincipalMutation,
  useMakePrincipalMutation,
  useConvertTeacherToAdminMutation,
  CreateSchoolDto,
  AddAdminDto,
  AddTeacherDto,
  UpdateAdminDto,
  UpdateTeacherDto,
  UpdatePrincipalDto,
  School,
  SchoolAdmin,
  Teacher,
} from '@/lib/store/api/schoolsApi';

// Re-export types for convenience
export type { School, SchoolAdmin, Teacher, CreateSchoolDto, AddAdminDto, AddTeacherDto, UpdateAdminDto, UpdateTeacherDto, UpdatePrincipalDto };

/**
 * Hook for managing schools list with pagination
 */
export function useSchools(params?: {
  page?: number;
  limit?: number;
  search?: string;
  filter?: 'all' | 'active' | 'inactive';
}) {
  const { data, isLoading, error, refetch } = useGetSchoolsQuery(params);

  return {
    schools: data?.data?.data || [],
    pagination: data?.data
      ? {
          total: data.data.total,
          page: data.data.page,
          limit: data.data.limit,
          totalPages: data.data.totalPages,
          hasNext: data.data.hasNext,
          hasPrev: data.data.hasPrev,
        }
      : null,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for managing a single school
 */
export function useSchool(schoolId: string | null) {
  const { data, isLoading, error, refetch } = useGetSchoolQuery(schoolId!, {
    skip: !schoolId,
  });

  // TEMPORARY LOG: Log the school data received from backend
  if (data?.data) {
    console.log('🔍 [FRONTEND] School data received:', {
      schoolId: data.data.id,
      schoolName: data.data.name,
      admins: data.data.admins.map(a => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        role: a.role,
        roleType: typeof a.role,
      })),
    });
  }

  return {
    school: data?.data || null,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for creating a new school
 */
export function useCreateSchool() {
  const router = useRouter();
  const [createSchool, { isLoading }] = useCreateSchoolMutation();

  const handleCreateSchool = useCallback(
    async (schoolData: CreateSchoolDto) => {
      try {
        const result = await createSchool(schoolData).unwrap();
        if (result.success) {
          toast.success(result.message || 'School created successfully');
          // Navigate to the new school's detail page
          if (result.data?.id) {
            router.push(`/dashboard/super-admin/schools/${result.data.id}`);
          } else {
            router.push('/dashboard/super-admin/schools');
          }
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to create school');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to create school';
        toast.error(errorMessage);
        throw error;
      }
    },
    [createSchool, router]
  );

  return {
    createSchool: handleCreateSchool,
    isLoading,
  };
}

/**
 * Hook for updating a school
 */
export function useUpdateSchool() {
  const router = useRouter();
  const [updateSchoolMutation, { isLoading }] = useUpdateSchoolMutation();

  const updateSchool = useCallback(
    async (schoolId: string, schoolData: Partial<CreateSchoolDto>) => {
      try {
        const result = await updateSchoolMutation({
          id: schoolId,
          data: schoolData,
        }).unwrap();
        if (result.success) {
          toast.success(result.message || 'School updated successfully');
          // Navigate back to the school detail page
          router.push(`/dashboard/super-admin/schools/${schoolId}`);
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to update school');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to update school';
        toast.error(errorMessage);
        throw error;
      }
    },
    [updateSchoolMutation, router]
  );

  return {
    updateSchool,
    isLoading,
  };
}

/**
 * Hook for adding an admin to a school
 */
export function useAddAdmin(schoolId: string | null) {
  const [addAdminMutation, { isLoading }] = useAddAdminMutation();

  const addAdmin = useCallback(
    async (adminData: AddAdminDto) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      // TEMPORARY LOG: Log what we're sending to backend
      console.log('🔍 [FRONTEND] Sending admin data to backend:', {
        schoolId,
        adminData: {
          ...adminData,
          role: adminData.role,
          roleType: typeof adminData.role,
          permissionsCount: adminData.permissions?.length || 0,
          permissions: adminData.permissions,
        },
      });

      try {
        const result = await addAdminMutation({
          schoolId,
          admin: adminData,
        }).unwrap();

        // TEMPORARY LOG: Log the response from backend
        console.log('🔍 [FRONTEND] Response from backend:', {
          success: result.success,
          message: result.message,
          adminData: result.data ? {
            id: result.data.id,
            name: `${result.data.firstName} ${result.data.lastName}`,
            role: result.data.role,
            roleType: typeof result.data.role,
          } : null,
        });

        if (result.success) {
          toast.success(result.message || 'Administrator added successfully');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to add administrator');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to add administrator';
        toast.error(errorMessage);
        throw error;
      }
    },
    [addAdminMutation, schoolId]
  );

  return {
    addAdmin,
    isLoading,
  };
}

/**
 * Hook for updating an admin in a school
 */
export function useUpdateAdmin(schoolId: string | null) {
  const [updateAdminMutation, { isLoading }] = useUpdateAdminMutation();

  const updateAdmin = useCallback(
    async (adminId: string, adminData: UpdateAdminDto) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      try {
        const result = await updateAdminMutation({
          schoolId,
          adminId,
          admin: adminData,
        }).unwrap();

        if (result.success) {
          toast.success(result.message || 'Administrator updated successfully');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to update administrator');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to update administrator';
        toast.error(errorMessage);
        throw error;
      }
    },
    [updateAdminMutation, schoolId]
  );

  return {
    updateAdmin,
    isLoading,
  };
}

/**
 * Hook for adding a teacher to a school
 */
export function useAddTeacher(schoolId: string | null) {
  const [addTeacherMutation, { isLoading }] = useAddTeacherMutation();

  const addTeacher = useCallback(
    async (teacherData: AddTeacherDto) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      try {
        const result = await addTeacherMutation({
          schoolId,
          teacher: teacherData,
        }).unwrap();

        if (result.success) {
          toast.success(result.message || 'Teacher added successfully');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to add teacher');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to add teacher';
        toast.error(errorMessage);
        throw error;
      }
    },
    [addTeacherMutation, schoolId]
  );

  return {
    addTeacher,
    isLoading,
  };
}

/**
 * Hook for updating a teacher in a school
 */
export function useUpdateTeacher(schoolId: string | null) {
  const [updateTeacherMutation, { isLoading }] = useUpdateTeacherMutation();

  const updateTeacher = useCallback(
    async (teacherId: string, teacherData: UpdateTeacherDto) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      try {
        const result = await updateTeacherMutation({
          schoolId,
          teacherId,
          teacher: teacherData,
        }).unwrap();

        if (result.success) {
          toast.success(result.message || 'Teacher updated successfully');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to update teacher');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to update teacher';
        toast.error(errorMessage);
        throw error;
      }
    },
    [updateTeacherMutation, schoolId]
  );

  return {
    updateTeacher,
    isLoading,
  };
}

/**
 * Hook for deleting a teacher from a school
 */
export function useDeleteTeacher(schoolId: string | null) {
  const [deleteTeacherMutation, { isLoading }] = useDeleteTeacherMutation();

  const deleteTeacher = useCallback(
    async (teacherId: string) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      try {
        const result = await deleteTeacherMutation({
          schoolId,
          teacherId,
        }).unwrap();

        if (result.success) {
          toast.success(result.message || 'Teacher deleted successfully');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to delete teacher');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to delete teacher';
        toast.error(errorMessage);
        throw error;
      }
    },
    [deleteTeacherMutation, schoolId]
  );

  return {
    deleteTeacher,
    isLoading,
  };
}

/**
 * Hook for deleting an admin from a school
 */
export function useDeleteAdmin(schoolId: string | null) {
  const [deleteAdminMutation, { isLoading }] = useDeleteAdminMutation();

  const deleteAdmin = useCallback(
    async (adminId: string) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      try {
        const result = await deleteAdminMutation({
          schoolId,
          adminId,
        }).unwrap();

        if (result.success) {
          toast.success(result.message || 'Administrator deleted successfully');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to delete administrator');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to delete administrator';
        toast.error(errorMessage);
        throw error;
      }
    },
    [deleteAdminMutation, schoolId]
  );

  return {
    deleteAdmin,
    isLoading,
  };
}

/**
 * Hook for deleting a principal from a school
 * Note: Principal cannot be deleted unless another admin is made principal first
 */
export function useDeletePrincipal(schoolId: string | null) {
  const [deletePrincipalMutation, { isLoading }] = useDeletePrincipalMutation();

  const deletePrincipal = useCallback(
    async (principalId: string) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      try {
        const result = await deletePrincipalMutation({
          schoolId,
          principalId,
        }).unwrap();

        if (result.success) {
          toast.success(result.message || 'Principal deleted successfully');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to delete principal');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to delete principal';
        
        // Provide more specific error messages for principal deletion
        if (errorMessage.includes('active principal')) {
          toast.error(
            'Cannot delete an active principal. You must first transfer the principal role to another administrator using the "Make Principal" option.',
            { duration: 6000 }
          );
        } else if (errorMessage.includes('other administrator')) {
          toast.error(
            'Cannot delete principal. There must be at least one other administrator to assign the principal role to before deletion.',
            { duration: 6000 }
          );
        } else {
          toast.error(errorMessage);
        }
        throw error;
      }
    },
    [deletePrincipalMutation, schoolId]
  );

  return {
    deletePrincipal,
    isLoading,
  };
}

/**
 * Hook for updating a principal in a school
 */
export function useUpdatePrincipal(schoolId: string | null) {
  const [updatePrincipalMutation, { isLoading }] = useUpdatePrincipalMutation();

  const updatePrincipal = useCallback(
    async (principalId: string, principalData: UpdatePrincipalDto) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      try {
        const result = await updatePrincipalMutation({
          schoolId,
          principalId,
          principal: principalData,
        }).unwrap();

        if (result.success) {
          toast.success(result.message || 'Principal updated successfully');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to update principal');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to update principal';
        toast.error(errorMessage);
        throw error;
      }
    },
    [updatePrincipalMutation, schoolId]
  );

  return {
    updatePrincipal,
    isLoading,
  };
}

/**
 * Hook for making an admin the principal
 * Switches the current principal to admin role and promotes the selected admin to principal
 */
export function useMakePrincipal(schoolId: string | null) {
  const [makePrincipalMutation, { isLoading }] = useMakePrincipalMutation();

  const makePrincipal = useCallback(
    async (adminId: string) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      try {
        const result = await makePrincipalMutation({
          schoolId,
          adminId,
        }).unwrap();

        if (result.success) {
          toast.success(result.message || 'Administrator successfully made principal');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to make administrator principal');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to make administrator principal';
        toast.error(errorMessage);
        throw error;
      }
    },
    [makePrincipalMutation, schoolId]
  );

  return {
    makePrincipal,
    isLoading,
  };
}

/**
 * Hook for converting a teacher to an admin
 * Optionally keeps the teacher role if keepAsTeacher is true
 */
export function useConvertTeacherToAdmin(schoolId: string | null) {
  const [convertTeacherToAdminMutation, { isLoading }] = useConvertTeacherToAdminMutation();

  const convertTeacherToAdmin = useCallback(
    async (teacherId: string, role: string, keepAsTeacher: boolean) => {
      if (!schoolId) {
        throw new Error('School ID is required');
      }

      try {
        const result = await convertTeacherToAdminMutation({
          schoolId,
          teacherId,
          role,
          keepAsTeacher,
        }).unwrap();

        if (result.success) {
          toast.success(result.message || 'Teacher successfully converted to administrator');
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to convert teacher to administrator');
        }
      } catch (error: any) {
        const errorMessage =
          error?.data?.message || error?.message || 'Failed to convert teacher to administrator';
        toast.error(errorMessage);
        throw error;
      }
    },
    [convertTeacherToAdminMutation, schoolId]
  );

  return {
    convertTeacherToAdmin,
    isLoading,
  };
}

