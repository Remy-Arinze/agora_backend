import { useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  useGetTeacherSubjectsQuery,
  useGetTeacherWithSubjectsQuery,
  useUpdateTeacherSubjectsMutation,
  useAddTeacherSubjectMutation,
  useRemoveTeacherSubjectMutation,
  useGetAssignableSubjectsQuery,
  TeacherSubject,
  TeacherWithSubjects,
  AssignableSubject,
} from '@/lib/store/api/schoolAdminApi';

interface UseTeacherSubjectsOptions {
  schoolId?: string;
  teacherId?: string;
  skip?: boolean;
}

interface UseTeacherSubjectsReturn {
  // Data
  subjects: TeacherSubject[];
  teacherWithSubjects: TeacherWithSubjects | null;
  
  // Loading states
  isLoading: boolean;
  isLoadingDetails: boolean;
  isUpdating: boolean;
  isAdding: boolean;
  isRemoving: boolean;
  
  // Error states
  error: any;
  detailsError: any;
  
  // Actions
  updateSubjects: (subjectIds: string[]) => Promise<void>;
  addSubject: (subjectId: string) => Promise<void>;
  removeSubject: (subjectId: string) => Promise<void>;
  
  // Utilities
  hasSubject: (subjectId: string) => boolean;
  getSubjectById: (subjectId: string) => TeacherSubject | undefined;
  refetch: () => void;
}

/**
 * Custom hook for managing teacher subject competencies
 * Provides CRUD operations for managing what subjects a teacher can teach
 */
export function useTeacherSubjects({
  schoolId,
  teacherId,
  skip = false,
}: UseTeacherSubjectsOptions): UseTeacherSubjectsReturn {
  const shouldSkip = skip || !schoolId || !teacherId;

  // Queries
  const {
    data: subjectsResponse,
    isLoading,
    error,
    refetch,
  } = useGetTeacherSubjectsQuery(
    { schoolId: schoolId!, teacherId: teacherId! },
    { skip: shouldSkip }
  );

  const {
    data: detailsResponse,
    isLoading: isLoadingDetails,
    error: detailsError,
  } = useGetTeacherWithSubjectsQuery(
    { schoolId: schoolId!, teacherId: teacherId! },
    { skip: shouldSkip }
  );

  // Mutations
  const [updateSubjectsMutation, { isLoading: isUpdating }] = useUpdateTeacherSubjectsMutation();
  const [addSubjectMutation, { isLoading: isAdding }] = useAddTeacherSubjectMutation();
  const [removeSubjectMutation, { isLoading: isRemoving }] = useRemoveTeacherSubjectMutation();

  // Derived data
  const subjects = useMemo(() => subjectsResponse?.data || [], [subjectsResponse]);
  const teacherWithSubjects = useMemo(() => detailsResponse?.data || null, [detailsResponse]);

  // Helper to check if teacher has a subject
  const hasSubject = useCallback(
    (subjectId: string) => subjects.some((s) => s.id === subjectId),
    [subjects]
  );

  // Helper to get subject by ID
  const getSubjectById = useCallback(
    (subjectId: string) => subjects.find((s) => s.id === subjectId),
    [subjects]
  );

  // Update all subjects (replaces existing)
  const updateSubjects = useCallback(
    async (subjectIds: string[]) => {
      if (!schoolId || !teacherId) {
        toast.error('School or teacher information missing');
        return;
      }

      try {
        await updateSubjectsMutation({
          schoolId,
          teacherId,
          subjectIds,
        }).unwrap();
        toast.success('Teacher subjects updated successfully');
      } catch (err: any) {
        const message = err?.data?.message || 'Failed to update teacher subjects';
        toast.error(message);
        throw err;
      }
    },
    [schoolId, teacherId, updateSubjectsMutation]
  );

  // Add a single subject
  const addSubject = useCallback(
    async (subjectId: string) => {
      if (!schoolId || !teacherId) {
        toast.error('School or teacher information missing');
        return;
      }

      try {
        await addSubjectMutation({
          schoolId,
          teacherId,
          subjectId,
        }).unwrap();
        toast.success('Subject added successfully');
      } catch (err: any) {
        const message = err?.data?.message || 'Failed to add subject';
        toast.error(message);
        throw err;
      }
    },
    [schoolId, teacherId, addSubjectMutation]
  );

  // Remove a subject
  const removeSubject = useCallback(
    async (subjectId: string) => {
      if (!schoolId || !teacherId) {
        toast.error('School or teacher information missing');
        return;
      }

      try {
        await removeSubjectMutation({
          schoolId,
          teacherId,
          subjectId,
        }).unwrap();
        toast.success('Subject removed successfully');
      } catch (err: any) {
        const message = err?.data?.message || 'Failed to remove subject';
        toast.error(message);
        throw err;
      }
    },
    [schoolId, teacherId, removeSubjectMutation]
  );

  return {
    subjects,
    teacherWithSubjects,
    isLoading,
    isLoadingDetails,
    isUpdating,
    isAdding,
    isRemoving,
    error,
    detailsError,
    updateSubjects,
    addSubject,
    removeSubject,
    hasSubject,
    getSubjectById,
    refetch,
  };
}

interface UseAssignableSubjectsOptions {
  schoolId?: string;
  teacherId?: string;
  classId?: string;
  skip?: boolean;
}

interface UseAssignableSubjectsReturn {
  subjects: AssignableSubject[];
  availableSubjects: AssignableSubject[];
  assignedSubjects: AssignableSubject[];
  isLoading: boolean;
  error: any;
  refetch: () => void;
}

/**
 * Custom hook for getting subjects a teacher can be assigned to for a specific class
 * Filters out already assigned subjects
 */
export function useAssignableSubjects({
  schoolId,
  teacherId,
  classId,
  skip = false,
}: UseAssignableSubjectsOptions): UseAssignableSubjectsReturn {
  const shouldSkip = skip || !schoolId || !teacherId || !classId;

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useGetAssignableSubjectsQuery(
    { schoolId: schoolId!, teacherId: teacherId!, classId: classId! },
    { skip: shouldSkip }
  );

  const subjects = useMemo(() => response?.data || [], [response]);

  const availableSubjects = useMemo(
    () => subjects.filter((s) => !s.alreadyAssigned),
    [subjects]
  );

  const assignedSubjects = useMemo(
    () => subjects.filter((s) => s.alreadyAssigned),
    [subjects]
  );

  return {
    subjects,
    availableSubjects,
    assignedSubjects,
    isLoading,
    error,
    refetch,
  };
}

