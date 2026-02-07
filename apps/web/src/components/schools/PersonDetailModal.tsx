'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CopyToClipboard } from './CopyToClipboard';
import { formatRoleDisplayName } from '@/lib/utils/school-utils';
import { SchoolAdmin, Teacher } from '@/hooks/useSchools';
import { UserCog, Users, GraduationCap, Trash2, Pencil, Mail } from 'lucide-react';
import { useResendPasswordResetForStaffMutation } from '@/lib/store/api/schoolAdminApi';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface PersonDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: SchoolAdmin | Teacher | null;
  type: 'admin' | 'teacher' | 'principal';
  onEdit?: () => void;
  onDelete?: () => void;
  onMakePrincipal?: () => void;
  showMakePrincipal?: boolean;
  schoolId?: string;
}

export function PersonDetailModal({
  isOpen,
  onClose,
  person,
  type,
  onEdit,
  onDelete,
  onMakePrincipal,
  showMakePrincipal = false,
  schoolId,
}: PersonDetailModalProps) {
  const [resendEmail, { isLoading: isResending }] = useResendPasswordResetForStaffMutation();

  const handleResendEmail = async () => {
    if (!schoolId || !person || type === 'teacher') {
      toast.error('Unable to resend email');
      return;
    }

    const admin = person as SchoolAdmin;
    if (!admin.email) {
      toast.error('No email address available for this admin');
      return;
    }

    try {
      await resendEmail({ schoolId, staffId: admin.id }).unwrap();
      toast.success(`Password setup email resent to ${admin.firstName} ${admin.lastName} (${admin.email})`);
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to resend email. Please try again.');
    }
  };

  if (!person) return null;

  const isTeacher = type === 'teacher';
  const teacher = isTeacher ? (person as Teacher) : null;
  const admin = !isTeacher ? (person as SchoolAdmin) : null;
  const uniqueId = isTeacher ? teacher?.teacherId : admin?.adminId;
  const uniqueIdLabel = isTeacher ? 'Teacher ID' : type === 'principal' ? 'Principal ID' : 'Admin ID';

  const iconConfig = {
    principal: { Icon: UserCog, bgColor: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400', badgeColor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400' },
    admin: { Icon: Users, bgColor: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', badgeColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
    teacher: { Icon: GraduationCap, bgColor: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', badgeColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
  };

  const config = iconConfig[type];
  const Icon = config.Icon;
  const roleDisplay = type === 'principal' ? 'Principal' : isTeacher ? 'Teacher' : formatRoleDisplayName(admin?.role || '');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={type === 'principal' ? 'Principal Details' : isTeacher ? 'Teacher Details' : 'Administrator Details'}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-dark-border">
          <div className={`p-3 ${config.bgColor} rounded-lg`}>
            <Icon className={`h-8 w-8 ${config.iconColor}`} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-dark-text-primary">
              {person.firstName} {person.lastName}
            </h3>
            <span className={`inline-block mt-1 px-3 py-1 ${config.badgeColor} rounded-full text-xs font-medium`}>
              {roleDisplay}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          {!isTeacher && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                Email
              </p>
              <p className="text-sm text-gray-900 dark:text-dark-text-primary">
                {person.email || 'N/A'}
              </p>
            </div>
          )}
          {isTeacher && teacher?.email && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                Email
              </p>
              <p className="text-sm text-gray-900 dark:text-dark-text-primary">
                {teacher.email}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
              Phone
            </p>
            <p className="text-sm text-gray-900 dark:text-dark-text-primary">
              {person.phone}
            </p>
          </div>
          {!isTeacher && admin && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                Role
              </p>
              <p className="text-sm text-gray-900 dark:text-dark-text-primary">
                {formatRoleDisplayName(admin.role)}
              </p>
            </div>
          )}
          {isTeacher && teacher?.subject && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                Subject
              </p>
              <p className="text-sm text-gray-900 dark:text-dark-text-primary">
                {teacher.subject}
              </p>
            </div>
          )}
          {uniqueId && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                {uniqueIdLabel}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-gray-900 dark:text-dark-text-primary">
                  {uniqueId}
                </p>
                <CopyToClipboard
                  text={uniqueId}
                  id={`${type}-${person.id}`}
                  size="md"
                />
              </div>
            </div>
          )}
          {!isTeacher && admin && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                Account Status
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {admin.accountStatus === 'SHADOW' ? (
                  <>
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                      Inactive - Password Not Set
                    </span>
                    {schoolId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResendEmail}
                        disabled={isResending}
                        className="text-xs h-6 px-2"
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        {isResending ? 'Sending...' : 'Resend Email'}
                      </Button>
                    )}
                  </>
                ) : admin.accountStatus === 'ACTIVE' ? (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                    Active
                  </span>
                ) : admin.accountStatus ? (
                  <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs font-medium">
                    {admin.accountStatus}
                  </span>
                ) : null}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
              Created
            </p>
            <p className="text-sm text-gray-900 dark:text-dark-text-primary">
              {new Date(person.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {(onEdit || onDelete || onMakePrincipal) && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-border">
            {onDelete && (
              <Button
                variant="ghost"
                onClick={onDelete}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {onEdit && (
              <Button
                variant="primary"
                onClick={onEdit}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {onMakePrincipal && showMakePrincipal && (
              <Button
                variant="primary"
                onClick={onMakePrincipal}
              >
                <UserCog className="h-4 w-4 mr-2" />
                Make Principal
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

