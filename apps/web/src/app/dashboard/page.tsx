'use client';

import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { RootState } from '@/lib/store/store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      const roleMap: Record<string, string> = {
        SUPER_ADMIN: '/dashboard/super-admin/overview',
        SCHOOL_ADMIN: '/dashboard/school',
        TEACHER: '/dashboard/teacher',
        STUDENT: '/dashboard/student',
      };
      const redirectPath = roleMap[user.role];
      if (redirectPath) {
        router.push(redirectPath);
      }
    }
  }, [user, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

