'use client';

import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';
import { SidebarBody, SidebarLink, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { getActivePluginsForTeacher } from '@/lib/plugins';
import { usePermissionFilteredSidebar, type NavItem } from '@/hooks/useSidebarConfig';

function LogoSection() {
  const { open } = useSidebar();
  
  return (
    <div className="mb-8">
      <Link
        href="/"
        className="font-normal flex items-center justify-center md:justify-start py-1 relative z-20"
      >
        {open ? (
          <Image
            src="/assets/logos/agora_worded_white.png"
            alt="Agora"
            width={120}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        ) : (
          <Image
            src="/assets/logos/agora_main.png"
            alt="Agora"
            width={40}
            height={40}
            className="h-8 w-8 object-contain"
            priority
          />
        )}
      </Link>
    </div>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  const { open } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={logout}
      className="w-full justify-start gap-2 text-gray-700 dark:text-[#9ca3af] hover:bg-gray-100 dark:hover:bg-[#1f2937]"
    >
      <LogOut className="h-5 w-5 flex-shrink-0" />
      <motion.span
        animate={{
          display: open ? "inline-block" : "none",
          opacity: open ? 1 : 0,
        }}
        className="text-sm"
      >
        Logout
      </motion.span>
    </Button>
  );
}

export function SidebarNew() {
  const user = useSelector((state: RootState) => state.auth.user);
  const pathname = usePathname();
  
  // Use permission-filtered sidebar config
  const { sections, isLoadingPermissions } = usePermissionFilteredSidebar();

  if (!user) return null;

  // Flatten sections into links
  let links = sections.flatMap((section) =>
    section.items.map((item: NavItem) => ({
      label: item.label,
      href: item.href,
      icon: <item.icon className="h-5 w-5 flex-shrink-0" />,
    }))
  );
  
  // Show loading state for school admins while permissions load
  const showLoadingSkeleton = user.role === 'SCHOOL_ADMIN' && isLoadingPermissions;

  // If user is a teacher, add active plugins as tools
  if (user.role === 'TEACHER') {
    // Remove History from links if it exists (it's now in profile)
    links = links.filter(link => link.href !== '/dashboard/teacher/history');
    
    const activePlugins = getActivePluginsForTeacher();
    const pluginLinks = activePlugins.map((plugin) => {
      const Icon = plugin.icon;
      return {
        label: plugin.name,
        href: `/dashboard/teacher/plugins/${plugin.slug}`,
        icon: <Icon className="h-5 w-5 flex-shrink-0" />,
      };
    });
    
    // Add plugins
    if (pluginLinks.length > 0) {
      links = [
        ...links,
        ...pluginLinks,
      ];
    }
  }

  return (
    <SidebarBody className="justify-between gap-10">
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <LogoSection />

        {/* Navigation Links */}
        <div className="flex flex-col gap-2 flex-1 mt-10">
          {showLoadingSkeleton ? (
            // Loading skeleton while permissions are being fetched
            <>
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-2 animate-pulse">
                  <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </>
          ) : (
            links.map((link, idx) => {
            const isActive =
              pathname === link.href ||
              pathname.startsWith(link.href + '/') ||
              (link.href === '/dashboard/super-admin/overview' &&
                pathname === '/dashboard/super-admin') ||
              (link.href === '/dashboard/school/overview' &&
                (pathname === '/dashboard/school' || pathname === '/dashboard')) ||
              (link.href === '/dashboard/student/overview' &&
                (pathname === '/dashboard/student' || pathname === '/dashboard')) ||
              (link.href === '/dashboard/teacher/timetables' &&
                (pathname === '/dashboard/teacher' || pathname === '/dashboard')) ||
              (link.href === '/dashboard/teacher/overview' &&
                (pathname === '/dashboard/teacher' || pathname === '/dashboard'));
            return (
              <SidebarLink
                key={idx}
                link={link}
                isActive={isActive}
              />
            );
            })
          )}
        </div>
      </div>

      {/* Logout Button at Bottom */}
      <div className="pt-4 border-t border-gray-200 dark:border-[#1a1f2e]">
        <LogoutButton />
      </div>
    </SidebarBody>
  );
}

