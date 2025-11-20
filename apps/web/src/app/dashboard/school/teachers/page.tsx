'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Alert } from '@/components/ui/Alert';
import { motion } from 'framer-motion';
import { Users, Plus, FileSpreadsheet, ChevronLeft, ChevronRight, Loader2, AlertCircle, Mail, CheckCircle, Clock, Ban } from 'lucide-react';
import { useGetStaffListQuery, useGetMySchoolQuery, useResendPasswordResetForStaffMutation } from '@/lib/store/api/schoolAdminApi';
import { useDebounce } from '@/hooks/useDebounce';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology } from '@/lib/utils/terminology';
import { PermissionAssignmentModal } from '@/components/permissions/PermissionAssignmentModal';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import { StaffImportModal } from '@/components/modals/StaffImportModal';
import toast from 'react-hot-toast';

export default function StaffPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
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

  // Debounce search query to avoid too many API calls
  const debouncedSearch = useDebounce(searchQuery, 500);

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

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Format phone number for display
  const formatPhone = (phone: string) => {
    return phone;
  };

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
            className="w-12 h-12 rounded-full object-cover border-2 border-light-border dark:border-dark-border shadow-sm"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }
    
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white font-semibold text-sm border-2 border-light-border dark:border-dark-border shadow-sm flex-shrink-0">
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

  // Get status badge config based on account status
  const getStatusBadge = (accountStatus: string) => {
    switch (accountStatus) {
      case 'ACTIVE':
        return {
          icon: CheckCircle,
          label: 'Active',
          className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        };
      case 'SHADOW':
        return {
          icon: Clock,
          label: 'Pending',
          className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        };
      case 'SUSPENDED':
        return {
          icon: Ban,
          label: 'Suspended',
          className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        };
      case 'ARCHIVED':
        return {
          icon: Ban,
          label: 'Archived',
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
        };
      default:
        return {
          icon: Clock,
          label: 'Unknown',
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
        };
    }
  };

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                Staff
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                Manage all staff in your school
              </p>
            </div>
            <PermissionGate resource={PermissionResource.STAFF} type={PermissionType.WRITE}>
              <div className="flex items-center gap-3">
                <Link href="/dashboard/school/teachers/add">
                  <Button variant="primary" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Staff
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => setShowImportModal(true)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </div>
            </PermissionGate>
          </div>
        </motion.div>

        {/* Error State */}
        {error && (
          <Alert variant="error" className="mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <div className="flex-1">
                <p className="font-semibold">Failed to load staff list</p>
                <p className="text-sm mt-1">
                  {error && 'data' in error
                    ? (error.data as any)?.message || 'An error occurred while loading staff data'
                    : 'An error occurred while loading staff data'}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Staff Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                All Staff {meta ? `(${meta.total})` : ''}
              </CardTitle>
              {/* Search and Filters */}
              <div className="flex items-center gap-3">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by name, email, or subject..."
                  containerClassName="w-64"
                  size="md"
                />
                <div className="w-40">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-light-border dark:border-dark-border rounded-lg bg-light-bg dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 h-9"
                  >
                    <option value="All">All Roles</option>
                    {availableRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="ml-3 text-light-text-secondary dark:text-dark-text-secondary">
                  Loading staff...
                </span>
              </div>
            ) : staff.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  {searchQuery || roleFilter !== 'All'
                    ? `No ${terminology.staff.toLowerCase()} found matching your criteria.`
                    : `No ${terminology.staff.toLowerCase()} found. Click "Add ${terminology.staffSingular}" to get started.`}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-light-border dark:border-dark-border">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                          Role
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                          Subject
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                          Contact
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((staffMember, index) => (
                        <motion.tr
                          key={staffMember.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-light-border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors cursor-pointer"
                          onClick={() => router.push(`/dashboard/school/teachers/${staffMember.id}`)}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <div className="flex-shrink-0">
                                <StaffAvatar
                                  profileImage={staffMember.profileImage}
                                  firstName={staffMember.firstName}
                                  lastName={staffMember.lastName}
                                />
                              </div>
                              {/* Name and Email */}
                              <div>
                                <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                  {staffMember.firstName} {staffMember.lastName}
                                </p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                  {staffMember.email || 'No email'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                staffMember.role === 'Principal'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                  : staffMember.role === 'Teacher'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}
                            >
                              {staffMember.role || 'N/A'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {staffMember.subject || 'N/A'}
                          </td>
                          <td className="py-4 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {formatPhone(staffMember.phone)}
                          </td>
                          <td className="py-4 px-4">
                            {(() => {
                              const statusConfig = getStatusBadge(staffMember.accountStatus);
                              const StatusIcon = statusConfig.icon;
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  {statusConfig.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center space-x-2">
                              <Link href={`/dashboard/school/teachers/${staffMember.id}`}>
                                <Button variant="ghost" size="sm">
                                  View
                                </Button>
                              </Link>
                              {/* Resend invitation button for pending accounts */}
                              {staffMember.accountStatus === 'SHADOW' && staffMember.email && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => handleResendInvitation(
                                    staffMember.id, 
                                    `${staffMember.firstName} ${staffMember.lastName}`,
                                    e
                                  )}
                                  disabled={resendingStaffId === staffMember.id}
                                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                >
                                  {resendingStaffId === staffMember.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Mail className="h-4 w-4 mr-1" />
                                      Resend
                                    </>
                                  )}
                                </Button>
                              )}
                              {staffMember.type === 'admin' && staffMember.role?.toLowerCase() !== 'principal' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    // Handle permission assignment
                                    setSelectedAdminForPermissions({
                                      id: staffMember.id,
                                      name: `${staffMember.firstName} ${staffMember.lastName}`,
                                      role: staffMember.role || 'Administrator',
                                    });
                                  }}
                                >
                                  Permissions
                                </Button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination info and controls at bottom */}
                {meta && (
                  <div className="mt-6 pt-4 border-t border-light-border dark:border-dark-border">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        Showing {meta.page === 1 ? 1 : (meta.page - 1) * meta.limit + 1} to{' '}
                        {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} {terminology.staff.toLowerCase()}
                      </p>
                      {meta.totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={!meta.hasPrev || isLoading}
                            className="disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((page) => {
                              if (
                                page === 1 ||
                                page === meta.totalPages ||
                                (page >= currentPage - 1 && page <= currentPage + 1)
                              ) {
                                return (
                                  <Button
                                    key={page}
                                    variant={currentPage === page ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => handlePageChange(page)}
                                    disabled={isLoading}
                                    className="min-w-[40px] disabled:opacity-50"
                                  >
                                    {page}
                                  </Button>
                                );
                              } else if (page === currentPage - 2 || page === currentPage + 2) {
                                return (
                                  <span
                                    key={page}
                                    className="px-2 text-light-text-secondary dark:text-dark-text-secondary"
                                  >
                                    ...
                                  </span>
                                );
                              }
                              return null;
                            })}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={!meta.hasNext || isLoading}
                            className="disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

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
