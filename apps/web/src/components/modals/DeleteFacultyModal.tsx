'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Loader2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Faculty } from '@/lib/store/api/schoolAdminApi';

interface DeleteFacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (force?: boolean) => Promise<boolean>;
  isLoading: boolean;
  faculty: Faculty;
}

export function DeleteFacultyModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  faculty,
}: DeleteFacultyModalProps) {
  const [acknowledgeForce, setAcknowledgeForce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDepartments = faculty.departmentsCount > 0;

  const handleConfirm = async () => {
    setError(null);
    const success = await onConfirm(hasDepartments && acknowledgeForce);
    if (!success) {
      setError('Failed to delete faculty. Please try again.');
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setAcknowledgeForce(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-light-card dark:bg-dark-surface rounded-lg shadow-xl max-w-md w-full"
        >
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
                  Delete Faculty
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
                <span className="font-semibold">{faculty.name}</span>?
              </p>

              {hasDepartments ? (
                <div className="space-y-4">
                  <Alert variant="error">
                    <div className="flex items-start gap-3">
                      <BookOpen className="h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">
                          Faculty has {faculty.departmentsCount} department(s)
                        </p>
                        <p className="text-sm">
                          Deleting this faculty will also deactivate all associated departments.
                          This may affect enrolled students.
                        </p>
                      </div>
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
                      I understand that{' '}
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {faculty.departmentsCount} department(s)
                      </span>{' '}
                      will be deactivated and all associated data may be affected.
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
                        This faculty will be permanently deleted.
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
                disabled={isLoading || (hasDepartments && !acknowledgeForce)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : hasDepartments ? (
                  'Delete Anyway'
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

