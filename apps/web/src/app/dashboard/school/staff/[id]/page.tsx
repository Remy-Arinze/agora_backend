'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { 
  Users, 
  Mail, 
  Phone, 
  BookOpen, 
  GraduationCap,
  Edit,
  Clock,
  User,
  Calendar,
  MapPin,
  Award,
  Shield,
  Loader2,
  AlertCircle,
  Send
} from 'lucide-react';
import {
  useGetStaffMemberQuery,
  useGetAdminPermissionsQuery,
  useGetMySchoolQuery,
  useResendPasswordResetForStaffMutation,
  useGetClassesQuery,
  useGetTeacherTimetableClassesQuery,
  PermissionResource,
  PermissionType,
} from '@/lib/store/api/schoolAdminApi';
import { PermissionAssignmentModal } from '@/components/permissions/PermissionAssignmentModal';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource as PermissionResourceHook, PermissionType as PermissionTypeHook } from '@/hooks/usePermissions';
import { EditTeacherProfileModal } from '@/components/modals/EditTeacherProfileModal';
import { useSchoolType } from '@/hooks/useSchoolType';
import { useTeacherSubjects } from '@/hooks/useTeacherSubjects';
import { BackButton } from '@/components/ui/BackButton';
import toast from 'react-hot-toast';
import { isPrincipalRole } from '@/lib/constants/roles';

const RESOURCE_LABELS: Record<PermissionResource, string> = {
  OVERVIEW: 'Dashboard Overview',
  ANALYTICS: 'Analytics',
  SUBSCRIPTIONS: 'Subscriptions',
  STUDENTS: 'Students',
  STAFF: 'Staff',
  CLASSES: 'Classes',
  SUBJECTS: 'Subjects',
  TIMETABLES: 'Timetables',
  CALENDAR: 'Calendar',
  ADMISSIONS: 'Admissions',
  SESSIONS: 'Sessions',
  EVENTS: 'Events',
};

const TYPE_LABELS: Record<PermissionType, string> = {
  READ: 'Read',
  WRITE: 'Write',
  ADMIN: 'Admin (Full Access)',
};

type TabType = 'profile' | 'permissions';

// Passport-style photo component
const PassportPhoto = ({
  profileImage,
  firstName,
  lastName,
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

  return (
    <div className="flex justify-center">
      <div className="relative w-48 h-60 bg-white dark:bg-gray-800 border-4 border-gray-300 dark:border-gray-600 shadow-lg overflow-hidden">
        {profileImage && !imageError ? (
          <img
            src={profileImage}
            alt={`${firstName} ${lastName}`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center">
            <span className="text-white font-bold text-4xl">
              {getInitials(firstName, lastName)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const staffId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  // Get school ID and type
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;
  const { currentType: schoolType } = useSchoolType();

  // Get staff member data
  const { data: staffResponse, isLoading, error, refetch: refetchStaff } = useGetStaffMemberQuery(
    { schoolId: schoolId!, staffId },
    { skip: !schoolId || !staffId }
  );

  const staff = staffResponse?.data;
  const isTeacher = staff?.type === 'teacher';
  const isAdmin = staff?.type === 'admin';

  // Get admin permissions if this is an admin
  const { data: permissionsResponse } = useGetAdminPermissionsQuery(
    { schoolId: schoolId!, adminId: staffId },
    { skip: !schoolId || !staffId || !isAdmin }
  );

  // Get classes assigned to teacher (only if teacher, not admin)
  // Always fetch ClassTeacher-based assignments (for PRIMARY/TERTIARY form teacher/assistant roles)
  const { data: classesResponse, isLoading: isLoadingClasses } = useGetClassesQuery(
    { schoolId: schoolId!, teacherId: isTeacher ? staffId : undefined },
    { skip: !schoolId || !staffId || !isTeacher }
  );

  // Always fetch timetable-based assignments (for SECONDARY schools)
  // The backend has fallback logic to get the active term if termId is not provided
  const { data: timetableClassesResponse, isLoading: isLoadingTimetableClasses } = useGetTeacherTimetableClassesQuery(
    { schoolId: schoolId!, teacherId: staffId },
    { skip: !schoolId || !staffId || !isTeacher }
  );

  // Filter ClassTeacher-based classes to PRIMARY/TERTIARY only (SECONDARY uses timetable)
  const allTeacherClasses = classesResponse?.data || [];
  const teacherClasses = allTeacherClasses.filter(
    (c: any) => c.type === 'PRIMARY' || c.type === 'TERTIARY'
  );
  const timetableClasses = timetableClassesResponse?.data;
  const permissions = permissionsResponse?.data?.permissions || [];
  const isPrincipal = isAdmin && isPrincipalRole(staff?.role);

  // Get teacher subjects (for teachers with subject competencies - mainly SECONDARY, but can include PRIMARY/TERTIARY)
  const {
    subjects: teacherSubjects,
    isLoading: isLoadingSubjects,
  } = useTeacherSubjects({
    schoolId,
    teacherId: staffId,
    skip: !isTeacher || !schoolId,
  });
  
  // Resend password reset mutation
  const [resendPasswordReset, { isLoading: isResendingPasswordReset }] = useResendPasswordResetForStaffMutation();
  
  // Check if user hasn't set their password yet
  const hasNotSetPassword = staff?.user?.accountStatus === 'SHADOW';
  
  const handleResendPasswordReset = async () => {
    if (!schoolId || !staffId) return;
    
    try {
      await resendPasswordReset({ schoolId, staffId }).unwrap();
      toast.success('Password reset email sent successfully');
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to send password reset email');
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
    ...(isAdmin ? [{ id: 'permissions' as TabType, label: 'Permissions', icon: <Shield className="h-4 w-4" /> }] : []),
  ];

  if (isLoading) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Loading staff details...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !staff) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full">
          <BackButton fallbackUrl="/dashboard/school/teachers" className="mb-4" />
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Staff member not found or error loading details.
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <BackButton fallbackUrl="/dashboard/school/teachers" className="mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                {staff.firstName} {staff.lastName}
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                {staff.role || (isAdmin ? 'Administrator' : 'Teacher')} {staff.subject ? `• ${staff.subject}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasNotSetPassword && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleResendPasswordReset}
                  disabled={isResendingPasswordReset}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isResendingPasswordReset ? 'Sending...' : 'Resend Password Setup Email'}
                </Button>
              )}
              {isAdmin && !isPrincipal && (
                <PermissionGate resource={PermissionResourceHook.STAFF} type={PermissionTypeHook.ADMIN}>
                  <Button variant="ghost" size="sm" onClick={() => setShowPermissionModal(true)}>
                    <Shield className="h-4 w-4 mr-2" />
                    Manage Permissions
                  </Button>
                </PermissionGate>
              )}
              <PermissionGate resource={PermissionResourceHook.STAFF} type={PermissionTypeHook.WRITE}>
                <Button variant="ghost" size="sm" onClick={() => setShowEditProfileModal(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </PermissionGate>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="mb-6 border-b border-light-border dark:border-dark-border">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                        Personal Information
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Full Name
                        </p>
                        <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                          {staff.firstName} {staff.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Email
                        </p>
                        <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                          {staff.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Phone
                        </p>
                        <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                          {staff.phone}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Role
                        </p>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isPrincipal
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                              : staff.role === 'Teacher'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                        >
                          {staff.role || (isAdmin ? 'Administrator' : 'Teacher')}
                        </span>
                      </div>
                      {staff.subject && (
                        <div>
                          <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            Subject
                          </p>
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                            {staff.subject}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Status
                        </p>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            staff.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {staff.status}
                        </span>
                      </div>
                      {staff.employeeId && (
                        <div>
                          <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            Employee ID
                          </p>
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                            {staff.employeeId}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Classes Assigned (only for teachers) */}
                {staff.type === 'teacher' && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                            Classes Assigned
                          </CardTitle>
                        </div>
                        {/* Show summary stats */}
                        <div className="flex items-center gap-4 text-sm">
                          {teacherClasses.length > 0 && (
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">
                              <span className="font-semibold text-purple-600 dark:text-purple-400">{teacherClasses.length}</span> form class{teacherClasses.length !== 1 ? 'es' : ''}
                            </span>
                          )}
                          {timetableClasses && timetableClasses.totalClasses > 0 && (
                            <>
                              <span className="text-light-text-secondary dark:text-dark-text-secondary">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">{timetableClasses.totalClasses}</span> teaching class{timetableClasses.totalClasses !== 1 ? 'es' : ''}
                              </span>
                              <span className="text-light-text-secondary dark:text-dark-text-secondary">
                                <span className="font-semibold text-green-600 dark:text-green-400">{timetableClasses.totalPeriods}</span> periods/week
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Loading State */}
                      {(isLoadingClasses || isLoadingTimetableClasses) && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                        </div>
                      )}

                      {/* Empty State - No classes at all */}
                      {!isLoadingClasses && !isLoadingTimetableClasses && 
                       teacherClasses.length === 0 && 
                       (!timetableClasses || timetableClasses.classes.length === 0) && (
                        <div className="text-center py-8">
                          <BookOpen className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                          <p className="text-light-text-secondary dark:text-dark-text-secondary">
                            This teacher is not assigned to any classes yet.
                          </p>
                          <p className="text-sm text-light-text-muted dark:text-dark-text-muted mt-2">
                            Assign them as a form teacher, or add them to class timetables.
                          </p>
                        </div>
                      )}

                      <div className="space-y-6">
                        {/* PRIMARY/TERTIARY Classes - Form Teacher/Assistant Roles */}
                        {teacherClasses.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-3 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                              Form Teacher Assignments
                            </h4>
                            <div className="space-y-3">
                              {teacherClasses.map((classItem: any) => {
                                const assignment = classItem.teachers?.find(
                                  (t: any) => t.teacherId === staffId
                                );
                                return (
                                  <Link
                                    key={classItem.id}
                                    href={`/dashboard/school/courses/${classItem.id}`}
                                    className="block border border-light-border dark:border-dark-border rounded-lg p-4 hover:bg-light-surface dark:hover:bg-[var(--dark-hover)] hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                            {classItem.name}
                                          </h3>
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                            classItem.type === 'TERTIARY'
                                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
                                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                                          }`}>
                                            {classItem.type === 'TERTIARY' ? 'Course' : classItem.type}
                                          </span>
                                          {assignment?.isPrimary && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                              Form Teacher
                                            </span>
                                          )}
                                          {!assignment?.isPrimary && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                              Assistant
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                          <span>{classItem.studentsCount || 0} students</span>
                                          {classItem.academicYear && <span>{classItem.academicYear}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* SECONDARY Classes - Timetable-based Subject Teaching */}
                        {timetableClasses && timetableClasses.classes.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-3 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              Subject Teaching (via Timetable)
                            </h4>
                            <div className="space-y-3">
                              {timetableClasses.classes.map((classAssignment: any) => (
                                <Link
                                  key={classAssignment.classId}
                                  href={`/dashboard/school/courses/${classAssignment.classId}`}
                                  className="block border border-light-border dark:border-dark-border rounded-lg p-4 hover:bg-light-surface dark:hover:bg-[var(--dark-hover)] hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                          {classAssignment.className}
                                        </h3>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400">
                                          SECONDARY
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                          {classAssignment.totalPeriods} periods
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        {classAssignment.subjects.map((subject: any) => (
                                          <span
                                            key={subject.subjectId}
                                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                          >
                                            {subject.subjectName}
                                            <span className="ml-1.5 text-blue-500 dark:text-blue-400">
                                              ({subject.periodCount})
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Subjects Teacher Can Teach (for SECONDARY and PRIMARY school teachers with subject competencies) */}
                {isTeacher && (schoolType === 'SECONDARY' || (teacherSubjects && teacherSubjects.length > 0)) && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                          <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                            Subject Competencies
                          </CardTitle>
                        </div>
                        {teacherSubjects && teacherSubjects.length > 0 && (
                          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            <span className="font-semibold text-purple-600 dark:text-purple-400">{teacherSubjects.length}</span> subject{teacherSubjects.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingSubjects ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                        </div>
                      ) : !teacherSubjects || teacherSubjects.length === 0 ? (
                        <div className="text-center py-8">
                          <GraduationCap className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                          <p className="text-light-text-secondary dark:text-dark-text-secondary">
                            No subject competencies assigned yet.
                          </p>
                          <p className="text-sm text-light-text-muted dark:text-dark-text-muted mt-1">
                            Add subjects this teacher is qualified to teach on the Subjects page.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {teacherSubjects.map((subject) => (
                            <div
                              key={subject.id}
                              className="border border-light-border dark:border-dark-border rounded-lg p-4 hover:bg-light-surface dark:hover:bg-[var(--dark-hover)] transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                                    {subject.name}
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {subject.code && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                        {subject.code}
                                      </span>
                                    )}
                                    {subject.classLevelName && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                        {subject.classLevelName}
                                      </span>
                                    )}
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      subject.assignedClassCount > 0
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                      {subject.assignedClassCount > 0 
                                        ? `Teaching ${subject.assignedClassCount} class${subject.assignedClassCount !== 1 ? 'es' : ''}`
                                        : 'Not assigned'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Passport Photo */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                      Photo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PassportPhoto
                      profileImage={staff.profileImage || null}
                      firstName={staff.firstName}
                      lastName={staff.lastName}
                    />
                  </CardContent>
                </Card>

                {/* Additional Information */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                        Additional Information
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Created At
                        </p>
                        <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                          {new Date(staff.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {staff.isTemporary && (
                        <div>
                          <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            Employment Type
                          </p>
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                            Temporary
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && isAdmin && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                      Assigned Permissions
                    </CardTitle>
                  </div>
                  {!isPrincipal && (
                    <PermissionGate resource={PermissionResourceHook.STAFF} type={PermissionTypeHook.ADMIN}>
                      <Button variant="primary" size="sm" onClick={() => setShowPermissionModal(true)}>
                        <Shield className="h-4 w-4 mr-2" />
                        Manage Permissions
                      </Button>
                    </PermissionGate>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isPrincipal ? (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
                    <p className="text-light-text-primary dark:text-dark-text-primary font-semibold mb-2">
                      Principal - Full Access
                    </p>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      Principals have full administrative access to all resources and features.
                    </p>
                  </div>
                ) : permissions.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                      No permissions assigned yet.
                    </p>
                    <PermissionGate resource={PermissionResourceHook.STAFF} type={PermissionTypeHook.ADMIN}>
                      <Button variant="primary" size="sm" onClick={() => setShowPermissionModal(true)}>
                        <Shield className="h-4 w-4 mr-2" />
                        Assign Permissions
                      </Button>
                    </PermissionGate>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(
                      permissions.reduce((acc, perm) => {
                        if (!acc[perm.resource]) {
                          acc[perm.resource] = [];
                        }
                        acc[perm.resource].push(perm);
                        return acc;
                      }, {} as Record<PermissionResource, typeof permissions>)
                    ).map(([resource, resourcePerms]) => (
                      <div key={resource} className="border border-light-border dark:border-dark-border rounded-lg p-4">
                        <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-3">
                          {RESOURCE_LABELS[resource as PermissionResource]}
                        </h3>
                        <div className="space-y-2">
                          {resourcePerms.map((perm) => (
                            <div
                              key={perm.id}
                              className="flex items-center justify-between p-2 bg-light-surface dark:bg-dark-surface rounded"
                            >
                              <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                {TYPE_LABELS[perm.type]}
                              </span>
                              {perm.type === PermissionType.ADMIN && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                  Full Access
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Permission Assignment Modal */}
        {showPermissionModal && isAdmin && (
          <PermissionAssignmentModal
            isOpen={showPermissionModal}
            onClose={() => setShowPermissionModal(false)}
            adminId={staffId}
            adminName={`${staff.firstName} ${staff.lastName}`}
            adminRole={staff.role || 'Administrator'}
          />
        )}

        {/* Edit Profile Modal */}
        {showEditProfileModal && staff && (
          <EditTeacherProfileModal
            isOpen={showEditProfileModal}
            onClose={() => setShowEditProfileModal(false)}
            teacher={{
              id: staff.id,
              firstName: staff.firstName,
              lastName: staff.lastName,
              phone: staff.phone,
              subject: staff.subject,
              isTemporary: staff.isTemporary,
              role: staff.role,
              profileImage: staff.profileImage || null,
            }}
            schoolId={schoolId!}
            staffType={staff.type}
            schoolType={schoolType ?? undefined}
            onSuccess={() => {
              // Refetch staff data
              refetchStaff();
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
