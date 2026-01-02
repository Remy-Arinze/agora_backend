'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Loader2, Shield, CheckCircle2, Eye, Edit, Settings, Info, Crown, Lock } from 'lucide-react';
import {
  useGetAllPermissionsQuery,
  useGetAdminPermissionsQuery,
  useAssignPermissionsMutation,
  Permission,
  PermissionResource,
  PermissionType,
} from '@/lib/store/api/schoolAdminApi';
import { useGetMySchoolQuery } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';

interface PermissionAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminId: string;
  adminName: string;
  adminRole: string;
}

// Detailed resource information
const RESOURCE_INFO: Record<PermissionResource, { label: string; description: string; icon: string }> = {
  OVERVIEW: {
    label: 'Dashboard Overview',
    description: 'Access to school dashboard, statistics, and general school information.',
    icon: '📊',
  },
  ANALYTICS: {
    label: 'Analytics & Reports',
    description: 'View and export school performance analytics, attendance reports, and data insights.',
    icon: '📈',
  },
  SUBSCRIPTIONS: {
    label: 'Subscriptions & Billing',
    description: 'Manage school subscription plans, view billing history, and access premium features.',
    icon: '💳',
  },
  STUDENTS: {
    label: 'Student Management',
    description: 'Access student records, enrollment data, academic history, and student profiles.',
    icon: '👨‍🎓',
  },
  STAFF: {
    label: 'Staff Management',
    description: 'Manage teachers, administrators, and other school staff members.',
    icon: '👥',
  },
  CLASSES: {
    label: 'Class Management',
    description: 'Manage class structures, class arms, student-class assignments, and class resources.',
    icon: '🏫',
  },
  SUBJECTS: {
    label: 'Subject Management',
    description: 'Manage subjects/courses, assign teachers to subjects, and configure subject settings.',
    icon: '📚',
  },
  TIMETABLES: {
    label: 'Timetable Management',
    description: 'Create and manage school timetables, period assignments, and room allocations.',
    icon: '📅',
  },
  CALENDAR: {
    label: 'School Calendar',
    description: 'Manage school calendar events, holidays, and important dates.',
    icon: '🗓️',
  },
  ADMISSIONS: {
    label: 'Admissions',
    description: 'Process new student admissions, manage admission forms, and enrollment workflows.',
    icon: '📝',
  },
  SESSIONS: {
    label: 'Academic Sessions',
    description: 'Manage academic sessions, terms, student promotions, and session transitions.',
    icon: '🎓',
  },
  EVENTS: {
    label: 'School Events',
    description: 'Create and manage school events, announcements, and activities.',
    icon: '🎉',
  },
  GRADES: {
    label: 'Grades & Assessments',
    description: 'View and manage student grades, assessments, report cards, and academic performance.',
    icon: '📝',
  },
  CURRICULUM: {
    label: 'Curriculum Management',
    description: 'Create and manage curricula, lesson plans, and teaching schedules.',
    icon: '📖',
  },
  RESOURCES: {
    label: 'Class Resources',
    description: 'Upload, manage, and share educational materials and resources for classes.',
    icon: '📁',
  },
  TRANSFERS: {
    label: 'Student Transfers',
    description: 'Process student transfers between schools, generate TACs, and manage transfer requests.',
    icon: '🔄',
  },
  INTEGRATIONS: {
    label: 'External Integrations',
    description: 'Configure and manage third-party integrations like Google Calendar and external systems.',
    icon: '🔗',
  },
};

// Detailed permission type information
const TYPE_INFO: Record<PermissionType, { label: string; description: string; color: string; bgColor: string }> = {
  READ: {
    label: 'View Only',
    description: 'Can view and read data but cannot make any changes.',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  WRITE: {
    label: 'Create & Edit',
    description: 'Can create new records and edit existing ones, but cannot delete.',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  ADMIN: {
    label: 'Full Control',
    description: 'Complete access including create, edit, delete, and all administrative actions.',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
};

// Legacy labels for backward compatibility
const RESOURCE_LABELS: Record<PermissionResource, string> = Object.fromEntries(
  Object.entries(RESOURCE_INFO).map(([key, value]) => [key, value.label])
) as Record<PermissionResource, string>;

const TYPE_LABELS: Record<PermissionType, string> = {
  READ: 'Read',
  WRITE: 'Write',
  ADMIN: 'Admin (Full Access)',
};

export function PermissionAssignmentModal({
  isOpen,
  onClose,
  adminId,
  adminName,
  adminRole,
}: PermissionAssignmentModalProps) {
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;

  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Check if this admin is a Principal (permanent full access, cannot edit)
  const isPrincipal = adminRole.toLowerCase().includes('principal');

  // Get all available permissions
  const { data: allPermissionsResponse, isLoading: isLoadingAll } = useGetAllPermissionsQuery(
    { schoolId: schoolId! },
    { skip: !schoolId || !isOpen }
  );

  // Get current admin permissions (skip for principals - they have all)
  const { data: adminPermissionsResponse, isLoading: isLoadingAdmin } = useGetAdminPermissionsQuery(
    { schoolId: schoolId!, adminId },
    { skip: !schoolId || !adminId || !isOpen || isPrincipal }
  );

  const [assignPermissions, { isLoading: isAssigning }] = useAssignPermissionsMutation();

  const allPermissions = allPermissionsResponse?.data || [];
  const currentPermissions = adminPermissionsResponse?.data?.permissions || [];

  // Initialize selected permissions from current permissions
  useEffect(() => {
    if (currentPermissions.length > 0) {
      setSelectedPermissions(new Set(currentPermissions.map((p) => p.id)));
    }
  }, [currentPermissions]);

  // Group permissions by resource
  const permissionsByResource = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<PermissionResource, Permission[]>);

  const handleTogglePermission = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSelectAllForResource = (resource: PermissionResource) => {
    const resourcePerms = permissionsByResource[resource] || [];
    const newSelected = new Set(selectedPermissions);
    
    // Check if all are selected
    const allSelected = resourcePerms.every((p) => newSelected.has(p.id));
    
    if (allSelected) {
      // Deselect all
      resourcePerms.forEach((p) => newSelected.delete(p.id));
    } else {
      // Select all
      resourcePerms.forEach((p) => newSelected.add(p.id));
    }
    
    setSelectedPermissions(newSelected);
  };

  const handleSave = async () => {
    if (!schoolId) return;

    try {
      await assignPermissions({
        schoolId,
        adminId,
        permissionIds: Array.from(selectedPermissions),
      }).unwrap();

      toast.success('Permissions assigned successfully');
      onClose();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to assign permissions');
    }
  };

  const isLoading = isLoadingAll || isLoadingAdmin;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Permissions" size="xl">
      <div className="space-y-4">
        {/* Admin Info */}
        <div className="bg-[var(--light-bg)] dark:bg-dark-surface rounded-lg p-4">
          <div className="flex items-center gap-3">
            {isPrincipal ? (
              <Crown className="h-5 w-5 text-amber-500" />
            ) : (
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            )}
            <div>
              <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                {adminName}
              </p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                Role: {adminRole}
              </p>
            </div>
          </div>
        </div>

        {/* Principal Full Access Notice */}
        {isPrincipal ? (
          <>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center">
                  <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300 mb-2">
                    Principal - Full Access
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
                    As the Principal, this account has <strong>permanent full access</strong> to all school resources and features. 
                    This ensures the school leader always maintains complete control over the institution.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                    <Lock className="h-4 w-4" />
                    <span>Principal permissions cannot be modified</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* All Permissions Granted (Visual Display) */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                All permissions are automatically granted:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(RESOURCE_INFO).map(([resource, info]) => (
                  <div 
                    key={resource} 
                    className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-300 truncate">{info.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Close Button for Principal */}
            <div className="flex items-center justify-end pt-4 border-t border-light-border dark:border-dark-border">
              <Button variant="primary" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Permission Types Legend */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Permission Types Explained</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(TYPE_INFO).map(([type, info]) => (
              <div key={type} className={`p-3 rounded-lg ${info.bgColor}`}>
                <div className="flex items-center gap-2 mb-1">
                  {type === 'READ' && <Eye className={`h-4 w-4 ${info.color}`} />}
                  {type === 'WRITE' && <Edit className={`h-4 w-4 ${info.color}`} />}
                  {type === 'ADMIN' && <Settings className={`h-4 w-4 ${info.color}`} />}
                  <span className={`font-semibold text-sm ${info.color}`}>{info.label}</span>
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  {info.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {Object.entries(permissionsByResource).map(([resource, permissions]) => {
              const resourceInfo = RESOURCE_INFO[resource as PermissionResource];
              return (
                <Card key={resource} className="border-light-border dark:border-dark-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{resourceInfo.icon}</span>
                        <div>
                          <CardTitle className="text-base font-semibold text-light-text-primary dark:text-dark-text-primary">
                            {resourceInfo.label}
                          </CardTitle>
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            {resourceInfo.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectAllForResource(resource as PermissionResource)}
                        className="text-xs"
                      >
                        {permissions.every((p) => selectedPermissions.has(p.id))
                          ? 'Deselect All'
                          : 'Select All'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {permissions.map((permission) => {
                        const isSelected = selectedPermissions.has(permission.id);
                        const typeInfo = TYPE_INFO[permission.type];
                        
                        return (
                          <label
                            key={permission.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              isSelected
                                ? `border-blue-500 ${typeInfo.bgColor}`
                                : 'border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-bg'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleTogglePermission(permission.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {permission.type === 'READ' && <Eye className={`h-3.5 w-3.5 ${typeInfo.color}`} />}
                                {permission.type === 'WRITE' && <Edit className={`h-3.5 w-3.5 ${typeInfo.color}`} />}
                                {permission.type === 'ADMIN' && <Settings className={`h-3.5 w-3.5 ${typeInfo.color}`} />}
                                <span className={`font-medium text-sm ${isSelected ? typeInfo.color : 'text-light-text-primary dark:text-dark-text-primary'}`}>
                                  {typeInfo.label}
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Summary */}
        <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-3 border border-light-border dark:border-dark-border">
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
              {selectedPermissions.size}
            </span> permission{selectedPermissions.size !== 1 ? 's' : ''} selected
          </p>
        </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-light-border dark:border-dark-border">
              <Button variant="ghost" onClick={onClose} disabled={isAssigning}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={isAssigning || isLoading}>
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Permissions'
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

