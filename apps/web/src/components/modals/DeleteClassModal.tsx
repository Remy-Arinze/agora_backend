'use client';

import { useState, useEffect } from 'react';
import { useModalAnimation } from '@/lib/gsap';
import { X, AlertTriangle, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface DeleteClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (forceDelete?: boolean) => Promise<void>;
  className: string;
  classLevel?: string;
  studentsCount?: number;
  isClassArm?: boolean;
  isLoading?: boolean;
}

export function DeleteClassModal({
  isOpen,
  onClose,
  onConfirm,
  className,
  classLevel,
  studentsCount = 0,
  isClassArm = false,
  isLoading = false,
}: DeleteClassModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgeStudents, setAcknowledgeStudents] = useState(false);

  // Reset acknowledgment when modal opens/closes or class changes
  useEffect(() => {
    if (!isOpen) {
      setAcknowledgeStudents(false);
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm(hasStudents && acknowledgeStudents);
      setIsDeleting(false);
      onClose();
    } catch (err: any) {
      setIsDeleting(false);
      setError(err?.data?.message || 'Failed to delete. Please try again.');
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setError(null);
      setAcknowledgeStudents(false);
      onClose();
    }
  };

  const { shouldRender, backdropRef, panelRef } = useModalAnimation(isOpen);
  if (!shouldRender) return null;

  const hasStudents = studentsCount > 0;
  const canDelete = !hasStudents || acknowledgeStudents;
  const displayName = isClassArm && classLevel 
    ? `${classLevel} ${className}` 
    : className;

  return (
    <div ref={backdropRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ opacity: 0 }}>
      <div ref={panelRef} className="bg-light-card dark:bg-dark-surface rounded-lg shadow-xl max-w-md w-full" style={{ opacity: 0 }}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
                Delete {isClassArm ? 'ClassArm' : 'Class'}
              </h2>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                This action cannot be undone
              </p>
            </div>
            {!isDeleting && (
              <button
                onClick={handleClose}
                className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="mb-6">
            <p className="text-light-text-primary dark:text-dark-text-primary mb-4">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{displayName}</span>?
            </p>

            {hasStudents ? (
              <div className="space-y-4 mb-4">
                <Alert variant="error">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium mb-1">
                        Warning: {isClassArm ? 'ClassArm' : 'Class'} has enrolled students
                      </p>
                      <p className="text-sm">
                        This {isClassArm ? 'ClassArm' : 'Class'} has{' '}
                        <span className="font-semibold">{studentsCount}</span> active student
                        {studentsCount !== 1 ? 's' : ''} enrolled. Deleting this class will 
                        unenroll all students from this class.
                      </p>
                    </div>
                  </div>
                </Alert>
                
                {/* Acknowledgment Checkbox */}
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 cursor-pointer hover:border-red-300 dark:hover:border-red-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={acknowledgeStudents}
                    onChange={(e) => setAcknowledgeStudents(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
                    I understand that{' '}
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {studentsCount} student{studentsCount !== 1 ? 's' : ''}
                    </span>{' '}
                    will be unenrolled from this class and all associated data (timetables, 
                    curriculum, resources) will be permanently deleted.
                  </span>
                </label>
              </div>
            ) : (
              <Alert variant="warning" className="mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Warning</p>
                    <p className="text-sm">
                      All associated data including timetables, curriculum, and resources will be
                      permanently deleted.
                    </p>
                  </div>
                </div>
              </Alert>
            )}

            {error && (
              <Alert variant="error" className="mb-4">
                <p className="text-sm">{error}</p>
              </Alert>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirm}
              disabled={isDeleting || !canDelete}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : hasStudents ? (
                'Delete Anyway'
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

