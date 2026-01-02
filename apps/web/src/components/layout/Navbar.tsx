'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SchoolTypeSelector } from './SchoolTypeSelector';
import { useSidebar } from '@/components/ui/sidebar';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import type { RootState } from '@/lib/store/store';
import { useGetMySchoolQuery, useGetMyTeacherSchoolQuery, useGetMyStudentSchoolQuery } from '@/lib/store/api/schoolAdminApi';

export function Navbar() {
  const { user, getDashboardPath } = useAuth();
  const { open } = useSidebar();
  const userRole = useSelector((state: RootState) => state.auth.user?.role);

  // Get school name and logo for school admins, teachers, and students
  const { data: schoolResponse } = useGetMySchoolQuery(undefined, {
    skip: userRole !== 'SCHOOL_ADMIN',
  });
  const { data: teacherSchoolResponse } = useGetMyTeacherSchoolQuery(undefined, {
    skip: userRole !== 'TEACHER',
  });
  const { data: studentSchoolResponse } = useGetMyStudentSchoolQuery(undefined, {
    skip: userRole !== 'STUDENT',
  });
  
  // Combine school data from all sources
  const school = schoolResponse?.data || teacherSchoolResponse?.data || studentSchoolResponse?.data;
  const schoolName = school?.name;
  const schoolLogo = school?.logo;
  const [logoError, setLogoError] = useState(false);

  // Show school type selector only for school admins
  const showSchoolTypeSelector = userRole === 'SCHOOL_ADMIN';
  
  // Determine which logo to show - show school logo if available and no error, otherwise show Agora logo
  const shouldShowSchoolLogo = 
    (userRole === 'SCHOOL_ADMIN' || userRole === 'TEACHER' || userRole === 'STUDENT') &&
    schoolLogo && 
    !logoError;

  return (
    <nav className={`bg-[var(--light-bg)] dark:bg-dark-bg transition-all duration-300 fixed top-0 right-0 left-0 z-30 ${open ? 'md:left-[250px]' : 'md:left-[80px]'
      }`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              {shouldShowSchoolLogo ? (
                <img
                  src={schoolLogo!}
                  alt={schoolName || 'School Logo'}
                  className="h-8 w-8 object-contain flex-shrink-0 rounded"
                  onError={() => setLogoError(true)}
                />
              ) : (
                // Agora default logo fallback
                <div className="h-8 w-9 bg-blue-600 dark:bg-blue-500 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
              )}
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {(userRole === 'SCHOOL_ADMIN' || userRole === 'TEACHER' || userRole === 'STUDENT') && schoolName ? schoolName : 'Agora'}
              </span>
            </Link>
            {user && (
              <div className="ml-10 flex items-center space-x-4">
                <Link
                  href={getDashboardPath()}
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
             
             
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {showSchoolTypeSelector && <SchoolTypeSelector />}
            <ThemeToggle />
            {!user && (
              <div className="flex items-center space-x-2">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
