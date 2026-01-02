'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Library, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { ImageUrlInput } from '@/components/ui/ImageUrlInput';
import {
  useGetStaffListQuery,
  useUpdateFacultyMutation,
  type Faculty,
} from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';

// Legacy props interface (with isOpen and onSubmit)
interface LegacyEditFacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name?: string;
    code?: string;
    description?: string;
    imageUrl?: string;
    deanId?: string;
  }) => Promise<any>;
  isLoading: boolean;
  faculty: Faculty;
  schoolId?: string;
}

// Self-contained props interface
interface SelfContainedEditFacultyModalProps {
  schoolId: string;
  faculty: Faculty;
  onClose: () => void;
}

type EditFacultyModalProps = LegacyEditFacultyModalProps | SelfContainedEditFacultyModalProps;

function isLegacyProps(props: EditFacultyModalProps): props is LegacyEditFacultyModalProps {
  return 'isOpen' in props && 'onSubmit' in props;
}

export function EditFacultyModal(props: EditFacultyModalProps) {
  const isLegacy = isLegacyProps(props);
  const faculty = props.faculty;
  const onClose = props.onClose;
  const schoolId = 'schoolId' in props ? props.schoolId : undefined;
  const isOpen = isLegacy ? props.isOpen : true;

  const [updateFaculty, { isLoading: isUpdating }] = useUpdateFacultyMutation();
  const isLoading = isLegacy ? props.isLoading : isUpdating;

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    imageUrl: '',
    deanId: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Get staff for dean selection
  const { data: staffResponse } = useGetStaffListQuery(
    { role: 'teacher' },
    { skip: !isOpen }
  );
  const teachers = staffResponse?.data?.items || [];

  // Initialize form with faculty data
  useEffect(() => {
    if (isOpen && faculty) {
      setFormData({
        name: faculty.name,
        code: faculty.code,
        description: faculty.description || '',
        imageUrl: faculty.imageUrl || '',
        deanId: faculty.deanId || '',
      });
    }
  }, [isOpen, faculty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Faculty name is required');
      return;
    }

    if (!formData.code.trim()) {
      setError('Faculty code is required');
      return;
    }

    const data = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      description: formData.description.trim() || undefined,
      imageUrl: formData.imageUrl || undefined,
      deanId: formData.deanId || undefined,
    };

    if (isLegacy) {
      const result = await props.onSubmit(data);
      if (result) {
        onClose();
      }
    } else {
      try {
        await updateFaculty({
          schoolId: schoolId!,
          facultyId: faculty.id,
          data,
        }).unwrap();
        toast.success('Faculty updated successfully');
        onClose();
      } catch (error: any) {
        setError(error?.data?.message || 'Failed to update faculty');
      }
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
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
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Library className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    Edit Faculty
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
                    Faculty Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Faculty of Science"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                    Faculty Code *
                  </label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., FOS"
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
                    placeholder="Brief description of the faculty..."
                    disabled={isLoading}
                    rows={3}
                    className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-muted dark:placeholder:text-dark-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <ImageUrlInput
                  value={formData.imageUrl}
                  onChange={(url) => setFormData({ ...formData, imageUrl: url || '' })}
                  entityName={formData.name || 'Faculty'}
                  label="Faculty Image"
                />

                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                    Dean
                  </label>
                  <select
                    value={formData.deanId}
                    onChange={(e) => setFormData({ ...formData, deanId: e.target.value })}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No dean assigned</option>
                    {teachers.map((teacher: any) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.firstName} {teacher.lastName}
                      </option>
                    ))}
                  </select>
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

