'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { X, Save, Loader2, Plus, ChevronDown, Trash2, Sparkles } from 'lucide-react';
import { FadeInUp } from '@/components/ui/FadeInUp';
import {
  type TimetablePeriod,
  type DayOfWeek,
} from '@/lib/store/api/schoolAdminApi';
import { useAutoGenerateTimetable } from '@/hooks/useAutoGenerateTimetable';

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

interface EditablePeriod {
  id?: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  subjectId?: string;
  courseId?: string;
  type: 'LESSON' | 'BREAK' | 'LUNCH' | 'ASSEMBLY';
}

interface EditableTimetableTableProps {
  timetable: TimetablePeriod[];
  subjects: Array<{ id: string; name: string; code?: string }>;
  courses: Array<{ id: string; name: string; code?: string }>;
  schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
  onSave: (periods: EditablePeriod[]) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export function EditableTimetableTable({
  timetable,
  subjects,
  courses,
  schoolType,
  onSave,
  onClose,
  isLoading = false,
}: EditableTimetableTableProps) {
  // Convert timetable to editable format, organized by time slots
  const [editablePeriods, setEditablePeriods] = useState<EditablePeriod[]>(() => {
    return timetable.map((period) => ({
      id: period.id,
      dayOfWeek: period.dayOfWeek,
      startTime: period.startTime,
      endTime: period.endTime,
      subjectId: period.subjectId || undefined,
      courseId: period.courseId || undefined,
      type: period.type || 'LESSON',
    }));
  });

  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);

  // Auto-generate hook
  const { generateTimetable, canGenerate } = useAutoGenerateTimetable({
    schoolType,
    subjects,
    courses,
    existingPeriods: timetable,
  });

  const handleAutoGenerate = () => {
    const generatedPeriods = generateTimetable();
    
    // Convert generated periods to editable format
    const newPeriods: EditablePeriod[] = generatedPeriods.map((p) => ({
      dayOfWeek: p.dayOfWeek,
      startTime: p.startTime,
      endTime: p.endTime,
      type: p.type,
      subjectId: p.subjectId,
      courseId: p.courseId,
    }));

    setEditablePeriods(newPeriods);
    setShowAutoGenerateModal(false);
  };

  // Get all unique time periods
  const timePeriods = useMemo(() => {
    const timeSet = new Set<string>();
    editablePeriods.forEach((period) => {
      timeSet.add(`${period.startTime}-${period.endTime}`);
    });
    return Array.from(timeSet)
      .map((timeStr) => {
        const [startTime, endTime] = timeStr.split('-');
        return { startTime, endTime };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [editablePeriods]);

  // Get periods for a specific day and time
  const getPeriodForDayAndTime = (day: DayOfWeek, startTime: string, endTime: string): EditablePeriod | undefined => {
    return editablePeriods.find(
      (p) => p.dayOfWeek === day && p.startTime === startTime && p.endTime === endTime
    );
  };

  // Update period
  const updatePeriod = (day: DayOfWeek, startTime: string, endTime: string, updates: Partial<EditablePeriod>) => {
    setEditablePeriods((prev) =>
      prev.map((period) => {
        if (period.dayOfWeek === day && period.startTime === startTime && period.endTime === endTime) {
          return { ...period, ...updates };
        }
        return period;
      })
    );
  };

  // Update time for all periods with the same time (for break/lunch/assembly)
  const updateTimeForAllDays = (oldStartTime: string, oldEndTime: string, newStartTime: string, newEndTime: string) => {
    setEditablePeriods((prev) =>
      prev.map((period) => {
        if (period.startTime === oldStartTime && period.endTime === oldEndTime) {
          return { ...period, startTime: newStartTime, endTime: newEndTime };
        }
        return period;
      })
    );
  };

  // Add new period for a day and time
  const addPeriod = (day: DayOfWeek, startTime: string, endTime: string) => {
    const newPeriod: EditablePeriod = {
      dayOfWeek: day,
      startTime,
      endTime,
      type: 'LESSON',
    };
    setEditablePeriods((prev) => [...prev, newPeriod]);
  };

  // Remove period
  const removePeriod = (day: DayOfWeek, startTime: string, endTime: string) => {
    setEditablePeriods((prev) =>
      prev.filter(
        (period) => !(period.dayOfWeek === day && period.startTime === startTime && period.endTime === endTime)
      )
    );
  };

  // Remove all periods of a specific type and time (for break/lunch/assembly)
  const removeBreakPeriod = (startTime: string, endTime: string) => {
    setEditablePeriods((prev) =>
      prev.filter(
        (period) => !(period.startTime === startTime && period.endTime === endTime && period.type !== 'LESSON')
      )
    );
  };

  // Insert a break/lunch/assembly period at a specific position
  // This adds the period for all days at the specified time slot
  const insertBreakPeriod = (insertAfterTime: string | null, type: 'BREAK' | 'LUNCH' | 'ASSEMBLY', startTime: string, endTime: string) => {
    setEditablePeriods((prev) => {
      // Create periods for all days
      const newPeriods: EditablePeriod[] = DAYS.map((day) => ({
        dayOfWeek: day,
        startTime,
        endTime,
        type,
      }));

      // If insertAfterTime is null, insert at the beginning
      if (insertAfterTime === null) {
        return [...newPeriods, ...prev];
      }

      // Find all periods that come after this time (sorted by startTime)
      // We need to insert after all periods with startTime <= insertAfterTime
      const sortedPeriods = [...prev].sort((a, b) => {
        const timeA = a.startTime.localeCompare(b.startTime);
        if (timeA !== 0) return timeA;
        return a.dayOfWeek.localeCompare(b.dayOfWeek);
      });

      // Find the index where we should insert (after all periods with startTime <= insertAfterTime)
      let insertIndex = sortedPeriods.length;
      for (let i = 0; i < sortedPeriods.length; i++) {
        if (sortedPeriods[i].startTime > insertAfterTime) {
          insertIndex = i;
          break;
        }
      }

      // Insert the new periods
      sortedPeriods.splice(insertIndex, 0, ...newPeriods);
      return sortedPeriods;
    });
  };

  const handleSave = async () => {
    await onSave(editablePeriods);
  };

  const isTertiary = schoolType === 'TERTIARY';
  const options = isTertiary ? courses : subjects;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-light-border dark:border-dark-border">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary">
              Edit Timetable
            </h2>
            {canGenerate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAutoGenerateModal(true)}
                disabled={isLoading}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Auto-Fill
              </Button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-light-text-muted dark:text-dark-text-muted hover:text-light-text-primary dark:hover:text-dark-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border px-3 py-3 text-left text-sm font-semibold text-light-text-primary dark:text-dark-text-primary min-w-[200px]">
                    Time
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="border border-light-border dark:border-dark-border px-4 py-3 text-center text-sm font-semibold text-light-text-primary dark:text-dark-text-primary"
                    >
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border px-4 py-3 text-center text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                    Insert
                  </th>
                </tr>
              </thead>
              <tbody>
                {timePeriods.map((timePeriod, timeIndex) => {
                  const periodsAtThisTime = editablePeriods.filter(
                    (p) => p.startTime === timePeriod.startTime && p.endTime === timePeriod.endTime
                  );
                  const isBreakType = periodsAtThisTime.some((p) => p.type !== 'LESSON');
                  const breakType = isBreakType ? periodsAtThisTime[0]?.type : null;

                  // If it's a break/lunch/assembly, show as a single row
                  if (isBreakType && breakType) {
                    return (
                      <tr key={`${timePeriod.startTime}-${breakType}`}>
                        <td className="sticky left-0 z-10 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border px-3 py-3 min-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="time"
                              value={timePeriod.startTime}
                              onChange={(e) => {
                                const newStartTime = e.target.value;
                                updateTimeForAllDays(timePeriod.startTime, timePeriod.endTime, newStartTime, timePeriod.endTime);
                              }}
                              className="w-[90px] px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                            />
                            <span className="text-xs text-light-text-muted">-</span>
                            <input
                              type="time"
                              value={timePeriod.endTime}
                              onChange={(e) => {
                                const newEndTime = e.target.value;
                                updateTimeForAllDays(timePeriod.startTime, timePeriod.endTime, timePeriod.startTime, newEndTime);
                              }}
                              className="w-[90px] px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                            />
                          </div>
                        </td>
                        <td
                          colSpan={DAYS.length}
                          className="border border-light-border dark:border-dark-border px-4 py-3 text-center text-sm bg-gray-50 dark:bg-dark-surface/50"
                        >
                          <div className="flex items-center justify-center gap-3">
                            <span>
                              {breakType === 'BREAK' ? 'Break' : breakType === 'LUNCH' ? 'Lunch' : breakType === 'ASSEMBLY' ? 'Assembly' : ''}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBreakPeriod(timePeriod.startTime, timePeriod.endTime);
                              }}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded transition-colors flex items-center justify-center"
                              title={`Delete ${breakType === 'BREAK' ? 'Break' : breakType === 'LUNCH' ? 'Lunch' : 'Assembly'} period`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="sticky right-0 z-10 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border px-4 py-3">
                          <InsertButton
                            onInsert={(type, startTime, endTime) => {
                              insertBreakPeriod(timePeriod.startTime, type, startTime, endTime);
                            }}
                            previousTime={timeIndex > 0 ? timePeriods[timeIndex - 1].startTime : null}
                          />
                        </td>
                      </tr>
                    );
                  }

                  // Lesson periods
                  return (
                    <tr key={timePeriod.startTime}>
                      <td className="sticky left-0 z-10 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border px-3 py-3 min-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={timePeriod.startTime}
                            onChange={(e) => {
                              const newStartTime = e.target.value;
                              // Update all periods at this time slot
                              editablePeriods
                                .filter((p) => p.startTime === timePeriod.startTime && p.endTime === timePeriod.endTime)
                                .forEach((period) => {
                                  updatePeriod(period.dayOfWeek, timePeriod.startTime, timePeriod.endTime, {
                                    startTime: newStartTime,
                                  });
                                });
                            }}
                            className="w-[90px] px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                          />
                          <span className="text-xs text-light-text-muted">-</span>
                          <input
                            type="time"
                            value={timePeriod.endTime}
                            onChange={(e) => {
                              const newEndTime = e.target.value;
                              // Update all periods at this time slot
                              editablePeriods
                                .filter((p) => p.startTime === timePeriod.startTime && p.endTime === timePeriod.endTime)
                                .forEach((period) => {
                                  updatePeriod(period.dayOfWeek, timePeriod.startTime, timePeriod.endTime, {
                                    endTime: newEndTime,
                                  });
                                });
                            }}
                            className="w-[90px] px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                          />
                        </div>
                      </td>
                      {DAYS.map((day) => {
                        const period = getPeriodForDayAndTime(day, timePeriod.startTime, timePeriod.endTime);
                        return (
                          <td
                            key={day}
                            className="border border-light-border dark:border-dark-border px-3 py-2"
                          >
                            {period ? (
                              <select
                                value={isTertiary ? period.courseId || '' : period.subjectId || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '') {
                                    // Remove period
                                    removePeriod(day, timePeriod.startTime, timePeriod.endTime);
                                  } else if (value === 'FREE_PERIOD') {
                                    // Set as free period
                                    updatePeriod(day, timePeriod.startTime, timePeriod.endTime, {
                                      subjectId: undefined,
                                      courseId: undefined,
                                    });
                                  } else {
                                    // Update subject/course
                                    updatePeriod(day, timePeriod.startTime, timePeriod.endTime, {
                                      subjectId: isTertiary ? undefined : value,
                                      courseId: isTertiary ? value : undefined,
                                    });
                                  }
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                              >
                                <option value="">-- Empty --</option>
                                <option value="FREE_PERIOD">Free Period</option>
                                {options.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name} {option.code ? `(${option.code})` : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value=""
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value && value !== '') {
                                    // Add new period
                                    addPeriod(day, timePeriod.startTime, timePeriod.endTime);
                                    if (value !== 'FREE_PERIOD') {
                                      updatePeriod(day, timePeriod.startTime, timePeriod.endTime, {
                                        subjectId: isTertiary ? undefined : value,
                                        courseId: isTertiary ? value : undefined,
                                      });
                                    }
                                  }
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                              >
                                <option value="">-- Empty --</option>
                                <option value="FREE_PERIOD">Free Period</option>
                                {options.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name} {option.code ? `(${option.code})` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border px-4 py-3">
                        <InsertButton
                          onInsert={(type, startTime, endTime) => {
                            insertBreakPeriod(timePeriod.startTime, type, startTime, endTime);
                          }}
                          previousTime={timeIndex > 0 ? timePeriods[timeIndex - 1].startTime : null}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-light-border dark:border-dark-border">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Auto-Generate Confirmation Modal */}
        {showAutoGenerateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                  Auto-Fill Timetable
                </h3>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  This will automatically fill empty slots with:
                </p>
                <ul className="text-sm text-light-text-secondary dark:text-dark-text-secondary space-y-1 ml-4">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    Random {schoolType === 'TERTIARY' ? 'courses' : 'subjects'} (core subjects appear more often)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    Assembly, Break & Lunch periods
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    1-2 Free periods per day
                  </li>
                </ul>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-3">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Note:</strong> Existing assignments won&apos;t be changed. Only empty slots will be filled.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleAutoGenerate}
                  className="flex-1"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowAutoGenerateModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

// Insert Button Component with dropdown
interface InsertButtonProps {
  onInsert: (type: 'BREAK' | 'LUNCH' | 'ASSEMBLY', startTime: string, endTime: string) => void;
  previousTime: string | null;
}

function InsertButton({ onInsert, previousTime }: InsertButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [insertType, setInsertType] = useState<'BREAK' | 'LUNCH' | 'ASSEMBLY' | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate default times based on previous time
  const getDefaultTimes = () => {
    if (previousTime) {
      // Add 1 hour to previous time
      const [prevHours, prevMinutes] = previousTime.split(':').map(Number);
      const nextHours = prevHours + 1;
      const defaultStart = `${String(nextHours).padStart(2, '0')}:${String(prevMinutes).padStart(2, '0')}`;
      const defaultEnd = `${String(nextHours + 1).padStart(2, '0')}:${String(prevMinutes).padStart(2, '0')}`;
      return { defaultStart, defaultEnd };
    }
    return { defaultStart: '08:00', defaultEnd: '09:00' };
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen && !insertType) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen && !insertType) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, insertType]);

  const handleInsertClick = (type: 'BREAK' | 'LUNCH' | 'ASSEMBLY') => {
    setInsertType(type);
    const { defaultStart, defaultEnd } = getDefaultTimes();
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setIsOpen(false); // Close dropdown, show form
  };

  const handleConfirm = () => {
    if (insertType && startTime && endTime && startTime < endTime) {
      onInsert(insertType, startTime, endTime);
      setIsOpen(false);
      setInsertType(null);
      setStartTime('');
      setEndTime('');
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setInsertType(null);
    setStartTime('');
    setEndTime('');
  };

  // Show time input form if type is selected
  if (insertType) {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <div className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
          Insert {insertType === 'BREAK' ? 'Break' : insertType === 'LUNCH' ? 'Lunch' : 'Assembly'}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-[85px] px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
          />
          <span className="text-xs text-light-text-muted">-</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-[85px] px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={!startTime || !endTime || startTime >= endTime}
            className="flex-1 text-xs py-1"
          >
            Insert
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="text-xs py-1"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Show dropdown button
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        title="Insert break/lunch/assembly"
      >
        <Plus className="h-3 w-3" />
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !insertType && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded shadow-lg z-20 min-w-[150px]">
          <button
            onClick={() => handleInsertClick('ASSEMBLY')}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Assembly
          </button>
          <button
            onClick={() => handleInsertClick('BREAK')}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Break
          </button>
          <button
            onClick={() => handleInsertClick('LUNCH')}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Lunch
          </button>
        </div>
      )}
    </div>
  );
}

