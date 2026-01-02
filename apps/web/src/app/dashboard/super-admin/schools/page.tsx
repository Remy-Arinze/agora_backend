'use client';

import { motion } from 'framer-motion';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SchoolsTable } from '@/components/dashboard/SchoolsTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSchools } from '@/hooks/useSchools';

export default function SchoolsPage() {
  const { schools, isLoading, error } = useSchools();

  // Transform API data to match component interface
  const transformedSchools = schools.map((school) => ({
    id: school.id,
    name: school.name,
    subdomain: school.subdomain,
    city: school.city || 'N/A',
    state: school.state || 'N/A',
    students: school.studentsCount ?? 0,
    teachers: school.teachersCount || 0,
    status: school.isActive ? ('active' as const) : ('inactive' as const),
    createdAt: school.createdAt,
  }));

  if (isLoading) {
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    const errorMessage = error && 'status' in error 
      ? (error as any).data?.message || 'Failed to fetch schools'
      : 'Failed to load schools';
    
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
              Schools
            </h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Manage all schools in the platform
            </p>
          </motion.div>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Schools
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Manage all schools in the platform
          </p>
        </motion.div>

        <SchoolsTable schools={transformedSchools} />
      </div>
    </ProtectedRoute>
  );
}

