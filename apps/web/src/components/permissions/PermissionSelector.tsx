'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Eye, Edit, Settings, Info, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { PermissionResource, PermissionType } from '@/lib/store/api/schoolAdminApi';
import { AdminPermissionInput } from '@/lib/store/api/schoolsApi';

interface PermissionSelectorProps {
  /**
   * Current selected permissions
   */
  value: AdminPermissionInput[];
  /**
   * Callback when permissions change
   */
  onChange: (permissions: AdminPermissionInput[]) => void;
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
  /**
   * Whether the section starts collapsed (default: true)
   */
  defaultCollapsed?: boolean;
}

// Resource information with labels, descriptions, and icons
const RESOURCE_INFO: Record<PermissionResource, { label: string; description: string; icon: string }> = {
  OVERVIEW: {
    label: 'Dashboard Overview',
    description: 'Access to school dashboard and statistics.',
    icon: '📊',
  },
  ANALYTICS: {
    label: 'Analytics & Reports',
    description: 'View school performance analytics and reports.',
    icon: '📈',
  },
  SUBSCRIPTIONS: {
    label: 'Subscriptions & Billing',
    description: 'Manage subscription plans and billing.',
    icon: '💳',
  },
  STUDENTS: {
    label: 'Student Management',
    description: 'Access student records and profiles.',
    icon: '👨‍🎓',
  },
  STAFF: {
    label: 'Staff Management',
    description: 'Manage teachers and administrators.',
    icon: '👥',
  },
  CLASSES: {
    label: 'Class Management',
    description: 'Manage class structures and assignments.',
    icon: '🏫',
  },
  SUBJECTS: {
    label: 'Subject Management',
    description: 'Manage subjects and teacher assignments.',
    icon: '📚',
  },
  TIMETABLES: {
    label: 'Timetable Management',
    description: 'Create and manage school timetables.',
    icon: '📅',
  },
  CALENDAR: {
    label: 'School Calendar',
    description: 'Manage calendar events and holidays.',
    icon: '🗓️',
  },
  ADMISSIONS: {
    label: 'Admissions',
    description: 'Process new student admissions.',
    icon: '📝',
  },
  SESSIONS: {
    label: 'Academic Sessions',
    description: 'Manage sessions, terms, and promotions.',
    icon: '🎓',
  },
  EVENTS: {
    label: 'School Events',
    description: 'Create and manage school events.',
    icon: '🎉',
  },
  GRADES: {
    label: 'Grades & Assessments',
    description: 'View and manage student grades.',
    icon: '💯',
  },
  CURRICULUM: {
    label: 'Curriculum Management',
    description: 'Create and manage curricula.',
    icon: '📖',
  },
  RESOURCES: {
    label: 'Class Resources',
    description: 'Upload and manage educational materials.',
    icon: '📁',
  },
  TRANSFERS: {
    label: 'Student Transfers',
    description: 'Process student transfers between schools.',
    icon: '🔄',
  },
  INTEGRATIONS: {
    label: 'External Integrations',
    description: 'Configure third-party integrations.',
    icon: '🔗',
  },
};

// Permission type information with user-friendly descriptions
const TYPE_INFO: Record<PermissionType, { label: string; description: string; icon: React.ReactNode }> = {
  READ: {
    label: 'View',
    description: 'Can see this screen on their dashboard',
    icon: <Eye className="h-3.5 w-3.5" />,
  },
  WRITE: {
    label: 'Edit',
    description: 'Can add and modify data (includes View)',
    icon: <Edit className="h-3.5 w-3.5" />,
  },
  ADMIN: {
    label: 'Full Control',
    description: 'Can delete and manage everything (includes Edit + View)',
    icon: <Settings className="h-3.5 w-3.5" />,
  },
};

// All available resources - explicitly define to avoid TypeScript enum quirks
const ALL_RESOURCES: PermissionResource[] = [
  PermissionResource.OVERVIEW,
  PermissionResource.ANALYTICS,
  PermissionResource.SUBSCRIPTIONS,
  PermissionResource.STUDENTS,
  PermissionResource.STAFF,
  PermissionResource.CLASSES,
  PermissionResource.SUBJECTS,
  PermissionResource.TIMETABLES,
  PermissionResource.CALENDAR,
  PermissionResource.ADMISSIONS,
  PermissionResource.SESSIONS,
  PermissionResource.EVENTS,
  PermissionResource.GRADES,
  PermissionResource.CURRICULUM,
  PermissionResource.RESOURCES,
  PermissionResource.TRANSFERS,
  PermissionResource.INTEGRATIONS,
];

const ALL_TYPES: PermissionType[] = [
  PermissionType.READ,
  PermissionType.WRITE,
  PermissionType.ADMIN,
];

/**
 * A component for selecting permissions during admin creation.
 * By default, all READ permissions are checked.
 * The section is collapsible to reduce visual clutter.
 */
export function PermissionSelector({
  value,
  onChange,
  disabled = false,
  defaultCollapsed = true,
}: PermissionSelectorProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  // Build a Set for quick lookup of selected permissions
  const selectedPermissions = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(value)) {
      value.forEach((p) => {
        if (p && p.resource && p.type) {
          set.add(`${p.resource}:${p.type}`);
        }
      });
    }
    return set;
  }, [value]);

  // Check if a permission is selected
  const hasPermission = (resource: PermissionResource, type: PermissionType): boolean => {
    return selectedPermissions.has(`${resource}:${type}`);
  };

  // Toggle a permission with auto-selection of dependent permissions
  // - ADMIN requires WRITE and READ
  // - WRITE requires READ
  const togglePermission = (resource: PermissionResource, type: PermissionType) => {
    if (disabled) return;

    try {
      const key = `${resource}:${type}`;
      const currentValue = Array.isArray(value) ? value : [];
      let newPermissions = [...currentValue];

      if (selectedPermissions.has(key)) {
        // Remove the permission and any higher-level permissions that depend on it
        if (type === PermissionType.READ) {
          // Removing READ also removes WRITE and ADMIN (they require READ)
          newPermissions = newPermissions.filter((p) => 
            !(p.resource === resource && (p.type === PermissionType.READ || p.type === PermissionType.WRITE || p.type === PermissionType.ADMIN))
          );
        } else if (type === PermissionType.WRITE) {
          // Removing WRITE also removes ADMIN (it requires WRITE)
          newPermissions = newPermissions.filter((p) => 
            !(p.resource === resource && (p.type === PermissionType.WRITE || p.type === PermissionType.ADMIN))
          );
        } else {
          // Removing ADMIN only removes ADMIN
          newPermissions = newPermissions.filter((p) => !(p.resource === resource && p.type === type));
        }
        onChange(newPermissions);
      } else {
        // Add the permission and any lower-level permissions it requires
        const permissionsToAdd: PermissionType[] = [type];
        
        if (type === PermissionType.ADMIN) {
          // ADMIN requires WRITE and READ
          if (!hasPermission(resource, PermissionType.WRITE)) {
            permissionsToAdd.push(PermissionType.WRITE);
          }
          if (!hasPermission(resource, PermissionType.READ)) {
            permissionsToAdd.push(PermissionType.READ);
          }
        } else if (type === PermissionType.WRITE) {
          // WRITE requires READ
          if (!hasPermission(resource, PermissionType.READ)) {
            permissionsToAdd.push(PermissionType.READ);
          }
        }

        permissionsToAdd.forEach((t) => {
          if (!hasPermission(resource, t)) {
            newPermissions.push({ resource: resource as string, type: t as string });
          }
        });
        onChange(newPermissions);
      }
    } catch (error) {
      console.error('Error toggling permission:', error);
    }
  };

  // Toggle all READ permissions
  const toggleAllRead = () => {
    if (disabled) return;

    try {
      const currentValue = Array.isArray(value) ? value : [];
      const allReadSelected = ALL_RESOURCES.every((r) => hasPermission(r, PermissionType.READ));
      
      if (allReadSelected) {
        // Remove all READ permissions
        const filtered = currentValue.filter((p) => p.type !== PermissionType.READ);
        onChange(filtered);
      } else {
        // Add all READ permissions
        const newPermissions = [...currentValue];
        ALL_RESOURCES.forEach((resource) => {
          if (!hasPermission(resource, PermissionType.READ)) {
            newPermissions.push({ resource: resource as string, type: PermissionType.READ as string });
          }
        });
        onChange(newPermissions);
      }
    } catch (error) {
      console.error('Error toggling all READ permissions:', error);
    }
  };

  // Toggle a resource row (expand/collapse)
  const toggleResourceExpanded = (resource: string) => {
    const newExpanded = new Set(expandedResources);
    if (newExpanded.has(resource)) {
      newExpanded.delete(resource);
    } else {
      newExpanded.add(resource);
    }
    setExpandedResources(newExpanded);
  };

  // Count selected permissions per resource
  const getResourcePermissionCount = (resource: PermissionResource): number => {
    return ALL_TYPES.filter((type) => hasPermission(resource, type)).length;
  };

  // Check if all READ permissions are selected
  const allReadSelected = ALL_RESOURCES.every((r) => hasPermission(r, PermissionType.READ));

  return (
    <Card className="border-light-border dark:border-dark-border">
      {/* Collapsible Header */}
      <CardHeader 
        className="pb-3 cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-base font-semibold text-light-text-primary dark:text-dark-text-primary">
              Dashboard Permissions
            </CardTitle>
            <span className="text-xs text-light-text-muted dark:text-dark-text-muted bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {value.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
          {isCollapsed 
            ? 'Click to expand and configure which screens this admin can access'
            : 'Configure what this administrator can see and do. View permissions are enabled by default.'
          }
        </p>
      </CardHeader>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <CardContent className="pt-0">
          {/* Quick Actions */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleAllRead();
              }}
              disabled={disabled}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              {allReadSelected ? 'Remove all view access' : 'Grant all view access'}
            </button>
          </div>

          {/* Permission Type Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs border border-blue-100 dark:border-blue-800/30">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-700 dark:text-blue-300">
                <strong>View</strong> = Can see this screen
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Edit className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-700 dark:text-blue-300">
                <strong>Edit</strong> = Can add & modify (includes View)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-700 dark:text-blue-300">
                <strong>Full Control</strong> = Can delete & manage (includes Edit + View)
              </span>
            </div>
          </div>

        {/* Permissions Grid */}
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {ALL_RESOURCES.map((resource) => {
            const info = RESOURCE_INFO[resource];
            // Safety check - skip if resource info is missing
            if (!info) {
              console.warn(`Missing RESOURCE_INFO for resource: ${resource}`);
              return null;
            }
            const permCount = getResourcePermissionCount(resource);
            const isExpanded = expandedResources.has(resource);

            return (
              <div
                key={resource}
                className="border border-light-border dark:border-dark-border rounded-lg overflow-hidden"
              >
                {/* Resource Header */}
                <div
                  className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    permCount > 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleResourceExpanded(resource);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{info.icon}</span>
                    <div>
                      <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                        {info.label}
                      </span>
                      {permCount > 0 && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                          ({permCount} permission{permCount !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Quick toggles visible when collapsed */}
                    {!isExpanded && (
                      <div className="flex items-center gap-1">
                        {ALL_TYPES.map((type) => {
                          const typeInfo = TYPE_INFO[type];
                          if (!typeInfo) return null;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePermission(resource, type);
                              }}
                              disabled={disabled}
                              className={`p-1.5 rounded transition-colors ${
                                hasPermission(resource, type)
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                              } disabled:opacity-50`}
                              title={`${typeInfo.label} access for ${info.label}`}
                            >
                              {typeInfo.icon}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div 
                    className="p-3 pt-2 border-t border-light-border dark:border-dark-border bg-gray-50/50 dark:bg-gray-800/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                      {info.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_TYPES.map((type) => {
                        const typeInfo = TYPE_INFO[type];
                        // Safety check for typeInfo
                        if (!typeInfo) return null;
                        const isSelected = hasPermission(resource, type);

                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              togglePermission(resource, type);
                            }}
                            disabled={disabled}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span>{typeInfo.icon}</span>
                            <span className="text-sm font-medium">
                              {typeInfo.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

          {/* Summary */}
          <div className="mt-4 pt-3 border-t border-light-border dark:border-dark-border">
            <div className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
              <Info className="h-3.5 w-3.5" />
              <span>
                {value.length} permission{value.length !== 1 ? 's' : ''} selected
                {value.length === 0 && ' - Administrator will have no dashboard access'}
              </span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Helper function to create default READ permissions for all resources
 */
export function getDefaultReadPermissions(): AdminPermissionInput[] {
  return ALL_RESOURCES.map((resource) => ({
    resource: resource as string,
    type: PermissionType.READ as string,
  }));
}

export { ALL_RESOURCES, ALL_TYPES, RESOURCE_INFO, TYPE_INFO };

