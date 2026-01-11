'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
  Send,
  Filter,
  BookOpen,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { 
  useGetStudentByIdQuery, 
  useGetMySchoolQuery,
  useResendPasswordResetForStudentMutation,
  useGetStudentGradesQuery,
  useGetActiveSessionQuery,
  useGetSessionsQuery
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

  // Get active session for term filtering
  const { data: activeSessionResponse } = useGetActiveSessionQuery(
    { schoolId: schoolId! },
    { skip: !schoolId }
  );
  const activeSession = activeSessionResponse?.data;

  // Get all sessions
  const { data: sessionsResponse } = useGetSessionsQuery(
    { schoolId: schoolId || '' },
    { skip: !schoolId }
  );
  const sessions = sessionsResponse?.data || [];

  // Get student grades
  const { 
    data: gradesResponse, 
    isLoading: isLoadingGrades,
    error: gradesError 
  } = useGetStudentGradesQuery(
    { schoolId: schoolId!, studentId },
    { skip: !schoolId || !studentId }
  );
  const grades = gradesResponse?.data || [];

  // Filter states
  const [gradeTypeFilter, setGradeTypeFilter] = useState<'ALL' | 'CA' | 'ASSIGNMENT' | 'EXAM'>('ALL');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const hasAutoExpanded = useRef(false);

  // Helper function to get letter grade
  const getLetterGrade = (percentage: number): string => {
    if (percentage >= 75) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'C';
    if (percentage >= 60) return 'D';
    if (percentage >= 50) return 'E';
    return 'F';
  };

  // Filter grades by type
  const filteredGrades = useMemo(() => {
    if (gradeTypeFilter === 'ALL') return grades;
    return grades.filter((grade) => grade.gradeType === gradeTypeFilter);
  }, [grades, gradeTypeFilter]);

  // Build hierarchical structure: Session -> Term -> Subject -> Grades
  type SubjectData = {
    name: string;
    totalScore: number;
    totalMaxScore: number;
    percentage: number;
    grade: string;
    assessments: any[];
    caScore: number;
    caMaxScore: number;
    testScore: number;
    testMaxScore: number;
    examScore: number;
    examMaxScore: number;
  };

  type TermData = {
    termId: string;
    termName: string;
    termNumber: number;
    subjects: Map<string, SubjectData>;
    totalScore: number;
    totalMaxScore: number;
    averagePercentage: number;
  };

  type SessionData = {
    sessionId: string;
    sessionName: string;
    terms: Map<string, TermData>;
    totalScore: number;
    totalMaxScore: number;
    averagePercentage: number;
  };

  const hierarchicalData = useMemo(() => {
    const sessionMap = new Map<string, SessionData>();

    // Process each grade
    filteredGrades.forEach((grade: any) => {
      const academicYear = grade.academicYear || 'Unknown';
      const termName = grade.term || 'Unknown Term';
      const subjectName = grade.subject || 'Unknown';

      // Find or create session
      let sessionData = sessionMap.get(academicYear);
      if (!sessionData) {
        const session = sessions.find(s => s.name === academicYear);
        sessionData = {
          sessionId: session?.id || academicYear,
          sessionName: academicYear,
          terms: new Map(),
          totalScore: 0,
          totalMaxScore: 0,
          averagePercentage: 0,
        };
        sessionMap.set(academicYear, sessionData);
      }

      // Find or create term within session
      let termData = sessionData.terms.get(termName);
      if (!termData) {
        const session = sessions.find(s => s.name === academicYear);
        const term = session?.terms?.find(t => t.name === termName);
        termData = {
          termId: term?.id || `${academicYear}-${termName}`,
          termName,
          termNumber: term?.number || 0,
          subjects: new Map(),
          totalScore: 0,
          totalMaxScore: 0,
          averagePercentage: 0,
        };
        sessionData.terms.set(termName, termData);
      }

      // Find or create subject within term
      let subjectData = termData.subjects.get(subjectName);
      if (!subjectData) {
        subjectData = {
          name: subjectName,
          totalScore: 0,
          totalMaxScore: 0,
          percentage: 0,
          grade: 'F',
          assessments: [],
          caScore: 0,
          caMaxScore: 0,
          testScore: 0,
          testMaxScore: 0,
          examScore: 0,
          examMaxScore: 0,
        };
        termData.subjects.set(subjectName, subjectData);
      }

      // Add grade to subject
      subjectData.assessments.push(grade);
      subjectData.totalScore += grade.score;
      subjectData.totalMaxScore += grade.maxScore;

      if (grade.gradeType === 'CA') {
        subjectData.caScore += grade.score;
        subjectData.caMaxScore += grade.maxScore;
      } else if (grade.gradeType === 'ASSIGNMENT') {
        subjectData.testScore += grade.score;
        subjectData.testMaxScore += grade.maxScore;
      } else if (grade.gradeType === 'EXAM') {
        subjectData.examScore += grade.score;
        subjectData.examMaxScore += grade.maxScore;
      }
    });

    // Calculate percentages and grades for all levels
    sessionMap.forEach((sessionData) => {
      let sessionTotalScore = 0;
      let sessionTotalMaxScore = 0;

      sessionData.terms.forEach((termData) => {
        let termTotalScore = 0;
        let termTotalMaxScore = 0;

        termData.subjects.forEach((subjectData) => {
          if (subjectData.totalMaxScore > 0) {
            subjectData.percentage = (subjectData.totalScore / subjectData.totalMaxScore) * 100;
            subjectData.grade = getLetterGrade(subjectData.percentage);
          }
          termTotalScore += subjectData.totalScore;
          termTotalMaxScore += subjectData.totalMaxScore;

          // Sort assessments by date
          subjectData.assessments.sort((a, b) => {
            if (a.assessmentDate && b.assessmentDate) {
              return new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime();
            }
            return 0;
          });
        });

        termData.totalScore = termTotalScore;
        termData.totalMaxScore = termTotalMaxScore;
        if (termTotalMaxScore > 0) {
          termData.averagePercentage = (termTotalScore / termTotalMaxScore) * 100;
        }

        sessionTotalScore += termTotalScore;
        sessionTotalMaxScore += termTotalMaxScore;
      });

      sessionData.totalScore = sessionTotalScore;
      sessionData.totalMaxScore = sessionTotalMaxScore;
      if (sessionTotalMaxScore > 0) {
        sessionData.averagePercentage = (sessionTotalScore / sessionTotalMaxScore) * 100;
      }
    });

    // Convert to sorted arrays
    return Array.from(sessionMap.values())
      .sort((a, b) => b.sessionName.localeCompare(a.sessionName))
      .map(sessionData => ({
        ...sessionData,
        terms: Array.from(sessionData.terms.values())
          .sort((a, b) => b.termNumber - a.termNumber)
          .map(termData => ({
            ...termData,
            subjects: Array.from(termData.subjects.values())
              .sort((a, b) => a.name.localeCompare(b.name))
          }))
      }));
  }, [filteredGrades, sessions]);

  // Auto-expand first session when data loads
  useEffect(() => {
    if (hierarchicalData.length > 0 && !hasAutoExpanded.current) {
      const firstSessionId = hierarchicalData[0].sessionId;
      setExpandedSessions(new Set([firstSessionId]));
      // Also expand first term of first session
      if (hierarchicalData[0].terms.length > 0) {
        setExpandedTerms(new Set([hierarchicalData[0].terms[0].termId]));
      }
      hasAutoExpanded.current = true;
    }
  }, [hierarchicalData]);

  // Get available grade types
  const availableGradeTypes = useMemo(() => {
    const types = new Set<string>();
    grades.forEach((grade: any) => {
      types.add(grade.gradeType);
    });
    return Array.from(types);
  }, [grades]);

  // Toggle functions for collapsible sections
  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const toggleTerm = (termId: string) => {
    setExpandedTerms(prev => {
      const next = new Set(prev);
      if (next.has(termId)) {
        next.delete(termId);
      } else {
        next.add(termId);
      }
      return next;
    });
  };

  const toggleSubject = (subjectKey: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subjectKey)) {
        next.delete(subjectKey);
      } else {
        next.add(subjectKey);
      }
      return next;
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CA':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'ASSIGNMENT':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'EXAM':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

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
                          {student.user?.email && (
                            <div>
                              <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1 flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email
                              </p>
                              <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                {student.user.email}
                              </p>
                            </div>
                          )}
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
            <div className="space-y-6">
              {isLoadingGrades ? (
            <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted animate-spin" />
                    </div>
                  </CardContent>
                </Card>
              ) : gradesError ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        Unable to load grades
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : grades.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                        No Grades Available
                      </h3>
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        This student doesn't have any grades recorded yet.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Grade Type Filter */}
                  {availableGradeTypes.length > 0 && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary" />
                          <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                            Assessment Type:
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant={gradeTypeFilter === 'ALL' ? 'primary' : 'ghost'}
                              size="sm"
                              onClick={() => setGradeTypeFilter('ALL')}
                            >
                              All
                            </Button>
                            {availableGradeTypes.map((type) => (
                              <Button
                                key={type}
                                variant={gradeTypeFilter === type ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() => setGradeTypeFilter(type as any)}
                              >
                                {type}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Hierarchical Grades Display */}
                  <div className="space-y-4">
                    {hierarchicalData.map((sessionData) => {
                      const isSessionExpanded = expandedSessions.has(sessionData.sessionId);
                      return (
                        <Card key={sessionData.sessionId}>
              <CardHeader>
                            <button
                              onClick={() => toggleSession(sessionData.sessionId)}
                              className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                {isSessionExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                )}
                                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                                  {sessionData.sessionName}
                </CardTitle>
                              </div>
                              {sessionData.averagePercentage > 0 && (
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                  <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                    Session Average: {sessionData.averagePercentage.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </button>
              </CardHeader>
                          {isSessionExpanded && (
              <CardContent>
                              <div className="space-y-4 pl-8">
                                {sessionData.terms.map((termData) => {
                                  const termKey = termData.termId;
                                  const isTermExpanded = expandedTerms.has(termKey);
                                  return (
                                    <div
                                      key={termKey}
                                      className="border border-light-border dark:border-dark-border rounded-lg overflow-hidden"
                                    >
                                      <button
                                        onClick={() => toggleTerm(termKey)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-light-surface dark:hover:bg-dark-surface transition-colors text-left"
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          {isTermExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary" />
                                          )}
                                          <div>
                                            <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                              {termData.termName}
                                            </h3>
                                            {termData.averagePercentage > 0 && (
                                              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                Term Average: {termData.averagePercentage.toFixed(1)}%
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                          {termData.subjects.length} {termData.subjects.length === 1 ? 'Subject' : 'Subjects'}
                                        </span>
                                      </button>
                                      {isTermExpanded && (
                                        <div className="border-t border-light-border dark:border-dark-border p-4 space-y-3">
                                          {termData.subjects.map((subject) => {
                                            const subjectKey = `${termKey}-${subject.name}`;
                                            const isSubjectExpanded = expandedSubjects.has(subjectKey);
                                            return (
                                              <div
                                                key={subject.name}
                                                className="bg-light-surface dark:bg-dark-surface rounded-lg p-4"
                                              >
                                                <div className="flex items-center justify-between mb-2">
                                                  <div className="flex-1">
                                                    <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                                      {subject.name}
                                                    </h4>
                                                    <div className="flex items-center gap-3 mt-1">
                                                      <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                        {subject.totalScore} / {subject.totalMaxScore}
                                                      </span>
                                                      {subject.percentage > 0 && (
                                                        <>
                                                          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                            {subject.percentage.toFixed(1)}%
                                                          </span>
                                                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                            subject.grade === 'A' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                            subject.grade === 'B' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            subject.grade === 'C' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                          }`}>
                                                            {subject.grade}
                                                          </span>
                                                        </>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {subject.assessments.length > 0 && (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => toggleSubject(subjectKey)}
                                                    >
                                                      {isSubjectExpanded ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                      ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                      )}
                                                    </Button>
                                                  )}
                                                </div>
                                                {isSubjectExpanded && subject.assessments.length > 0 && (
                                                  <div className="mt-3 pt-3 border-t border-light-border dark:border-dark-border space-y-2">
                                                    {subject.assessments.map((assessment: any, idx: number) => (
                                                      <div
                                                        key={idx}
                                                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
                                                      >
                                                        <div className="flex items-center gap-2">
                                                          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(assessment.gradeType)}`}>
                                                            {assessment.gradeType}
                                                          </span>
                                                          <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                                                            {assessment.assessmentName || 'Assessment'}
                                                          </span>
                                                          {assessment.assessmentDate && (
                                                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                              {new Date(assessment.assessmentDate).toLocaleDateString()}
                                                            </span>
                                                          )}
                                                        </div>
                                                        <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                                                          {assessment.score} / {assessment.maxScore}
                                                        </span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                </div>
              </CardContent>
                          )}
            </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="space-y-6">
              {isLoadingGrades ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted animate-spin" />
                    </div>
                  </CardContent>
                </Card>
              ) : grades.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                        No Transcript Available
                      </h3>
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        This student doesn't have any academic records yet.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Academic Transcript
                </CardTitle>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">
                        Complete academic history for {student?.firstName} {student?.lastName}
                      </p>
              </CardHeader>
                  </Card>

                  {/* Hierarchical Transcript Display */}
                  <div className="space-y-4">
                    {hierarchicalData.map((sessionData) => {
                      const isSessionExpanded = expandedSessions.has(sessionData.sessionId);
                      return (
                        <Card key={sessionData.sessionId}>
                          <CardHeader>
                            <button
                              onClick={() => toggleSession(sessionData.sessionId)}
                              className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                {isSessionExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                                )}
                                <div>
                                  <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                                    {sessionData.sessionName}
                                  </CardTitle>
                                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                    {sessionData.terms.length} {sessionData.terms.length === 1 ? 'Term' : 'Terms'}
                                  </p>
                                </div>
                              </div>
                              {sessionData.averagePercentage > 0 && (
                                <div className="text-right">
                                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    Session Average
                                  </p>
                                  <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                                    {sessionData.averagePercentage.toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    {sessionData.totalScore} / {sessionData.totalMaxScore} points
                                  </p>
                                </div>
                              )}
                            </button>
                          </CardHeader>
                          {isSessionExpanded && (
              <CardContent>
                              <div className="space-y-4 pl-8">
                                {sessionData.terms.map((termData) => {
                                  const termKey = termData.termId;
                                  const isTermExpanded = expandedTerms.has(termKey);
                                  return (
                                    <div
                                      key={termKey}
                                      className="border border-light-border dark:border-dark-border rounded-lg overflow-hidden"
                                    >
                                      <button
                                        onClick={() => toggleTerm(termKey)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-light-surface dark:hover:bg-dark-surface transition-colors text-left"
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          {isTermExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary" />
                                          )}
                                          <div>
                                            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                                              {termData.termName}
                                            </h3>
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                              {termData.subjects.length} {termData.subjects.length === 1 ? 'Subject' : 'Subjects'}
                                            </p>
                                          </div>
                                        </div>
                                        {termData.averagePercentage > 0 && (
                                          <div className="text-right">
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                              Term Average
                                            </p>
                                            <p className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                                              {termData.averagePercentage.toFixed(1)}%
                                            </p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                              {termData.totalScore} / {termData.totalMaxScore} points
                                            </p>
                                          </div>
                                        )}
                                      </button>
                                      {isTermExpanded && (
                                        <div className="border-t border-light-border dark:border-dark-border p-4 space-y-3">
                                          {termData.subjects.map((subject) => (
                                            <div
                                              key={subject.name}
                                              className="flex items-center justify-between p-3 bg-light-surface dark:bg-dark-surface rounded-lg"
                                            >
                                              <div className="flex-1">
                                                <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                                  {subject.name}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1">
                                                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                    {subject.totalScore} / {subject.totalMaxScore}
                                                  </span>
                                                  {subject.percentage > 0 && (
                                                    <>
                                                      <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                        {subject.percentage.toFixed(1)}%
                                                      </span>
                                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        subject.grade === 'A' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                        subject.grade === 'B' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        subject.grade === 'C' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                      }`}>
                                                        {subject.grade}
                                                      </span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <div className="flex gap-2">
                                                  {subject.caScore > 0 && (
                                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                                      CA: {subject.caScore}/{subject.caMaxScore}
                                                    </span>
                                                  )}
                                                  {subject.examScore > 0 && (
                                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded">
                                                      Exam: {subject.examScore}/{subject.examMaxScore}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                </div>
              </CardContent>
                          )}
            </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
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

