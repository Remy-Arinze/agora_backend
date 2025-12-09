'use client';

import React, { useState } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Plus, 
  Eye, 
  Edit2, 
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  MoreVertical,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CurriculumStatusBadge } from './CurriculumStatusBadge';
import { CurriculumProgressBar } from './CurriculumProgressBar';
import type { CurriculumSummary } from '@/lib/store/api/schoolAdminApi';

interface SubjectCurriculumCardProps {
  subject: CurriculumSummary;
  onGenerate?: (subjectId: string) => void;
  onCreateManual?: (subjectId: string) => void;
  onView?: (curriculumId: string) => void;
  onEdit?: (curriculumId: string) => void;
  onDelete?: (curriculumId: string) => void;
  canEdit?: boolean;
  isGenerating?: boolean;
  isDeleting?: boolean;
  // Selection props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
}

export function SubjectCurriculumCard({
  subject,
  onGenerate,
  onCreateManual,
  onView,
  onEdit,
  onDelete,
  canEdit = false,
  isGenerating = false,
  isDeleting = false,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPress,
}: SubjectCurriculumCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const hasCurriculum = !!subject.curriculumId;
  const isNerdcAvailable = subject.isNerdcBased || !hasCurriculum; // Can generate from NERDC if not created yet

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode && hasCurriculum) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (hasCurriculum && onLongPress && canEdit) {
      e.preventDefault();
      onLongPress();
    }
  };

  return (
    <div 
      className={`relative bg-[var(--light-card)] dark:bg-[var(--dark-surface)] border rounded-lg p-4 transition-all ${
        isSelected 
          ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20' 
          : 'border-light-border dark:border-dark-border hover:shadow-md hover:bg-[var(--light-hover)] dark:hover:bg-[var(--dark-hover)]'
      } ${isSelectionMode && hasCurriculum ? 'cursor-pointer' : ''}`}
      onClick={handleCardClick}
      onContextMenu={handleContextMenu}
    >
      {/* Selection Checkbox */}
      {isSelectionMode && hasCurriculum && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-300 dark:border-gray-600 bg-[var(--light-card)] dark:bg-[var(--dark-surface)] hover:border-blue-400'
            }`}
          >
            {isSelected && <Check className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isSelected 
              ? 'bg-blue-100 dark:bg-blue-900/50' 
              : 'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {subject.subjectName}
            </h3>
            {subject.subjectCode && (
              <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                {subject.subjectCode}
              </span>
            )}
          </div>
        </div>
        {!isSelectionMode && <CurriculumStatusBadge status={subject.status} />}
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-4 text-xs text-light-text-muted dark:text-dark-text-muted mb-4">
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>{subject.periodsPerWeek} periods/week</span>
        </div>
        {subject.teachers && subject.teachers.length > 0 && (
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>
              {subject.teachers.length === 1
                ? subject.teachers[0].name
                : `${subject.teachers.length} teachers`}
            </span>
          </div>
        )}
      </div>

      {/* Progress or Empty State */}
      {hasCurriculum ? (
        <div className="mb-4">
          <CurriculumProgressBar
            completed={subject.weeksCompleted}
            total={subject.weeksTotal}
          />
          {subject.isNerdcBased && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-purple-600 dark:text-purple-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Based on NERDC template</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mb-4">
          <AlertCircle className="h-4 w-4" />
          <span>No curriculum created yet</span>
        </div>
      )}

      {/* Actions - Hidden in selection mode */}
      {!isSelectionMode && (
        <div className="flex items-center gap-2">
          {hasCurriculum ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView?.(subject.curriculumId!)}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-1.5" />
                View
              </Button>
              {canEdit && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMenu(!showMenu)}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  {showMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-[var(--light-card)] dark:bg-[var(--dark-surface)] border border-light-border dark:border-dark-border rounded-lg shadow-lg py-1">
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            onEdit?.(subject.curriculumId!);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-light-text-primary dark:text-dark-text-primary hover:bg-[var(--light-hover)] dark:hover:bg-[var(--dark-hover)]"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            onDelete?.(subject.curriculumId!);
                          }}
                          disabled={isDeleting}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onGenerate?.(subject.subjectId)}
                disabled={isGenerating}
                className="flex-1"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                {isGenerating ? 'Generating...' : 'Generate from NERDC'}
              </Button>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreateManual?.(subject.subjectId)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Selection Mode Status Badge */}
      {isSelectionMode && hasCurriculum && (
        <div className="flex items-center justify-center pt-2">
          <CurriculumStatusBadge status={subject.status} />
        </div>
      )}
    </div>
  );
}

