'use client';

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology, Terminology } from '@/lib/utils/terminology';
import { useCurrentAdminPermissions, PermissionResource } from '@/hooks/usePermissions';
import {
  LayoutDashboard,
  Building2,
  Users,
  BarChart3,
  GraduationCap,
  UserPlus,
  ArrowRightLeft,
  Puzzle,
  BookOpen,
  BookMarked,
  Calendar,
  Clock,
  FileText,
  CreditCard,
  Library,
  User,
  LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
  schoolTypes?: Array<'PRIMARY' | 'SECONDARY' | 'TERTIARY'>;
  badge?: string | number;
  /** Permission resource required to view this item (school admin only) */
  permission?: PermissionResource;
}

export interface SidebarSection {
  title?: string;
  items: NavItem[];
}

/**
 * Hook to get sidebar configuration based on user role and school type
 * This centralizes all sidebar logic for easier maintenance
 */
export function useSidebarConfig(): {
  sections: SidebarSection[];
  terminology: Terminology;
  currentType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
} {
  const user = useSelector((state: RootState) => state.auth.user);
  const { currentType } = useSchoolType();
  const terminology = getTerminology(user?.role === 'SCHOOL_ADMIN' ? currentType : null);

  const sections = useMemo(() => {
    if (!user) return [];

    const role = user.role;

    // Super Admin sidebar
    if (role === 'SUPER_ADMIN') {
      return [
        {
          items: [
            { label: 'Overview', href: '/dashboard/super-admin/overview', icon: LayoutDashboard },
            { label: 'Schools', href: '/dashboard/super-admin/schools', icon: Building2 },
            { label: 'Analytics', href: '/dashboard/super-admin/analytics', icon: BarChart3 },
            { label: 'Plugins', href: '/dashboard/super-admin/plugins', icon: Puzzle },
            { label: 'Profile', href: '/dashboard/profile', icon: User },
          ],
        },
      ];
    }

    // School Admin sidebar - dynamic based on school type and permissions
    if (role === 'SCHOOL_ADMIN') {
      const baseItems: NavItem[] = [
        { label: 'Overview', href: '/dashboard/school/overview', icon: LayoutDashboard, permission: PermissionResource.OVERVIEW },
        { label: 'Students', href: '/dashboard/school/students', icon: GraduationCap, permission: PermissionResource.STUDENTS },
        { label: 'Staff', href: '/dashboard/school/teachers', icon: Users, permission: PermissionResource.STAFF },
      ];

      // Add Faculties for tertiary (before Departments/Classes)
      if (currentType === 'TERTIARY') {
        baseItems.push({
          label: 'Faculties',
          href: '/dashboard/school/faculties',
          icon: Library,
          schoolTypes: ['TERTIARY'],
          permission: PermissionResource.CLASSES,
        });
      }

      // Add Classes/Departments based on type
      baseItems.push({
        label: currentType === 'TERTIARY' ? 'Departments' : terminology.courses,
        href: '/dashboard/school/courses',
        icon: BookOpen,
        permission: PermissionResource.CLASSES,
      });

      // Common items after Classes/Departments
      baseItems.push(
        { label: currentType === 'TERTIARY' ? 'Courses' : 'Subjects', href: '/dashboard/school/subjects', icon: BookMarked, permission: PermissionResource.SUBJECTS },
        { label: 'Timetables', href: '/dashboard/school/timetables', icon: Clock, permission: PermissionResource.TIMETABLES },
        { label: 'Calendar', href: '/dashboard/school/calendar', icon: Calendar, permission: PermissionResource.CALENDAR },
        { label: 'Admissions', href: '/dashboard/school/admissions', icon: UserPlus, permission: PermissionResource.ADMISSIONS },
        { label: 'Transfers', href: '/dashboard/school/transfers', icon: ArrowRightLeft, permission: PermissionResource.ADMISSIONS }, // Transfers use same permission as admissions
        { label: 'Subscription', href: '/dashboard/school/subscription', icon: CreditCard, permission: PermissionResource.SUBSCRIPTIONS },
        { label: 'Profile', href: '/dashboard/profile', icon: User }
      );

      return [{ items: baseItems }];
    }

    // Teacher sidebar - Overview available for all teacher types
    if (role === 'TEACHER') {
      return [
        {
          items: [
            { label: 'Overview', href: '/dashboard/teacher/overview', icon: LayoutDashboard },
            { label: 'Timetables', href: '/dashboard/teacher/timetables', icon: Clock },
            { label: 'Classes', href: '/dashboard/teacher/classes', icon: BookOpen },
            { label: 'Calendar', href: '/dashboard/teacher/calendar', icon: Calendar },
          ],
        },
      ];
    }

    // Student sidebar
    if (role === 'STUDENT') {
      return [
        {
          items: [
            { label: 'Overview', href: '/dashboard/student/overview', icon: LayoutDashboard },
            { label: 'Classes', href: '/dashboard/student/classes', icon: BookOpen },
            { label: 'Timetables', href: '/dashboard/student/timetables', icon: Clock },
            { label: 'Results', href: '/dashboard/student/results', icon: FileText },
            { label: 'Calendar', href: '/dashboard/student/calendar', icon: Calendar },
            { label: 'Resources', href: '/dashboard/student/resources', icon: FileText },
            { label: 'History', href: '/dashboard/student/history', icon: GraduationCap },
            { label: 'Transfers', href: '/dashboard/student/transfers', icon: ArrowRightLeft },
          ],
        },
      ];
    }

    return [];
  }, [user, currentType, terminology]);

  return {
    sections,
    terminology,
    currentType,
  };
}

/**
 * Get flat list of nav items (for backwards compatibility with existing sidebar)
 */
export function useFlatNavItems(): NavItem[] {
  const { sections } = useSidebarConfig();
  return sections.flatMap((section) => section.items);
}

/**
 * Hook to get sidebar items filtered by user permissions
 * For school admins, items are filtered based on READ permission
 */
export function usePermissionFilteredSidebar(): {
  sections: SidebarSection[];
  terminology: Terminology;
  currentType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
  isLoadingPermissions: boolean;
} {
  const { sections, terminology, currentType } = useSidebarConfig();
  const user = useSelector((state: RootState) => state.auth.user);
  const { canView, isLoading: isLoadingPermissions, isPrincipal } = useCurrentAdminPermissions();
  
  const filteredSections = useMemo(() => {
    // Only filter for school admins
    if (user?.role !== 'SCHOOL_ADMIN') {
      return sections;
    }
    
    // Principals have permanent full access - see everything (no loading needed)
    if (isPrincipal) {
      return sections;
    }
    
    // While loading permissions, show empty sidebar to prevent flash
    if (isLoadingPermissions) {
      return sections.map((section) => ({ ...section, items: [] }));
    }
    
    // Filter items based on permissions
    return sections.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // If no permission specified, show the item
        if (!item.permission) return true;
        // Check if user has READ access to this resource
        return canView(item.permission);
      }),
    }));
  }, [sections, user?.role, isLoadingPermissions, isPrincipal, canView]);
  
  return {
    sections: filteredSections,
    terminology,
    currentType,
    isLoadingPermissions,
  };
}

