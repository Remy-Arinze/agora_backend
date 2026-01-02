'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { ImageUrlInput } from '@/components/ui/ImageUrlInput';
import {
  useGetFacultiesQuery,
  useCreateDepartmentMutation,
  type Faculty,
} from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';

// Legacy interface for backwards compatibility
interface LegacyCreateDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    code: string;
    description?: string;
    facultyId: string;
  }) => Promise<void>;
  isLoading: boolean;
  faculties: Faculty[];
}

// New self-contained interface
interface SelfContainedCreateDepartmentModalProps {
  schoolId: string;
  defaultFacultyId?: string;
  onClose: () => void;
}

type CreateDepartmentModalProps = LegacyCreateDepartmentModalProps | SelfContainedCreateDepartmentModalProps;

function isLegacyProps(props: CreateDepartmentModalProps): props is LegacyCreateDepartmentModalProps {
  return 'isOpen' in props && 'onSubmit' in props;
}

export function CreateDepartmentModal(props: CreateDepartmentModalProps) {
  // Determine which mode we're in
  const isLegacy = isLegacyProps(props);

  // For self-contained mode
  const schoolId = !isLegacy ? props.schoolId : undefined;
  const defaultFacultyId = !isLegacy ? props.defaultFacultyId : undefined;

  // Fetch faculties for self-contained mode
  const { data: facultiesResponse } = useGetFacultiesQuery(
    { schoolId: schoolId! },
    { skip: isLegacy || !schoolId }
  );

  const [createDepartment, { isLoading: isCreatingDept }] = useCreateDepartmentMutation();

  const faculties = isLegacy ? props.faculties : (facultiesResponse?.data || []);
  const isLoading = isLegacy ? props.isLoading : isCreatingDept;
  const onClose = props.onClose;
  const isOpen = isLegacy ? props.isOpen : true;

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    imageUrl: '',
    facultyId: defaultFacultyId || '',
  });
  const [error, setError] = useState<string | null>(null);

  // Update facultyId when defaultFacultyId changes
  useEffect(() => {
    if (defaultFacultyId) {
      setFormData((prev) => ({ ...prev, facultyId: defaultFacultyId }));
    }
  }, [defaultFacultyId]);

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

    const data = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      description: formData.description.trim() || undefined,
      imageUrl: formData.imageUrl || undefined,
      facultyId: formData.facultyId,
    };

    if (isLegacy) {
      await props.onSubmit(data);
    } else {
      try {
        await createDepartment({ schoolId: schoolId!, data }).unwrap();
        toast.success('Department created successfully');
        handleClose();
      } catch (error: any) {
        setError(error?.data?.message || 'Failed to create department');
        return;
      }
    }

    // Reset form on success
    setFormData({ name: '', code: '', description: '', imageUrl: '', facultyId: defaultFacultyId || '' });
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setFormData({ name: '', code: '', description: '', imageUrl: '', facultyId: defaultFacultyId || '' });
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
          <form onSubmit={handleSubmit}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    Create Department
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
                    disabled={isLoading || !!defaultFacultyId}
                    className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a faculty...</option>
                    {faculties.map((faculty) => (
                      <option key={faculty.id} value={faculty.id}>
                        {faculty.name} ({faculty.code})
                      </option>
                    ))}
                  </select>
                  {defaultFacultyId && (
                    <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                      Creating department within this faculty
                    </p>
                  )}
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
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                    Short unique code for the department
                  </p>
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

                <ImageUrlInput
                  value={formData.imageUrl}
                  onChange={(url) => setFormData({ ...formData, imageUrl: url || '' })}
                  entityName={formData.name || 'Department'}
                  label="Department Image (Optional)"
                />
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
                    Creating...
                  </>
                ) : (
                  'Create Department'
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

