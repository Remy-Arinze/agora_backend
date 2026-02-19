'use client';

import { useState, useEffect } from 'react';
import { useModalAnimation } from '@/lib/gsap';
import { X, Loader2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newName: string) => Promise<void>;
  currentName: string;
  isLoading?: boolean;
}

export function EditClassModal({
  isOpen,
  onClose,
  onConfirm,
  currentName,
  isLoading = false,
}: EditClassModalProps) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = newName.trim();

    // Validation
    if (!trimmedName) {
      setError('Class name cannot be empty');
      return;
    }

    if (trimmedName === currentName) {
      setError('Class name is unchanged');
      return;
    }

    setIsSaving(true);

    try {
      await onConfirm(trimmedName);
      setIsSaving(false);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setError(err?.data?.message || 'Failed to update class name. Please try again.');
    }
  };

  const handleClose = () => {
    if (!isSaving && !isLoading) {
      setError(null);
      setNewName(currentName);
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
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Edit className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
                Edit Class Name
              </h2>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                Update the class name. This will not affect enrolled students.
              </p>
            </div>
            {!isSaving && !isLoading && (
              <button
                onClick={handleClose}
                className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="className">Class Name *</Label>
              <Input
                id="className"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter class name"
                className={error ? 'border-red-500' : ''}
                disabled={isSaving || isLoading}
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-500 mt-1">{error}</p>
              )}
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                Current name: <span className="font-medium">{currentName}</span>
              </p>
            </div>

            {/* Info Alert */}
            <Alert variant="info">
              <p className="text-sm">
                Changing the class name will update it across the system. Student enrollments and other data will remain unchanged.
              </p>
            </Alert>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-dark-border">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSaving || isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSaving || isLoading || !newName.trim() || newName.trim() === currentName}
              >
                {isSaving || isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

