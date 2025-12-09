'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { CurriculumSummary } from '@/lib/store/api/schoolAdminApi';
import { useCurriculum } from '@/hooks/useCurriculum';

interface GenerateCurriculumModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  classLevelId: string;
  termId: string;
  teacherId: string;
  subjects: CurriculumSummary[];
  onSuccess?: () => void;
}

export function GenerateCurriculumModal({
  isOpen,
  onClose,
  schoolId,
  classLevelId,
  termId,
  teacherId,
  subjects,
  onSuccess,
}: GenerateCurriculumModalProps) {
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(
    new Set(subjects.map(s => s.subjectId))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<{
    success: string[];
    failed: { subjectId: string; error: string }[];
  } | null>(null);

  const { handleBulkGenerate } = useCurriculum({ schoolId, classLevelId, termId });

  const toggleSubject = (subjectId: string) => {
    const newSelected = new Set(selectedSubjects);
    if (newSelected.has(subjectId)) {
      newSelected.delete(subjectId);
    } else {
      newSelected.add(subjectId);
    }
    setSelectedSubjects(newSelected);
  };

  const selectAll = () => {
    setSelectedSubjects(new Set(subjects.map(s => s.subjectId)));
  };

  const deselectAll = () => {
    setSelectedSubjects(new Set());
  };

  const handleGenerate = async () => {
    if (selectedSubjects.size === 0) return;

    setIsGenerating(true);
    setResults(null);

    const result = await handleBulkGenerate({
      classLevelId,
      termId,
      teacherId,
      subjectIds: Array.from(selectedSubjects),
    });

    setIsGenerating(false);

    if (result) {
      setResults({
        success: result.created,
        failed: result.failed,
      });

      if (result.created.length > 0 && result.failed.length === 0) {
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      }
    }
  };

  const getSubjectName = (subjectId: string) => {
    return subjects.find(s => s.subjectId === subjectId)?.subjectName || subjectId;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Curricula from NERDC"
      size="lg"
    >
      <div className="space-y-6">
        {/* Description */}
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          Select subjects to generate curricula based on NERDC (Nigerian Educational Research 
          and Development Council) templates. This will create a 13-week scheme of work for each 
          selected subject.
        </p>

        {!results ? (
          <>
            {/* Selection Controls */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
              <span className="text-sm text-light-text-muted dark:text-dark-text-muted ml-auto">
                {selectedSubjects.size} of {subjects.length} selected
              </span>
            </div>

            {/* Subject List */}
            <div className="border border-light-border dark:border-dark-border rounded-lg divide-y divide-light-border dark:divide-dark-border max-h-[300px] overflow-y-auto">
              {subjects.map((subject) => (
                <label
                  key={subject.subjectId}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedSubjects.has(subject.subjectId)}
                    onChange={() => toggleSubject(subject.subjectId)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                    <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                      {subject.subjectName}
                    </span>
                    {subject.subjectCode && (
                      <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                        ({subject.subjectCode})
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={isGenerating}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={selectedSubjects.size === 0 || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate {selectedSubjects.size} Curricula
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          /* Results */
          <div className="space-y-4">
            {/* Success */}
            {results.success.length > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">
                    Successfully generated {results.success.length} curricula
                  </span>
                </div>
              </div>
            )}

            {/* Failures */}
            {results.failed.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">
                    {results.failed.length} failed to generate
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                  {results.failed.map((fail) => (
                    <li key={fail.subjectId}>
                      • {getSubjectName(fail.subjectId)}: {fail.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

