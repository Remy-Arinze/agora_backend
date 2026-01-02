'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to overview page
    router.replace('/dashboard/school/overview');
  }, [router]);

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    </ProtectedRoute>
  );
}

