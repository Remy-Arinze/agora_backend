'use client';

import { ReactNode } from 'react';
import { useCurrentAdminPermissions, PermissionResource, PermissionType } from '@/hooks/usePermissions';

interface PermissionGateProps {
  /**
   * The resource to check permission for
   */
  resource: PermissionResource;
  
  /**
   * The type of permission required (default: READ)
   */
  type?: PermissionType;
  
  /**
   * Content to render if permission is granted
   */
  children: ReactNode;
  
  /**
   * Optional fallback to render if permission is denied
   * If not provided, nothing is rendered
   */
  fallback?: ReactNode;
  
  /**
   * If true, shows a loading skeleton while permissions are being fetched
   */
  showLoading?: boolean;
}

/**
 * Component that conditionally renders children based on user permissions
 * 
 * Usage:
 * ```tsx
 * <PermissionGate resource={PermissionResource.STUDENTS} type={PermissionType.WRITE}>
 *   <Button>Add Student</Button>
 * </PermissionGate>
 * 
 * // With fallback
 * <PermissionGate 
 *   resource={PermissionResource.STAFF} 
 *   fallback={<p>You don't have access to this section</p>}
 * >
 *   <StaffList />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  resource,
  type = PermissionType.READ,
  children,
  fallback = null,
  showLoading = false,
}: PermissionGateProps) {
  const { hasPermission, isLoading } = useCurrentAdminPermissions();
  
  if (isLoading && showLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      </div>
    );
  }
  
  if (isLoading) {
    // If not showing loading, return nothing until we know the permissions
    return null;
  }
  
  if (hasPermission(resource, type)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}

/**
 * Higher-order component version for wrapping entire pages
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  resource: PermissionResource,
  type: PermissionType = PermissionType.READ,
  FallbackComponent?: React.ComponentType
) {
  return function PermissionProtectedComponent(props: P) {
    const { hasPermission, isLoading } = useCurrentAdminPermissions();
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      );
    }
    
    if (!hasPermission(resource, type)) {
      if (FallbackComponent) {
        return <FallbackComponent />;
      }
      return <AccessDenied resource={resource} />;
    }
    
    return <WrappedComponent {...props} />;
  };
}

/**
 * Default access denied component
 */
function AccessDenied({ resource }: { resource: PermissionResource }) {
  const resourceLabels: Record<PermissionResource, string> = {
    [PermissionResource.OVERVIEW]: 'Dashboard Overview',
    [PermissionResource.ANALYTICS]: 'Analytics',
    [PermissionResource.SUBSCRIPTIONS]: 'Subscriptions',
    [PermissionResource.STUDENTS]: 'Students',
    [PermissionResource.STAFF]: 'Staff',
    [PermissionResource.CLASSES]: 'Classes',
    [PermissionResource.SUBJECTS]: 'Subjects',
    [PermissionResource.TIMETABLES]: 'Timetables',
    [PermissionResource.CALENDAR]: 'Calendar',
    [PermissionResource.ADMISSIONS]: 'Admissions',
    [PermissionResource.SESSIONS]: 'Sessions',
    [PermissionResource.EVENTS]: 'Events',
    [PermissionResource.GRADES]: 'Grades',
    [PermissionResource.CURRICULUM]: 'Curriculum',
    [PermissionResource.RESOURCES]: 'Resources',
    [PermissionResource.TRANSFERS]: 'Transfers',
    [PermissionResource.INTEGRATIONS]: 'Integrations',
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Access Denied
      </h2>
      <p className="text-gray-600 dark:text-gray-400 max-w-md">
        You don't have permission to access <span className="font-medium">{resourceLabels[resource]}</span>.
        Please contact your school administrator if you believe this is an error.
      </p>
    </div>
  );
}

export { AccessDenied };

