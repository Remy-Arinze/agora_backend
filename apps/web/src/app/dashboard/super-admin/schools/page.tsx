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
import { StatCard } from '@/components/dashboard/StatCard';
import { EntityAvatar } from '@/components/ui/EntityAvatar';
import { useSchools } from '@/hooks/useSchools';
import { Search, Grid3x3, List, MoreVertical, Target, Users, Building2, CheckCircle, XCircle } from 'lucide-react';
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

  // Calculate stats from current page data and pagination
  const activeSchoolsOnPage = schools.filter(s => s.isActive).length;
  const inactiveSchoolsOnPage = schools.filter(s => !s.isActive).length;
  
  // For stats, we show totals from pagination when available
  // When filtered, the pagination.total reflects the filtered count
  const totalSchools = pagination?.total ?? 0;
  const showingCount = schools.length;
  
  // Calculate active/inactive based on filter
  // When filtered, all schools on page match the filter
  // When "all", we estimate from current page (not perfect but gives an idea)
  const activeCount = filter === 'active' 
    ? totalSchools 
    : filter === 'inactive' 
    ? 0 
    : activeSchoolsOnPage; // Estimate from current page
    
  const inactiveCount = filter === 'inactive' 
    ? totalSchools 
    : filter === 'active' 
    ? 0 
    : inactiveSchoolsOnPage; // Estimate from current page


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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Schools"
            value={totalSchools}
            icon={
              <Building2 className="text-blue-600 dark:text-blue-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
          <StatCard
            title="Active Schools"
            value={activeCount}
            icon={
              <CheckCircle className="text-green-600 dark:text-green-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
          <StatCard
            title="Inactive Schools"
            value={inactiveCount}
            icon={
              <XCircle className="text-gray-600 dark:text-gray-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
          <StatCard
            title="Showing"
            value={`${showingCount} of ${totalSchools}`}
            icon={
              <Grid3x3 className="text-blue-600 dark:text-blue-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
        </div>

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
          <h2 className="font-medium text-light-text-secondary dark:text-[#9ca3af] mb-4 text-sm opacity-70">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schools.map((school) => {
                // Get school levels
                const levels = [];
                if (school.hasPrimary) levels.push('Primary');
                if (school.hasSecondary) levels.push('Secondary');
                if (school.hasTertiary) levels.push('Tertiary');

                return (
                  <motion.div
                    key={school.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 h-full flex flex-col"
                      onClick={() => router.push(`/dashboard/super-admin/schools/${school.id}`)}
                    >
                    <CardContent className="p-4 flex-1 flex flex-col" style={{ padding: 'var(--card-padding)' }}>
                      <div className="flex items-start gap-3">
                        {/* School Avatar */}
                        <EntityAvatar
                          name={school.name}
                          imageUrl={school.logo || undefined}
                          size="md"
                          variant="rounded"
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          {/* Header Row: Name, Status, Menu */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-light-text-primary dark:text-white truncate" style={{ fontSize: 'var(--text-card-title)' }}>
                              {school.name}
                            </h3>
                            <span
                              className={cn(
                                'px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                                school.isActive
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              )}
                            >
                              {school.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Add dropdown menu
                              }}
                              className="text-light-text-secondary dark:text-[#9ca3af] hover:text-light-text-primary dark:hover:text-white p-1 flex-shrink-0 ml-auto"
                            >
                              <MoreVertical className="h-5 w-5" />
                            </button>
                          </div>

                          {/* Location */}
                          <p className="text-light-text-secondary dark:text-[#9ca3af] mb-2" style={{ fontSize: 'var(--text-body)' }}>
                            {school.city || 'N/A'}, {school.state || 'N/A'}
                          </p>

                          {/* School Levels */}
                          {levels.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                              {levels.map((level) => (
                                <span
                                  key={level}
                                  className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                >
                                  {level}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Teachers and Students - Inline */}
                          <div className="flex items-center gap-4 text-light-text-secondary dark:text-[#9ca3af]" style={{ fontSize: 'var(--text-body)' }}>
                            <div className="flex items-center gap-1">
                              <Target className="h-4 w-4" />
                              <span>{school.teachersCount || 0} Teachers</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>{school.studentsCount || 0} Students</span>
                            </div>
                          </div>
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
              {schools.map((school) => {
                // Get school levels
                const levels = [];
                if (school.hasPrimary) levels.push('Primary');
                if (school.hasSecondary) levels.push('Secondary');
                if (school.hasTertiary) levels.push('Tertiary');

                return (
                  <motion.div
                    key={school.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <Card
                      className="cursor-pointer hover:bg-light-hover dark:hover:bg-[#1f2937] transition-all duration-200"
                      onClick={() => router.push(`/dashboard/super-admin/schools/${school.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* School Avatar */}
                          <EntityAvatar
                            name={school.name}
                            imageUrl={school.logo || undefined}
                            size="md"
                            variant="rounded"
                            className="flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            {/* Header Row: Name, Status */}
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-light-text-primary dark:text-white truncate">
                                {school.name}
                              </h3>
                              <span
                                className={cn(
                                  'px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                                  school.isActive
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                )}
                              >
                                {school.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            
                            {/* Location and Levels Row */}
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <p className="text-sm text-light-text-secondary dark:text-[#9ca3af]">
                                {school.city || 'N/A'}, {school.state || 'N/A'}
                              </p>
                              {/* School Levels */}
                              {levels.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {levels.map((level) => (
                                    <span
                                      key={level}
                                      className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    >
                                      {level}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Teachers, Students, and Subdomain - Inline */}
                            <div className="flex items-center gap-4 text-sm text-light-text-secondary dark:text-[#9ca3af] flex-wrap">
                              <div className="flex items-center gap-1">
                                <Target className="h-4 w-4" />
                                <span>{school.teachersCount || 0} teachers</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                <span>{school.studentsCount || 0} students</span>
                              </div>
                              <span className="text-xs text-light-text-muted dark:text-[#6b7280]">
                                {school.subdomain}.agora.com
                              </span>
                            </div>
                          </div>
                          <span className="text-sm text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">
                            View →
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
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
