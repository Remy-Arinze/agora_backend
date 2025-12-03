/**
 * useAutoGenerateWithTeachers.ts
 * 
 * Enhanced timetable auto-generation hook that includes teacher assignment.
 * Builds on useAutoGenerateTimetable and adds:
 * - Teacher assignment for SECONDARY schools
 * - Load balancing algorithm
 * - Workload analysis and warnings
 * - Preview functionality before applying
 * 
 * For PRIMARY schools, this works the same as the basic hook.
 * For TERTIARY schools, this works the same as the basic hook (no per-period teacher).
 */

import { useMemo, useCallback, useState } from 'react';
import { getScheduleForSchoolType, type SchedulePeriod } from '@/lib/utils/nigerianSchoolSchedule';
import type { 
  TimetablePeriod, 
  DayOfWeek,
  Subject as ApiSubject,
  TeacherWithWorkload,
  WorkloadStatus,
} from '@/lib/store/api/schoolAdminApi';

// ============================================
// TYPES
// ============================================

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

// Core subjects that should appear more frequently
const CORE_SUBJECTS = ['english', 'mathematics', 'math', 'basic science', 'science'];

// Workload thresholds
const WORKLOAD_THRESHOLDS = {
  LOW: 10,
  NORMAL: 25,
  HIGH: 30,
};

export interface SubjectWithTeachers {
  id: string;
  name: string;
  code?: string;
  teachers?: TeacherWithWorkload[];
}

export interface GeneratedPeriodWithTeacher {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  type: 'LESSON' | 'BREAK' | 'LUNCH' | 'ASSEMBLY';
  subjectId?: string;
  subjectName?: string;
  courseId?: string;
  courseName?: string;
  // Teacher fields (for SECONDARY)
  teacherId?: string;
  teacherName?: string;
  // Warnings
  hasTeacherWarning?: boolean;
  warningMessage?: string;
}

export interface TeacherAssignmentSummary {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  periodCount: number;
  totalLoad: number; // Including existing + new
  status: WorkloadStatus;
}

export interface GenerationAnalysis {
  totalPeriods: number;
  assignedWithTeacher: number;
  unassignedTeacher: number;
  freePeriods: number;
  subjectsUsed: number;
  teachersInvolved: number;
  teacherAssignments: TeacherAssignmentSummary[];
  subjectsWithoutTeachers: Array<{ id: string; name: string; periodCount: number }>;
  warnings: string[];
}

export interface UseAutoGenerateWithTeachersOptions {
  schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
  subjects: SubjectWithTeachers[];
  courses?: SubjectWithTeachers[];
  existingPeriods: TimetablePeriod[];
  maxSameSubjectPerDay?: number;
  freePeriodsPerDay?: number;
}

export interface UseAutoGenerateWithTeachersReturn {
  /** Generate timetable with teacher assignments */
  generateTimetable: () => GeneratedPeriodWithTeacher[];
  /** Can generate (has subjects/courses) */
  canGenerate: boolean;
  /** Schedule template */
  schedule: SchedulePeriod[];
  /** Analyze generated timetable */
  analyzeGeneration: (periods: GeneratedPeriodWithTeacher[]) => GenerationAnalysis;
  /** Subjects that have no competent teachers */
  subjectsWithoutTeachers: Array<{ id: string; name: string }>;
  /** Whether teacher assignment is required for this school type */
  requiresTeacherAssignment: boolean;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getWorkloadStatus(periodCount: number): WorkloadStatus {
  if (periodCount < WORKLOAD_THRESHOLDS.LOW) return 'LOW';
  if (periodCount <= WORKLOAD_THRESHOLDS.NORMAL) return 'NORMAL';
  if (periodCount <= WORKLOAD_THRESHOLDS.HIGH) return 'HIGH';
  return 'OVERLOADED';
}

function selectLeastLoadedTeacher(
  teachers: TeacherWithWorkload[],
  workloadTracker: Map<string, number>
): TeacherWithWorkload | null {
  if (teachers.length === 0) return null;
  if (teachers.length === 1) return teachers[0];

  let leastLoaded = teachers[0];
  let minLoad = (leastLoaded.periodCount || 0) + (workloadTracker.get(leastLoaded.id) || 0);

  teachers.forEach(teacher => {
    const currentLoad = (teacher.periodCount || 0) + (workloadTracker.get(teacher.id) || 0);
    if (currentLoad < minLoad) {
      minLoad = currentLoad;
      leastLoaded = teacher;
    }
  });

  return leastLoaded;
}

// ============================================
// HOOK
// ============================================

export function useAutoGenerateWithTeachers({
  schoolType,
  subjects,
  courses = [],
  existingPeriods,
  maxSameSubjectPerDay = 2,
  freePeriodsPerDay = 1,
}: UseAutoGenerateWithTeachersOptions): UseAutoGenerateWithTeachersReturn {
  
  const schedule = useMemo(() => getScheduleForSchoolType(schoolType), [schoolType]);
  
  const items = useMemo(() => {
    return schoolType === 'TERTIARY' ? courses : subjects;
  }, [schoolType, subjects, courses]);

  const canGenerate = items.length > 0;

  const requiresTeacherAssignment = schoolType === 'SECONDARY';

  // Create subject map for quick lookup
  const subjectMap = useMemo(() => {
    const map = new Map<string, SubjectWithTeachers>();
    items.forEach(s => map.set(s.id, s));
    return map;
  }, [items]);

  // Find subjects without teachers
  const subjectsWithoutTeachers = useMemo(() => {
    if (!requiresTeacherAssignment) return [];
    return items
      .filter(s => !s.teachers || s.teachers.length === 0)
      .map(s => ({ id: s.id, name: s.name }));
  }, [items, requiresTeacherAssignment]);

  /**
   * Generate timetable with teacher assignments for SECONDARY schools
   */
  const generateTimetable = useCallback((): GeneratedPeriodWithTeacher[] => {
    const result: GeneratedPeriodWithTeacher[] = [];
    
    // Track teacher workloads during generation
    const workloadTracker = new Map<string, number>();
    
    const hasExistingTimetable = existingPeriods.length > 0;
    
    // Convert existing periods
    existingPeriods.forEach((p) => {
      const period: GeneratedPeriodWithTeacher = {
        dayOfWeek: p.dayOfWeek,
        startTime: p.startTime,
        endTime: p.endTime,
        subjectId: p.subjectId || undefined,
        subjectName: p.subjectName || undefined,
        courseId: p.courseId || undefined,
        courseName: p.courseName || undefined,
        teacherId: p.teacherId || undefined,
        teacherName: p.teacherName || undefined,
        type: (p.type as 'LESSON' | 'BREAK' | 'LUNCH' | 'ASSEMBLY') || 'LESSON',
      };
      result.push(period);
      
      // Track existing teacher assignments
      if (p.teacherId) {
        workloadTracker.set(p.teacherId, (workloadTracker.get(p.teacherId) || 0) + 1);
      }
    });
    
    // Helper functions
    const hasSubjectAssigned = (day: DayOfWeek, startTime: string, endTime: string): boolean => {
      return result.some(
        (p) => p.dayOfWeek === day && 
               p.startTime === startTime && 
               p.endTime === endTime &&
               (p.subjectId || p.courseId)
      );
    };

    const hasPeriodAtTime = (day: DayOfWeek, startTime: string, endTime: string): boolean => {
      return result.some(
        (p) => p.dayOfWeek === day && 
               p.startTime === startTime && 
               p.endTime === endTime
      );
    };

    const countSubjectOnDay = (day: DayOfWeek, subjectId: string): number => {
      return result.filter(
        (p) => p.dayOfWeek === day && 
        (p.subjectId === subjectId || p.courseId === subjectId)
      ).length;
    };

    const getPreviousSubject = (day: DayOfWeek, startTime: string): string | undefined => {
      const sortedPeriods = result
        .filter((p) => p.dayOfWeek === day && p.type === 'LESSON' && (p.subjectId || p.courseId))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      const previousPeriods = sortedPeriods.filter((p) => p.startTime < startTime);
      if (previousPeriods.length > 0) {
        const prev = previousPeriods[previousPeriods.length - 1];
        return prev.subjectId || prev.courseId;
      }
      return undefined;
    };

    const updatePeriodInResult = (
      day: DayOfWeek, 
      startTime: string, 
      endTime: string, 
      updates: Partial<GeneratedPeriodWithTeacher>
    ) => {
      const index = result.findIndex(
        (p) => p.dayOfWeek === day && p.startTime === startTime && p.endTime === endTime
      );
      if (index !== -1) {
        result[index] = { ...result[index], ...updates };
        return true;
      }
      return false;
    };

    // Add breaks if new timetable
    if (!hasExistingTimetable) {
      schedule.periods.forEach((period) => {
        if (period.type !== 'LESSON') {
          DAYS.forEach((day) => {
            result.push({
              dayOfWeek: day,
              startTime: period.startTime,
              endTime: period.endTime,
              type: period.type,
            });
          });
        }
      });
    }

    // Get lesson periods
    const existingLessonSlots = new Map<string, { startTime: string; endTime: string }>();
    existingPeriods
      .filter((p) => p.type === 'LESSON' || !p.type)
      .forEach((p) => {
        const key = `${p.startTime}-${p.endTime}`;
        if (!existingLessonSlots.has(key)) {
          existingLessonSlots.set(key, { startTime: p.startTime, endTime: p.endTime });
        }
      });
    
    const lessonPeriods = hasExistingTimetable 
      ? Array.from(existingLessonSlots.values()).sort((a, b) => a.startTime.localeCompare(b.startTime))
      : schedule.periods.filter((p) => p.type === 'LESSON');

    // Create weighted subject pool
    const createWeightedPool = (): { id: string; name: string }[] => {
      const pool: { id: string; name: string }[] = [];
      
      if (items.length === 0) return pool;
      
      items.forEach((item) => {
        const isCore = CORE_SUBJECTS.some((core) => 
          item.name.toLowerCase().includes(core)
        );
        const weight = isCore ? 3 : 2;
        for (let i = 0; i < weight; i++) {
          pool.push({ id: item.id, name: item.name });
        }
      });
      
      return pool;
    };

    // Fill empty slots
    DAYS.forEach((day) => {
      let freePeriodsAddedToday = 0;
      const maxFreeToday = freePeriodsPerDay + (Math.random() > 0.5 ? 1 : 0);
      const totalLessonsToday = lessonPeriods.length;
      
      lessonPeriods.forEach((period, periodIndex) => {
        if (hasSubjectAssigned(day, period.startTime, period.endTime)) {
          return;
        }

        const periodExists = hasPeriodAtTime(day, period.startTime, period.endTime);
        const pool = createWeightedPool();
        
        if (pool.length === 0) {
          if (!periodExists) {
            result.push({
              dayOfWeek: day,
              startTime: period.startTime,
              endTime: period.endTime,
              type: 'LESSON',
              subjectName: 'Free Period',
            });
          }
          return;
        }
        
        // Shuffle pool
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        // Decide if free period
        const shouldBeFree = freePeriodsAddedToday < maxFreeToday && 
                            Math.random() < (maxFreeToday / (totalLessonsToday - periodIndex));

        if (shouldBeFree) {
          freePeriodsAddedToday++;
          if (!periodExists) {
            result.push({
              dayOfWeek: day,
              startTime: period.startTime,
              endTime: period.endTime,
              type: 'LESSON',
              subjectName: 'Free Period',
            });
          }
          return;
        }

        // Find suitable subject
        let selected: { id: string; name: string } | undefined;
        const previousSubject = getPreviousSubject(day, period.startTime);

        for (const candidate of pool) {
          if (candidate.id === previousSubject) continue;
          if (countSubjectOnDay(day, candidate.id) >= maxSameSubjectPerDay) continue;
          selected = candidate;
          break;
        }

        if (!selected && pool.length > 0) {
          selected = pool[0];
        }

        if (selected) {
          const isTertiary = schoolType === 'TERTIARY';
          
          // Build period data
          const periodData: Partial<GeneratedPeriodWithTeacher> = {
            type: 'LESSON',
            subjectId: !isTertiary ? selected.id : undefined,
            subjectName: !isTertiary ? selected.name : undefined,
            courseId: isTertiary ? selected.id : undefined,
            courseName: isTertiary ? selected.name : undefined,
          };

          // For SECONDARY, assign teacher using load balancing
          if (requiresTeacherAssignment && !isTertiary) {
            const subject = subjectMap.get(selected.id);
            const teachers = subject?.teachers || [];
            
            if (teachers.length === 0) {
              periodData.hasTeacherWarning = true;
              periodData.warningMessage = `No teachers assigned to ${selected.name}`;
            } else {
              const selectedTeacher = selectLeastLoadedTeacher(teachers, workloadTracker);
              
              if (selectedTeacher) {
                periodData.teacherId = selectedTeacher.id;
                periodData.teacherName = `${selectedTeacher.firstName} ${selectedTeacher.lastName}`;
                
                // Update tracker
                workloadTracker.set(
                  selectedTeacher.id, 
                  (workloadTracker.get(selectedTeacher.id) || 0) + 1
                );
                
                // Check if overloaded
                const totalLoad = (selectedTeacher.periodCount || 0) + 
                                  (workloadTracker.get(selectedTeacher.id) || 0);
                if (totalLoad > WORKLOAD_THRESHOLDS.HIGH) {
                  periodData.hasTeacherWarning = true;
                  periodData.warningMessage = `${selectedTeacher.firstName} ${selectedTeacher.lastName} has ${totalLoad} periods (high load)`;
                }
              }
            }
          }
          
          if (periodExists) {
            updatePeriodInResult(day, period.startTime, period.endTime, periodData);
          } else {
            result.push({
              dayOfWeek: day,
              startTime: period.startTime,
              endTime: period.endTime,
              ...periodData,
            } as GeneratedPeriodWithTeacher);
          }
        } else if (!periodExists) {
          result.push({
            dayOfWeek: day,
            startTime: period.startTime,
            endTime: period.endTime,
            type: 'LESSON',
            subjectName: 'Free Period',
          });
        }
      });
    });

    // Sort by day and time
    return result.sort((a, b) => {
      const dayOrder = DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek);
      if (dayOrder !== 0) return dayOrder;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [
    schedule, items, schoolType, existingPeriods, 
    maxSameSubjectPerDay, freePeriodsPerDay, 
    requiresTeacherAssignment, subjectMap
  ]);

  /**
   * Analyze generated timetable for warnings and stats
   */
  const analyzeGeneration = useCallback((periods: GeneratedPeriodWithTeacher[]): GenerationAnalysis => {
    const lessonPeriods = periods.filter(p => p.type === 'LESSON');
    const freePeriods = lessonPeriods.filter(p => 
      p.subjectName === 'Free Period' || (!p.subjectId && !p.courseId)
    );
    
    const teacherAssignmentMap = new Map<string, {
      teacherId: string;
      teacherName: string;
      subjects: Map<string, { id: string; name: string; count: number }>;
      totalPeriods: number;
    }>();
    
    const subjectMissingTeacher = new Map<string, { id: string; name: string; count: number }>();
    const usedSubjects = new Set<string>();
    
    let assignedWithTeacher = 0;
    let unassignedTeacher = 0;
    
    lessonPeriods.forEach(period => {
      if (!period.subjectId) return;
      
      usedSubjects.add(period.subjectId);
      
      if (period.teacherId && period.teacherName) {
        assignedWithTeacher++;
        
        if (!teacherAssignmentMap.has(period.teacherId)) {
          teacherAssignmentMap.set(period.teacherId, {
            teacherId: period.teacherId,
            teacherName: period.teacherName,
            subjects: new Map(),
            totalPeriods: 0,
          });
        }
        
        const teacherData = teacherAssignmentMap.get(period.teacherId)!;
        teacherData.totalPeriods++;
        
        if (!teacherData.subjects.has(period.subjectId)) {
          teacherData.subjects.set(period.subjectId, {
            id: period.subjectId,
            name: period.subjectName || 'Unknown',
            count: 0,
          });
        }
        teacherData.subjects.get(period.subjectId)!.count++;
        
      } else if (requiresTeacherAssignment) {
        unassignedTeacher++;
        
        if (!subjectMissingTeacher.has(period.subjectId)) {
          subjectMissingTeacher.set(period.subjectId, {
            id: period.subjectId,
            name: period.subjectName || 'Unknown',
            count: 0,
          });
        }
        subjectMissingTeacher.get(period.subjectId)!.count++;
      }
    });

    // Build teacher assignments summary
    const teacherAssignments: TeacherAssignmentSummary[] = [];
    teacherAssignmentMap.forEach((data) => {
      data.subjects.forEach((subject) => {
        // Find teacher's base load from subject data
        const subjectData = subjectMap.get(subject.id);
        const teacherInfo = subjectData?.teachers?.find(t => t.id === data.teacherId);
        const baseLoad = teacherInfo?.periodCount || 0;
        const totalLoad = baseLoad + data.totalPeriods;
        
        teacherAssignments.push({
          teacherId: data.teacherId,
          teacherName: data.teacherName,
          subjectId: subject.id,
          subjectName: subject.name,
          periodCount: subject.count,
          totalLoad,
          status: getWorkloadStatus(totalLoad),
        });
      });
    });

    // Sort by total load descending
    teacherAssignments.sort((a, b) => b.totalLoad - a.totalLoad);

    // Build warnings
    const warnings: string[] = [];
    
    if (unassignedTeacher > 0) {
      warnings.push(`${unassignedTeacher} periods have no teacher assigned`);
    }
    
    teacherAssignments.forEach(ta => {
      if (ta.status === 'OVERLOADED') {
        warnings.push(`${ta.teacherName} is overloaded with ${ta.totalLoad} periods`);
      } else if (ta.status === 'HIGH') {
        warnings.push(`${ta.teacherName} has high workload (${ta.totalLoad} periods)`);
      }
    });

    subjectMissingTeacher.forEach((subject) => {
      warnings.push(`"${subject.name}" has ${subject.count} periods without a teacher`);
    });

    return {
      totalPeriods: lessonPeriods.length - freePeriods.length,
      assignedWithTeacher,
      unassignedTeacher,
      freePeriods: freePeriods.length,
      subjectsUsed: usedSubjects.size,
      teachersInvolved: teacherAssignmentMap.size,
      teacherAssignments,
      subjectsWithoutTeachers: Array.from(subjectMissingTeacher.values()),
      warnings,
    };
  }, [requiresTeacherAssignment, subjectMap]);

  return {
    generateTimetable,
    canGenerate,
    schedule: schedule.periods,
    analyzeGeneration,
    subjectsWithoutTeachers,
    requiresTeacherAssignment,
  };
}

