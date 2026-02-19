'use client';

import { useState, useEffect } from 'react';
import { useModalAnimation } from '@/lib/gsap';
import { X, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import type { Department, Faculty } from '@/lib/store/api/schoolAdminApi';

interface EditDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name?: string;
    code?: string;
    description?: string;
    facultyId?: string;
  }) => Promise<void>;
  isLoading: boolean;
  department: Department;
  faculties: Faculty[];
}

export function EditDepartmentModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  department,
  faculties,
}: EditDepartmentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    facultyId: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Initialize form with department data
  useEffect(() => {
    if (isOpen && department) {
      setFormData({
        name: department.name,
        code: department.code,
        description: department.description || '',
        facultyId: department.facultyId || '',
      });
    }
  }, [isOpen, department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Department name is required');
      return;
    }

    if (!formData.code.trim()) {
      setError('Department code is required');
      return;
    }

    if (!formData.facultyId) {
      setError('Please select a faculty');
      return;
    }

    await onSubmit({
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      description: formData.description.trim() || undefined,
      facultyId: formData.facultyId,
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      onClose();
    }
  };

  const { shouldRender, backdropRef, panelRef } = useModalAnimation(isOpen);
  if (!shouldRender) return null;

  return (
    <div ref={backdropRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ opacity: 0 }}>
      <div ref={panelRef} className="bg-light-card dark:bg-dark-surface rounded-lg shadow-xl max-w-md w-full" style={{ opacity: 0 }}>
          <form onSubmit={handleSubmit}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    Edit Department
                  </h2>
                </div>
                {!isLoading && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Error */}
              {error && (
                <Alert variant="error" className="mb-4">
                  {error}
                </Alert>
              )}

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                    Faculty *
                  </label>
                  <select
                    value={formData.facultyId}
                    onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a faculty...</option>
                    {faculties.map((faculty) => (
                      <option key={faculty.id} value={faculty.id}>
                        {faculty.name} ({faculty.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                    Department Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Computer Science"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                    Department Code *
                  </label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., CS"
                    disabled={isLoading}
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the department..."
                    disabled={isLoading}
                    rows={3}
                    className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-muted dark:placeholder:text-dark-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? (
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
  );
}

