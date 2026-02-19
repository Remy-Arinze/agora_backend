'use client';

import { useState } from 'react';
import { useModalAnimation } from '@/lib/gsap';
import { X, AlertTriangle, Loader2, GraduationCap, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Department } from '@/lib/store/api/schoolAdminApi';

interface DeleteDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (force?: boolean) => Promise<boolean>;
  isLoading: boolean;
  department: Department;
}

export function DeleteDepartmentModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  department,
}: DeleteDepartmentModalProps) {
  const [acknowledgeForce, setAcknowledgeForce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStudents = department.studentsCount > 0;
  const hasLevels = department.levelsCount > 0;
  const needsForce = hasStudents || hasLevels;

  const handleConfirm = async () => {
    setError(null);
    const success = await onConfirm(needsForce && acknowledgeForce);
    if (!success) {
      setError('Failed to delete department. Please try again.');
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setAcknowledgeForce(false);
      onClose();
    }
  };

  const { shouldRender, backdropRef, panelRef } = useModalAnimation(isOpen);
  if (!shouldRender) return null;

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
                  Delete Department
                </h2>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  This action cannot be undone
                </p>
              </div>
              {!isLoading && (
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
                <span className="font-semibold">{department.name}</span>
                {department.facultyName && (
                  <span className="text-light-text-secondary dark:text-dark-text-secondary">
                    {' '}from {department.facultyName}
                  </span>
                )}?
              </p>

              {needsForce ? (
                <div className="space-y-4">
                  <Alert variant="error">
                    <div className="space-y-2">
                      {hasLevels && (
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm">
                            <span className="font-medium">{department.levelsCount}</span> level(s) will be deleted
                          </span>
                        </div>
                      )}
                      {hasStudents && (
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm">
                            <span className="font-medium">{department.studentsCount}</span> student(s) will be unenrolled
                          </span>
                        </div>
                      )}
                    </div>
                  </Alert>

                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 cursor-pointer hover:border-red-300 dark:hover:border-red-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={acknowledgeForce}
                      onChange={(e) => setAcknowledgeForce(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
                      I understand that all levels, courses, and student enrollments in this department will be permanently deleted.
                    </span>
                  </label>
                </div>
              ) : (
                <Alert variant="warning">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium mb-1">Warning</p>
                      <p className="text-sm">
                        This department will be permanently deleted.
                      </p>
                    </div>
                  </div>
                </Alert>
              )}

              {error && (
                <Alert variant="error" className="mt-4">
                  <p className="text-sm">{error}</p>
                </Alert>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirm}
                disabled={isLoading || (needsForce && !acknowledgeForce)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : needsForce ? (
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

