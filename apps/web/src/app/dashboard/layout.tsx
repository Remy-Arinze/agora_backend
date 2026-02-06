'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SidebarNew } from '@/components/layout/SidebarNew';
import { Navbar } from '@/components/layout/Navbar';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/lib/store/store';

function MainContent({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar();
  const userRole = useSelector((state: RootState) => state.auth.user?.role);
  
  // Hide navbar for SUPER_ADMIN and SCHOOL_ADMIN
  const showNavbar = userRole !== 'SUPER_ADMIN' && userRole !== 'SCHOOL_ADMIN';
  
  return (
    <main 
      className={`flex-1 overflow-y-auto p-8 transition-all duration-300 bg-[#0f1419] dark:bg-[#0f1419] ${
        open ? 'md:ml-[250px]' : 'md:ml-[80px]'
      }`}
    >
      {children}
    </main>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const userRole = useSelector((state: RootState) => state.auth.user?.role);
  
  // Hide navbar for SUPER_ADMIN and SCHOOL_ADMIN
  const showNavbar = userRole !== 'SUPER_ADMIN' && userRole !== 'SCHOOL_ADMIN';
  
  return (
    <div className="h-screen bg-[#0f1419] dark:bg-[#0f1419] transition-colors duration-200 flex flex-col overflow-hidden">
      {showNavbar && <Navbar />}
      <div className={`flex flex-1 overflow-hidden relative ${showNavbar ? 'pt-16' : ''}`}>
        <SidebarNew />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <ProtectedRoute>
      <SidebarProvider open={sidebarOpen} setOpen={setSidebarOpen} animate={true}>
        <DashboardContent>{children}</DashboardContent>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

