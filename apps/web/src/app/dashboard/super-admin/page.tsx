'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function SuperAdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to overview page
    router.replace('/dashboard/super-admin/overview');
  }, [router]);

  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    </ProtectedRoute>
  );
}
