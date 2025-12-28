'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/dashboard/StatCard';
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { motion } from 'framer-motion';
import { GraduationCap, Users, BookOpen, UserPlus, Loader2, AlertCircle, Calendar, XCircle, Upload } from 'lucide-react';
import { ImageCropModal } from '@/components/ui/ImageCropModal';
import { useRouter } from 'next/navigation';
import { useGetSchoolAdminDashboardQuery, useGetActiveSessionQuery, useGetMySchoolQuery, useEndTermMutation, useUploadSchoolLogoMutation } from '@/lib/store/api/schoolAdminApi';
import { EndTermModal } from '@/components/modals';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology } from '@/lib/utils/terminology';

// Helper function to format numbers with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// Helper function to format change percentage
const formatChange = (change: number, isPercentage: boolean = true): string => {
  const sign = change >= 0 ? '+' : '';
  if (isPercentage) {
    return `${sign}${change}%`;
  }
  return `${sign}${change}`;
};

// Helper function to determine change type
const getChangeType = (change: number): 'positive' | 'negative' | 'neutral' => {
  if (change > 0) return 'positive';
  if (change < 0) return 'negative';
  return 'neutral';
};

export default function AdminOverviewPage() {
  const router = useRouter();
  
  // Get school type and terminology
  const { currentType } = useSchoolType();
  
  const { data, isLoading, error, refetch } = useGetSchoolAdminDashboardQuery(
    currentType || undefined
  );
  const terminology = getTerminology(currentType);

  // Get school and active session
  const { data: schoolResponse, refetch: refetchSchool } = useGetMySchoolQuery();
  const school = schoolResponse?.data;
  const schoolId = school?.id;
  const [uploadSchoolLogo, { isLoading: isUploadingLogo }] = useUploadSchoolLogoMutation();
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: activeSessionResponse, refetch: refetchActiveSession } = useGetActiveSessionQuery(
    { schoolId: schoolId!, schoolType: currentType || undefined },
    { skip: !schoolId }
  );
  const activeSession = activeSessionResponse?.data;

  const [endTerm, { isLoading: isEndingTerm }] = useEndTermMutation();
  const [showEndTermModal, setShowEndTermModal] = useState(false);

  // Create preview URL when file is selected
  useEffect(() => {
    if (selectedLogoFile && logoPreview) {
      // Cleanup function to revoke the object URL
      return () => {
        URL.revokeObjectURL(logoPreview);
      };
    }
  }, [selectedLogoFile, logoPreview]);

  // Handle file selection - open crop modal
  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size exceeds maximum limit of 5MB');
      return;
    }

    // Create preview URL for cropping
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageToCrop(result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  // Handle crop completion
  const handleCropComplete = async (croppedBlob: Blob) => {
    // Convert blob to File
    const croppedFile = new File([croppedBlob], 'school-logo.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    // Create preview URL
    const previewUrl = URL.createObjectURL(croppedBlob);
    setLogoPreview(previewUrl);
    setSelectedLogoFile(croppedFile);

    // Close crop modal
    setImageToCrop(null);
    setShowCropModal(false);
  };

  // Determine button state
  const hasActiveSession = !!activeSession?.session;
  const hasActiveTerm = !!activeSession?.term;
  
  const getButtonConfig = () => {
    if (!hasActiveSession) {
      return {
        text: 'Start Session',
        icon: Calendar,
        onClick: () => router.push('/dashboard/school/settings/session'),
        variant: 'primary' as const,
      };
    } else if (!hasActiveTerm) {
      return {
        text: `Start ${terminology.periodSingular}`,
        icon: Calendar,
        onClick: () => router.push('/dashboard/school/settings/session'),
        variant: 'primary' as const,
      };
    } else {
      return {
        text: `End ${terminology.periodSingular}`,
        icon: XCircle,
        onClick: () => setShowEndTermModal(true),
        variant: 'danger' as const,
      };
    }
  };

  const handleEndTerm = async () => {
    if (!schoolId) {
      toast.error('School not found');
      return;
    }

    try {
      await endTerm({ schoolId, schoolType: currentType || undefined }).unwrap();
      toast.success(`${terminology.periodSingular} ended successfully`);
      setShowEndTermModal(false);
      refetchActiveSession();
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || `Failed to end ${terminology.periodSingular.toLowerCase()}`);
    }
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;

  // Extract dashboard data
  const dashboard = data?.data;
  const stats = dashboard?.stats;
  const growthTrends = dashboard?.growthTrends || [];
  const weeklyActivity = dashboard?.weeklyActivity || [];
  const recentStudents = dashboard?.recentStudents || [];

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                Overview
              </h1>
              
            </div>
            <div className="flex items-center gap-3">
              {/* School Logo Upload - Passport Size */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileSelect(file);
                    }
                  }}
                />
                {/* Show preview if file is selected, otherwise show current logo or upload placeholder */}
                {logoPreview ? (
                  <div className="relative group">
                    <img
                      src={logoPreview}
                      alt="Logo Preview"
                      className="object-cover border-2 border-blue-500 dark:border-blue-400 rounded shadow-sm"
                      style={{ width: '60px', height: '60px' }}
                    />
                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                      !
                    </div>
                  </div>
                ) : school?.logo ? (
                  <div className="relative group">
                    <img
                      src={school.logo}
                      alt="School Logo"
                      className="object-cover border-2 border-light-border dark:border-dark-border rounded shadow-sm"
                      style={{ width: '60px', height: '60px' }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          fileInputRef.current?.click();
                        }}
                        className="text-white text-xs"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-light-border dark:border-dark-border rounded cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center justify-center bg-gray-50 dark:bg-gray-800"
                    style={{ width: '60px', height: '60px' }}
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                  </div>
                )}
                {selectedLogoFile && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        if (!selectedLogoFile) return;
                        try {
                          await uploadSchoolLogo({ file: selectedLogoFile }).unwrap();
                          toast.success('School logo uploaded successfully!');
                          setSelectedLogoFile(null);
                          setLogoPreview(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                          refetchSchool();
                        } catch (error: any) {
                          toast.error(error?.data?.message || 'Failed to upload logo');
                        }
                      }}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3 mr-1" />
                          Upload
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedLogoFile(null);
                        setLogoPreview(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      disabled={isUploadingLogo}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <PermissionGate resource={PermissionResource.SESSIONS} type={PermissionType.WRITE}>
                <Button
                  variant={buttonConfig.variant}
                  size="sm"
                  onClick={buttonConfig.onClick}
                  disabled={isEndingTerm}
                  className="flex items-center gap-2"
                >
                  {isEndingTerm ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Ending {terminology.periodSingular}...
                    </>
                  ) : (
                    <>
                      <ButtonIcon className="h-4 w-4" />
                      {buttonConfig.text}
                    </>
                  )}
                </Button>
              </PermissionGate>
            </div>
          </div>
          
          {/* Term End Date Display - Only show if there's an active term */}
          {hasActiveTerm && activeSession?.term?.endDate && (() => {
            const endDate = new Date(activeSession.term.endDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const isPastDue = daysRemaining < 0;
            const isDueSoon = daysRemaining <= 7 && daysRemaining >= 0;
            
            return (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 text-sm"
              >
                <Calendar className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
                <span className="text-light-text-secondary dark:text-dark-text-secondary">
                  Current {terminology.periodSingular} ends on{' '}
                  <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                    {endDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  {isPastDue ? (
                    <span className="ml-2 text-red-600 dark:text-red-400 font-semibold">
                      (Overdue by {Math.abs(daysRemaining)} {Math.abs(daysRemaining) === 1 ? 'day' : 'days'})
                    </span>
                  ) : isDueSoon ? (
                    <span className="ml-2 text-orange-600 dark:text-orange-400 font-semibold">
                      ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining)
                    </span>
                  ) : (
                    <span className="ml-2 text-blue-600 dark:text-blue-400 font-semibold">
                      ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining)
                    </span>
                  )}
                </span>
              </motion.div>
            );
          })()}
        </motion.div>

        {/* Error State */}
        {error && (
          <Alert variant="error" className="mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-semibold">Failed to load dashboard data</p>
                <p className="text-sm mt-1">
                  {error && 'data' in error
                    ? (error.data as any)?.message || 'An error occurred while loading dashboard data'
                    : 'An error occurred while loading dashboard data'}
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

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="ml-3 text-light-text-secondary dark:text-dark-text-secondary">
              Loading dashboard data...
            </span>
          </div>
        )}

        {/* Dashboard Content */}
        {!isLoading && !error && stats && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <StatCard
                title="Total Students"
                value={formatNumber(stats.totalStudents)}
                change={formatChange(stats.studentsChange)}
                changeType={getChangeType(stats.studentsChange)}
                icon={
                  <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                }
              />
          <StatCard
            title={`Total ${terminology.staff}`}
            value={formatNumber(stats.totalTeachers)}
            change={formatChange(stats.teachersChange)}
            changeType={getChangeType(stats.teachersChange)}
            icon={
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            }
          />
          <StatCard
            title={`Active ${terminology.courses}`}
            value={formatNumber(stats.activeCourses)}
            change={formatChange(stats.coursesChange)}
            changeType={getChangeType(stats.coursesChange)}
            icon={
              <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            }
          />
              <StatCard
                title="Pending Admissions"
                value={formatNumber(stats.pendingAdmissions)}
                change={formatChange(stats.pendingAdmissionsChange, false)}
                changeType={getChangeType(stats.pendingAdmissionsChange)}
                icon={
                  <UserPlus className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                }
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <AnalyticsChart
                title="Growth Trends"
                data={growthTrends}
                type="line"
                dataKeys={['students', 'teachers', 'courses']}
                colors={['#3b82f6', '#10b981', '#a855f7']}
              />
              <AnalyticsChart
                title="Student Distribution"
                data={growthTrends}
                type="donut"
                dataKeys={['students']}
                colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444']}
              />
            </div>

            {/* Recent Activity */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AnalyticsChart
                  title="Weekly Activity"
                  data={weeklyActivity}
                  type="horizontal"
                  dataKeys={['admissions', 'transfers']}
                  colors={['#3b82f6', '#10b981']}
                />
              </CardContent>
            </Card>

            {/* Recent Students */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    Recently Added Students
                  </CardTitle>
                  <Link href="/dashboard/school/students">
                    <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400">
                      View All →
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentStudents.length === 0 ? (
                  <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                    <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No recent students found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentStudents.map((student: any) => (
                      <Link
                        key={student.id}
                        href={`/dashboard/school/students/${student.id}`}
                      >
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-transparent rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--dark-hover)] transition-colors cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-dark-border"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                {student.name}
                              </h4>
                              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                {student.classLevel} • {student.admissionNumber}
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                student.status === 'active'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {student.status}
                            </span>
                          </div>
                        </motion.div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* End Term Modal */}
        <EndTermModal
          isOpen={showEndTermModal}
          onClose={() => setShowEndTermModal(false)}
          onConfirm={handleEndTerm}
          isLoading={isEndingTerm}
          termName={activeSession?.term?.name}
          sessionName={activeSession?.session?.name}
          termLabel={terminology.periodSingular}
          termEndDate={activeSession?.term?.endDate}
        />

        {/* Image Crop Modal */}
        {imageToCrop && (
          <ImageCropModal
            isOpen={showCropModal}
            onClose={() => {
              setShowCropModal(false);
              setImageToCrop(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            imageSrc={imageToCrop}
            onCropComplete={handleCropComplete}
            aspectRatio={1}
            cropShape="rect"
            title="Crop School Logo"
            minZoom={1}
            maxZoom={3}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

