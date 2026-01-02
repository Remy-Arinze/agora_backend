'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  useGetFacultiesQuery,
  useGetFacultyQuery,
  useCreateFacultyMutation,
  useUpdateFacultyMutation,
  useDeleteFacultyMutation,
  useGenerateDefaultFacultiesMutation,
  type Faculty,
  type CreateFacultyDto,
  type UpdateFacultyDto,
} from '@/lib/store/api/schoolAdminApi';

interface UseFacultiesOptions {
  schoolId: string | undefined;
  skip?: boolean;
}

interface UseFacultiesResult {
  faculties: Faculty[];
  isLoading: boolean;
  error: any;
  refetch: () => void;
  createFaculty: (data: CreateFacultyDto) => Promise<Faculty | undefined>;
  updateFaculty: (facultyId: string, data: UpdateFacultyDto) => Promise<Faculty | undefined>;
  deleteFaculty: (facultyId: string, force?: boolean) => Promise<boolean>;
  generateDefaults: () => Promise<{ created: number; skipped: number } | undefined>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isGenerating: boolean;
}

/**
 * Hook for managing faculties with built-in error handling and toasts
 */
export function useFaculties({ schoolId, skip = false }: UseFacultiesOptions): UseFacultiesResult {
  const {
    data: facultiesResponse,
    isLoading,
    error,
    refetch,
  } = useGetFacultiesQuery(
    { schoolId: schoolId! },
    { skip: !schoolId || skip }
  );

  const [createFacultyMutation, { isLoading: isCreating }] = useCreateFacultyMutation();
  const [updateFacultyMutation, { isLoading: isUpdating }] = useUpdateFacultyMutation();
  const [deleteFacultyMutation, { isLoading: isDeleting }] = useDeleteFacultyMutation();
  const [generateDefaultsMutation, { isLoading: isGenerating }] = useGenerateDefaultFacultiesMutation();

  const faculties = facultiesResponse?.data || [];

  const createFaculty = useCallback(
    async (data: CreateFacultyDto): Promise<Faculty | undefined> => {
      if (!schoolId) {
        toast.error('School ID is required');
        return undefined;
      }

      try {
        const result = await createFacultyMutation({ schoolId, data }).unwrap();
        toast.success(`Faculty "${data.name}" created successfully`);
        return result.data;
      } catch (error: any) {
        const message = error?.data?.message || 'Failed to create faculty';
        toast.error(message);
        return undefined;
      }
    },
    [schoolId, createFacultyMutation]
  );

  const updateFaculty = useCallback(
    async (facultyId: string, data: UpdateFacultyDto): Promise<Faculty | undefined> => {
      if (!schoolId) {
        toast.error('School ID is required');
        return undefined;
      }

      try {
        const result = await updateFacultyMutation({ schoolId, facultyId, data }).unwrap();
        toast.success('Faculty updated successfully');
        return result.data;
      } catch (error: any) {
        const message = error?.data?.message || 'Failed to update faculty';
        toast.error(message);
        return undefined;
      }
    },
    [schoolId, updateFacultyMutation]
  );

  const deleteFaculty = useCallback(
    async (facultyId: string, force = false): Promise<boolean> => {
      if (!schoolId) {
        toast.error('School ID is required');
        return false;
      }

      try {
        await deleteFacultyMutation({ schoolId, facultyId, force }).unwrap();
        toast.success('Faculty deleted successfully');
        return true;
      } catch (error: any) {
        const message = error?.data?.message || 'Failed to delete faculty';
        toast.error(message);
        return false;
      }
    },
    [schoolId, deleteFacultyMutation]
  );

  const generateDefaults = useCallback(
    async (): Promise<{ created: number; skipped: number } | undefined> => {
      if (!schoolId) {
        toast.error('School ID is required');
        return undefined;
      }

      try {
        const result = await generateDefaultsMutation({ schoolId }).unwrap();
        if (result.data.created > 0) {
          toast.success(result.message || `Created ${result.data.created} faculties`);
        } else {
          toast.info(result.message || 'All default faculties already exist');
        }
        return result.data;
      } catch (error: any) {
        const message = error?.data?.message || 'Failed to generate faculties';
        toast.error(message);
        return undefined;
      }
    },
    [schoolId, generateDefaultsMutation]
  );

  return {
    faculties,
    isLoading,
    error,
    refetch,
    createFaculty,
    updateFaculty,
    deleteFaculty,
    generateDefaults,
    isCreating,
    isUpdating,
    isDeleting,
    isGenerating,
  };
}

interface UseFacultyOptions {
  schoolId: string | undefined;
  facultyId: string | undefined;
  skip?: boolean;
}

/**
 * Hook for getting a single faculty
 */
export function useFaculty({ schoolId, facultyId, skip = false }: UseFacultyOptions) {
  const {
    data: facultyResponse,
    isLoading,
    error,
    refetch,
  } = useGetFacultyQuery(
    { schoolId: schoolId!, facultyId: facultyId! },
    { skip: !schoolId || !facultyId || skip }
  );

  return {
    faculty: facultyResponse?.data,
    isLoading,
    error,
    refetch,
  };
}

