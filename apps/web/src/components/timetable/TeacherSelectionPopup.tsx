'use client';

/**
 * TeacherSelectionPopup.tsx
 * 
 * Modal popup for selecting a teacher when dropping a subject on a timetable slot.
 * Used by SECONDARY schools to assign the right teacher to each period.
 * 
 * Features:
 * - Shows competent teachers with their current workload
 * - Highlights recommended (least loaded) teacher
 * - Option to apply same teacher to all periods of this subject
 * - Visual workload indicators (normal, high, overloaded)
 */

import { useState, useMemo } from 'react';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { X, User, Users, Clock, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { TeacherWithWorkload, WorkloadStatus } from '@/lib/store/api/schoolAdminApi';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface TeacherSelectionPopupProps {
  /** Subject being assigned */
  subject: {
    id: string;
    name: string;
    code?: string;
  };
  /** Slot information */
  slot: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  };
  /** Available teachers for this subject */
  teachers: TeacherWithWorkload[];
  /** Callback when teacher is selected */
  onSelect: (teacherId: string, applyToAllSubjectPeriods: boolean) => void;
  /** Callback when popup is cancelled */
  onCancel: () => void;
  /** Loading state */
  isLoading?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getWorkloadStatus(periodCount: number): WorkloadStatus {
  if (periodCount < 10) return 'LOW';
  if (periodCount <= 25) return 'NORMAL';
  if (periodCount <= 30) return 'HIGH';
  return 'OVERLOADED';
}

function getWorkloadColor(status: WorkloadStatus): string {
  switch (status) {
    case 'LOW':
      return 'text-gray-500 dark:text-gray-400';
    case 'NORMAL':
      return 'text-green-600 dark:text-green-400';
    case 'HIGH':
      return 'text-amber-600 dark:text-amber-400';
    case 'OVERLOADED':
      return 'text-red-600 dark:text-red-400';
  }
}

function getWorkloadBgColor(status: WorkloadStatus): string {
  switch (status) {
    case 'LOW':
      return 'bg-gray-100 dark:bg-gray-800';
    case 'NORMAL':
      return 'bg-green-50 dark:bg-green-900/20';
    case 'HIGH':
      return 'bg-amber-50 dark:bg-amber-900/20';
    case 'OVERLOADED':
      return 'bg-red-50 dark:bg-red-900/20';
  }
}

function getWorkloadLabel(status: WorkloadStatus): string {
  switch (status) {
    case 'LOW':
      return 'Light load';
    case 'NORMAL':
      return 'Normal load';
    case 'HIGH':
      return 'High load';
    case 'OVERLOADED':
      return 'Overloaded';
  }
}

function formatDayOfWeek(day: string): string {
  const days: Record<string, string> = {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday',
  };
  return days[day] || day;
}

// ============================================
// COMPONENT
// ============================================

export function TeacherSelectionPopup({
  subject,
  slot,
  teachers,
  onSelect,
  onCancel,
  isLoading = false,
}: TeacherSelectionPopupProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);

  // Sort teachers by workload (least loaded first)
  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => (a.periodCount || 0) - (b.periodCount || 0));
  }, [teachers]);

  // The recommended teacher is the one with lowest workload
  const recommendedTeacher = sortedTeachers[0];

  const handleConfirm = () => {
    if (selectedTeacherId) {
      onSelect(selectedTeacherId, applyToAll);
    }
  };

  // If no teachers, show warning
  if (teachers.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        >
          <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-6 w-6" />
            <h3 className="text-lg font-semibold">No Teachers Available</h3>
          </div>
          
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
            No teachers are assigned to teach <strong>{subject.name}</strong>. 
            Please add competent teachers in the Subjects page first.
          </p>
          
          <div className="flex gap-3">
            <Button variant="primary" onClick={onCancel} className="flex-1">
              OK
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // If only one teacher, show simpler confirmation with apply-to-all option
  if (teachers.length === 1) {
    const teacher = teachers[0];
    const status = getWorkloadStatus(teacher.periodCount || 0);
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
              Assign Teacher
            </h3>
            <button
              onClick={onCancel}
              className="text-light-text-muted dark:text-dark-text-muted hover:text-light-text-primary dark:hover:text-dark-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              <strong>{subject.name}</strong> • {formatDayOfWeek(slot.dayOfWeek)} {slot.startTime}-{slot.endTime}
            </p>
          </div>

          <div className={cn(
            'p-4 rounded-lg border-2 border-blue-500',
            getWorkloadBgColor(status)
          )}>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                  {teacher.firstName} {teacher.lastName}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5" />
                  <span className={getWorkloadColor(status)}>
                    {teacher.periodCount || 0} periods • {getWorkloadLabel(status)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {status === 'OVERLOADED' && (
            <div className="mt-3 flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>This teacher has a high workload. Consider adding more teachers to this subject.</span>
            </div>
          )}

          {/* Apply to all checkbox */}
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              Use this teacher for all <strong>{subject.name}</strong> periods in this class
            </span>
          </label>

          <div className="flex gap-3 mt-4">
            <Button variant="ghost" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={() => onSelect(teacher.id, applyToAll)}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                applyToAll ? 'Assign to All' : 'Assign'
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Multiple teachers - show selection list
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
              Select Teacher
            </h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
              <strong>{subject.name}</strong> • {formatDayOfWeek(slot.dayOfWeek)} {slot.startTime}-{slot.endTime}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-light-text-muted dark:text-dark-text-muted hover:text-light-text-primary dark:hover:text-dark-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Teacher list */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {sortedTeachers.map((teacher, index) => {
            const status = getWorkloadStatus(teacher.periodCount || 0);
            const isSelected = selectedTeacherId === teacher.id;
            const isRecommended = index === 0;

            return (
              <button
                key={teacher.id}
                onClick={() => setSelectedTeacherId(teacher.id)}
                className={cn(
                  'w-full p-4 rounded-lg border-2 transition-all text-left',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-light-border dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600',
                  getWorkloadBgColor(status)
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center',
                    isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-gray-100 dark:bg-gray-800'
                  )}>
                    {isSelected ? (
                      <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-light-text-primary dark:text-dark-text-primary truncate">
                        {teacher.firstName} {teacher.lastName}
                      </p>
                      {isRecommended && (
                        <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-0.5">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className={getWorkloadColor(status)}>
                        {teacher.periodCount || 0} periods • {getWorkloadLabel(status)}
                      </span>
                      {teacher.classCount !== undefined && (
                        <span className="text-light-text-muted dark:text-dark-text-muted">
                          • {teacher.classCount} classes
                        </span>
                      )}
                    </div>
                  </div>

                  {status === 'OVERLOADED' && (
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  )}
                  {status === 'HIGH' && (
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Apply to all checkbox */}
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            Use this teacher for all <strong>{subject.name}</strong> periods in this class
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleConfirm}
            disabled={!selectedTeacherId || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Assign Teacher
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

