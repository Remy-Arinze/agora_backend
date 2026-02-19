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
import { FadeInUp } from '@/components/ui/FadeInUp';
import { Users, Plus, FileSpreadsheet, Search, Grid3x3, List, MoreVertical, BookOpen, CheckCircle, Clock, Ban, Mail, Loader2 } from 'lucide-react';
import { useGetStaffListQuery, useGetMySchoolQuery, useResendPasswordResetForStaffMutation } from '@/lib/store/api/schoolAdminApi';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology } from '@/lib/utils/terminology';
import { PermissionAssignmentModal } from '@/components/permissions/PermissionAssignmentModal';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import { StaffImportModal } from '@/components/modals/StaffImportModal';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'active' | 'pending' | 'suspended';

export default function StaffPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterType>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const itemsPerPage = 4; // Show 4 items per page (2 rows of 2 columns)
  const [selectedAdminForPermissions, setSelectedAdminForPermissions] = useState<{
    id: string;
    name: string;
    role: string;
  } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Get school ID
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;

  // Get school type and terminology
  const { currentType } = useSchoolType();
  const terminology = getTerminology(currentType);

  // Resend invitation mutation
  const [resendInvitation, { isLoading: isResending }] = useResendPasswordResetForStaffMutation();
  const [resendingStaffId, setResendingStaffId] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch staff list from API
  const {
    data: staffResponse,
    isLoading,
    error,
    refetch,
  } = useGetStaffListQuery({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch || undefined,
    role: roleFilter !== 'All' ? roleFilter : undefined,
    schoolType: currentType || undefined,
  });

  const staffList = staffResponse?.data;
  const staff = staffList?.items || [];
  const meta = staffList?.meta;
  const availableRoles = staffList?.availableRoles || [];

  // Calculate stats
  const stats = useMemo(() => {
    const total = meta?.total || 0;
    const active = staff.filter(s => s.accountStatus === 'ACTIVE').length;
    const pending = staff.filter(s => s.accountStatus === 'SHADOW').length;
    const suspended = staff.filter(s => s.accountStatus === 'SUSPENDED').length;
    
    return { total, active, pending, suspended };
  }, [staff, meta]);

  // Filter staff by status
  const filteredStaff = useMemo(() => {
    if (filter === 'all') return staff;
    return staff.filter(s => {
      if (filter === 'active') return s.accountStatus === 'ACTIVE';
      if (filter === 'pending') return s.accountStatus === 'SHADOW';
      if (filter === 'suspended') return s.accountStatus === 'SUSPENDED';
      return true;
    });
  }, [staff, filter]);

  // Get initials from name
  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0]?.toUpperCase() || '';
    const last = lastName?.[0]?.toUpperCase() || '';
    return first + last || '?';
  };

  // Avatar component for staff
  const StaffAvatar = ({ 
    profileImage, 
    firstName, 
    lastName 
  }: { 
    profileImage?: string | null; 
    firstName?: string; 
    lastName?: string; 
  }) => {
    const [imageError, setImageError] = useState(false);
    
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
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white font-semibold border-2 border-[#1a1f2e] dark:border-[#1a1f2e] shadow-sm flex-shrink-0" style={{ fontSize: 'var(--text-body)' }}>
        {getInitials(firstName, lastName)}
      </div>
    );
  };

  // Handle resend invitation
  const handleResendInvitation = async (staffId: string, staffName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!schoolId) return;
    
    setResendingStaffId(staffId);
    try {
      await resendInvitation({ schoolId, staffId }).unwrap();
      toast.success(`Invitation email resent to ${staffName}`);
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to resend invitation');
    } finally {
      setResendingStaffId(null);
    }
  };

  // Get status badge config
  const getStatusBadge = (accountStatus: string) => {
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
          icon: Clock,
          label: 'Unknown',
          className: 'bg-gray-500/20 text-gray-400',
        };
    }
  };

  if (isLoading && !staff.length) {
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
      ? (error as any).data?.message || 'Failed to fetch staff'
      : 'Failed to load staff';
    
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
              Staff
            </h1>
            <p className="text-light-text-secondary dark:text-[#9ca3af]" style={{ fontSize: 'var(--text-page-subtitle)' }}>
              Manage all staff in your school
            </p>
          </div>
          <PermissionGate resource={PermissionResource.STAFF} type={PermissionType.WRITE}>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/school/teachers/add">
                <Button variant="primary" size="sm" className="bg-[#f97316] hover:bg-[#ea580c] text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Staff
                </Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </div>
          </PermissionGate>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Staff"
            value={stats.total}
            icon={
              <Users className="text-blue-600 dark:text-blue-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
          <StatCard
            title="Active Staff"
            value={stats.active}
            change="+12%"
            changeType="positive"
            icon={
              <CheckCircle className="text-green-600 dark:text-green-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
          <StatCard
            title="Pending Staff"
            value={stats.pending}
            icon={
              <Clock className="text-amber-600 dark:text-amber-400" style={{ width: 'var(--stat-icon-size)', height: 'var(--stat-icon-size)' }} />
            }
          />
          <StatCard
            title="Suspended Staff"
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
                placeholder="Search staff by name, email, or subject..."
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
                    setCurrentPage(1);
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

            {/* Role Filter */}
            <div className="w-40">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2 py-1.5 border border-light-border dark:border-[#1a1f2e] rounded-lg bg-light-card dark:bg-[#151a23] text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2490FD] h-9"
                style={{ fontSize: 'var(--text-body)' }}
              >
                <option value="All">All Roles</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
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
            <span className="text-light-text-secondary dark:text-[#9ca3af]" style={{ fontSize: 'var(--text-body)' }}>
              {meta?.total || 0}
            </span>
          </div>
        </div>

        {/* Staff Grid/List */}
        <div>
          <p className="font-medium text-light-text-secondary dark:text-dark-text-secondary mb-4" style={{ fontSize: 'var(--text-section-title)' }}>
            All Staff
          </p>

          {filteredStaff.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-light-text-secondary dark:text-[#9ca3af]">
                  No staff found. Click &quot;Add Staff&quot; to add one.
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredStaff.map((staffMember) => {
                
                const statusConfig = getStatusBadge(staffMember.accountStatus);
                const StatusIcon = statusConfig.icon;

                return (
                  <motion.div
                    key={staffMember.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-lg transition-shadow h-full flex flex-col"
                      onClick={() => router.push(`/dashboard/school/teachers/${staffMember.id}`)}
                    >
                      <CardContent className="p-4 flex-1 flex flex-col" style={{ padding: 'var(--card-padding)' }}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1">
                            <StaffAvatar
                              profileImage={staffMember.profileImage}
                              firstName={staffMember.firstName}
                              lastName={staffMember.lastName}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-light-text-primary dark:text-white" style={{ fontSize: 'var(--text-card-title)' }}>
                                  {staffMember.firstName} {staffMember.lastName}
                                </h3>
                                <span className={cn('px-2.5 py-0.5 rounded-full font-medium', statusConfig.className)} style={{ fontSize: 'var(--text-small)' }}>
                                  <StatusIcon className="h-3 w-3 inline mr-1" />
                                  {statusConfig.label}
                                </span>
                              </div>
                              <p className="text-light-text-secondary dark:text-[#9ca3af]" style={{ fontSize: 'var(--text-body)' }}>
                                {staffMember.email || 'No email'}
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
                            <span className={cn(
                              'px-2 py-0.5 rounded font-medium',
                              staffMember.role === 'Principal'
                                ? 'bg-purple-500/20 text-purple-400'
                                : staffMember.role === 'Teacher'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-blue-500/20 text-blue-400'
                            )} style={{ fontSize: 'var(--text-small)' }}>
                              {staffMember.role || 'N/A'}
                            </span>
                          </div>
                          {staffMember.subject && (
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-4 w-4" />
                              <span>{staffMember.subject}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStaff.map((staffMember) => {
                const statusConfig = getStatusBadge(staffMember.accountStatus);
                const StatusIcon = statusConfig.icon;

                return (
                  <motion.div
                    key={staffMember.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Card
                      className="cursor-pointer hover:bg-light-hover dark:hover:bg-[#1f2937] transition-colors"
                      onClick={() => router.push(`/dashboard/school/teachers/${staffMember.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <StaffAvatar
                              profileImage={staffMember.profileImage}
                              firstName={staffMember.firstName}
                              lastName={staffMember.lastName}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-light-text-primary dark:text-white">
                                  {staffMember.firstName} {staffMember.lastName}
                                </h3>
                                <span className={cn('px-2.5 py-0.5 rounded-full font-medium', statusConfig.className)} style={{ fontSize: 'var(--text-small)' }}>
                                  <StatusIcon className="h-3 w-3 inline mr-1" />
                                  {statusConfig.label}
                                </span>
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium',
                                  staffMember.role === 'Principal'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : staffMember.role === 'Teacher'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-blue-500/20 text-blue-400'
                                )}>
                                  {staffMember.role || 'N/A'}
                                </span>
                              </div>
                              <p className="text-light-text-secondary dark:text-[#9ca3af]" style={{ fontSize: 'var(--text-body)' }}>
                                {staffMember.email || 'No email'} • {staffMember.subject || 'No subject'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="font-medium text-light-text-primary dark:text-white" style={{ fontSize: 'var(--text-body)' }}>
                                {staffMember.phone || 'N/A'}
                              </p>
                            </div>
                            <span className="text-blue-600 dark:text-blue-400 font-medium" style={{ fontSize: 'var(--text-body)' }}>
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
        {meta && meta.totalPages > 1 && (
          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(newLimit) => {
              setCurrentPage(1);
            }}
            totalItems={meta.total}
          />
        )}

        {/* Import Modal */}
        {schoolId && (
          <StaffImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            schoolId={schoolId}
          />
        )}

        {/* Permission Assignment Modal */}
        {selectedAdminForPermissions && (
          <PermissionAssignmentModal
            isOpen={!!selectedAdminForPermissions}
            onClose={() => setSelectedAdminForPermissions(null)}
            adminId={selectedAdminForPermissions.id}
            adminName={selectedAdminForPermissions.name}
            adminRole={selectedAdminForPermissions.role}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
