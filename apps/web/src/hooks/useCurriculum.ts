'use client';

import { useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  useGetNerdcSubjectsQuery,
  useGetSubjectsFromTimetableQuery,
  useGetCurriculaSummaryQuery,
  useGetCurriculumByIdQuery,
  useCreateCurriculumMutation,
  useGenerateCurriculumMutation,
  useBulkGenerateCurriculumMutation,
  useUpdateCurriculumMutation,
  useDeleteCurriculumMutation,
  useSubmitCurriculumForApprovalMutation,
  useApproveCurriculumMutation,
  useRejectCurriculumMutation,
  useActivateCurriculumMutation,
  useMarkWeekCompleteMutation,
  useMarkWeekInProgressMutation,
  useSkipWeekMutation,
  type CreateCurriculumDto,
  type GenerateCurriculumDto,
  type BulkGenerateCurriculumDto,
  type UpdateCurriculumDto,
} from '@/lib/store/api/schoolAdminApi';

interface UseCurriculumOptions {
  schoolId?: string;
  classLevelId?: string;
  termId?: string;
  schoolType?: string;
}

export function useCurriculum(options: UseCurriculumOptions = {}) {
  const { schoolId, classLevelId, termId, schoolType } = options;
  
  // State
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  
  // ============================================
  // Queries
  // ============================================
  
  // Get NERDC subjects for the school type
  const {
    data: nerdcSubjectsResponse,
    isLoading: isLoadingNerdcSubjects,
    refetch: refetchNerdcSubjects,
  } = useGetNerdcSubjectsQuery(
    { schoolId: schoolId || '', schoolType },
    { skip: !schoolId }
  );
  
  // Get subjects from timetable for the class level
  const {
    data: timetableSubjectsResponse,
    isLoading: isLoadingTimetableSubjects,
    refetch: refetchTimetableSubjects,
  } = useGetSubjectsFromTimetableQuery(
    { schoolId: schoolId || '', classLevelId: classLevelId || '', termId: termId || '' },
    { skip: !schoolId || !classLevelId || !termId }
  );
  
  // Get curriculum summary for all subjects
  const {
    data: curriculaSummaryResponse,
    isLoading: isLoadingCurriculaSummary,
    refetch: refetchCurriculaSummary,
  } = useGetCurriculaSummaryQuery(
    { schoolId: schoolId || '', classLevelId: classLevelId || '', termId: termId || '' },
    { skip: !schoolId || !classLevelId || !termId }
  );
  
  // Get selected curriculum details
  const {
    data: selectedCurriculumResponse,
    isLoading: isLoadingSelectedCurriculum,
    refetch: refetchSelectedCurriculum,
  } = useGetCurriculumByIdQuery(
    { schoolId: schoolId || '', curriculumId: selectedCurriculumId || '' },
    { skip: !schoolId || !selectedCurriculumId }
  );
  
  // ============================================
  // Mutations
  // ============================================
  
  const [createCurriculum, { isLoading: isCreating }] = useCreateCurriculumMutation();
  const [generateCurriculum, { isLoading: isGenerating }] = useGenerateCurriculumMutation();
  const [bulkGenerateCurriculum, { isLoading: isBulkGenerating }] = useBulkGenerateCurriculumMutation();
  const [updateCurriculum, { isLoading: isUpdating }] = useUpdateCurriculumMutation();
  const [deleteCurriculum, { isLoading: isDeleting }] = useDeleteCurriculumMutation();
  const [submitForApproval, { isLoading: isSubmitting }] = useSubmitCurriculumForApprovalMutation();
  const [approveCurriculum, { isLoading: isApproving }] = useApproveCurriculumMutation();
  const [rejectCurriculum, { isLoading: isRejecting }] = useRejectCurriculumMutation();
  const [activateCurriculum, { isLoading: isActivating }] = useActivateCurriculumMutation();
  const [markWeekComplete, { isLoading: isMarkingComplete }] = useMarkWeekCompleteMutation();
  const [markWeekInProgress, { isLoading: isMarkingInProgress }] = useMarkWeekInProgressMutation();
  const [skipWeek, { isLoading: isSkipping }] = useSkipWeekMutation();
  
  // ============================================
  // Computed Values
  // ============================================
  
  const nerdcSubjects = useMemo(() => 
    nerdcSubjectsResponse?.data || [],
    [nerdcSubjectsResponse]
  );
  
  const timetableSubjects = useMemo(() => 
    timetableSubjectsResponse?.data || [],
    [timetableSubjectsResponse]
  );
  
  const curriculaSummary = useMemo(() => 
    curriculaSummaryResponse?.data || [],
    [curriculaSummaryResponse]
  );
  
  const selectedCurriculum = useMemo(() => 
    selectedCurriculumResponse?.data || null,
    [selectedCurriculumResponse]
  );
  
  // Stats
  const stats = useMemo(() => {
    const total = curriculaSummary.length;
    const created = curriculaSummary.filter(s => s.curriculumId).length;
    const approved = curriculaSummary.filter(s => s.status === 'APPROVED' || s.status === 'ACTIVE').length;
    const pending = curriculaSummary.filter(s => s.status === 'SUBMITTED').length;
    const draft = curriculaSummary.filter(s => s.status === 'DRAFT').length;
    const nerdcBased = curriculaSummary.filter(s => s.isNerdcBased).length;
    
    return { total, created, approved, pending, draft, nerdcBased };
  }, [curriculaSummary]);
  
  // ============================================
  // Actions
  // ============================================
  
  const handleCreate = useCallback(async (data: CreateCurriculumDto) => {
    if (!schoolId) return null;
    
    try {
      const result = await createCurriculum({ schoolId, curriculumData: data }).unwrap();
      toast.success('Curriculum created successfully');
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create curriculum');
      return null;
    }
  }, [schoolId, createCurriculum]);
  
  const handleGenerate = useCallback(async (data: GenerateCurriculumDto) => {
    if (!schoolId) return null;
    
    try {
      const result = await generateCurriculum({ schoolId, data }).unwrap();
      toast.success('Curriculum generated from NERDC template');
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to generate curriculum');
      return null;
    }
  }, [schoolId, generateCurriculum]);
  
  const handleBulkGenerate = useCallback(async (data: BulkGenerateCurriculumDto) => {
    if (!schoolId) return null;
    
    try {
      const result = await bulkGenerateCurriculum({ schoolId, data }).unwrap();
      const { created, failed } = result.data;
      
      if (created.length > 0) {
        toast.success(`Generated ${created.length} curricula from NERDC templates`);
      }
      if (failed.length > 0) {
        toast.warning(`${failed.length} curricula failed to generate`);
      }
      
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to bulk generate curricula');
      return null;
    }
  }, [schoolId, bulkGenerateCurriculum]);
  
  const handleUpdate = useCallback(async (curriculumId: string, data: UpdateCurriculumDto) => {
    if (!schoolId) return null;
    
    try {
      const result = await updateCurriculum({ schoolId, curriculumId, data }).unwrap();
      toast.success('Curriculum updated successfully');
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update curriculum');
      return null;
    }
  }, [schoolId, updateCurriculum]);
  
  const handleDelete = useCallback(async (curriculumId: string) => {
    if (!schoolId) return false;
    
    try {
      await deleteCurriculum({ schoolId, curriculumId }).unwrap();
      toast.success('Curriculum deleted successfully');
      return true;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete curriculum');
      return false;
    }
  }, [schoolId, deleteCurriculum]);
  
  const handleSubmit = useCallback(async (curriculumId: string) => {
    if (!schoolId) return null;
    
    try {
      const result = await submitForApproval({ schoolId, curriculumId }).unwrap();
      toast.success('Curriculum submitted for approval');
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to submit curriculum');
      return null;
    }
  }, [schoolId, submitForApproval]);
  
  const handleApprove = useCallback(async (curriculumId: string) => {
    if (!schoolId) return null;
    
    try {
      const result = await approveCurriculum({ schoolId, curriculumId }).unwrap();
      toast.success('Curriculum approved');
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to approve curriculum');
      return null;
    }
  }, [schoolId, approveCurriculum]);
  
  const handleReject = useCallback(async (curriculumId: string, reason: string) => {
    if (!schoolId) return null;
    
    try {
      const result = await rejectCurriculum({ schoolId, curriculumId, reason }).unwrap();
      toast.success('Curriculum rejected');
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to reject curriculum');
      return null;
    }
  }, [schoolId, rejectCurriculum]);
  
  const handleActivate = useCallback(async (curriculumId: string) => {
    if (!schoolId) return null;
    
    try {
      const result = await activateCurriculum({ schoolId, curriculumId }).unwrap();
      toast.success('Curriculum activated');
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to activate curriculum');
      return null;
    }
  }, [schoolId, activateCurriculum]);
  
  const handleMarkWeekComplete = useCallback(async (curriculumId: string, weekNumber: number, notes?: string) => {
    if (!schoolId) return null;
    
    try {
      const result = await markWeekComplete({ schoolId, curriculumId, weekNumber, notes }).unwrap();
      toast.success(`Week ${weekNumber} marked as complete`);
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to mark week as complete');
      return null;
    }
  }, [schoolId, markWeekComplete]);
  
  const handleMarkWeekInProgress = useCallback(async (curriculumId: string, weekNumber: number) => {
    if (!schoolId) return null;
    
    try {
      const result = await markWeekInProgress({ schoolId, curriculumId, weekNumber }).unwrap();
      toast.success(`Week ${weekNumber} marked as in progress`);
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to mark week as in progress');
      return null;
    }
  }, [schoolId, markWeekInProgress]);
  
  const handleSkipWeek = useCallback(async (curriculumId: string, weekNumber: number, reason: string) => {
    if (!schoolId) return null;
    
    try {
      const result = await skipWeek({ schoolId, curriculumId, weekNumber, reason }).unwrap();
      toast.success(`Week ${weekNumber} skipped`);
      return result.data;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to skip week');
      return null;
    }
  }, [schoolId, skipWeek]);
  
  // ============================================
  // Helper Functions
  // ============================================
  
  const getStatusColor = useCallback((status: string | null): string => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'SUBMITTED': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'APPROVED': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'ACTIVE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'COMPLETED': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'REJECTED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }, []);
  
  const getWeekStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'PENDING': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400';
      case 'COMPLETED': return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400';
      case 'SKIPPED': return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    }
  }, []);
  
  const getStatusLabel = useCallback((status: string | null): string => {
    switch (status) {
      case 'DRAFT': return 'Draft';
      case 'SUBMITTED': return 'Pending Approval';
      case 'APPROVED': return 'Approved';
      case 'ACTIVE': return 'Active';
      case 'COMPLETED': return 'Completed';
      case 'REJECTED': return 'Rejected';
      default: return 'Not Created';
    }
  }, []);
  
  return {
    // Data
    nerdcSubjects,
    timetableSubjects,
    curriculaSummary,
    selectedCurriculum,
    stats,
    
    // Selection
    selectedCurriculumId,
    setSelectedCurriculumId,
    
    // Loading states
    isLoading: isLoadingNerdcSubjects || isLoadingTimetableSubjects || isLoadingCurriculaSummary,
    isLoadingCurriculum: isLoadingSelectedCurriculum,
    isMutating: isCreating || isGenerating || isBulkGenerating || isUpdating || isDeleting ||
                isSubmitting || isApproving || isRejecting || isActivating ||
                isMarkingComplete || isMarkingInProgress || isSkipping,
    
    // Refetch functions
    refetchNerdcSubjects,
    refetchTimetableSubjects,
    refetchCurriculaSummary,
    refetchSelectedCurriculum,
    
    // CRUD actions
    handleCreate,
    handleGenerate,
    handleBulkGenerate,
    handleUpdate,
    handleDelete,
    
    // Status actions
    handleSubmit,
    handleApprove,
    handleReject,
    handleActivate,
    
    // Progress actions
    handleMarkWeekComplete,
    handleMarkWeekInProgress,
    handleSkipWeek,
    
    // Helpers
    getStatusColor,
    getWeekStatusColor,
    getStatusLabel,
  };
}

export type UseCurriculumReturn = ReturnType<typeof useCurriculum>;

