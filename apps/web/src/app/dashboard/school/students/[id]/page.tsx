'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { 
  GraduationCap, 
  Mail, 
  Phone, 
  MapPin, 
  User,
  Edit,
  FileText,
  Heart,
  Award,
  Loader2,
  Calendar,
  Send
} from 'lucide-react';
import { 
  useGetStudentByIdQuery, 
  useGetMySchoolQuery,
  useResendPasswordResetForStudentMutation
} from '@/lib/store/api/schoolAdminApi';
import { EditStudentProfileModal } from '@/components/modals/EditStudentProfileModal';
import { BackButton } from '@/components/ui/BackButton';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';

type TabType = 'profile' | 'health' | 'grades' | 'transcript';

// Circular avatar component for header
const StudentAvatar = ({
  profileImage,
  firstName,
  lastName,
  size = 'md',
}: {
  profileImage?: string | null;
  firstName?: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const [imageError, setImageError] = useState(false);
  
  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0]?.toUpperCase() || '';
    const last = lastName?.[0]?.toUpperCase() || '';
    return first + last || '?';
  };

  const sizeClasses = {
    sm: 'w-10 h-10 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  const shouldShowImage = profileImage && !imageError && profileImage.trim() !== '';

  if (shouldShowImage) {
    return (
      <div className={`relative ${sizeClasses[size]} flex-shrink-0`}>
        <img
          src={profileImage!}
          alt={`${firstName || ''} ${lastName || ''}`.trim() || 'Student'}
          className={`${sizeClasses[size]} rounded-full object-cover border-2 border-light-border dark:border-dark-border shadow-sm`}
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white font-semibold border-2 border-light-border dark:border-dark-border shadow-sm flex-shrink-0`}>
      {getInitials(firstName, lastName)}
    </div>
  );
};

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

  // Determine if we should show the image or fallback to initials
  const shouldShowImage = profileImage && !imageError && profileImage.trim() !== '';

  return (
    <div className="flex justify-center">
      <div className="relative w-48 h-60 bg-white dark:bg-gray-800 border-4 border-gray-300 dark:border-gray-600 shadow-lg overflow-hidden">
        {shouldShowImage ? (
          <img
            src={profileImage!}
            alt={`${firstName || ''} ${lastName || ''}`.trim() || 'Student photo'}
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

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  // Get school ID
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;

  const { data: studentResponse, isLoading, error } = useGetStudentByIdQuery(
    { schoolId: schoolId!, id: studentId },
    { skip: !schoolId || !studentId }
  );
  const student = studentResponse?.data;
  
  // Resend password reset mutation
  const [resendPasswordReset, { isLoading: isResendingPasswordReset }] = useResendPasswordResetForStudentMutation();
  
  // Check if user hasn't set their password yet
  const hasNotSetPassword = student?.user?.accountStatus === 'SHADOW';
  
  const handleResendPasswordReset = async () => {
    if (!schoolId || !studentId) return;
    
    try {
      await resendPasswordReset({ schoolId, studentId }).unwrap();
      toast.success('Password reset email sent successfully');
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to send password reset email');
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
    { id: 'health', label: 'Health Status', icon: <Heart className="h-4 w-4" /> },
    { id: 'grades', label: 'Grades', icon: <Award className="h-4 w-4" /> },
    { id: 'transcript', label: 'Transcript', icon: <FileText className="h-4 w-4" /> },
  ];

  const [selectedTerm, setSelectedTerm] = useState(0);

  if (isLoading) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Loading student details...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !student) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="w-full">
          <BackButton fallbackUrl="/dashboard/school/students" className="mb-4" />
          <div className="text-center py-12">
            <GraduationCap className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Student not found or error loading student details.
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
          <BackButton fallbackUrl="/dashboard/school/students" className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Circular Avatar */}
              <StudentAvatar
                profileImage={student.profileImage || null}
                firstName={student.firstName}
                lastName={student.lastName}
                size="lg"
              />
              <div>
                <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                  {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
                </h1>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  {student.uid} • {student.enrollment?.classLevel || 'N/A'}
                </p>
              </div>
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
              <PermissionGate resource={PermissionResource.STUDENTS} type={PermissionType.WRITE}>
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
              <div className="lg:col-span-2">
                {/* Combined Information Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                        Student Information
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Personal Information Section */}
                      <div>
                        <h3 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-4 uppercase tracking-wide">
                          Personal Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              Full Name
                            </p>
                            <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                              {student.firstName} {student.lastName}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              Student ID
                            </p>
                            <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                              {student.uid}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              Class Level
                            </p>
                            <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                              {student.enrollment?.classLevel || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              Date of Birth
                            </p>
                            <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                              {new Date(student.dateOfBirth).toLocaleDateString()}
                            </p>
                          </div>
                          {student.middleName && (
                            <div>
                              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                Middle Name
                              </p>
                              <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                {student.middleName}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              Status
                            </p>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                !student.profileLocked
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {student.profileLocked ? 'Locked' : 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-light-border dark:border-dark-border"></div>

                      {/* Contact Information Section */}
                      {student.enrollment && (
                        <div>
                          <h3 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-4 uppercase tracking-wide">
                            Enrollment Information
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                Academic Year
                              </p>
                              <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                {student.enrollment.academicYear}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                School
                              </p>
                              <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                {student.enrollment.school.name}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="border-t border-light-border dark:border-dark-border"></div>

                      {/* Academic Records Section */}
                      {student.enrollment && (
                        <div>
                          <h3 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-4 uppercase tracking-wide">
                            Academic Records
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                Academic Year
                              </p>
                              <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                {student.enrollment.academicYear}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                Current Class
                              </p>
                              <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                {student.enrollment.classLevel}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
                      profileImage={student.profileImage || null}
                      firstName={student.firstName}
                      lastName={student.lastName}
                    />
                  </CardContent>
                </Card>

                {/* Additional Info */}
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
                          {new Date(student.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          Last Updated
                        </p>
                        <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                          {new Date(student.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Health Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {student?.healthInfo ? (
                  <div className="space-y-6">
                    {/* Basic Health Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {student.healthInfo.bloodGroup && (
                        <div>
                          <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            Blood Group
                          </p>
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                            {student.healthInfo.bloodGroup}
                          </p>
                        </div>
                      )}
                      {student.healthInfo.allergies && (
                        <div>
                          <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            Allergies
                          </p>
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                            {student.healthInfo.allergies}
                          </p>
                        </div>
                      )}
                      {student.healthInfo.medications && (
                        <div>
                          <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            Medications
                          </p>
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                            {student.healthInfo.medications}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Emergency Contact */}
                    {(student.healthInfo.emergencyContact || student.healthInfo.emergencyContactPhone) && (
                      <div className="border-t border-light-border dark:border-dark-border pt-6">
                        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                          Emergency Contact
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {student.healthInfo.emergencyContact && (
                            <div>
                              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                Contact Name
                              </p>
                              <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                {student.healthInfo.emergencyContact}
                              </p>
                            </div>
                          )}
                          {student.healthInfo.emergencyContactPhone && (
                            <div>
                              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                Contact Phone
                              </p>
                              <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                {student.healthInfo.emergencyContactPhone}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Medical Notes */}
                    {student.healthInfo.medicalNotes && (
                      <div className="border-t border-light-border dark:border-dark-border pt-6">
                        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                          Medical Notes
                        </h3>
                        <div className="bg-light-surface dark:bg-dark-surface rounded-lg p-4">
                          <p className="text-sm text-light-text-primary dark:text-dark-text-primary whitespace-pre-wrap">
                            {student.healthInfo.medicalNotes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      No health information available for this student.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'grades' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Grades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Award className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">
                    Grades view will be available here.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'transcript' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Academic Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">
                    Transcript view will be available here. This shows the complete academic history across all schools.
                  </p>
                  <p className="text-sm text-light-text-muted dark:text-dark-text-muted mt-2">
                    (Optional - can be enabled per school policy)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Edit Profile Modal */}
        {showEditProfileModal && student && (
          <EditStudentProfileModal
            isOpen={showEditProfileModal}
            onClose={() => setShowEditProfileModal(false)}
            student={{
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              middleName: student.middleName,
              phone: student.user?.phone || undefined,
              profileImage: student.profileImage || null,
              healthInfo: student.healthInfo || undefined,
            }}
            schoolId={schoolId!}
            onSuccess={() => {
              // RTK Query will automatically refetch due to tag invalidation
              // No need to manually reload the page
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

