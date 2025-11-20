/**
 * useTeacherAssignment.ts
 * 
 * Business logic hook for managing teacher assignments in timetables.
 * Handles:
 * - Finding competent teachers for a subject
 * - Selecting the least loaded teacher (load balancing)
 * - Tracking workload during timetable generation
 * - Providing warnings for unassigned subjects
 * 
 * This hook separates business logic from UI components.
 */

import { useMemo, useCallback, useState } from 'react';
import type { 
  Subject, 
  TeacherWithWorkload,
  WorkloadStatus,
  DayOfWeek,
} from '@/lib/store/api/schoolAdminApi';

// ============================================
// TYPES
// ============================================

export interface TeacherAssignmentContext {
  /** Subject being assigned */
  subjectId: string;
  subjectName: string;
  /** Available teachers for this subject */
  competentTeachers: TeacherWithWorkload[];
  /** Number of periods already assigned in current generation */
  pendingPeriods: number;
}

export interface AssignmentResult {
  teacherId: string | null;
  teacherName: string | null;
  hasWarning: boolean;
  warningMessage?: string;
}

export interface WorkloadTracker {
  /** Current period count per teacher */
  periodCounts: Map<string, number>;
  /** Get teacher's current load including pending */
  getTeacherLoad: (teacherId: string) => number;
  /** Add periods to a teacher's load */
  addPeriods: (teacherId: string, count: number) => void;
  /** Reset pending counts (after save) */
  reset: () => void;
}

export interface TeacherAssignmentConfig {
  /** School type - determines behavior */
  schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
  /** Available subjects with their competent teachers */
  subjects: Subject[];
  /** Term ID for workload calculation */
  termId?: string;
  /** Workload thresholds */
  thresholds?: {
    low: number;
    normal: number;
    high: number;
  };
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_THRESHOLDS = {
  low: 10,
  normal: 25,
  high: 30,
};

// ============================================
// HOOK
// ============================================

export function useTeacherAssignment(config: TeacherAssignmentConfig) {
  const { schoolType, subjects, thresholds = DEFAULT_THRESHOLDS } = config;
  
  // Track pending assignments during generation (not yet saved)
  const [pendingPeriodCounts, setPendingPeriodCounts] = useState<Map<string, number>>(new Map());

  /**
   * Create a map of subject ID to subject data for quick lookup
   */
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach(s => map.set(s.id, s));
    return map;
  }, [subjects]);

  /**
   * Check if teacher assignment is required for this school type
   */
  const requiresTeacherAssignment = useMemo(() => {
    return schoolType === 'SECONDARY';
  }, [schoolType]);

  /**
   * Get competent teachers for a subject
   */
  const getCompetentTeachers = useCallback((subjectId: string): TeacherWithWorkload[] => {
    const subject = subjectMap.get(subjectId);
    return subject?.teachers || [];
  }, [subjectMap]);

  /**
   * Get total load for a teacher (saved + pending)
   */
  const getTeacherTotalLoad = useCallback((teacher: TeacherWithWorkload): number => {
    const savedPeriods = teacher.periodCount || 0;
    const pendingPeriods = pendingPeriodCounts.get(teacher.id) || 0;
    return savedPeriods + pendingPeriods;
  }, [pendingPeriodCounts]);

  /**
   * Determine workload status based on period count
   */
  const getWorkloadStatus = useCallback((periodCount: number): WorkloadStatus => {
    if (periodCount < thresholds.low) return 'LOW';
    if (periodCount <= thresholds.normal) return 'NORMAL';
    if (periodCount <= thresholds.high) return 'HIGH';
    return 'OVERLOADED';
  }, [thresholds]);

  /**
   * Select the least loaded teacher from a list
   * Returns null if no teachers available
   */
  const selectLeastLoadedTeacher = useCallback((
    teachers: TeacherWithWorkload[],
    excludeTeacherIds: string[] = []
  ): TeacherWithWorkload | null => {
    const availableTeachers = teachers.filter(t => !excludeTeacherIds.includes(t.id));
    
    if (availableTeachers.length === 0) {
      return null;
    }

    if (availableTeachers.length === 1) {
      return availableTeachers[0];
    }

    // Find teacher with lowest total load
    let leastLoaded = availableTeachers[0];
    let minLoad = getTeacherTotalLoad(leastLoaded);

    availableTeachers.forEach(teacher => {
      const load = getTeacherTotalLoad(teacher);
      if (load < minLoad) {
        minLoad = load;
        leastLoaded = teacher;
      }
    });

    return leastLoaded;
  }, [getTeacherTotalLoad]);

  /**
   * Auto-assign a teacher for a subject period
   * Uses load balancing algorithm
   */
  const autoAssignTeacher = useCallback((
    subjectId: string,
    excludeTeacherIds: string[] = []
  ): AssignmentResult => {
    // For non-SECONDARY schools, no teacher assignment at timetable level
    if (!requiresTeacherAssignment) {
      return {
        teacherId: null,
        teacherName: null,
        hasWarning: false,
      };
    }

    const subject = subjectMap.get(subjectId);
    if (!subject) {
      return {
        teacherId: null,
        teacherName: null,
        hasWarning: true,
        warningMessage: 'Subject not found',
      };
    }

    const competentTeachers = subject.teachers || [];

    if (competentTeachers.length === 0) {
      return {
        teacherId: null,
        teacherName: null,
        hasWarning: true,
        warningMessage: `No teachers assigned to ${subject.name}. Add competent teachers first.`,
      };
    }

    const selectedTeacher = selectLeastLoadedTeacher(competentTeachers, excludeTeacherIds);
    
    if (!selectedTeacher) {
      return {
        teacherId: null,
        teacherName: null,
        hasWarning: true,
        warningMessage: `All teachers for ${subject.name} are excluded or unavailable.`,
      };
    }

    // Check if selected teacher is overloaded
    const load = getTeacherTotalLoad(selectedTeacher);
    const status = getWorkloadStatus(load);
    
    return {
      teacherId: selectedTeacher.id,
      teacherName: `${selectedTeacher.firstName} ${selectedTeacher.lastName}`,
      hasWarning: status === 'OVERLOADED',
      warningMessage: status === 'OVERLOADED' 
        ? `${selectedTeacher.firstName} ${selectedTeacher.lastName} has ${load} periods (overloaded)`
        : undefined,
    };
  }, [requiresTeacherAssignment, subjectMap, selectLeastLoadedTeacher, getTeacherTotalLoad, getWorkloadStatus]);

  /**
   * Add pending periods for a teacher (during generation, before save)
   */
  const addPendingPeriods = useCallback((teacherId: string, count: number = 1) => {
    setPendingPeriodCounts(prev => {
      const next = new Map(prev);
      next.set(teacherId, (prev.get(teacherId) || 0) + count);
      return next;
    });
  }, []);

  /**
   * Reset pending period counts (after save)
   */
  const resetPendingCounts = useCallback(() => {
    setPendingPeriodCounts(new Map());
  }, []);

  /**
   * Get subjects that have no competent teachers
   */
  const getSubjectsWithoutTeachers = useMemo(() => {
    if (!requiresTeacherAssignment) return [];
    
    return subjects
      .filter(s => !s.teachers || s.teachers.length === 0)
      .map(s => ({
        subjectId: s.id,
        subjectName: s.name,
        message: `No teachers can teach ${s.name}. Assign teachers in the Subjects page.`,
      }));
  }, [subjects, requiresTeacherAssignment]);

  /**
   * Check if all subjects have at least one competent teacher
   */
  const allSubjectsHaveTeachers = useMemo(() => {
    if (!requiresTeacherAssignment) return true;
    return getSubjectsWithoutTeachers.length === 0;
  }, [requiresTeacherAssignment, getSubjectsWithoutTeachers]);

  /**
   * Get teachers sorted by workload (for display)
   */
  const getTeachersByWorkload = useCallback((teachers: TeacherWithWorkload[]) => {
    return [...teachers].sort((a, b) => getTeacherTotalLoad(a) - getTeacherTotalLoad(b));
  }, [getTeacherTotalLoad]);

  /**
   * Format teacher name with workload info
   */
  const formatTeacherWithLoad = useCallback((teacher: TeacherWithWorkload): string => {
    const load = getTeacherTotalLoad(teacher);
    const status = getWorkloadStatus(load);
    const statusLabel = status === 'OVERLOADED' ? ' ⚠️' : status === 'HIGH' ? ' ⚡' : '';
    return `${teacher.firstName} ${teacher.lastName} (${load} periods)${statusLabel}`;
  }, [getTeacherTotalLoad, getWorkloadStatus]);

  return {
    // State
    requiresTeacherAssignment,
    allSubjectsHaveTeachers,
    subjectsWithoutTeachers: getSubjectsWithoutTeachers,
    
    // Methods
    getCompetentTeachers,
    selectLeastLoadedTeacher,
    autoAssignTeacher,
    getTeacherTotalLoad,
    getWorkloadStatus,
    getTeachersByWorkload,
    formatTeacherWithLoad,
    
    // Pending tracking
    addPendingPeriods,
    resetPendingCounts,
    pendingPeriodCounts,
  };
}

// ============================================
// UTILITY FUNCTIONS (Pure functions for use outside hook)
// ============================================

/**
 * Calculate balanced teacher assignments for a full timetable
 * This is a pure function that can be used for preview/planning
 */
export function calculateBalancedAssignments(
  periods: Array<{ subjectId: string; dayOfWeek: DayOfWeek; startTime: string }>,
  subjects: Subject[],
  existingWorkloads: Map<string, number> = new Map()
): Map<string, { teacherId: string; teacherName: string } | null> {
  const assignments = new Map<string, { teacherId: string; teacherName: string } | null>();
  const workloadTracker = new Map<string, number>(existingWorkloads);
  
  // Create subject map for quick lookup
  const subjectMap = new Map<string, Subject>();
  subjects.forEach(s => subjectMap.set(s.id, s));

  // Group periods by subject for efficient assignment
  const periodsBySubject = new Map<string, typeof periods>();
  periods.forEach(period => {
    const key = period.subjectId;
    if (!periodsBySubject.has(key)) {
      periodsBySubject.set(key, []);
    }
    periodsBySubject.get(key)!.push(period);
  });

  // Assign teachers subject by subject
  periodsBySubject.forEach((subjectPeriods, subjectId) => {
    const subject = subjectMap.get(subjectId);
    if (!subject || !subject.teachers || subject.teachers.length === 0) {
      // Mark all periods for this subject as unassigned
      subjectPeriods.forEach(period => {
        const key = `${period.dayOfWeek}-${period.startTime}`;
        assignments.set(key, null);
      });
      return;
    }

    // For each period, find the least loaded teacher
    subjectPeriods.forEach(period => {
      const key = `${period.dayOfWeek}-${period.startTime}`;
      
      // Find least loaded teacher
      let leastLoaded = subject.teachers![0];
      let minLoad = workloadTracker.get(leastLoaded.id) || leastLoaded.periodCount || 0;

      subject.teachers!.forEach(teacher => {
        const load = workloadTracker.get(teacher.id) || teacher.periodCount || 0;
        if (load < minLoad) {
          minLoad = load;
          leastLoaded = teacher;
        }
      });

      // Assign and update tracker
      assignments.set(key, {
        teacherId: leastLoaded.id,
        teacherName: `${leastLoaded.firstName} ${leastLoaded.lastName}`,
      });
      
      workloadTracker.set(
        leastLoaded.id, 
        (workloadTracker.get(leastLoaded.id) || leastLoaded.periodCount || 0) + 1
      );
    });
  });

  return assignments;
}

/**
 * Analyze proposed assignments and generate warnings
 */
export function analyzeAssignments(
  assignments: Map<string, { teacherId: string; teacherName: string } | null>,
  subjects: Subject[],
  thresholds = DEFAULT_THRESHOLDS
): {
  totalPeriods: number;
  assignedPeriods: number;
  unassignedPeriods: number;
  teacherWorkloads: Array<{ teacherId: string; teacherName: string; periods: number; status: WorkloadStatus }>;
  warnings: string[];
  subjectsWithoutTeachers: string[];
} {
  const teacherPeriodCounts = new Map<string, { name: string; count: number }>();
  let assignedPeriods = 0;
  let unassignedPeriods = 0;
  const subjectsWithoutTeachers = new Set<string>();

  assignments.forEach((assignment, key) => {
    if (assignment) {
      assignedPeriods++;
      const existing = teacherPeriodCounts.get(assignment.teacherId) || { name: assignment.teacherName, count: 0 };
      existing.count++;
      teacherPeriodCounts.set(assignment.teacherId, existing);
    } else {
      unassignedPeriods++;
    }
  });

  // Find subjects without teachers from the subjects list
  subjects.forEach(subject => {
    if (!subject.teachers || subject.teachers.length === 0) {
      subjectsWithoutTeachers.add(subject.name);
    }
  });

  const teacherWorkloads = Array.from(teacherPeriodCounts.entries())
    .map(([teacherId, { name, count }]) => ({
      teacherId,
      teacherName: name,
      periods: count,
      status: (count < thresholds.low ? 'LOW' : 
               count <= thresholds.normal ? 'NORMAL' : 
               count <= thresholds.high ? 'HIGH' : 'OVERLOADED') as WorkloadStatus,
    }))
    .sort((a, b) => b.periods - a.periods);

  const warnings: string[] = [];
  
  teacherWorkloads.forEach(tw => {
    if (tw.status === 'OVERLOADED') {
      warnings.push(`${tw.teacherName} is overloaded with ${tw.periods} periods`);
    }
  });

  if (unassignedPeriods > 0) {
    warnings.push(`${unassignedPeriods} periods have no teacher assigned`);
  }

  return {
    totalPeriods: assignments.size,
    assignedPeriods,
    unassignedPeriods,
    teacherWorkloads,
    warnings,
    subjectsWithoutTeachers: Array.from(subjectsWithoutTeachers),
  };
}

