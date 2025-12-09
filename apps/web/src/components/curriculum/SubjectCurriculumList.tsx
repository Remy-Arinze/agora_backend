'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Sparkles, 
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SubjectCurriculumCard } from './SubjectCurriculumCard';
import { NoTimetableMessage } from './NoTimetableMessage';
import { GenerateCurriculumModal } from './GenerateCurriculumModal';
import { CurriculumDetailModal } from './CurriculumDetailModal';
import { ConfirmModal } from '@/components/ui/Modal';
import Link from 'next/link';
import { useCurriculum } from '@/hooks/useCurriculum';

interface SubjectCurriculumListProps {
  schoolId: string;
  classLevelId: string;
  termId: string;
  schoolType: string;
  teacherId?: string;
  canEdit?: boolean;
}

export function SubjectCurriculumList({
  schoolId,
  classLevelId,
  termId,
  schoolType,
  teacherId,
  canEdit = false,
}: SubjectCurriculumListProps) {
  const [showGenerateModal, setShowGenerateModal] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);
  const [generatingSubjectId, setGeneratingSubjectId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
    curriculumId: string;
    subjectName: string;
  } | null>(null);
  const [deletingCurriculumId, setDeletingCurriculumId] = useState<string | null>(null);
  
  // Multi-select state
  const [selectedCurricula, setSelectedCurricula] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const {
    curriculaSummary,
    isLoading,
    isMutating,
    handleGenerate,
    handleDelete,
    refetchCurriculaSummary,
    stats,
  } = useCurriculum({
    schoolId,
    classLevelId,
    termId,
    schoolType,
  });

  // Get curricula that can be selected (ones with curriculumId)
  const selectableCurricula = useMemo(() => 
    curriculaSummary.filter(s => s.curriculumId),
    [curriculaSummary]
  );

  const handleGenerateCurriculum = async (subjectId: string) => {
    if (!teacherId) return;
    
    setGeneratingSubjectId(subjectId);
    const result = await handleGenerate({
      classLevelId,
      subjectId,
      termId,
      teacherId,
    });
    setGeneratingSubjectId(null);
    
    if (result) {
      setShowDetailModal(result.id);
    }
  };

  const handleBulkGenerate = async () => {
    // Filter subjects without curriculum
    const subjectsToGenerate = curriculaSummary
      .filter(s => !s.curriculumId)
      .map(s => s.subjectId);
    
    // Open bulk generate modal or call bulk generate
    setShowGenerateModal('bulk');
  };

  const handleDeleteCurriculum = async () => {
    if (!showDeleteConfirm) return;
    
    setDeletingCurriculumId(showDeleteConfirm.curriculumId);
    const success = await handleDelete(showDeleteConfirm.curriculumId);
    setDeletingCurriculumId(null);
    setShowDeleteConfirm(null);
    
    if (success) {
      refetchCurriculaSummary();
    }
  };

  const openDeleteConfirm = (curriculumId: string) => {
    const subject = curriculaSummary.find(s => s.curriculumId === curriculumId);
    if (subject) {
      setShowDeleteConfirm({
        curriculumId,
        subjectName: subject.subjectName,
      });
    }
  };

  // Multi-select handlers
  const toggleSelection = (curriculumId: string) => {
    const newSelected = new Set(selectedCurricula);
    if (newSelected.has(curriculumId)) {
      newSelected.delete(curriculumId);
    } else {
      newSelected.add(curriculumId);
    }
    setSelectedCurricula(newSelected);
    
    // Exit selection mode if nothing selected
    if (newSelected.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCurricula.size === selectableCurricula.length) {
      // Deselect all
      setSelectedCurricula(new Set());
      setIsSelectionMode(false);
    } else {
      // Select all
      setSelectedCurricula(new Set(selectableCurricula.map(s => s.curriculumId!)));
    }
  };

  const cancelSelection = () => {
    setSelectedCurricula(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkDelete = async () => {
    if (selectedCurricula.size === 0) return;
    
    setIsBulkDeleting(true);
    let successCount = 0;
    
    for (const curriculumId of selectedCurricula) {
      const success = await handleDelete(curriculumId);
      if (success) successCount++;
    }
    
    setIsBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setSelectedCurricula(new Set());
    setIsSelectionMode(false);
    refetchCurriculaSummary();
  };

  const enterSelectionMode = (curriculumId?: string) => {
    setIsSelectionMode(true);
    if (curriculumId) {
      setSelectedCurricula(new Set([curriculumId]));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // No timetable configured
  if (curriculaSummary.length === 0) {
    return <NoTimetableMessage classLevelId={classLevelId} />;
  }

  // Count subjects without curriculum
  const emptyCount = curriculaSummary.filter(s => !s.curriculumId).length;

  return (
    <div className="space-y-6">
      {/* Selection Mode Bar */}
      {isSelectionMode && (
        <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200"
            >
              {selectedCurricula.size === selectableCurricula.length ? (
                <CheckSquare className="h-5 w-5" />
              ) : (
                <Square className="h-5 w-5" />
              )}
              {selectedCurricula.size === selectableCurricula.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {selectedCurricula.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={selectedCurricula.size === 0}
              className="text-red-600 hover:text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete ({selectedCurricula.size})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Header Stats */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm">
            <span className="font-medium text-green-600 dark:text-green-400">{stats.approved}</span>
            <span className="text-light-text-muted dark:text-dark-text-muted"> approved</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm">
            <span className="font-medium text-amber-600 dark:text-amber-400">{stats.draft}</span>
            <span className="text-light-text-muted dark:text-dark-text-muted"> in progress</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-sm">
            <span className="font-medium text-gray-600 dark:text-gray-400">{stats.total - stats.created}</span>
            <span className="text-light-text-muted dark:text-dark-text-muted"> not started</span>
          </span>
        </div>
        
        {/* Action Buttons */}
        <div className="ml-auto flex items-center gap-2">
          {/* Select Mode Toggle */}
          {canEdit && selectableCurricula.length > 0 && !isSelectionMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => enterSelectionMode()}
              className="text-light-text-muted dark:text-dark-text-muted"
            >
              <CheckSquare className="h-4 w-4 mr-1.5" />
              Select
            </Button>
          )}
          
          {/* Bulk Generate Button */}
          {canEdit && emptyCount > 0 && !isSelectionMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkGenerate}
              disabled={isMutating}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate All from NERDC ({emptyCount})
            </Button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        <Calendar className="h-4 w-4 flex-shrink-0" />
        <span>
          Showing {curriculaSummary.length} subjects from the class timetable.{' '}
          <Link 
            href="/dashboard/school/timetables" 
            className="underline hover:text-blue-800 dark:hover:text-blue-200"
          >
            Edit timetable
          </Link>
        </span>
      </div>

      {/* Subject Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {curriculaSummary.map((subject) => (
          <SubjectCurriculumCard
            key={subject.subjectId}
            subject={subject}
            onGenerate={handleGenerateCurriculum}
            onView={(curriculumId) => setShowDetailModal(curriculumId)}
            onEdit={(curriculumId) => setShowDetailModal(curriculumId)}
            onDelete={openDeleteConfirm}
            canEdit={canEdit}
            isGenerating={generatingSubjectId === subject.subjectId}
            isDeleting={deletingCurriculumId === subject.curriculumId}
            // Selection props
            isSelectionMode={isSelectionMode}
            isSelected={subject.curriculumId ? selectedCurricula.has(subject.curriculumId) : false}
            onToggleSelect={subject.curriculumId ? () => toggleSelection(subject.curriculumId!) : undefined}
            onLongPress={subject.curriculumId ? () => enterSelectionMode(subject.curriculumId!) : undefined}
          />
        ))}
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <GenerateCurriculumModal
          isOpen={!!showGenerateModal}
          onClose={() => setShowGenerateModal(null)}
          schoolId={schoolId}
          classLevelId={classLevelId}
          termId={termId}
          teacherId={teacherId!}
          subjects={curriculaSummary.filter(s => !s.curriculumId)}
          onSuccess={() => {
            setShowGenerateModal(null);
            refetchCurriculaSummary();
          }}
        />
      )}

      {/* Curriculum Detail Modal */}
      {showDetailModal && (
        <CurriculumDetailModal
          isOpen={!!showDetailModal}
          onClose={() => setShowDetailModal(null)}
          schoolId={schoolId}
          curriculumId={showDetailModal}
          canEdit={canEdit}
          onUpdate={refetchCurriculaSummary}
          onDelete={openDeleteConfirm}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={handleDeleteCurriculum}
        title="Delete Curriculum"
        message={
          <div className="space-y-3">
            <p>
              Are you sure you want to delete the curriculum for{' '}
              <strong>{showDeleteConfirm?.subjectName}</strong>?
            </p>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
              This will permanently delete all weekly topics, objectives, and progress tracking. 
              You can generate a new curriculum after deletion.
            </p>
          </div>
        }
        confirmText={deletingCurriculumId ? 'Deleting...' : 'Delete Curriculum'}
        variant="danger"
        isLoading={!!deletingCurriculumId}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Curricula"
        message={
          <div className="space-y-3">
            <p>
              Are you sure you want to delete{' '}
              <strong>{selectedCurricula.size} curriculum{selectedCurricula.size > 1 ? 's' : ''}</strong>?
            </p>
            <div className="max-h-32 overflow-y-auto">
              <ul className="text-sm text-light-text-secondary dark:text-dark-text-secondary space-y-1">
                {Array.from(selectedCurricula).map(id => {
                  const subject = curriculaSummary.find(s => s.curriculumId === id);
                  return subject ? (
                    <li key={id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      {subject.subjectName}
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
              This will permanently delete all weekly topics, objectives, and progress tracking for these curricula.
            </p>
          </div>
        }
        confirmText={isBulkDeleting ? `Deleting ${selectedCurricula.size}...` : `Delete ${selectedCurricula.size} Curriculum${selectedCurricula.size > 1 ? 's' : ''}`}
        variant="danger"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}

