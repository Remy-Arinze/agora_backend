'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';
import { useCurrentAdminPermissions, getRoutePermission, PermissionResource } from '@/hooks/usePermissions';
import { AccessDenied } from './PermissionGate';

interface ProtectedSchoolRouteProps {
  children: ReactNode;
  /**
   * Override the automatic route-based permission detection
   */
  resource?: PermissionResource;
}

/**
 * Wrapper component for school admin routes that enforces permissions
 * 
 * Usage:
 * ```tsx
 * // In a layout or page component
 * export default function StudentsPage() {
 *   return (
 *     <ProtectedSchoolRoute>
 *       <StudentsList />
 *     </ProtectedSchoolRoute>
 *   );
 * }
 * 
 * // Or with explicit resource
 * <ProtectedSchoolRoute resource={PermissionResource.STUDENTS}>
 *   <StudentsList />
 * </ProtectedSchoolRoute>
 * ```
 */
export function ProtectedSchoolRoute({ children, resource }: ProtectedSchoolRouteProps) {
  const pathname = usePathname();
  const user = useSelector((state: RootState) => state.auth.user);
  const { hasPermission, isLoading, isPrincipal } = useCurrentAdminPermissions();
  const [isChecking, setIsChecking] = useState(true);
  
  // Only apply protection for school admins
  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN';
  
  // Determine the required permission
  const routePermission = resource 
    ? { resource, type: 'READ' as const } 
    : getRoutePermission(pathname);
  
  useEffect(() => {
    // Non-school admins don't need permission checking
    if (!isSchoolAdmin) {
      setIsChecking(false);
      return;
    }
    
    // Wait for permissions to load
    if (isLoading) {
      return;
    }
    
    setIsChecking(false);
  }, [isSchoolAdmin, isLoading]);
  
  // Show loading while checking
  if (isChecking || (isSchoolAdmin && isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Verifying permissions...
          </p>
        </div>
      </div>
    );
  }
  
  // Non-school admins get through without permission checks
  if (!isSchoolAdmin) {
    return <>{children}</>;
  }
  
  // Principals have permanent full access (uneditable)
  if (isPrincipal) {
    return <>{children}</>;
  }
  
  // If no route permission found, allow access (for unmapped routes)
  if (!routePermission) {
    return <>{children}</>;
  }
  
  // Check if user has the required permission
  if (!hasPermission(routePermission.resource, routePermission.type)) {
    return <AccessDenied resource={routePermission.resource} />;
  }
  
  return <>{children}</>;
}

/**
 * HOC version for wrapping page components
 */
export function withSchoolRouteProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  resource?: PermissionResource
) {
  return function ProtectedPage(props: P) {
    return (
      <ProtectedSchoolRoute resource={resource}>
        <WrappedComponent {...props} />
      </ProtectedSchoolRoute>
    );
  };
}

