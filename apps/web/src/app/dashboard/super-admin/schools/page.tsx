'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Pagination } from '@/components/ui/Pagination';
import { useSchools } from '@/hooks/useSchools';
import { Search, Grid3x3, List, MoreVertical, Target, Users } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'active' | 'inactive';

export default function SchoolsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const { schools, pagination, isLoading, error } = useSchools({
    page,
    limit,
    search: debouncedSearch || undefined,
    filter: filter !== 'all' ? filter : undefined,
  });


  if (isLoading && !schools.length) {
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
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="w-full space-y-6">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="font-bold text-light-text-primary dark:text-white mb-2" style={{ fontSize: 'var(--text-page-title)' }}>
              Schools
            </h1>
            <p className="text-light-text-secondary dark:text-[#9ca3af]" style={{ fontSize: 'var(--text-page-subtitle)' }}>
              Create and manage schools on the platform
            </p>
          </div>
          <Link href="/dashboard/super-admin/schools/add">
            <Button variant="accent" size="md" className="bg-[#f97316] hover:bg-[#ea580c] text-white">
              Create School
            </Button>
          </Link>
        </motion.div>

        {/* Search and Filter Section */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-light-text-secondary dark:text-[#9ca3af]" />
              <Input
                type="text"
                placeholder="Search schools by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-light-card dark:bg-[#151a23] border-light-border dark:border-[#1a1f2e] text-light-text-primary dark:text-white placeholder:text-light-text-muted dark:placeholder:text-[#6b7280]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              {(['all', 'active', 'inactive'] as FilterType[]).map((filterType) => (
                <Button
                  key={filterType}
                  variant={filter === filterType ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setFilter(filterType);
                    setPage(1);
                  }}
                  className={cn(
                    'capitalize',
                    filter === filterType
                      ? 'bg-[#2490FD] dark:bg-[#2490FD] text-white'
                      : 'bg-light-surface dark:bg-[#151a23] text-light-text-secondary dark:text-[#9ca3af] hover:bg-light-hover dark:hover:bg-[#1f2937]'
                  )}
                >
                  {filterType}
                </Button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-light-surface dark:bg-[#151a23] border border-light-border dark:border-[#1a1f2e] rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'h-8 w-8 p-0',
                  viewMode === 'grid'
                    ? 'bg-[#2490FD] dark:bg-[#2490FD] text-white'
                    : 'text-light-text-secondary dark:text-[#9ca3af] hover:text-light-text-primary dark:hover:text-white'
                )}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn(
                  'h-8 w-8 p-0',
                  viewMode === 'list'
                    ? 'bg-[#2490FD] dark:bg-[#2490FD] text-white'
                    : 'text-light-text-secondary dark:text-[#9ca3af] hover:text-light-text-primary dark:hover:text-white'
                )}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Total Count */}
            <span className="text-sm text-light-text-secondary dark:text-[#9ca3af]">
              {pagination?.total || 0}
            </span>
          </div>
        </div>

        {/* Schools Grid/List */}
        <div>
          <h2 className="font-semibold text-light-text-primary dark:text-white mb-4" style={{ fontSize: 'var(--text-section-title)' }}>
            All Schools
          </h2>

          {schools.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-light-text-secondary dark:text-[#9ca3af]">
                  No schools found. Click &quot;Create School&quot; to add one.
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {schools.map((school) => {
                return (
                  <motion.div
                    key={school.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-lg transition-shadow h-full flex flex-col"
                      onClick={() => router.push(`/dashboard/super-admin/schools/${school.id}`)}
                    >
                    <CardContent className="p-4 flex-1 flex flex-col" style={{ padding: 'var(--card-padding)' }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-light-text-primary dark:text-white truncate" style={{ fontSize: 'var(--text-card-title)' }}>
                              {school.name}
                            </h3>
                            <span
                              className={cn(
                                'px-2.5 py-0.5 rounded-full text-xs font-medium',
                                school.isActive
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              )}
                            >
                              {school.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-light-text-secondary dark:text-[#9ca3af] line-clamp-2" style={{ fontSize: 'var(--text-body)' }}>
                            {school.city || 'N/A'}, {school.state || 'N/A'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Add dropdown menu
                          }}
                          className="text-light-text-secondary dark:text-[#9ca3af] hover:text-light-text-primary dark:hover:text-white p-1"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 text-light-text-secondary dark:text-[#9ca3af] mt-auto" style={{ fontSize: 'var(--text-body)' }}>
                        <div className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          <span>{school.teachersCount || 0} Teachers</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{school.studentsCount || 0} Students</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {schools.map((school) => (
                <motion.div
                  key={school.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Card
                    className="cursor-pointer hover:bg-light-hover dark:hover:bg-[#1f2937] transition-colors"
                    onClick={() => router.push(`/dashboard/super-admin/schools/${school.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-light-text-primary dark:text-white">
                              {school.name}
                            </h3>
                            <span
                              className={cn(
                                'px-2.5 py-0.5 rounded-full text-xs font-medium',
                                school.isActive
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              )}
                            >
                              {school.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-sm text-light-text-secondary dark:text-[#9ca3af]">
                            {school.city || 'N/A'}, {school.state || 'N/A'}
                          </p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm font-medium text-light-text-primary dark:text-white">
                              {school.teachersCount || 0} teachers
                            </p>
                            <p className="text-xs text-light-text-muted dark:text-[#6b7280]">
                              {school.subdomain}.agora.com
                            </p>
                          </div>
                          <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                            View →
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
            itemsPerPage={limit}
            onItemsPerPageChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            totalItems={pagination.total}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
