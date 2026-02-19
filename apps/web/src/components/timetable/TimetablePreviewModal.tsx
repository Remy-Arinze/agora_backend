'use client';

/**
 * TimetablePreviewModal.tsx
 * 
 * Modal for previewing auto-generated timetables before applying.
 * Shows:
 * - Generated timetable grid
 * - Teacher assignments summary
 * - Workload analysis and warnings
 * - Option to edit assignments before applying
 * 
 * Used by SECONDARY schools after auto-generation.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { 
  X, 
  Check, 
  AlertTriangle, 
  Users, 
  Clock, 
  BookOpen,
  ChevronDown,
  ChevronUp,
  Edit2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { 
  DayOfWeek, 
  TeacherWithWorkload,
  WorkloadStatus,
} from '@/lib/store/api/schoolAdminApi';
import type { 
  GeneratedPeriodWithTeacher, 
  GenerationAnalysis,
  TeacherAssignmentSummary,
} from '@/hooks/useAutoGenerateWithTeachers';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface TimetablePreviewModalProps {
  /** Class name for display */
  className: string;
  /** Generated periods */
  periods: GeneratedPeriodWithTeacher[];
  /** Analysis of the generation */
  analysis: GenerationAnalysis;
  /** Available subjects with teachers (for editing) */
  subjects: Array<{
    id: string;
    name: string;
    teachers?: TeacherWithWorkload[];
  }>;
  /** Callback when user applies the timetable */
  onApply: (periods: GeneratedPeriodWithTeacher[]) => void;
  /** Callback when modal is cancelled */
  onCancel: () => void;
  /** Loading state */
  isLoading?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getWorkloadStatusColor(status: WorkloadStatus): string {
  switch (status) {
    case 'LOW':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'NORMAL':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'HIGH':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'OVERLOADED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  }
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  variant = 'default' 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string;
  variant?: 'default' | 'warning' | 'error';
}) {
  return (
    <div className={cn(
      'p-3 rounded-lg border',
      variant === 'warning' && 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      variant === 'error' && 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      variant === 'default' && 'bg-gray-50 dark:bg-gray-800/50 border-light-border dark:border-dark-border'
    )}>
      <div className="flex items-center gap-2">
        <Icon className={cn(
          'h-4 w-4',
          variant === 'warning' && 'text-amber-600 dark:text-amber-400',
          variant === 'error' && 'text-red-600 dark:text-red-400',
          variant === 'default' && 'text-light-text-muted dark:text-dark-text-muted'
        )} />
        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
          {label}
        </span>
      </div>
      <p className={cn(
        'text-lg font-semibold mt-1',
        variant === 'warning' && 'text-amber-700 dark:text-amber-400',
        variant === 'error' && 'text-red-700 dark:text-red-400',
        variant === 'default' && 'text-light-text-primary dark:text-dark-text-primary'
      )}>
        {value}
      </p>
    </div>
  );
}

function TeacherAssignmentRow({ 
  assignment,
  onEdit,
}: { 
  assignment: TeacherAssignmentSummary;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary truncate">
          {assignment.teacherName}
        </p>
        <p className="text-xs text-light-text-muted dark:text-dark-text-muted truncate">
          {assignment.subjectName} • {assignment.periodCount} periods
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          'px-2 py-0.5 text-xs font-medium rounded-full',
          getWorkloadStatusColor(assignment.status)
        )}>
          {assignment.totalLoad} total
        </span>
        {onEdit && (
          <button 
            onClick={onEdit}
            className="p-1 text-light-text-muted hover:text-light-text-primary dark:text-dark-text-muted dark:hover:text-dark-text-primary"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function TimetablePreviewModal({
  className,
  periods,
  analysis,
  subjects,
  onApply,
  onCancel,
  isLoading = false,
}: TimetablePreviewModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [editablePeriods, setEditablePeriods] = useState(periods);

  // Get unique time slots
  const timeSlots = useMemo(() => {
    const slots = new Map<string, { startTime: string; endTime: string }>();
    editablePeriods
      .filter(p => p.type === 'LESSON')
      .forEach(p => {
        const key = `${p.startTime}-${p.endTime}`;
        if (!slots.has(key)) {
          slots.set(key, { startTime: p.startTime, endTime: p.endTime });
        }
      });
    return Array.from(slots.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [editablePeriods]);

  // Get period at specific day and time
  const getPeriodAt = (day: DayOfWeek, startTime: string) => {
    return editablePeriods.find(
      p => p.dayOfWeek === day && p.startTime === startTime && p.type === 'LESSON'
    );
  };

  // Check if there are any warnings
  const hasWarnings = analysis.warnings.length > 0 || analysis.unassignedTeacher > 0;

  const handleApply = () => {
    onApply(editablePeriods);
  };

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(el, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out', clearProps: 'all' });
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={panelRef}
        className="bg-white dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
          <div>
            <h2 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary">
              Timetable Preview: {className}
            </h2>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
              Review the auto-generated timetable before applying
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-light-text-muted dark:text-dark-text-muted hover:text-light-text-primary dark:hover:text-dark-text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard 
              icon={BookOpen} 
              label="Total Periods" 
              value={analysis.totalPeriods} 
            />
            <StatCard 
              icon={Users} 
              label="Teachers Assigned" 
              value={analysis.teachersInvolved} 
            />
            <StatCard 
              icon={Clock} 
              label="Free Periods" 
              value={analysis.freePeriods} 
            />
            <StatCard 
              icon={AlertTriangle} 
              label="Unassigned" 
              value={analysis.unassignedTeacher}
              variant={analysis.unassignedTeacher > 0 ? 'warning' : 'default'}
            />
          </div>

          {/* Warnings */}
          {hasWarnings && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-300">
                    Attention Required
                  </h4>
                  <ul className="mt-2 space-y-1">
                    {analysis.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-amber-700 dark:text-amber-400">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Timetable Grid */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-3">
              Generated Timetable
            </h3>
            <div className="overflow-x-auto border border-light-border dark:border-dark-border rounded-lg">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="py-2 px-3 text-left text-xs font-medium text-light-text-muted dark:text-dark-text-muted border-b border-light-border dark:border-dark-border">
                      Time
                    </th>
                    {DAYS.map(day => (
                      <th 
                        key={day} 
                        className="py-2 px-3 text-center text-xs font-medium text-light-text-muted dark:text-dark-text-muted border-b border-light-border dark:border-dark-border"
                      >
                        {DAY_LABELS[day]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((slot, idx) => (
                    <tr key={`${slot.startTime}-${slot.endTime}`}>
                      <td className="py-2 px-3 text-xs text-light-text-muted dark:text-dark-text-muted border-b border-light-border dark:border-dark-border whitespace-nowrap">
                        {slot.startTime}
                      </td>
                      {DAYS.map(day => {
                        const period = getPeriodAt(day, slot.startTime);
                        const isFree = period?.subjectName === 'Free Period' || (!period?.subjectId && !period?.courseId);
                        const hasWarning = period?.hasTeacherWarning;
                        
                        return (
                          <td 
                            key={day}
                            className={cn(
                              'py-2 px-2 text-center border-b border-light-border dark:border-dark-border',
                              isFree && 'bg-gray-50 dark:bg-gray-800/50',
                              hasWarning && 'bg-amber-50 dark:bg-amber-900/20'
                            )}
                          >
                            {period && !isFree ? (
                              <div className="text-xs">
                                <p className="font-medium text-light-text-primary dark:text-dark-text-primary truncate">
                                  {period.subjectName}
                                </p>
                                {period.teacherName ? (
                                  <p className="text-light-text-muted dark:text-dark-text-muted truncate">
                                    {period.teacherName}
                                  </p>
                                ) : (
                                  <p className="text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>No teacher</span>
                                  </p>
                                )}
                              </div>
                            ) : isFree ? (
                              <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                Free
                              </span>
                            ) : (
                              <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                -
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teacher Assignments - Collapsible */}
          <div className="border border-light-border dark:border-dark-border rounded-lg">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                  Teacher Assignments ({analysis.teachersInvolved})
                </span>
              </div>
              {showDetails ? (
                <ChevronUp className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
              )}
            </button>
            
            {showDetails && (
                <div className="overflow-hidden border-t border-light-border dark:border-dark-border">
                  <div className="p-2 max-h-48 overflow-y-auto">
                    {analysis.teacherAssignments.length > 0 ? (
                      analysis.teacherAssignments.map((assignment, idx) => (
                        <TeacherAssignmentRow 
                          key={`${assignment.teacherId}-${assignment.subjectId}-${idx}`}
                          assignment={assignment}
                        />
                      ))
                    ) : (
                      <p className="py-4 text-center text-sm text-light-text-muted dark:text-dark-text-muted">
                        No teacher assignments
                      </p>
                    )}
                  </div>
                </div>
              )}
          </div>

          {/* Subjects without teachers */}
          {analysis.subjectsWithoutTeachers.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">
                Subjects Without Teachers
              </h4>
              <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                The following subjects have periods without assigned teachers. 
                Add competent teachers in the Subjects page.
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.subjectsWithoutTeachers.map(subject => (
                  <span 
                    key={subject.id}
                    className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs rounded-full"
                  >
                    {subject.name} ({subject.periodCount})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-light-border dark:border-dark-border bg-gray-50 dark:bg-gray-800/50">
          <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
            {hasWarnings ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Review warnings before applying
              </span>
            ) : (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                All teachers assigned successfully
              </span>
            )}
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleApply}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Apply Timetable
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

