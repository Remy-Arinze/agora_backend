'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatRoleInput } from '@/lib/utils/school-utils';
import { SchoolAdmin, Teacher } from '@/hooks/useSchools';

interface BaseFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface AdminFormData extends BaseFormData {
  role: string;
}

interface TeacherFormData extends BaseFormData {
  subject: string;
  isTemporary: boolean;
}

interface PrincipalFormData extends BaseFormData {
  // Principal doesn't have role in form (it's always PRINCIPAL)
}

interface PersonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'principal' | 'admin' | 'teacher';
  isEditing: boolean;
  formData: AdminFormData | TeacherFormData | PrincipalFormData;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  isLoading: boolean;
  existingPerson?: SchoolAdmin | Teacher | null;
}

export function PersonFormModal({
  isOpen,
  onClose,
  type,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  isLoading,
  existingPerson,
}: PersonFormModalProps) {
  const isTeacher = type === 'teacher';
  const isPrincipal = type === 'principal';
  const adminForm = !isTeacher && !isPrincipal ? (formData as AdminFormData) : null;
  const teacherForm = isTeacher ? (formData as TeacherFormData) : null;
  const principalForm = isPrincipal ? (formData as PrincipalFormData) : null;

  const title = isEditing
    ? isPrincipal
      ? 'Edit Principal'
      : isTeacher
        ? 'Edit Teacher'
        : 'Edit Administrator'
    : isPrincipal
      ? 'Add Principal'
      : isTeacher
        ? 'Add Teacher'
        : 'Add Administrator';

  const handleRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isTeacher && !isPrincipal && adminForm) {
      setFormData({ ...adminForm, role: e.target.value } as AdminFormData);
    }
  };

  const handleRoleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!isTeacher && !isPrincipal && adminForm) {
      const formatted = formatRoleInput(e.target.value);
      setFormData({ ...adminForm, role: formatted } as AdminFormData);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name *"
            name="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            label="Last Name *"
            name="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>
        {!isEditing && (
          <Input
            label="Email *"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        )}
        {isEditing && existingPerson && (
          <>
            <Input
              label="Email"
              name="email"
              type="email"
              value={existingPerson.email || ''}
              disabled
              className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
            />
            <p className="text-xs text-light-text-muted dark:text-dark-text-muted -mt-2">
              Email cannot be changed
            </p>
          </>
        )}
        <Input
          label="Phone *"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          required
        />
        {!isTeacher && !isPrincipal && adminForm && (
          <div>
            <Input
              label="Role *"
              name="role"
              type="text"
              placeholder="e.g., Bursar, Vice Principal, Dean of Students"
              value={adminForm.role}
              onChange={handleRoleChange}
              onBlur={handleRoleBlur}
              required
              maxLength={50}
            />
            <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
              Enter the role (e.g., Bursar, Vice Principal, Dean of Students). Teaching-related roles are not allowed here.
            </p>
          </div>
        )}
        {isTeacher && teacherForm && (
          <>
            <div>
              <Input
                label="Course/Subject (Optional)"
                name="subject"
                value={teacherForm.subject}
                onChange={(e) => setFormData({ ...teacherForm, subject: e.target.value } as TeacherFormData)}
                placeholder="e.g., Mathematics, English Language"
              />
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                The primary course or subject this teacher will be teaching
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isTemporary"
                checked={teacherForm.isTemporary}
                onChange={(e) => setFormData({ ...teacherForm, isTemporary: e.target.checked } as TeacherFormData)}
                className="w-4 h-4 text-blue-600 bg-light-card dark:bg-dark-surface border-light-border dark:border-dark-border rounded focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <label htmlFor="isTemporary" className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                Temporary Teacher
              </label>
            </div>
            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
              Check this if the teacher is temporary or on contract
            </p>
          </>
        )}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEditing
              ? isPrincipal
                ? 'Update Principal'
                : isTeacher
                  ? 'Update Teacher'
                  : 'Update Administrator'
              : isPrincipal
                ? 'Add Principal'
                : isTeacher
                  ? 'Add Teacher'
                  : 'Add Administrator'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

