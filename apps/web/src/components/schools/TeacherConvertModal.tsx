'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PersonDetailModal } from './PersonDetailModal';
import { formatRoleInput } from '@/lib/utils/school-utils';
import { Teacher } from '@/hooks/useSchools';
import { GraduationCap, Pencil } from 'lucide-react';

interface TeacherConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  formData: {
    role: string;
    keepAsTeacher: boolean;
    showPromoteOption: boolean;
  };
  setFormData: (data: { role: string; keepAsTeacher: boolean; showPromoteOption: boolean }) => void;
  onConvert: () => void;
  onEdit: () => void;
  isLoading: boolean;
}

export function TeacherConvertModal({
  isOpen,
  onClose,
  teacher,
  formData,
  setFormData,
  onConvert,
  onEdit,
  isLoading,
}: TeacherConvertModalProps) {
  if (!teacher) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Teacher Details" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-dark-border">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-dark-text-primary">
              {teacher.firstName} {teacher.lastName}
            </h3>
            <span className="inline-block mt-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full text-xs font-medium">
              Teacher
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
              Role
            </p>
            <p className="text-sm text-gray-900 dark:text-dark-text-primary">Teacher</p>
          </div>
          {teacher.email && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                Email
              </p>
              <p className="text-sm text-gray-900 dark:text-dark-text-primary">{teacher.email}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
              Phone
            </p>
            <p className="text-sm text-gray-900 dark:text-dark-text-primary">{teacher.phone}</p>
          </div>
          {teacher.subject && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                Subject
              </p>
              <p className="text-sm text-gray-900 dark:text-dark-text-primary">{teacher.subject}</p>
            </div>
          )}
          {teacher.teacherId && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                Teacher ID
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-gray-900 dark:text-dark-text-primary">
                  {teacher.teacherId}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Promote to Admin Section */}
        <div className="pt-4 border-t border-gray-200 dark:border-dark-border">
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border">
            <input
              type="checkbox"
              id="showPromoteOption"
              checked={formData.showPromoteOption}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  showPromoteOption: e.target.checked,
                  role: e.target.checked ? formData.role : '',
                })
              }
              className="mt-1 h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-light-border dark:border-dark-border rounded"
            />
            <div className="flex-1">
              <label
                htmlFor="showPromoteOption"
                className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer"
              >
                Promote to Administrator
              </label>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                Check this to convert this teacher to an administrator role
              </p>
            </div>
          </div>

          {formData.showPromoteOption && (
            <div className="mt-4 space-y-4">
              <div>
                <Input
                  label="Admin Role *"
                  name="adminRole"
                  type="text"
                  placeholder="e.g., Bursar, Vice Principal, Dean of Students"
                  value={formData.role}
                  onChange={(e) => {
                    setFormData({ ...formData, role: e.target.value });
                  }}
                  onBlur={(e) => {
                    const formatted = formatRoleInput(e.target.value);
                    setFormData({ ...formData, role: formatted });
                  }}
                  required
                  maxLength={50}
                />
                <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                  Enter the administrative role (e.g., Bursar, Vice Principal, Dean of Students)
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border">
                <input
                  type="checkbox"
                  id="keepAsTeacher"
                  checked={formData.keepAsTeacher}
                  onChange={(e) => setFormData({ ...formData, keepAsTeacher: e.target.checked })}
                  className="mt-1 h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-light-border dark:border-dark-border rounded"
                />
                <div className="flex-1">
                  <label
                    htmlFor="keepAsTeacher"
                    className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer"
                  >
                    Keep as Teacher
                  </label>
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                    If checked, the teacher will retain their teaching role while also being an
                    administrator. If unchecked, they will only be an administrator.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-border">
          <Button type="button" variant="ghost" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Details
          </Button>
          {formData.showPromoteOption && (
            <Button
              onClick={onConvert}
              disabled={isLoading || !formData.role || !formData.role.trim()}
              isLoading={isLoading}
            >
              Convert to Admin
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

