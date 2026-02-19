'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, GripVertical, X, Loader2, Sparkles } from 'lucide-react';
import { FadeInUp } from '@/components/ui/FadeInUp';
import {
  type TimetablePeriod,
  type DayOfWeek,
  type PeriodType,
} from '@/lib/store/api/schoolAdminApi';
import { getScheduleForSchoolType, getLessonPeriods, type SchedulePeriod } from '@/lib/utils/nigerianSchoolSchedule';
import { useAutoGenerateTimetable } from '@/hooks/useAutoGenerateTimetable';
import { useAutoGenerateWithTeachers } from '@/hooks/useAutoGenerateWithTeachers';

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

interface DraggableSubject {
  id: string;
  name: string;
  code?: string;
  type: 'subject' | 'course' | 'free';
}

export interface TimetableSlot {
  dayOfWeek: DayOfWeek;
  period: { startTime: string; endTime: string; type: string };
  periodData?: TimetablePeriod;
}

interface GeneratedPeriod {
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
  hasTeacherWarning?: boolean;
  warningMessage?: string;
}

// Extended subject type that includes teachers (for SECONDARY)
interface SubjectWithTeachers {
  id: string;
  name: string;
  code?: string;
  type: 'subject' | 'course' | 'free';
  teachers?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    periodCount?: number;
    classCount?: number;
  }>;
}

// Callback for teacher selection in SECONDARY schools
interface TeacherSelectionRequest {
  slot: TimetableSlot;
  subject: { id: string; name: string; code?: string };
  teachers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    periodCount?: number;
    classCount?: number;
  }>;
}

interface TimetableBuilderProps {
  schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
  subjects: DraggableSubject[];
  courses: DraggableSubject[];
  timetable: TimetablePeriod[];
  classArmId: string;
  termId: string;
  onPeriodUpdate: (slot: TimetableSlot, subjectId?: string, courseId?: string, teacherId?: string) => Promise<void>;
  onPeriodDelete: (periodId: string) => Promise<void>;
  onAutoGenerate?: (periods: GeneratedPeriod[]) => Promise<void>;
  isLoading?: boolean;
  readOnly?: boolean; // If true, disable drag-and-drop and editing
  // SECONDARY-specific props
  subjectsWithTeachers?: SubjectWithTeachers[]; // Subjects with teacher info for SECONDARY
  onTeacherSelectionNeeded?: (request: TeacherSelectionRequest) => void; // Callback when teacher selection is needed
  onEditPeriodTeacher?: (period: TimetablePeriod, teachers: TeacherSelectionRequest['teachers']) => void; // Edit existing period's teacher
}

// Draggable Subject/Course Item
function DraggableItem({ item }: { item: DraggableSubject }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 p-3 border rounded-lg cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        item.type === 'free'
          ? 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
          : 'bg-white dark:bg-dark-surface border-light-border dark:border-dark-border'
      }`}
    >
      <GripVertical className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
      <div className="flex-1">
        <p className={`text-sm font-medium ${
          item.type === 'free'
            ? 'text-gray-700 dark:text-gray-300'
            : 'text-light-text-primary dark:text-dark-text-primary'
        }`}>
          {item.name}
        </p>
        {item.code && (
          <p className="text-xs text-light-text-muted dark:text-dark-text-muted">{item.code}</p>
        )}
      </div>
    </div>
  );
}

// Timetable Grid Cell (Droppable)
function TimetableCell({
  slot,
  onCellClick,
  onEditTeacher,
  readOnly = false,
  showEditTeacher = false,
}: {
  slot: TimetableSlot;
  onCellClick: () => void;
  onEditTeacher?: () => void;
  readOnly?: boolean;
  showEditTeacher?: boolean; // For SECONDARY: show edit teacher option
}) {
  const { period, periodData } = slot;
  const slotId = `${slot.dayOfWeek}-${period.startTime}`;
  
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    disabled: period.type !== 'LESSON' || readOnly,
  });

  // Skip rendering for non-lesson periods (breaks, lunch, assembly)
  if (period.type !== 'LESSON') {
    return null; // Will be handled in parent row
  }

  const hasSubject = periodData?.subjectId || periodData?.courseId;
  const isFree = periodData?.subjectName === 'Free Period' || (periodData && !hasSubject);

  return (
    <td
      ref={setNodeRef}
      onClick={readOnly ? undefined : onCellClick}
      className={`py-4 px-4 min-w-[140px] ${readOnly ? '' : 'cursor-pointer'} transition-colors ${
        isOver && !readOnly
          ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 border-dashed'
          : periodData
            ? readOnly 
              ? 'bg-blue-50 dark:bg-blue-900/30'
              : 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
            : readOnly
              ? 'bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border'
              : 'bg-white dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-dark-surface/80 border border-light-border dark:border-dark-border'
      }`}
    >
      {periodData ? (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
            {periodData.subjectName || periodData.courseName || 'Free Period'}
          </p>
          {/* Show teacher or "No teacher" for SECONDARY */}
          {showEditTeacher && hasSubject && !isFree ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTeacher?.();
              }}
              className="flex items-center gap-1 text-sm hover:underline transition-colors group"
            >
              {periodData.teacherName ? (
                <span className="text-light-text-secondary dark:text-dark-text-secondary group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {periodData.teacherName}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300">
                  + Assign teacher
                </span>
              )}
            </button>
          ) : periodData.teacherName ? (
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {periodData.teacherName}
            </p>
          ) : null}
          {periodData.roomName && (
            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
              {periodData.roomName}
            </p>
          )}
        </div>
      ) : (
        <div className="text-sm text-light-text-muted dark:text-dark-text-muted text-center py-3">
          {readOnly ? '' : 'Drop here'}
        </div>
      )}
    </td>
  );
}

export function TimetableBuilder({
  schoolType,
  subjects,
  courses,
  timetable,
  classArmId,
  termId,
  onPeriodUpdate,
  onPeriodDelete,
  onAutoGenerate,
  isLoading = false,
  readOnly = false,
  // SECONDARY-specific props
  subjectsWithTeachers,
  onTeacherSelectionNeeded,
  onEditPeriodTeacher,
}: TimetableBuilderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  // Basic auto-generate hook (for PRIMARY/TERTIARY)
  const { 
    generateTimetable: generateBasic, 
    canGenerate: canGenerateBasic 
  } = useAutoGenerateTimetable({
    schoolType,
    subjects: subjects.filter(s => s.type !== 'free').map(s => ({ id: s.id, name: s.name, code: s.code })),
    courses: courses.filter(c => c.type !== 'free').map(c => ({ id: c.id, name: c.name, code: c.code })),
    existingPeriods: timetable,
  });

  // Enhanced auto-generate hook with teacher assignment (for SECONDARY)
  const { 
    generateTimetable: generateWithTeachers, 
    canGenerate: canGenerateWithTeachers 
  } = useAutoGenerateWithTeachers({
    schoolType,
    subjects: subjectsWithTeachers || subjects.filter(s => s.type !== 'free').map(s => ({ 
      id: s.id, 
      name: s.name, 
      code: s.code 
    })),
    existingPeriods: timetable,
  });

  // Use appropriate generator based on school type
  const generateTimetable = schoolType === 'SECONDARY' ? generateWithTeachers : generateBasic;
  const canGenerate = schoolType === 'SECONDARY' ? canGenerateWithTeachers : canGenerateBasic;

  const handleAutoGenerate = async () => {
    if (!onAutoGenerate) return;
    
    setIsAutoGenerating(true);
    try {
      const generatedPeriods = generateTimetable();
      await onAutoGenerate(generatedPeriods);
      setShowAutoGenerateModal(false);
    } catch (error) {
      console.error('Failed to auto-generate timetable:', error);
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const schedule = useMemo(() => getScheduleForSchoolType(schoolType), [schoolType]);
  const lessonPeriods = useMemo(() => getLessonPeriods(schedule), [schedule]);

  // Get items based on school type, including "Free Period"
  const draggableItems = useMemo(() => {
    const freePeriod: DraggableSubject = {
      id: 'FREE_PERIOD',
      name: 'Free Period',
      type: 'free',
    };
    
    let items: DraggableSubject[];
    if (schoolType === 'TERTIARY') {
      items = courses;
    } else {
      items = subjects;
    }
    
    return [freePeriod, ...items];
  }, [schoolType, subjects, courses]);

  // Create timetable grid - index by day and startTime
  const timetableGrid = useMemo(() => {
    const grid: Record<string, Record<string, TimetablePeriod>> = {};
    timetable.forEach((period) => {
      if (!grid[period.dayOfWeek]) {
        grid[period.dayOfWeek] = {};
      }
      grid[period.dayOfWeek][period.startTime] = period;
    });
    return grid;
  }, [timetable]);

  // Get all unique time periods from timetable data (sorted by start time)
  // ONLY include periods that exist in the database - don't add from schedule template
  const allTimePeriods = useMemo(() => {
    const timeSet = new Set<string>();
    
    // Only add periods from the database (timetable)
    timetable.forEach((period) => {
      timeSet.add(`${period.startTime}-${period.endTime}`);
    });
    
    return Array.from(timeSet)
      .map((timeStr) => {
        const [startTime, endTime] = timeStr.split('-');
        return { startTime, endTime };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timetable]);

  // Create slots for the grid - based on actual timetable periods
  const slots = useMemo(() => {
    const allSlots: TimetableSlot[] = [];
    allTimePeriods.forEach((timePeriod) => {
      DAYS.forEach((day) => {
        const periodData = timetableGrid[day]?.[timePeriod.startTime];
        if (periodData) {
          allSlots.push({
            dayOfWeek: day,
            period: {
              startTime: timePeriod.startTime,
              endTime: timePeriod.endTime,
              type: periodData.type || 'LESSON',
            },
            periodData,
          });
        }
      });
    });
    return allSlots;
  }, [allTimePeriods, timetableGrid]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const draggedItem = draggableItems.find((item) => item.id === active.id);
    if (!draggedItem) return;

    // Parse the drop target ID (format: "DAY-STARTTIME")
    const overId = over.id as string;
    const [dayOfWeek, startTime] = overId.split('-');

    // Find the slot that was dropped on
    const slot = slots.find(
      (s) => s.dayOfWeek === dayOfWeek && s.period.startTime === startTime
    );

    if (slot && slot.period.type === 'LESSON') {
      // Handle "Free Period" - create period without subject/course
      if (draggedItem.id === 'FREE_PERIOD') {
        await onPeriodUpdate(slot, undefined, undefined);
      } else if (schoolType === 'TERTIARY') {
        await onPeriodUpdate(slot, undefined, draggedItem.id);
      } else if (schoolType === 'SECONDARY' && subjectsWithTeachers && onTeacherSelectionNeeded) {
        // SECONDARY: Find subject with teachers and request selection
        const subjectWithTeachers = subjectsWithTeachers.find(s => s.id === draggedItem.id);
        const teachers = subjectWithTeachers?.teachers || [];
        
        if (teachers.length === 0) {
          // No teachers available - show warning via callback
          onTeacherSelectionNeeded({
            slot,
            subject: { id: draggedItem.id, name: draggedItem.name, code: draggedItem.code },
            teachers: [],
          });
        } else if (teachers.length === 1) {
          // Only one teacher - auto-assign
          await onPeriodUpdate(slot, draggedItem.id, undefined, teachers[0].id);
        } else {
          // Multiple teachers - request selection via callback
          onTeacherSelectionNeeded({
            slot,
            subject: { id: draggedItem.id, name: draggedItem.name, code: draggedItem.code },
            teachers,
          });
        }
      } else {
        // PRIMARY or SECONDARY without teacher info: direct update
        await onPeriodUpdate(slot, draggedItem.id, undefined);
      }
    }
  };

  const activeItem = activeId ? draggableItems.find((item) => item.id === activeId) : null;

  // If read-only, render without DndContext and without sidebar
  if (readOnly) {
    return (
      <div className="w-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Timetable</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-light-text-muted dark:text-dark-text-muted" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary border-b-2 border-light-border dark:border-dark-border">
                        Time
                      </th>
                      {DAYS.map((day) => (
                        <th
                          key={day}
                          className="text-left py-4 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary border-b-2 border-light-border dark:border-dark-border"
                        >
                          {DAY_LABELS[day]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-border dark:divide-dark-border">
                    {allTimePeriods.map((timePeriod) => {
                      // Check if this is a break/lunch/assembly period (no lesson periods for this time)
                      const hasLessons = DAYS.some((day) => {
                        const period = timetableGrid[day]?.[timePeriod.startTime];
                        return period && period.type === 'LESSON';
                      });
                      
                      // Check if there are database periods of break/lunch/assembly type at this time
                      // ONLY show break/lunch/assembly if they exist in the database
                      const dbBreakPeriods = timetable.filter(
                        (p) => p.startTime === timePeriod.startTime && 
                               p.endTime === timePeriod.endTime && 
                               p.type !== 'LESSON'
                      );

                      // Determine the break type from database only
                      const breakType = dbBreakPeriods.length > 0 ? dbBreakPeriods[0].type : null;
                      
                      const breakLabel = breakType === 'BREAK' ? 'Break' : 
                                        breakType === 'LUNCH' ? 'Lunch' : 
                                        breakType === 'ASSEMBLY' ? 'Assembly' : 
                                        'Break';

                      // Only show break/lunch/assembly row if it exists in the database
                      if (dbBreakPeriods.length > 0 && !hasLessons) {
                        return (
                          <tr key={`${timePeriod.startTime}-${breakType || 'break'}`}>
                            <td className="py-4 px-4 text-sm font-medium text-light-text-primary dark:text-dark-text-primary whitespace-nowrap">
                              <span>{timePeriod.startTime} - {timePeriod.endTime}</span>
                            </td>
                            <td
                              colSpan={DAYS.length}
                              className="py-4 px-4 text-center text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary bg-gray-50 dark:bg-dark-surface/50"
                            >
                              {breakLabel}
                            </td>
                          </tr>
                        );
                      }

                      // Handle lesson periods
                      return (
                        <tr key={timePeriod.startTime}>
                          <td className="py-4 px-4 text-sm font-medium text-light-text-primary dark:text-dark-text-primary whitespace-nowrap">
                            <span>{timePeriod.startTime} - {timePeriod.endTime}</span>
                          </td>
                          {DAYS.map((day) => {
                            const periodData = timetableGrid[day]?.[timePeriod.startTime];
                            const slot: TimetableSlot = {
                              dayOfWeek: day,
                              period: {
                                startTime: timePeriod.startTime,
                                endTime: timePeriod.endTime,
                                type: periodData?.type || 'LESSON',
                              },
                              periodData,
                            };

                            return (
                              <TimetableCell
                                key={`${day}-${timePeriod.startTime}`}
                                slot={slot}
                                onCellClick={() => {}}
                                readOnly={readOnly}
                              />
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Editable mode with drag-and-drop
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar with draggable subjects/courses */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {schoolType === 'TERTIARY' ? 'Courses' : 'Subjects'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* Auto-Fill Button */}
              {onAutoGenerate && canGenerate && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAutoGenerateModal(true)}
                  disabled={isLoading || isAutoGenerating}
                  className="w-full mb-3"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-Fill Timetable
                </Button>
              )}
              
              <SortableContext items={draggableItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-hide">
                  {draggableItems.length === 0 ? (
                    <p className="text-sm text-light-text-muted dark:text-dark-text-muted text-center py-4">
                      No {schoolType === 'TERTIARY' ? 'courses' : 'subjects'} available
                    </p>
                  ) : (
                    draggableItems.map((item) => (
                      <DraggableItem key={item.id} item={item} />
                    ))
                  )}
                </div>
              </SortableContext>
            </CardContent>
          </Card>
        </div>

        {/* Timetable Grid */}
        <div className="col-span-9">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timetable</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-light-text-muted dark:text-dark-text-muted" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left py-4 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary border-b-2 border-light-border dark:border-dark-border">
                          Time
                        </th>
                        {DAYS.map((day) => (
                          <th
                            key={day}
                            className="text-left py-4 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary border-b-2 border-light-border dark:border-dark-border"
                          >
                            {DAY_LABELS[day]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-light-border dark:divide-dark-border">
                      {allTimePeriods.map((timePeriod) => {
                        // Check if this is a break/lunch/assembly period (no lesson periods for this time)
                        const hasLessons = DAYS.some((day) => {
                          const period = timetableGrid[day]?.[timePeriod.startTime];
                          return period && period.type === 'LESSON';
                        });
                        
                        // Check if there are database periods of break/lunch/assembly type at this time
                        // ONLY show break/lunch/assembly if they exist in the database
                        const dbBreakPeriods = timetable.filter(
                          (p) => p.startTime === timePeriod.startTime && 
                                 p.endTime === timePeriod.endTime && 
                                 p.type !== 'LESSON'
                        );

                        // Determine the break type from database only
                        const breakType = dbBreakPeriods.length > 0 ? dbBreakPeriods[0].type : null;
                        
                        const breakLabel = breakType === 'BREAK' ? 'Break' : 
                                          breakType === 'LUNCH' ? 'Lunch' : 
                                          breakType === 'ASSEMBLY' ? 'Assembly' : 
                                          'Break';

                        // Only show break/lunch/assembly row if it exists in the database
                        if (dbBreakPeriods.length > 0 && !hasLessons) {
                          return (
                            <tr key={`${timePeriod.startTime}-${breakType || 'break'}`}>
                              <td className="py-4 px-4 text-sm font-medium text-light-text-primary dark:text-dark-text-primary whitespace-nowrap">
                                <span>{timePeriod.startTime} - {timePeriod.endTime}</span>
                              </td>
                              <td
                                colSpan={DAYS.length}
                                className="py-4 px-4 text-center text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary bg-gray-50 dark:bg-dark-surface/50"
                              >
                                {breakLabel}
                              </td>
                            </tr>
                          );
                        }

                        // Handle lesson periods
                        return (
                          <tr key={timePeriod.startTime}>
                            <td className="py-4 px-4 text-sm font-medium text-light-text-primary dark:text-dark-text-primary whitespace-nowrap">
                              <span>{timePeriod.startTime} - {timePeriod.endTime}</span>
                            </td>
                            {DAYS.map((day) => {
                              const periodData = timetableGrid[day]?.[timePeriod.startTime];
                              const slot: TimetableSlot = {
                                dayOfWeek: day,
                                period: {
                                  startTime: timePeriod.startTime,
                                  endTime: timePeriod.endTime,
                                  type: periodData?.type || 'LESSON',
                                },
                                periodData,
                              };

                              // Get teachers for this subject (for SECONDARY edit)
                              const subjectTeachers = periodData?.subjectId && subjectsWithTeachers
                                ? subjectsWithTeachers.find(s => s.id === periodData.subjectId)?.teachers || []
                                : [];

                              return (
                                <TimetableCell
                                  key={`${day}-${timePeriod.startTime}`}
                                  slot={slot}
                                  onCellClick={() => {
                                    // Cell click handler (no time editing)
                                  }}
                                  onEditTeacher={
                                    schoolType === 'SECONDARY' && periodData && onEditPeriodTeacher
                                      ? () => onEditPeriodTeacher(periodData, subjectTeachers)
                                      : undefined
                                  }
                                  readOnly={readOnly}
                                  showEditTeacher={schoolType === 'SECONDARY' && !readOnly}
                                />
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="p-3 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg shadow-lg">
            <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
              {activeItem.name}
            </p>
          </div>
        ) : null}
      </DragOverlay>

      {/* Auto-Generate Confirmation Modal */}
      {showAutoGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                disabled={isAutoGenerating}
                className="flex-1"
              >
                {isAutoGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowAutoGenerateModal(false)}
                disabled={isAutoGenerating}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </DndContext>
  );
}

