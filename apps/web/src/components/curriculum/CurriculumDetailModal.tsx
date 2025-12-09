'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  Clock,
  Edit2,
  Loader2,
  Play,
  Send,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CurriculumStatusBadge } from './CurriculumStatusBadge';
import { CurriculumProgressBar } from './CurriculumProgressBar';
import { useGetCurriculumByIdQuery } from '@/lib/store/api/schoolAdminApi';
import { useCurriculum } from '@/hooks/useCurriculum';
import type { WeekStatus, CurriculumItem } from '@/lib/store/api/schoolAdminApi';

interface CurriculumDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  curriculumId: string;
  canEdit?: boolean;
  onUpdate?: () => void;
  onDelete?: (curriculumId: string) => void;
}

export function CurriculumDetailModal({
  isOpen,
  onClose,
  schoolId,
  curriculumId,
  canEdit = false,
  onUpdate,
  onDelete,
}: CurriculumDetailModalProps) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [markingWeek, setMarkingWeek] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const { data: curriculumResponse, isLoading, refetch } = useGetCurriculumByIdQuery(
    { schoolId, curriculumId },
    { skip: !curriculumId }
  );

  const {
    handleSubmit,
    handleMarkWeekComplete,
    handleMarkWeekInProgress,
    isMutating,
  } = useCurriculum({ schoolId });

  const curriculum = curriculumResponse?.data;

  const handleMarkComplete = async (weekNumber: number) => {
    setMarkingWeek(weekNumber);
    await handleMarkWeekComplete(curriculumId, weekNumber, notes || undefined);
    setMarkingWeek(null);
    setNotes('');
    refetch();
    onUpdate?.();
  };

  const handleStartWeek = async (weekNumber: number) => {
    setMarkingWeek(weekNumber);
    await handleMarkWeekInProgress(curriculumId, weekNumber);
    setMarkingWeek(null);
    refetch();
    onUpdate?.();
  };

  const handleSubmitForApproval = async () => {
    await handleSubmit(curriculumId);
    refetch();
    onUpdate?.();
  };

  const getWeekStatusIcon = (status: WeekStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'IN_PROGRESS':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'SKIPPED':
        return <X className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getWeekStatusColor = (status: WeekStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'IN_PROGRESS':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'SKIPPED':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'border-gray-200 dark:border-gray-700';
    }
  };

  if (isLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Loading..." size="xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Modal>
    );
  }

  if (!curriculum) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <span>{curriculum.subject}</span>
          <CurriculumStatusBadge status={curriculum.status} />
        </div>
      }
      size="xl"
    >
      <div className="space-y-6">
        {/* Header Info */}
        <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-light-border dark:border-dark-border">
          <div>
            <span className="text-xs text-light-text-muted dark:text-dark-text-muted">Teacher</span>
            <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
              {curriculum.teacherName || 'Unknown'}
            </p>
          </div>
          <div>
            <span className="text-xs text-light-text-muted dark:text-dark-text-muted">Term</span>
            <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
              {curriculum.termName || curriculum.academicYear}
            </p>
          </div>
          {curriculum.isNerdcBased && (
            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">NERDC Based</span>
            </div>
          )}
          <div className="ml-auto">
            <CurriculumProgressBar
              completed={curriculum.completedWeeks || 0}
              total={curriculum.totalWeeks || 0}
              size="md"
            />
          </div>
        </div>

        {/* Week List */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {[...curriculum.items]
            .sort((a, b) => (a.weekNumber || a.week || 0) - (b.weekNumber || b.week || 0))
            .map((item) => {
              const weekNumber = item.weekNumber || item.week || 0;
              const isExpanded = expandedWeek === weekNumber;
              const isMarking = markingWeek === weekNumber;

              return (
                <div
                  key={item.id}
                  className={`border-l-4 rounded-lg overflow-hidden transition-all ${getWeekStatusColor(
                    item.status
                  )}`}
                >
                  {/* Week Header */}
                  <button
                    onClick={() => setExpandedWeek(isExpanded ? null : weekNumber)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[var(--light-card)] dark:bg-[var(--dark-surface)] border border-light-border dark:border-dark-border flex items-center justify-center shadow-sm">
                      <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                        W{weekNumber}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary truncate">
                        {item.topic}
                      </h4>
                      <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                        {item.objectives?.length || 0} objectives • {item.activities?.length || 0} activities
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getWeekStatusIcon(item.status)}
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-light-text-muted" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-light-text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Week Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 space-y-4 bg-[var(--light-surface)] dark:bg-[var(--dark-bg)]">
                      {/* Sub-topics */}
                      {item.subTopics && item.subTopics.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-2">
                            Sub-topics
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {item.subTopics.map((topic, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-gray-100 dark:bg-[var(--dark-surface)] rounded text-xs text-light-text-secondary dark:text-dark-text-secondary"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Objectives */}
                      {item.objectives && item.objectives.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-2">
                            Objectives
                          </h5>
                          <ul className="space-y-1">
                            {item.objectives.map((obj, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary"
                              >
                                <span className="text-green-500 mt-1">•</span>
                                {obj}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Activities */}
                      {item.activities && item.activities.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-2">
                            Activities
                          </h5>
                          <ul className="space-y-1">
                            {item.activities.map((activity, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary"
                              >
                                <span className="text-blue-500 mt-1">→</span>
                                {activity}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Resources */}
                      {item.resources && item.resources.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-2">
                            Resources
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {item.resources.map((resource, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded text-xs text-purple-700 dark:text-purple-300"
                              >
                                {resource}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Teacher Notes (if any) */}
                      {item.teacherNotes && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-xs font-semibold">Teacher Notes</span>
                          </div>
                          <p className="text-sm text-amber-800 dark:text-amber-300">{item.teacherNotes}</p>
                        </div>
                      )}

                      {/* Progress Actions */}
                      {canEdit && item.status !== 'COMPLETED' && item.status !== 'SKIPPED' && (
                        <div className="flex items-center gap-3 pt-2 border-t border-light-border dark:border-dark-border">
                          {item.status === 'PENDING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartWeek(weekNumber)}
                              disabled={isMarking}
                            >
                              <Play className="h-4 w-4 mr-1.5" />
                              Start Teaching
                            </Button>
                          )}
                          {item.status === 'IN_PROGRESS' && (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Add notes (optional)"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="flex-1 px-3 py-1.5 text-sm border border-light-border dark:border-dark-border rounded-lg bg-[var(--light-input)] dark:bg-[var(--dark-input)]"
                              />
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleMarkComplete(weekNumber)}
                                disabled={isMarking}
                              >
                                {isMarking ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="h-4 w-4 mr-1.5" />
                                    Mark Complete
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-light-border dark:border-dark-border">
          <div className="flex items-center gap-3">
            {curriculum.status === 'DRAFT' && canEdit && (
              <Button
                variant="primary"
                onClick={handleSubmitForApproval}
                disabled={isMutating}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            )}
            {curriculum.status === 'REJECTED' && curriculum.rejectionReason && (
              <div className="text-sm text-red-600 dark:text-red-400">
                <strong>Rejected:</strong> {curriculum.rejectionReason}
              </div>
            )}
            {canEdit && onDelete && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onDelete(curriculumId);
                }}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

