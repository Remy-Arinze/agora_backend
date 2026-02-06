'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/dashboard/StatCard';
import { motion } from 'framer-motion';
import { GraduationCap, Plus, FileSpreadsheet, Search, Grid3x3, List, MoreVertical, CheckCircle, Clock, Ban, Mail, Loader2, Users } from 'lucide-react';
import { useGetStudentsQuery, useGetMySchoolQuery, useResendPasswordResetForStudentMutation } from '@/lib/store/api/schoolAdminApi';
import { useSchoolType } from '@/hooks/useSchoolType';
import { StudentImportModal } from '@/components/modals/StudentImportModal';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'active' | 'pending' | 'suspended';

// Avatar component for students
const StudentAvatar = ({ 
  profileImage, 
  firstName, 
  lastName 
}: { 
  profileImage?: string | null; 
  firstName?: string; 
  lastName?: string; 
}) => {
  const [imageError, setImageError] = useState(false);
  
  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0]?.toUpperCase() || '';
    const last = lastName?.[0]?.toUpperCase() || '';
    return first + last || '?';
  };
  
  if (profileImage && !imageError) {
    return (
      <div className="relative w-12 h-12 flex-shrink-0">
        <img
          src={profileImage}
          alt={`${firstName} ${lastName}`}
          className="w-12 h-12 rounded-full object-cover border-2 border-[#1a1f2e] dark:border-[#1a1f2e] shadow-sm"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }
  
  return (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white font-semibold text-sm border-2 border-[#1a1f2e] dark:border-[#1a1f2e] shadow-sm flex-shrink-0">
      {getInitials(firstName, lastName)}
    </div>
  );
};

export default function StudentsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterType>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [resendingStudentId, setResendingStudentId] = useState<string | null>(null);

  // Get school ID and school type
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;
  const { currentType } = useSchoolType();

  // Resend invitation mutation
  const [resendInvitation] = useResendPasswordResetForStudentMutation();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: studentsResponse, isLoading, error } = useGetStudentsQuery(
    { schoolId: schoolId!, page, limit, schoolType: currentType || undefined },
    { skip: !schoolId }
  );
  const students = studentsResponse?.data?.items || [];
  const pagination = studentsResponse?.data;
  
  // Calculate pagination helpers
  const hasNext = pagination ? pagination.page < pagination.totalPages : false;
  const hasPrev = pagination ? pagination.page > 1 : false;

  // Calculate stats
  const stats = useMemo(() => {
    const total = pagination?.total || 0;
    const active = students.filter(s => s.user?.accountStatus === 'ACTIVE').length;
    const pending = students.filter(s => s.user?.accountStatus === 'SHADOW').length;
    const suspended = students.filter(s => s.user?.accountStatus === 'SUSPENDED').length;
    
    return { total, active, pending, suspended };
  }, [students, pagination]);

  // Filter students by status and search
  const filteredStudents = useMemo(() => {
    let filtered = students;
    
    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(s => {
        if (filter === 'active') return s.user?.accountStatus === 'ACTIVE';
        if (filter === 'pending') return s.user?.accountStatus === 'SHADOW';
        if (filter === 'suspended') return s.user?.accountStatus === 'SUSPENDED';
        return true;
      });
    }
    
    // Apply search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.firstName.toLowerCase().includes(query) ||
          student.lastName.toLowerCase().includes(query) ||
          student.uid.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [students, filter, debouncedSearch]);

  // Handle resend invitation
  const handleResendInvitation = async (studentId: string, studentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!schoolId) return;
    
    setResendingStudentId(studentId);
    try {
      await resendInvitation({ schoolId, studentId }).unwrap();
      toast.success(`Invitation email resent to ${studentName}`);
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to resend invitation');
    } finally {
      setResendingStudentId(null);
    }
  };

  // Get status badge config
  const getStatusBadge = (accountStatus: string | undefined) => {
    switch (accountStatus) {
      case 'ACTIVE':
        return {
          icon: CheckCircle,
          label: 'Active',
          className: 'bg-green-500/20 text-green-400',
        };
      case 'SHADOW':
        return {
          icon: Clock,
          label: 'Pending',
          className: 'bg-amber-500/20 text-amber-400',
        };
      case 'SUSPENDED':
        return {
          icon: Ban,
          label: 'Suspended',
          className: 'bg-red-500/20 text-red-400',
        };
      case 'ARCHIVED':
        return {
          icon: Ban,
          label: 'Archived',
          className: 'bg-gray-500/20 text-gray-400',
        };
      default:
        return {
          icon: CheckCircle,
          label: 'Active',
          className: 'bg-green-500/20 text-green-400',
        };
    }
  };

  if (isLoading && !students.length) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    const errorMessage = error && 'status' in error 
      ? (error as any).data?.message || 'Failed to fetch students'
      : 'Failed to load students';
    
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full">
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full space-y-6">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="font-bold text-light-text-primary dark:text-white mb-2" style={{ fontSize: 'var(--text-page-title)' }}>
              Students
            </h1>
            <p className="text-light-text-secondary dark:text-[#9ca3af]" style={{ fontSize: 'var(--text-page-subtitle)' }}>
              Manage all students in your school
            </p>
          </div>
          <PermissionGate resource={PermissionResource.STUDENTS} type={PermissionType.WRITE}>
            <div className="flex items-center gap-3">
              <Button variant="accent" size="md" className="bg-[#f97316] hover:bg-[#ea580c] text-white" onClick={() => router.push('/dashboard/school/admissions?new=true')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowImportModal(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </div>
          </PermissionGate>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Students"
            value={stats.total}
            icon={
              <GraduationCap className="text-blue-600 dark:text-blue-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
          <StatCard
            title="Active Students"
            value={stats.active}
            change="+18%"
            changeType="positive"
            icon={
              <CheckCircle className="text-green-600 dark:text-green-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
          <StatCard
            title="Pending Students"
            value={stats.pending}
            icon={
              <Clock className="text-amber-600 dark:text-amber-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
          <StatCard
            title="Suspended Students"
            value={stats.suspended}
            icon={
              <Ban className="text-red-600 dark:text-red-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
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
                placeholder="Search students by name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-light-card dark:bg-[#151a23] border-light-border dark:border-[#1a1f2e] text-light-text-primary dark:text-white placeholder:text-light-text-muted dark:placeholder:text-[#6b7280]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              {(['all', 'active', 'pending', 'suspended'] as FilterType[]).map((filterType) => (
                <Button
                  key={filterType}
                  variant="ghost"
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

        {/* Students Grid/List */}
        <div>
          <h2 className="font-semibold text-light-text-primary dark:text-white mb-4" style={{ fontSize: 'var(--text-section-title)' }}>
            All Students
          </h2>

          {filteredStudents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-light-text-secondary dark:text-[#9ca3af]">
                  No students found. Click &quot;Add Student&quot; to add one.
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStudents.map((student) => {
                
                const statusConfig = getStatusBadge(student.user?.accountStatus);
                const StatusIcon = statusConfig.icon;

                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-lg transition-shadow h-full flex flex-col"
                      onClick={() => router.push(`/dashboard/school/students/${student.id}`)}
                    >
                      <CardContent className="p-4 flex-1 flex flex-col" style={{ padding: 'var(--card-padding)' }}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1">
                            <StudentAvatar
                              profileImage={student.profileImage}
                              firstName={student.firstName}
                              lastName={student.lastName}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-light-text-primary dark:text-white" style={{ fontSize: 'var(--text-card-title)' }}>
                                  {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
                                </h3>
                                <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', statusConfig.className)}>
                                  <StatusIcon className="h-3 w-3 inline mr-1" />
                                  {statusConfig.label}
                                </span>
                              </div>
                              <p className="text-light-text-secondary dark:text-[#9ca3af]" style={{ fontSize: 'var(--text-body)' }}>
                                {student.uid}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="text-light-text-secondary dark:text-[#9ca3af] hover:text-light-text-primary dark:hover:text-white p-1"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-4 text-light-text-secondary dark:text-[#9ca3af] mt-auto" style={{ fontSize: 'var(--text-body)' }}>
                          <div className="flex items-center gap-1">
                            <span>{student.enrollment?.classLevel || 'N/A'}</span>
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
              {filteredStudents.map((student) => {
                const statusConfig = getStatusBadge(student.user?.accountStatus);
                const StatusIcon = statusConfig.icon;

                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Card
                      className="cursor-pointer hover:bg-light-hover dark:hover:bg-[#1f2937] transition-colors"
                      onClick={() => router.push(`/dashboard/school/students/${student.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <StudentAvatar
                              profileImage={student.profileImage}
                              firstName={student.firstName}
                              lastName={student.lastName}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-light-text-primary dark:text-white">
                                  {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
                                </h3>
                                <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', statusConfig.className)}>
                                  <StatusIcon className="h-3 w-3 inline mr-1" />
                                  {statusConfig.label}
                                </span>
                              </div>
                              <p className="text-sm text-light-text-secondary dark:text-[#9ca3af]">
                                {student.uid} • {student.enrollment?.classLevel || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm font-medium text-light-text-primary dark:text-white">
                                {new Date(student.dateOfBirth).toLocaleDateString()}
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

        {/* Import Modal */}
        {schoolId && (
          <StudentImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            schoolId={schoolId}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
