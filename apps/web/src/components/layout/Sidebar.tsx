'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    roles: ['SCHOOL_ADMIN', 'TEACHER', 'PARENT', 'STUDENT'],
  },
  // Super Admin sections - Overview first
  {
    label: 'Overview',
    href: '/dashboard/super-admin/overview',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Schools',
    href: '/dashboard/super-admin/schools',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'School Owners',
    href: '/dashboard/super-admin/owners',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Analytics',
    href: '/dashboard/super-admin/analytics',
    roles: ['SUPER_ADMIN'],
  },
  // Other sections
  {
    label: 'Students',
    href: '/dashboard/students',
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
  },
  {
    label: 'Bulk Import',
    href: '/dashboard/import',
    roles: ['SCHOOL_ADMIN'],
  },
  {
    label: 'My Children',
    href: '/dashboard/children',
    roles: ['PARENT'],
  },
  {
    label: 'My Profile',
    href: '/dashboard/profile',
    roles: ['STUDENT'],
  },
  {
    label: 'Transfers',
    href: '/dashboard/transfers',
    roles: ['SCHOOL_ADMIN', 'PARENT'],
  },
];

export function Sidebar() {
  const user = useSelector((state: RootState) => state.auth.user);
  const pathname = usePathname();

  if (!user) return null;

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  return (
    <aside className="w-64 dark:bg-dark-surface border-r border-gray-200 dark:border-dark-border h-[calc(100vh-4rem)] fixed left-0 top-16 transition-colors duration-200 flex flex-col z-20">
      <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">
        <nav className="space-y-1">
          {filteredNavItems.map((item) => {
            // Check if current path matches or starts with the href
            // Also handle the case where we're on /dashboard/super-admin and should highlight Overview
            const isActive = 
              pathname === item.href || 
              pathname.startsWith(item.href + '/') ||
              (item.href === '/dashboard/super-admin/overview' && pathname === '/dashboard/super-admin');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-500 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-surface/50'
                )}
              >
                {item.icon && <span className="mr-3">{item.icon}</span>}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

