'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import {
  Clock,
  Plus,
  Loader2,
  AlertCircle,
  BookOpen,
  Calendar,
  Edit,
  Trash2,
  MousePointerClick,
  GripVertical,
  AlertTriangle,
  ChevronDown,
  GraduationCap,
  Info,
} from 'lucide-react';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import {
  useGetMySchoolQuery,
  useGetActiveSessionQuery,
  useGetSessionsQuery,
  useGetClassesQuery,
  useGetTimetableForClassQuery,
  useGetTimetablesForSchoolTypeQuery,
  useCreateTimetablePeriodMutation,
  useUpdateTimetablePeriodMutation,
  useDeleteTimetablePeriodMutation,
  useDeleteTimetableForClassMutation,
  useGetSubjectsQuery,
  useGetCoursesQuery,
  useGetRoomsQuery,
  useGetStaffListQuery,
  useCreateMasterScheduleMutation,
  type TimetablePeriod,
  type Class,
  type DayOfWeek,
  type PeriodType,
  type TeacherWithWorkload,
} from '@/lib/store/api/schoolAdminApi';
import { useSchoolType } from '@/hooks/useSchoolType';
import { TimetableBuilder, type TimetableSlot } from '@/components/timetable/TimetableBuilder';
import { EditableTimetableTable } from '@/components/timetable/EditableTimetableTable';
import { TeacherSelectionPopup } from '@/components/timetable/TeacherSelectionPopup';
import { TimetablePreviewModal } from '@/components/timetable/TimetablePreviewModal';
import { getScheduleForSchoolType } from '@/lib/utils/nigerianSchoolSchedule';
import { ConfirmModal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useAutoGenerateWithTeachers, type GeneratedPeriodWithTeacher } from '@/hooks/useAutoGenerateWithTeachers';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Types for teacher selection state
interface TeacherSelectionState {
  slot: TimetableSlot;
  subject: { id: string; name: string; code?: string };
  teachers: TeacherWithWorkload[];
}

export default function TimetablesPage() {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTimetableClassId, setNewTimetableClassId] = useState<string>('');
  const [newTimetableTermId, setNewTimetableTermId] = useState<string>('');

  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;
  const { currentType } = useSchoolType();

  const { data: activeSessionResponse } = useGetActiveSessionQuery(
    { schoolId: schoolId!, schoolType: currentType || undefined },
    { skip: !schoolId }
  );

  const { data: sessionsResponse } = useGetSessionsQuery(
    { schoolId: schoolId!, schoolType: currentType || undefined },
    { skip: !schoolId }
  );

  // Get classes filtered by school type (same as courses page)
  const { data: classesResponse } = useGetClassesQuery(
    { schoolId: schoolId!, type: currentType || undefined },
    { skip: !schoolId }
  );

  // Get all timetables for current school type
  const { data: timetablesResponse, refetch: refetchTimetables } = useGetTimetablesForSchoolTypeQuery(
    {
      schoolId: schoolId!,
      schoolType: currentType || undefined,
      termId: selectedTermId || undefined,
    },
    { skip: !schoolId }
  );

  // Get timetable for selected class
  const { data: timetableResponse, refetch: refetchTimetable, isLoading: isLoadingTimetable } = useGetTimetableForClassQuery(
    {
      schoolId: schoolId!,
      classId: selectedClassId,
      termId: selectedTermId,
    },
    { skip: !schoolId || !selectedClassId || !selectedTermId }
  );

  // For SECONDARY, include termId to get teacher workload data
  // Skip until termId is selected for SECONDARY to ensure we get workload data
  const { data: subjectsResponse, refetch: refetchSubjects } = useGetSubjectsQuery(
    {
      schoolId: schoolId!,
      schoolType: currentType || undefined,
      termId: currentType === 'SECONDARY' ? selectedTermId : undefined,
    },
    { skip: !schoolId || (currentType === 'SECONDARY' && !selectedTermId) }
  );

  const { data: coursesResponse } = useGetCoursesQuery(
    { schoolId: schoolId!, schoolType: currentType || undefined },
    { skip: !schoolId || currentType !== 'TERTIARY' }
  );

  const { data: roomsResponse } = useGetRoomsQuery(
    { schoolId: schoolId! },
    { skip: !schoolId }
  );

  const { data: staffResponse } = useGetStaffListQuery(
    { role: 'teacher', limit: 100 },
    { skip: !schoolId }
  );

  const [createPeriod, { isLoading: isCreating }] = useCreateTimetablePeriodMutation();
  const [updatePeriod, { isLoading: isUpdating }] = useUpdateTimetablePeriodMutation();
  const [deletePeriod, { isLoading: isDeleting }] = useDeleteTimetablePeriodMutation();
  const [deleteTimetable, { isLoading: isDeletingTimetable }] = useDeleteTimetableForClassMutation();
  const [createMasterSchedule, { isLoading: isCreatingMaster }] = useCreateMasterScheduleMutation();
  
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ classId: string; className: string; termId: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // SECONDARY-specific state for teacher assignment
  const [teacherSelectionState, setTeacherSelectionState] = useState<TeacherSelectionState | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPeriods, setPreviewPeriods] = useState<GeneratedPeriodWithTeacher[]>([]);
  const [isApplyingPreview, setIsApplyingPreview] = useState(false);

  const classes = classesResponse?.data || [];
  const subjects = subjectsResponse?.data || [];
  const courses = coursesResponse?.data || [];
  const rooms = roomsResponse?.data || [];
  const teachers = staffResponse?.data?.items || [];
  const timetable = timetableResponse?.data || [];
  const timetablesByClass = timetablesResponse?.data || {};

  // Get all terms from sessions - filtered by current school type and deduplicated
  const allTerms = useMemo(() => {
    if (!sessionsResponse?.data) return [];
    
    // IMPORTANT: Only show sessions that match the current school type
    // Each school type (PRIMARY, SECONDARY, TERTIARY) has its own independent sessions
    const filteredSessions = sessionsResponse.data.filter((session) => {
      // If no current type selected, show sessions without a school type (legacy)
      if (!currentType) return !session.schoolType;
      // Otherwise, only show sessions for the current school type
      return session.schoolType === currentType;
    });
    
    // Deduplicate sessions by name (keep first/latest)
    const uniqueSessionsMap = new Map<string, typeof filteredSessions[0]>();
    filteredSessions.forEach((session) => {
      // Use session name as key - if duplicate exists, keep the first one (latest by startDate)
      if (!uniqueSessionsMap.has(session.name)) {
        uniqueSessionsMap.set(session.name, session);
      }
    });
    const uniqueSessions = Array.from(uniqueSessionsMap.values());
    
    // Map terms with session info
    return uniqueSessions.flatMap((session) =>
      session.terms.map((term) => ({
        ...term,
        sessionName: session.name,
        schoolType: session.schoolType,
      }))
    ).sort((a, b) => {
      // Sort by session name (desc) then term number (asc)
      const sessionCompare = b.sessionName.localeCompare(a.sessionName);
      if (sessionCompare !== 0) return sessionCompare;
      return a.number - b.number;
    });
  }, [sessionsResponse, currentType]);

  // Auto-select active term if available, reset when school type changes
  useEffect(() => {
    if (activeSessionResponse?.data?.term?.id) {
      setSelectedTermId(activeSessionResponse.data.term.id);
    } else {
      setSelectedTermId('');
    }
    // Also reset selected class when school type changes
    setSelectedClassId('');
  }, [activeSessionResponse, currentType]);

  const handleCreateTimetable = async () => {
    if (!schoolId || !newTimetableClassId || !newTimetableTermId) {
      toast.error('Please select a class and term');
      return;
    }

    // Check if subjects are available for the school type (before creating)
    // This is a synchronous check, so we'll validate in the UI instead

    // Use Nigerian school schedule based on school type
    const schedule = getScheduleForSchoolType(currentType);
    const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const periods = schedule.periods
      .filter((p) => p.type === 'LESSON')
      .flatMap((period) =>
        DAYS.map((day) => ({
          dayOfWeek: day,
          startTime: period.startTime,
          endTime: period.endTime,
          type: 'LESSON' as PeriodType,
        }))
      );

    // Check if the selected class has a classArmId (it's a ClassArm-based class)
    // The class list returns classArmId for ClassArm records (PRIMARY/SECONDARY with arms)
    // Legacy Class records (auto-generated before ClassArm system) don't have classArmId
    const selectedClass = classes.find((c) => c.id === newTimetableClassId);
    const hasClassArmId = selectedClass?.classArmId;

    try {
      // Create master schedule for the selected class
      // Note: We'll need to update createMasterSchedule to support classId
      // For now, we'll create periods directly
      for (const periodDef of periods) {
        await createPeriod({
          schoolId,
          data: {
            ...periodDef,
            // Use classArmId if the class has one (ClassArm-based), otherwise use classId
            ...(hasClassArmId 
              ? { classArmId: newTimetableClassId }
              : { classId: newTimetableClassId }
            ),
            termId: newTimetableTermId,
          },
        }).unwrap();
      }

      toast.success('Timetable created successfully');
      setShowCreateModal(false);
      setNewTimetableClassId('');
      setNewTimetableTermId('');
      refetchTimetables();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create timetable');
    }
  };

  const handlePeriodUpdate = async (
    slot: { dayOfWeek: DayOfWeek; period: { startTime: string; endTime: string; type: string }; periodData?: TimetablePeriod },
    subjectId?: string,
    courseId?: string,
    teacherId?: string  // NEW: Teacher ID for SECONDARY schools
  ) => {
    if (!schoolId || !selectedClassId || !selectedTermId) return;

    try {
      if (slot.periodData) {
        // For Free Period, explicitly pass null to clear the subject/course
        // undefined means "don't change", null means "clear it"
        const isFreeperiod = subjectId === undefined && courseId === undefined;
        
        await updatePeriod({
          schoolId,
          periodId: slot.periodData.id,
          data: {
            subjectId: currentType !== 'TERTIARY' 
              ? (isFreeperiod ? null : subjectId) 
              : undefined,
            courseId: currentType === 'TERTIARY' 
              ? (isFreeperiod ? null : courseId) 
              : undefined,
            // For SECONDARY, use the provided teacherId; otherwise keep existing
            teacherId: currentType === 'SECONDARY' 
              ? (teacherId || undefined) 
              : (slot.periodData.teacherId || undefined),
            roomId: slot.periodData.roomId || undefined,
            startTime: slot.periodData.startTime,
            endTime: slot.periodData.endTime,
          },
        }).unwrap();
        toast.success('Period updated successfully');
      } else {
        // Check if the selected class has a classArmId (ClassArm-based class)
        const hasClassArmId = selectedClass?.classArmId;
        
        await createPeriod({
          schoolId,
          data: {
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.period.startTime,
            endTime: slot.period.endTime,
            type: slot.period.type as PeriodType,
            subjectId: currentType !== 'TERTIARY' ? subjectId : undefined,
            courseId: currentType === 'TERTIARY' ? courseId : undefined,
            // Include teacherId for SECONDARY schools
            teacherId: currentType === 'SECONDARY' ? teacherId : undefined,
            // Use classArmId if the class has one, otherwise use classId
            ...(hasClassArmId 
              ? { classArmId: selectedClassId }
              : { classId: selectedClassId }
            ),
            termId: selectedTermId,
          },
        }).unwrap();
        toast.success('Period created successfully');
      }
      // Refetch to update the UI with new times
      await refetchTimetable();
      refetchTimetables();
    } catch (error: any) {
      if (error?.status === 409) {
        toast.error(error?.data?.message || 'Conflict detected: Teacher or room already booked');
      } else {
        toast.error(error?.data?.message || 'Failed to save period');
      }
    }
  };

  const handlePeriodDelete = async (periodId: string) => {
    if (!schoolId) return;
    try {
      await deletePeriod({ schoolId, periodId }).unwrap();
      toast.success('Period deleted successfully');
      refetchTimetable();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete period');
    }
  };

  const handleAutoGenerate = async (generatedPeriods: Array<{
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    type: 'LESSON' | 'BREAK' | 'LUNCH' | 'ASSEMBLY';
    subjectId?: string;
    subjectName?: string;
    courseId?: string;
    courseName?: string;
  }>) => {
    if (!schoolId || !selectedClassId || !selectedTermId) return;

    try {
      // Create a map of existing periods with their IDs for updates
      const existingMap = new Map<string, TimetablePeriod>();
      timetable.forEach((period) => {
        const key = `${period.dayOfWeek}-${period.startTime}-${period.endTime}`;
        existingMap.set(key, period);
      });

      let createdCount = 0;
      let updatedCount = 0;
      
      for (const period of generatedPeriods) {
        const key = `${period.dayOfWeek}-${period.startTime}-${period.endTime}`;
        const existingPeriod = existingMap.get(key);
        
        if (existingPeriod) {
          // Period exists - check if we need to update it
          const existingHasSubject = existingPeriod.subjectId || existingPeriod.courseId;
          const newHasSubject = period.subjectId || period.courseId;
          
          // Only update if:
          // 1. Existing period has no subject (is a free period) AND new period has a subject
          // 2. Or it's a break/lunch/assembly type update
          if ((!existingHasSubject && newHasSubject) || period.type !== 'LESSON') {
            await updatePeriod({
              schoolId,
              periodId: existingPeriod.id,
              data: {
                type: period.type as PeriodType,
                subjectId: currentType !== 'TERTIARY' ? period.subjectId : undefined,
                courseId: currentType === 'TERTIARY' ? period.courseId : undefined,
              },
            }).unwrap();
            updatedCount++;
          }
        } else {
          // Period doesn't exist - create new one
          // Check if the selected class has a classArmId (ClassArm-based class)
          const hasClassArmId = selectedClass?.classArmId;
          
          await createPeriod({
            schoolId,
            data: {
              dayOfWeek: period.dayOfWeek,
              startTime: period.startTime,
              endTime: period.endTime,
              type: period.type as PeriodType,
              subjectId: currentType !== 'TERTIARY' ? period.subjectId : undefined,
              courseId: currentType === 'TERTIARY' ? period.courseId : undefined,
              // Use classArmId if the class has one, otherwise use classId
              ...(hasClassArmId 
                ? { classArmId: selectedClassId }
                : { classId: selectedClassId }
              ),
              termId: selectedTermId,
            },
          }).unwrap();
          createdCount++;
        }
      }

      const totalChanges = createdCount + updatedCount;
      if (totalChanges > 0) {
        toast.success(`Timetable generated! ${createdCount} created, ${updatedCount} updated.`);
      } else {
        toast.success('Timetable is already up to date!');
      }
      await refetchTimetable();
      refetchTimetables();
    } catch (error: any) {
      if (error?.status === 409) {
        toast.error(error?.data?.message || 'Conflict detected');
      } else {
        toast.error(error?.data?.message || 'Failed to generate timetable');
      }
    }
  };

  // ============================================
  // SECONDARY-SPECIFIC HANDLERS
  // ============================================

  /**
   * Handle teacher selection request from TimetableBuilder
   * Shows the teacher selection popup
   */
  const handleTeacherSelectionNeeded = useCallback((request: TeacherSelectionState) => {
    if (request.teachers.length === 0) {
      // No teachers - show warning
      toast.error(
        `No teachers assigned to "${request.subject.name}". Add teachers in the Subjects page first.`,
        { duration: 5000 }
      );
      return;
    }
    setTeacherSelectionState(request);
  }, []);

  /**
   * Handle teacher selection from popup
   */
  const handleTeacherSelect = useCallback(async (teacherId: string, applyToAllSubjectPeriods: boolean) => {
    if (!teacherSelectionState || !schoolId) return;
    
    const { slot, subject } = teacherSelectionState;
    
    // Close popup first
    setTeacherSelectionState(null);
    
    if (applyToAllSubjectPeriods) {
      // Apply teacher to ALL periods of this subject in the timetable
      const periodsToUpdate = timetable.filter(
        (period) => period.subjectId === subject.id && period.teacherId !== teacherId
      );
      
      if (periodsToUpdate.length === 0) {
        // Only the current period needs updating
        await handlePeriodUpdate(slot, subject.id, undefined, teacherId);
      } else {
        // Update all periods with this subject
        let updatedCount = 0;
        for (const period of periodsToUpdate) {
          try {
            await updatePeriod({
              schoolId,
              periodId: period.id,
              data: { teacherId },
            }).unwrap();
            updatedCount++;
          } catch (error) {
            console.error(`Failed to update period ${period.id}:`, error);
          }
        }
        
        // Also update the current slot if it's new (no periodId)
        if (!slot.periodData?.id) {
          await handlePeriodUpdate(slot, subject.id, undefined, teacherId);
        }
        
        toast.success(`Assigned teacher to ${updatedCount + 1} ${subject.name} periods`);
        await refetchTimetable();
      }
    } else {
      // Apply only to this period
      await handlePeriodUpdate(slot, subject.id, undefined, teacherId);
    }
    
    // Refetch subjects to update teacher workload counts
    if (currentType === 'SECONDARY') {
      refetchSubjects();
    }
  }, [teacherSelectionState, handlePeriodUpdate, currentType, refetchSubjects, timetable, schoolId, updatePeriod, refetchTimetable]);

  /**
   * Handle editing teacher for an existing period (SECONDARY)
   */
  const handleEditPeriodTeacher = useCallback((period: TimetablePeriod, teachers: TeacherWithWorkload[]) => {
    if (!period.subjectId || !period.subjectName) return;
    
    // Create a "slot" from the period for reusing the teacher selection popup
    const slot: TimetableSlot = {
      dayOfWeek: period.dayOfWeek,
      period: {
        startTime: period.startTime,
        endTime: period.endTime,
        type: period.type || 'LESSON',
      },
      periodData: period,
    };
    
    setTeacherSelectionState({
      slot,
      subject: { id: period.subjectId, name: period.subjectName },
      teachers,
    });
  }, []);

  /**
   * Handle auto-generate with teacher preview (SECONDARY)
   */
  const handleAutoGenerateWithPreview = useCallback(async (generatedPeriods: GeneratedPeriodWithTeacher[]) => {
    if (currentType === 'SECONDARY') {
      // Show preview modal instead of directly applying
      setPreviewPeriods(generatedPeriods);
      setShowPreviewModal(true);
    } else {
      // PRIMARY/TERTIARY: Apply directly (existing behavior)
      await handleAutoGenerate(generatedPeriods);
    }
  }, [currentType, handleAutoGenerate]);

  /**
   * Apply previewed timetable (from preview modal)
   */
  const handleApplyPreview = useCallback(async (periods: GeneratedPeriodWithTeacher[]) => {
    if (!schoolId || !selectedClassId || !selectedTermId) return;
    
    setIsApplyingPreview(true);
    
    try {
      const existingMap = new Map<string, TimetablePeriod>();
      timetable.forEach((period) => {
        const key = `${period.dayOfWeek}-${period.startTime}-${period.endTime}`;
        existingMap.set(key, period);
      });

      let createdCount = 0;
      let updatedCount = 0;
      
      // Get selected class to check if it has classArmId
      const currentSelectedClass = classes.find((c) => c.id === selectedClassId);
      const hasClassArmId = currentSelectedClass?.classArmId;
      
      for (const period of periods) {
        if (period.type !== 'LESSON') continue;
        
        const key = `${period.dayOfWeek}-${period.startTime}-${period.endTime}`;
        const existingPeriod = existingMap.get(key);
        
        if (existingPeriod) {
          const existingHasSubject = existingPeriod.subjectId || existingPeriod.courseId;
          const newHasSubject = period.subjectId || period.courseId;
          
          // Only update if existing is empty or we have new data
          if (!existingHasSubject && newHasSubject) {
            await updatePeriod({
              schoolId,
              periodId: existingPeriod.id,
              data: {
                type: period.type as PeriodType,
                subjectId: period.subjectId,
                teacherId: period.teacherId,
              },
            }).unwrap();
            updatedCount++;
          }
        } else if (period.subjectId) {
          await createPeriod({
            schoolId,
            data: {
              dayOfWeek: period.dayOfWeek,
              startTime: period.startTime,
              endTime: period.endTime,
              type: period.type as PeriodType,
              subjectId: period.subjectId,
              teacherId: period.teacherId,
              ...(hasClassArmId 
                ? { classArmId: selectedClassId }
                : { classId: selectedClassId }
              ),
              termId: selectedTermId,
            },
          }).unwrap();
          createdCount++;
        }
      }

      const totalChanges = createdCount + updatedCount;
      if (totalChanges > 0) {
        toast.success(`Timetable applied! ${createdCount} created, ${updatedCount} updated.`);
      } else {
        toast.success('Timetable is already up to date!');
      }
      
      await refetchTimetable();
      refetchTimetables();
      setShowPreviewModal(false);
      setPreviewPeriods([]);
    } catch (error: any) {
      if (error?.status === 409) {
        toast.error(error?.data?.message || 'Conflict detected');
      } else {
        toast.error(error?.data?.message || 'Failed to apply timetable');
      }
    } finally {
      setIsApplyingPreview(false);
    }
  }, [
    schoolId, selectedClassId, selectedTermId, timetable, classes,
    updatePeriod, createPeriod, refetchTimetable, refetchTimetables
  ]);

  // Use enhanced auto-generate hook for SECONDARY
  const { 
    generateTimetable: generateWithTeachers, 
    analyzeGeneration,
    subjectsWithoutTeachers,
    requiresTeacherAssignment,
  } = useAutoGenerateWithTeachers({
    schoolType: currentType,
    subjects: subjects.map(s => ({
      id: s.id,
      name: s.name,
      code: s.code,
      type: 'subject' as const,
      teachers: s.teachers,
    })),
    existingPeriods: timetable,
  });

  const handleDeleteTimetable = async () => {
    if (!schoolId || !deleteConfirmModal) return;
    try {
      await deleteTimetable({
        schoolId,
        classId: deleteConfirmModal.classId,
        termId: deleteConfirmModal.termId,
      }).unwrap();
      toast.success('Timetable deleted successfully');
      setDeleteConfirmModal(null);
      setSelectedClassId('');
      refetchTimetables();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete timetable');
    }
  };

  const handleBulkSave = async (periods: Array<{
    id?: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    subjectId?: string;
    courseId?: string;
    type: 'LESSON' | 'BREAK' | 'LUNCH' | 'ASSEMBLY';
  }>) => {
    if (!schoolId || !selectedClassId || !selectedTermId) return;

    try {
      // Get all existing period IDs
      const existingPeriodIds = new Set(timetable.map((p) => p.id));
      const updatedPeriodIds = new Set(periods.filter((p) => p.id).map((p) => p.id!));

      // Delete periods that are no longer in the edited list
      const periodsToDelete = timetable.filter((p) => !updatedPeriodIds.has(p.id));
      for (const period of periodsToDelete) {
        await deletePeriod({ schoolId, periodId: period.id }).unwrap();
      }

      // Update or create periods
      for (const period of periods) {
        if (period.id && existingPeriodIds.has(period.id)) {
          // Update existing period
          await updatePeriod({
            schoolId,
            periodId: period.id,
            data: {
              subjectId: currentType !== 'TERTIARY' ? period.subjectId : undefined,
              courseId: currentType === 'TERTIARY' ? period.courseId : undefined,
              startTime: period.startTime,
              endTime: period.endTime,
              dayOfWeek: period.dayOfWeek,
              type: period.type as PeriodType,
            },
          }).unwrap();
        } else {
          // Create new period
          // Check if the selected class has a classArmId (ClassArm-based class)
          const hasClassArmId = selectedClass?.classArmId;
          
          await createPeriod({
            schoolId,
            data: {
              dayOfWeek: period.dayOfWeek,
              startTime: period.startTime,
              endTime: period.endTime,
              type: period.type as PeriodType,
              subjectId: currentType !== 'TERTIARY' ? period.subjectId : undefined,
              courseId: currentType === 'TERTIARY' ? period.courseId : undefined,
              // Use classArmId if the class has one, otherwise use classId
              ...(hasClassArmId 
                ? { classArmId: selectedClassId }
                : { classId: selectedClassId }
              ),
              termId: selectedTermId,
            },
          }).unwrap();
        }
      }

      toast.success('Timetable updated successfully');
      setIsEditMode(false);
      await refetchTimetable();
      refetchTimetables();
    } catch (error: any) {
      if (error?.status === 409) {
        toast.error(error?.data?.message || 'Conflict detected: Teacher or room already booked');
      } else {
        toast.error(error?.data?.message || 'Failed to save timetable');
      }
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedTerm = allTerms.find((t) => t.id === selectedTermId);

  // Get classes that have timetables
  const classesWithTimetables = useMemo(() => {
    return classes.filter((cls) => {
      const classTimetable = timetablesByClass[cls.id];
      return classTimetable && classTimetable.length > 0;
    });
  }, [classes, timetablesByClass]);

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
              <h1 className="font-bold text-light-text-primary dark:text-dark-text-primary mb-2" style={{ fontSize: 'var(--text-page-title)' }}>
                Timetables
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary" style={{ fontSize: 'var(--text-page-subtitle)' }}>
                Manage class schedules and timetables for {currentType || 'all school types'}
              </p>
            </div>
            <PermissionGate resource={PermissionResource.TIMETABLES} type={PermissionType.WRITE}>
              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Timetable
              </Button>
            </PermissionGate>
          </div>
        </motion.div>

        {/* Timetables List */}
        {selectedTermId ? (
          <>
            <div className="flex justify-end mb-4">
              <Select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                inline
                wrapperClassName="w-auto min-w-[300px]"
                leftIcon={<Calendar className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />}
              >
                <option value="">Select Term...</option>
                {allTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.sessionName} - {term.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {classesWithTimetables.map((cls) => {
              const classTimetable = timetablesByClass[cls.id] || [];
              return (
                <Card
                  key={cls.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => {
                    // Toggle: if already selected, deselect it
                    if (selectedClassId === cls.id) {
                      setSelectedClassId('');
                    } else {
                      setSelectedClassId(cls.id);
                      if (!selectedTermId && activeSessionResponse?.data?.term?.id) {
                        setSelectedTermId(activeSessionResponse.data.term.id);
                      }
                    }
                  }}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{cls.name}</CardTitle>
                      <BookOpen className="h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-light-text-secondary dark:text-dark-text-secondary" style={{ fontSize: 'var(--text-small)' }}>
                        <Clock className="h-4 w-4 mr-2" />
                        {classTimetable.length} periods
                      </div>
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400" style={{ fontSize: 'var(--text-small)' }}>
                        <MousePointerClick className="h-3.5 w-3.5" />
                        <span>Click to expand timetable</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClassId(cls.id);
                            if (!selectedTermId && activeSessionResponse?.data?.term?.id) {
                              setSelectedTermId(activeSessionResponse.data.term.id);
                            }
                          }}
                        >
                          View Timetable
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmModal({
                              classId: cls.id,
                              className: cls.name,
                              termId: selectedTermId,
                            });
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          </>
        ) : (
          <Card>
            <div className="flex justify-end p-4 pb-0">
              <Select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                inline
                wrapperClassName="w-auto min-w-[300px]"
                leftIcon={<Calendar className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />}
              >
                <option value="">Select Term...</option>
                {allTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.sessionName} - {term.name}
                  </option>
                ))}
              </Select>
            </div>
            <CardContent className="py-12 text-center pt-4">
              <Calendar className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
              <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4" style={{ fontSize: 'var(--text-body)' }}>
                Please select a term from the top right to view timetables
              </p>
            </CardContent>
          </Card>
        )}

        {/* Timetable Builder for Selected Class */}
        {selectedClassId && selectedTermId && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Timetable for {selectedClass?.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Timetable
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeleteConfirmModal({
                        classId: selectedClassId,
                        className: selectedClass?.name || '',
                        termId: selectedTermId,
                      });
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Timetable
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/dashboard/school/courses/${selectedClassId}`)}
                  >
                    View Class Details
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTimetable ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary" style={{ fontSize: 'var(--text-body)' }}>
                    Loading timetable...
                  </p>
                </div>
              ) : timetable.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4" style={{ fontSize: 'var(--text-body)' }}>
                    No timetable periods found for {selectedClass?.name}.
                  </p>
                  <PermissionGate resource={PermissionResource.TIMETABLES} type={PermissionType.WRITE}>
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Timetable
                    </Button>
                  </PermissionGate>
                </div>
              ) : (
                <>
                  {/* Drag and drop hint */}
                  <div className="inline-flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <GripVertical className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <p className="text-blue-700 dark:text-blue-300" style={{ fontSize: 'var(--text-small)' }}>
                      <span className="font-medium">Tip:</span> Drag subjects from the left panel and drop them onto the timetable slots to assign them.
                    </p>
                  </div>
                  {/* Show warning for SECONDARY if subjects have no teachers */}
                  {currentType === 'SECONDARY' && subjectsWithoutTeachers.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-300" style={{ fontSize: 'var(--text-body)' }}>
                            Some subjects have no teachers assigned
                          </p>
                          <p className="text-amber-700 dark:text-amber-400 mt-1" style={{ fontSize: 'var(--text-small)' }}>
                            {subjectsWithoutTeachers.map(s => s.name).join(', ')}
                          </p>
                          <Link 
                            href="/dashboard/school/subjects" 
                            className="text-amber-700 dark:text-amber-400 underline hover:no-underline mt-1 inline-block"
                            style={{ fontSize: 'var(--text-small)' }}
                          >
                            Go to Subjects page to add teachers →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <TimetableBuilder
                    schoolType={currentType}
                    subjects={subjects.map((s) => ({ id: s.id, name: s.name, code: s.code, type: 'subject' as const }))}
                    courses={courses.map((c) => ({ id: c.id, name: c.name, code: c.code, type: 'course' as const }))}
                    timetable={timetable}
                    classArmId={''} // Not used when classId is provided
                    termId={selectedTermId}
                    onPeriodUpdate={handlePeriodUpdate}
                    onPeriodDelete={handlePeriodDelete}
                    onAutoGenerate={currentType === 'SECONDARY' ? handleAutoGenerateWithPreview : handleAutoGenerate}
                    isLoading={isCreating || isUpdating || isDeleting}
                    // SECONDARY-specific props
                    subjectsWithTeachers={currentType === 'SECONDARY' ? subjects.map(s => ({
                      id: s.id,
                      name: s.name,
                      code: s.code,
                      type: 'subject' as const,
                      teachers: s.teachers,
                    })) : undefined}
                    onTeacherSelectionNeeded={currentType === 'SECONDARY' ? handleTeacherSelectionNeeded : undefined}
                    onEditPeriodTeacher={currentType === 'SECONDARY' ? handleEditPeriodTeacher : undefined}
                  />
                  {isEditMode && (
                    <EditableTimetableTable
                      timetable={timetable}
                      subjects={subjects}
                      courses={courses}
                      schoolType={currentType}
                      onSave={handleBulkSave}
                      onClose={() => setIsEditMode(false)}
                      isLoading={isUpdating}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create Timetable Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4"
            >
              <p className="font-medium text-light-text-secondary dark:text-dark-text-secondary mb-4" style={{ fontSize: 'var(--text-section-title)' }}>
                Create New Timetable
              </p>
              <div className="space-y-4">
                {/* Classes Selection */}
                {classes.length === 0 ? (
                  <div className="p-4 border border-yellow-500/30 dark:border-yellow-500/30 rounded-lg bg-yellow-50/50 dark:bg-yellow-900/10">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-800 dark:text-yellow-300 mb-1" style={{ fontSize: 'var(--text-body)' }}>
                          No Classes Available
                        </p>
                        <p className="text-yellow-700 dark:text-yellow-400 mb-3" style={{ fontSize: 'var(--text-small)' }}>
                          You need to create or generate classes before creating a timetable.
                        </p>
                        <Link href="/dashboard/school/courses">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                          >
                            <GraduationCap className="h-4 w-4 mr-2" />
                            Go to Classes
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Select
                      label="Select Class"
                      value={newTimetableClassId}
                      onChange={(e) => setNewTimetableClassId(e.target.value)}
                      required
                    >
                      <option value="">Select a class...</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                {/* Terms Selection */}
                {allTerms.length === 0 ? (
                  <div className="p-4 border border-blue-500/30 dark:border-blue-500/30 rounded-lg bg-blue-50/50 dark:bg-blue-900/10">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-blue-800 dark:text-blue-300 mb-1" style={{ fontSize: 'var(--text-body)' }}>
                          No Terms Available
                        </p>
                        <p className="text-blue-700 dark:text-blue-400 mb-3" style={{ fontSize: 'var(--text-small)' }}>
                          You need to start a session and term before creating a timetable. Please go to your school overview to manage sessions.
                        </p>
                        <Link href="/dashboard/school/overview">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Go to Overview
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Select
                      label="Select Term"
                      value={newTimetableTermId}
                      onChange={(e) => setNewTimetableTermId(e.target.value)}
                      required
                    >
                      <option value="">Select a term...</option>
                      {allTerms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.sessionName} - {term.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="primary"
                    onClick={handleCreateTimetable}
                    disabled={isCreatingMaster || !newTimetableClassId || !newTimetableTermId || classes.length === 0 || allTerms.length === 0}
                    className="flex-1"
                  >
                    {isCreatingMaster ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!deleteConfirmModal}
          onClose={() => setDeleteConfirmModal(null)}
          onConfirm={handleDeleteTimetable}
          title="Delete Timetable"
          message={`Are you sure you want to delete the timetable for ${deleteConfirmModal?.className}? This will remove all ${timetablesByClass[deleteConfirmModal?.classId || '']?.length || 0} periods and cannot be undone.`}
          confirmText="Delete Timetable"
          cancelText="Cancel"
          variant="danger"
          isLoading={isDeletingTimetable}
        />

        {/* SECONDARY: Teacher Selection Popup */}
        {teacherSelectionState && (
          <TeacherSelectionPopup
            subject={teacherSelectionState.subject}
            slot={{
              dayOfWeek: teacherSelectionState.slot.dayOfWeek,
              startTime: teacherSelectionState.slot.period.startTime,
              endTime: teacherSelectionState.slot.period.endTime,
            }}
            teachers={teacherSelectionState.teachers}
            onSelect={handleTeacherSelect}
            onCancel={() => setTeacherSelectionState(null)}
            isLoading={isCreating || isUpdating}
          />
        )}

        {/* SECONDARY: Timetable Preview Modal */}
        {showPreviewModal && previewPeriods.length > 0 && (
          <TimetablePreviewModal
            className={selectedClass?.name || 'Unknown Class'}
            periods={previewPeriods}
            analysis={analyzeGeneration(previewPeriods)}
            subjects={subjects.map(s => ({
              id: s.id,
              name: s.name,
              teachers: s.teachers,
            }))}
            onApply={handleApplyPreview}
            onCancel={() => {
              setShowPreviewModal(false);
              setPreviewPeriods([]);
            }}
            isLoading={isApplyingPreview}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
