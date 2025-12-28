'use client';

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';
import {
  useGetMySchoolQuery,
  useGetMyPermissionsQuery,
  PermissionResource,
  PermissionType,
  Permission,
} from '@/lib/store/api/schoolAdminApi';

export { PermissionResource, PermissionType };

/**
 * Hook to get the current admin's permissions and check access
 * 
 * Usage:
 * ```tsx
 * const { hasPermission, hasReadAccess, canView, canEdit, isLoading } = useCurrentAdminPermissions();
 * 
 * // Check specific permission
 * if (hasPermission(PermissionResource.STUDENTS, PermissionType.WRITE)) { ... }
 * 
 * // Shorthand for READ access (screen visibility)
 * if (canView(PermissionResource.STUDENTS)) { ... }
 * 
 * // Shorthand for WRITE access (edit/create/delete)
 * if (canEdit(PermissionResource.STUDENTS)) { ... }
 * ```
 */
export function useCurrentAdminPermissions() {
  const auth = useSelector((state: RootState) => state.auth);
  const user = auth.user;
  
  // Get school info (includes current admin's role)
  const { data: schoolResponse, isLoading: isLoadingSchool } = useGetMySchoolQuery(undefined, {
    skip: user?.role !== 'SCHOOL_ADMIN',
  });
  
  const schoolId = schoolResponse?.data?.id;
  
  // Check if admin is a Principal EARLY based on school response
  // This ensures Principals get full access even before permissions are fetched
  const currentAdmin = schoolResponse?.data?.currentAdmin;
  const isPrincipalEarly = useMemo(() => {
    if (currentAdmin?.role) {
      return currentAdmin.role.toLowerCase().includes('principal');
    }
    return false;
  }, [currentAdmin?.role]);
  
  // Get current admin's own permissions (uses /permissions/me endpoint - no STAFF:READ required)
  // Skip for Principals - they have permanent full access
  const { 
    data: permissionsResponse, 
    isLoading: isLoadingPermissions,
    isFetching,
  } = useGetMyPermissionsQuery(
    { schoolId: schoolId! },
    { skip: !schoolId || user?.role !== 'SCHOOL_ADMIN' || isPrincipalEarly }
  );
  
  const permissions = permissionsResponse?.data?.permissions || [];
  const adminRole = permissionsResponse?.data?.role || currentAdmin?.role || '';
  
  // Final Principal check (from either source)
  const isPrincipal = useMemo(() => {
    return isPrincipalEarly || adminRole.toLowerCase().includes('principal');
  }, [isPrincipalEarly, adminRole]);
  
  /**
   * Check if admin has a specific permission
   * Principals automatically have ALL permissions (permanent, uneditable)
   */
  const hasPermission = useMemo(() => {
    return (resource: PermissionResource, type: PermissionType): boolean => {
      // Principals have permanent full access to everything
      if (isPrincipal) return true;
      
      // Check for ADMIN permission on this resource (grants all access)
      const hasAdmin = permissions.some(
        (p: Permission) => p.resource === resource && p.type === PermissionType.ADMIN
      );
      if (hasAdmin) return true;
      
      // Check for specific permission
      return permissions.some(
        (p: Permission) => p.resource === resource && p.type === type
      );
    };
  }, [permissions, isPrincipal]);
  
  /**
   * Check if admin has READ access to a resource (for viewing screens)
   */
  const hasReadAccess = useMemo(() => {
    return (resource: PermissionResource): boolean => {
      return hasPermission(resource, PermissionType.READ);
    };
  }, [hasPermission]);
  
  /**
   * Check if admin has WRITE access to a resource (for creating/editing)
   */
  const hasWriteAccess = useMemo(() => {
    return (resource: PermissionResource): boolean => {
      return hasPermission(resource, PermissionType.WRITE);
    };
  }, [hasPermission]);
  
  /**
   * Check if admin has ADMIN access to a resource (full control)
   */
  const hasAdminAccess = useMemo(() => {
    return (resource: PermissionResource): boolean => {
      if (isPrincipal) return true;
      return permissions.some(
        (p: Permission) => p.resource === resource && p.type === PermissionType.ADMIN
      );
    };
  }, [permissions, isPrincipal]);
  
  // Aliases for cleaner API
  const canView = hasReadAccess;
  const canEdit = hasWriteAccess;
  const canManage = hasAdminAccess;
  
  const isLoading = isLoadingSchool || isLoadingPermissions;
  
  return {
    // Permission check functions
    hasPermission,
    hasReadAccess,
    hasWriteAccess,
    hasAdminAccess,
    // Aliases
    canView,
    canEdit,
    canManage,
    // State
    permissions,
    isPrincipal, // Principals have permanent full access (uneditable)
    isLoading,
    isFetching,
    // Context
    schoolId,
    adminRole,
  };
}

/**
 * Map of routes to their required permissions
 * Used for protecting routes and sidebar items
 */
export const ROUTE_PERMISSIONS: Record<string, { resource: PermissionResource; type: PermissionType }> = {
  // Overview is always accessible (READ by default)
  '/dashboard/school/overview': { resource: PermissionResource.OVERVIEW, type: PermissionType.READ },
  '/dashboard/school': { resource: PermissionResource.OVERVIEW, type: PermissionType.READ },
  
  // Analytics
  '/dashboard/school/analytics': { resource: PermissionResource.ANALYTICS, type: PermissionType.READ },
  
  // Students
  '/dashboard/school/students': { resource: PermissionResource.STUDENTS, type: PermissionType.READ },
  '/dashboard/school/students/add': { resource: PermissionResource.STUDENTS, type: PermissionType.WRITE },
  
  // Staff
  '/dashboard/school/staff': { resource: PermissionResource.STAFF, type: PermissionType.READ },
  '/dashboard/school/staff/add': { resource: PermissionResource.STAFF, type: PermissionType.WRITE },
  
  // Classes
  '/dashboard/school/classes': { resource: PermissionResource.CLASSES, type: PermissionType.READ },
  
  // Subjects
  '/dashboard/school/subjects': { resource: PermissionResource.SUBJECTS, type: PermissionType.READ },
  
  // Timetables
  '/dashboard/school/timetable': { resource: PermissionResource.TIMETABLES, type: PermissionType.READ },
  
  // Calendar
  '/dashboard/school/calendar': { resource: PermissionResource.CALENDAR, type: PermissionType.READ },
  
  // Sessions
  '/dashboard/school/session': { resource: PermissionResource.SESSIONS, type: PermissionType.READ },
  
  // Admissions
  '/dashboard/school/admission': { resource: PermissionResource.ADMISSIONS, type: PermissionType.READ },
  
  // Subscriptions
  '/dashboard/school/subscription': { resource: PermissionResource.SUBSCRIPTIONS, type: PermissionType.READ },
  
  // Events
  '/dashboard/school/events': { resource: PermissionResource.EVENTS, type: PermissionType.READ },
  
  // Grades (new)
  '/dashboard/school/grades': { resource: PermissionResource.GRADES, type: PermissionType.READ },
  
  // Curriculum (new)
  '/dashboard/school/curriculum': { resource: PermissionResource.CURRICULUM, type: PermissionType.READ },
  
  // Transfers (new)
  '/dashboard/school/transfers': { resource: PermissionResource.TRANSFERS, type: PermissionType.READ },
};

/**
 * Get the required permission for a given route
 */
export function getRoutePermission(pathname: string): { resource: PermissionResource; type: PermissionType } | null {
  // Check for exact match first
  if (ROUTE_PERMISSIONS[pathname]) {
    return ROUTE_PERMISSIONS[pathname];
  }
  
  // Check for prefix matches (for dynamic routes)
  for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route) && route !== '/dashboard/school') {
      return permission;
    }
  }
  
  // Default to overview for unmatched school routes
  if (pathname.startsWith('/dashboard/school')) {
    return ROUTE_PERMISSIONS['/dashboard/school/overview'];
  }
  
  return null;
}

