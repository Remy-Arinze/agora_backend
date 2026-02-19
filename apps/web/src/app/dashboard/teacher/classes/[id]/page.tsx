'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { 
  BookOpen, 
  Users, 
  FileText, 
  Smartphone,
  ArrowLeft,
  Search,
  Calendar,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Download,
  Upload,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { getActivePluginsForTeacher } from '@/lib/plugins';
import { 
  useGetClassByIdQuery, 
  useGetMyTeacherSchoolQuery, 
  useGetActiveSessionQuery, 
  useGetClassStudentsQuery,
  useGetClassGradesQuery,
  useDeleteGradeMutation,
  useUpdateGradeMutation,
  useGetCurriculumForClassQuery,
  useGetTimetableForClassQuery,
  useGetSessionsQuery,
  type StudentWithEnrollment,
  type Grade,
  type GradeType
} from '@/lib/store/api/schoolAdminApi';
import { useClassResources } from '@/hooks/useClassResources';
import { BulkGradeEntryModal } from '@/components/modals/BulkGradeEntryModal';
import { GradeEntryModal } from '@/components/modals/GradeEntryModal';
import { ConfirmModal } from '@/components/ui/Modal';
import { TeacherTimetableGrid } from '@/components/timetable/TeacherTimetableGrid';
import toast from 'react-hot-toast';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology } from '@/lib/utils/terminology';

type TabType = 'curriculum' | 'students' | 'grades' | 'timetable' | 'rollcall' | 'resources';

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('curriculum');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBulkGradeModal, setShowBulkGradeModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithEnrollment | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [gradeTypeFilter, setGradeTypeFilter] = useState<GradeType | ''>('');
  const [termFilter, setTermFilter] = useState<string>('');
  const [sequenceFilter, setSequenceFilter] = useState<number | ''>('');
  const [selectedTimetableTermId, setSelectedTimetableTermId] = useState<string>('');
  const [showUploadResourceModal, setShowUploadResourceModal] = useState(false);

  const { currentType } = useSchoolType();
  const terminology = getTerminology(currentType) || {
    courses: 'Classes',
    courseSingular: 'Class',
    staff: 'Teachers',
    staffSingular: 'Teacher',
    periods: 'Terms',
    periodSingular: 'Term',
    subjects: 'Subjects',
    subjectSingular: 'Subject',
  };

  // Get teacher's school
  const { data: schoolResponse } = useGetMyTeacherSchoolQuery();
  const schoolId = schoolResponse?.data?.id;

  // Get class data first - we need the class type to fetch the correct active session
  const { data: classResponse, isLoading, error } = useGetClassByIdQuery(
    { schoolId: schoolId!, classId },
    { skip: !schoolId || !classId }
  );
  
  const classData = classResponse?.data;
  
  // Derive school type from the class being viewed (more accurate than localStorage)
  const classType = classData?.type as 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | undefined;

  // Get active session - use the class type to get the correct session for this school type
  const { data: activeSessionResponse } = useGetActiveSessionQuery(
    { schoolId: schoolId!, schoolType: classType || currentType || undefined },
    { skip: !schoolId }
  );
  const activeSession = activeSessionResponse?.data;

  // Get all sessions for timetable term selector
  const { data: sessionsResponse } = useGetSessionsQuery(
    { schoolId: schoolId! },
    { skip: !schoolId || activeTab !== 'timetable' }
  );

  // Get students in class (always fetch so they're available for grade entry modal)
  const { data: studentsResponse } = useGetClassStudentsQuery(
    { schoolId: schoolId!, classId },
    { skip: !schoolId || !classId }
  );

  // Get grades for class
  const { data: gradesResponse, refetch: refetchGrades } = useGetClassGradesQuery(
    { 
      schoolId: schoolId!, 
      classId,
      gradeType: gradeTypeFilter || undefined,
      termId: termFilter || undefined,
    },
    { skip: !schoolId || !classId || activeTab !== 'grades' }
  );

  const [deleteGrade, { isLoading: isDeleting }] = useDeleteGradeMutation();
  const [updateGrade, { isLoading: isPublishing }] = useUpdateGradeMutation();

  const handlePublishGrade = async (gradeId: string) => {
    if (!schoolId) return;
    
    try {
      await updateGrade({
        schoolId,
        gradeId,
        gradeData: { isPublished: true },
      }).unwrap();
      toast.success('Grade published successfully');
      refetchGrades();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to publish grade');
    }
  };

  // Get curriculum for class
  const { data: curriculumResponse, refetch: refetchCurriculum } = useGetCurriculumForClassQuery(
    {
      schoolId: schoolId!,
      classId,
      subject: classResponse?.data?.teachers?.[0]?.subject || undefined,
      academicYear: classResponse?.data?.academicYear || activeSession?.session?.name,
      termId: activeSession?.term?.id || undefined,
    },
    { skip: !schoolId || !classId || activeTab !== 'curriculum' }
  );
  const students = studentsResponse?.data || [];
  const allGrades = gradesResponse?.data || [];
  
  // Filter grades by sequence on frontend
  const grades = useMemo(() => {
    if (sequenceFilter === '') return allGrades;
    return allGrades.filter((grade: any) => grade.sequence === sequenceFilter);
  }, [allGrades, sequenceFilter]);
  
  // Get unique sequence numbers from grades for filter dropdown
  const uniqueSequences = useMemo(() => {
    const sequences = allGrades
      .map((g: any) => g.sequence)
      .filter((s: number | null | undefined): s is number => s !== null && s !== undefined && typeof s === 'number')
      .sort((a: number, b: number) => a - b);
    return Array.from(new Set(sequences));
  }, [allGrades]);

  // Extract all terms from sessions for timetable term selector - filtered by school type and deduplicated
  // Use classType (from the class being viewed) as primary, fallback to currentType (from localStorage)
  const effectiveSchoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null = classType || currentType || null;
  
  const timetableTerms = useMemo(() => {
    if (!sessionsResponse?.data) return [];
    
    // Filter sessions by the class's school type to show the correct terms
    const filteredSessions = sessionsResponse.data.filter((session: any) => {
      if (!effectiveSchoolType) return !session.schoolType;
      return session.schoolType === effectiveSchoolType;
    });
    
    // Deduplicate sessions by name (keep first/latest)
    const uniqueSessionsMap = new Map<string, any>();
    filteredSessions.forEach((session: any) => {
      if (!uniqueSessionsMap.has(session.name)) {
        uniqueSessionsMap.set(session.name, session);
      }
    });
    
    const terms: Array<{ id: string; name: string; sessionName: string }> = [];
    Array.from(uniqueSessionsMap.values()).forEach((session: any) => {
      if (session.terms && Array.isArray(session.terms)) {
        session.terms.forEach((term: any) => {
          terms.push({
            id: term.id,
            name: term.name,
            sessionName: session.name,
          });
        });
      }
    });
    return terms;
  }, [sessionsResponse, effectiveSchoolType]);

  // Determine which term to use for timetable
  const timetableTermId = selectedTimetableTermId || activeSession?.term?.id || '';

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    
    const query = searchQuery.toLowerCase();
    return students.filter(
      (student: StudentWithEnrollment) =>
        student.firstName?.toLowerCase().includes(query) ||
        student.lastName?.toLowerCase().includes(query) ||
        student.uid?.toLowerCase().includes(query) ||
        (student.middleName?.toLowerCase().includes(query) ?? false)
    );
  }, [students, searchQuery]);

  // Get class resources using the hook
  const {
    resources,
    isLoading: isLoadingResources,
    isUploading: isUploadingResource,
    isDeleting: isDeletingResource,
    selectedFile,
    resourceDescription,
    setSelectedFile,
    setResourceDescription,
    handleUpload,
    handleDelete: handleDeleteResource,
    refetchResources,
  } = useClassResources({
    schoolId,
    classId,
    activeTab,
  });
  const activePlugins = getActivePluginsForTeacher();
  const hasRollCall = activePlugins.some(p => p.slug === 'rollcall');

  // Build tabs dynamically based on available plugins
  const tabs: { id: TabType; label: string; icon: React.ReactNode; available: boolean }[] = [
    { id: 'curriculum', label: 'Curriculum', icon: <BookOpen className="h-4 w-4" />, available: true },
    { id: 'timetable', label: 'Timetable', icon: <Clock className="h-4 w-4" />, available: true },
    { id: 'students', label: 'Students', icon: <Users className="h-4 w-4" />, available: true },
    { id: 'grades', label: 'Grades', icon: <Award className="h-4 w-4" />, available: true },
    { id: 'resources', label: 'Resources', icon: <FileText className="h-4 w-4" />, available: true },
    { id: 'rollcall', label: 'RollCall', icon: <Smartphone className="h-4 w-4" />, available: hasRollCall },
  ];

  if (isLoading) {
    return (
      <ProtectedRoute roles={['TEACHER']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Loading {terminology.courseSingular.toLowerCase()} details...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !classData) {
    return (
      <ProtectedRoute roles={['TEACHER']}>
        <div className="w-full">
          <Link href="/dashboard/teacher/classes">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {terminology.courses}
            </Button>
          </Link>
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              {terminology.courseSingular} not found or error loading details.
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['TEACHER']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link href="/dashboard/teacher/classes">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Classes
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                {classData.name}
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                {classData.code && `${classData.code} • `}
                {classData.classLevel && `${classData.classLevel} • `}
                {classData.academicYear}
                {activeSession?.term && ` • ${activeSession.term.name}`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="mb-6 border-b border-light-border dark:border-dark-border">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.filter(tab => tab.available).map((tab) => (
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
          {/* Curriculum Tab */}
          {(activeTab as TabType) === 'curriculum' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                    Curriculum Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {curriculumResponse?.data ? (
                    <div className="space-y-6">
                      {curriculumResponse.data.items.map((item, index) => (
                        <div
                          key={item.id || index}
                          className="pb-6 border-b border-light-border dark:border-dark-border last:border-0 last:pb-0"
                        >
                          <div className="flex items-start gap-4 mb-4">
                            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-400 font-bold text-sm text-center leading-tight">
                                Week {item.week}
                              </span>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                                {item.topic}
                              </h3>
                              {item.objectives && item.objectives.length > 0 && (
                                <div className="space-y-2 mb-3">
                                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                    Learning Objectives:
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 ml-2">
                                    {item.objectives.map((objective, objIndex) => (
                                      <li
                                        key={objIndex}
                                        className="text-sm text-light-text-secondary dark:text-dark-text-secondary"
                                      >
                                        {objective}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {item.resources && item.resources.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                                    Resources:
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {item.resources.map((resource, resIndex) => (
                                      <span
                                        key={resIndex}
                                        className="px-3 py-1 bg-light-bg dark:bg-dark-surface rounded-md text-xs text-light-text-secondary dark:text-dark-text-secondary"
                                      >
                                        {resource}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                        No curriculum available for this class yet.
                      </p>
                      <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                        The curriculum will be created by the school administration.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Timetable Tab */}
          {(activeTab as TabType) === 'timetable' && (
            <div className="space-y-6">
              {timetableTermId ? (
                <ClassTimetableView
                  schoolId={schoolId!}
                  classId={classId}
                  termId={timetableTermId}
                  schoolType={effectiveSchoolType}
                  allTerms={timetableTerms}
                  selectedTermId={timetableTermId}
                  onTermChange={setSelectedTimetableTermId}
                  activeTermId={activeSession?.term?.id}
                  terminology={terminology}
                />
              ) : (
                <Card>
                  <CardContent className="pt-12 pb-12 text-center">
                    <Clock className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      No active term found. Please select a term to view the timetable.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Students Tab */}
          {(activeTab as TabType) === 'students' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                      Students ({filteredStudents.length})
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                      {searchQuery ? 'No students found matching your search.' : 'No students enrolled in this class yet.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
                        <Input
                          placeholder="Search students by name or student ID..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-light-border dark:border-dark-border">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                              Name
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                              Student ID
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                              Date of Birth
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
                          {filteredStudents.map((student: StudentWithEnrollment, index: number) => (
                            <motion.tr
                              key={student.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="border-b border-light-border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors"
                            >
                              <td className="py-4 px-4">
                                <div>
                                  <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                    {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
                                  </p>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {student.uid}
                              </td>
                              <td className="py-4 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {new Date(student.dateOfBirth).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    !student.profileLocked
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                  }`}
                                >
                                  {student.profileLocked ? 'Locked' : 'Active'}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/dashboard/teacher/students/${student.id}`)}
                                >
                                  View
                                </Button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Grades Tab */}
          {(activeTab as TabType) === 'grades' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                      Grades
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      {/* Filters */}
                      <div className="flex items-center gap-2">
                        <select
                          value={gradeTypeFilter}
                          onChange={(e) => setGradeTypeFilter(e.target.value as GradeType | '')}
                          className="text-xs px-2 py-1.5 border border-[var(--light-border)] dark:border-dark-border rounded-md bg-[var(--light-bg)] dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                          style={{ width: '100px' }}
                        >
                          <option value="">All Types</option>
                          <option value="CA">CA</option>
                          <option value="ASSIGNMENT">Assignment</option>
                          <option value="EXAM">Exam</option>
                        </select>
                        <select
                          value={termFilter}
                          onChange={(e) => setTermFilter(e.target.value)}
                          className="text-xs px-2 py-1.5 border border-[var(--light-border)] dark:border-dark-border rounded-md bg-[var(--light-bg)] dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                          style={{ width: '100px' }}
                        >
                          <option value="">All Terms</option>
                          {activeSession?.session?.terms?.map((term: any) => (
                            <option key={term.id} value={term.id}>
                              {term.name}
                            </option>
                          ))}
                        </select>
                        {uniqueSequences.length > 0 && (
                          <select
                            value={sequenceFilter}
                            onChange={(e) => setSequenceFilter(e.target.value === '' ? '' : parseInt(e.target.value))}
                            className="text-xs px-2 py-1.5 border border-[var(--light-border)] dark:border-dark-border rounded-md bg-[var(--light-bg)] dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                            style={{ width: '80px' }}
                          >
                            <option value="">All Seq</option>
                            {uniqueSequences.map((seq) => (
                              <option key={seq} value={seq}>
                                {seq}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowBulkGradeModal(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Bulk Entry
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">

                    {/* Grades Table */}
                    {grades.length === 0 ? (
                      <div className="text-center py-12">
                        <Award className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                          No grades found.
                        </p>
                        <Button
                          variant="primary"
                          onClick={() => setShowBulkGradeModal(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Enter Grades
                        </Button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-light-surface dark:bg-dark-surface">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                Student
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                Assessment
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                Score
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                Percentage
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-light-border dark:divide-dark-border">
                            {grades.map((grade) => {
                              const percentage = grade.maxScore > 0
                                ? ((grade.score / grade.maxScore) * 100).toFixed(1)
                                : '0.0';
                              const studentName = grade.student
                                ? `${grade.student.firstName} ${grade.student.lastName}`
                                : 'Unknown';

                              return (
                                <tr key={grade.id} className="hover:bg-light-surface dark:hover:bg-[var(--dark-hover)]">
                                  <td className="px-4 py-3">
                                    <div>
                                      <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                                        {studentName}
                                      </p>
                                      {grade.student?.uid && (
                                        <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                          {grade.student.uid}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div>
                                      <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                        {grade.assessmentName || '-'}
                                      </p>
                                      {grade.sequence && (
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                          Sequence: {grade.sequence}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                                      grade.gradeType === 'CA'
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                                        : grade.gradeType === 'ASSIGNMENT'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
                                    }`}>
                                      {grade.gradeType}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                      {grade.assessmentDate
                                        ? new Date(grade.assessmentDate).toLocaleDateString()
                                        : '-'}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                                      {grade.score} / {grade.maxScore}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                                      {percentage}%
                                    </p>
                                  </td>
                                  <td className="px-4 py-3">
                                    {grade.isPublished ? (
                                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                                        Published
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                                        Draft
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      {!grade.isPublished && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handlePublishGrade(grade.id)}
                                          disabled={isPublishing}
                                          className="text-blue-600 dark:text-blue-400"
                                        >
                                          Publish
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedGrade(grade);
                                          // TODO: Implement edit functionality
                                        }}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedGrade(grade);
                                          setShowDeleteModal(true);
                                        }}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resources Tab */}
          {(activeTab as TabType) === 'resources' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                      Class Resources
                    </CardTitle>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowUploadResourceModal(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Resource
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingResources ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted animate-spin" />
                    </div>
                  ) : resources.length > 0 ? (
                    <div className="space-y-4">
                      {resources.map((resource: any) => (
                        <motion.div
                          key={resource.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 border border-light-border dark:border-dark-border rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-light-card dark:bg-dark-surface"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                                  {resource.name}
                                </h4>
                                {resource.description && (
                                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1 line-clamp-2">
                                    {resource.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-light-text-muted dark:text-dark-text-muted">
                                  <span>{resource.fileType || 'Document'}</span>
                                  {resource.fileSize && (
                                    <span>
                                      {(resource.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                  )}
                                  {resource.createdAt && (
                                    <span>
                                      {new Date(resource.createdAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  {resource.uploadedByName && (
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">
                                      By {resource.uploadedByName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (!schoolId || !classId) return;
                                  const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/schools/${schoolId}/classes/${classId}/resources/${resource.id}/download`;
                                  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('accessToken')) : null;
                                  
                                  fetch(downloadUrl, {
                                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                                  })
                                    .then((response) => response.blob())
                                    .then((blob) => {
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = resource.name;
                                      document.body.appendChild(a);
                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                      document.body.removeChild(a);
                                    })
                                    .catch((error) => {
                                      toast.error('Failed to download resource');
                                      console.error('Download error:', error);
                                    });
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteResource(resource.id)}
                                disabled={isDeletingResource}
                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                              >
                                {isDeletingResource ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Delete'
                                )}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                      <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                        No resources uploaded yet.
                      </p>
                      <p className="text-sm text-light-text-muted dark:text-dark-text-muted mb-4">
                        Upload documents, spreadsheets, and other files for your students.
                      </p>
                      <Button
                        variant="primary"
                        onClick={() => setShowUploadResourceModal(true)}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Your First Resource
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* RollCall Tab */}
          {(activeTab as TabType) === 'rollcall' && hasRollCall && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-light-text-primary dark:text-dark-text-primary">
                      RollCall Attendance
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => router.push('/dashboard/teacher/plugins/rollcall')}
                      className="flex items-center gap-2"
                    >
                      <Smartphone className="h-4 w-4" />
                      Open RollCall
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <Card className="border border-light-border dark:border-dark-border">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                Today&apos;s Attendance
                              </p>
                              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                                {/* TODO: Replace with real attendance data when API is ready */}
                                0/{students.length}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border border-light-border dark:border-dark-border">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                Absent Today
                              </p>
                              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                                {/* TODO: Replace with real attendance data when API is ready */}
                                0
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border border-light-border dark:border-dark-border">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <div>
                              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                Late Today
                              </p>
                              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                                {/* TODO: Replace with real attendance data when API is ready */}
                                0
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                        Recent Attendance Records
                      </h3>
                      {/* TODO: Replace with real attendance data when API is ready */}
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                        <p className="text-light-text-secondary dark:text-dark-text-secondary">
                          Attendance records will be available here once you start taking attendance.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* RollCall Tab - Not Available */}
          {(activeTab as TabType) === 'rollcall' && !hasRollCall && (
            <div className="space-y-6">
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <Smartphone className="h-16 w-16 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                    RollCall Plugin Not Available
                  </h3>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
                    Your school needs to subscribe to the RollCall plugin to use this feature.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => router.push('/dashboard/school/marketplace')}
                  >
                    View Marketplace
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modals */}
      <BulkGradeEntryModal
        isOpen={showBulkGradeModal}
        onClose={() => setShowBulkGradeModal(false)}
        schoolId={schoolId!}
        classId={classId}
        students={students}
        subject={classData?.teachers?.[0]?.subject || undefined}
        termId={activeSession?.term?.id || undefined}
        academicYear={classData?.academicYear || activeSession?.session?.name}
        onSuccess={() => {
          refetchGrades();
          setShowBulkGradeModal(false);
        }}
      />

      {selectedStudent && (
        <GradeEntryModal
          isOpen={showGradeModal}
          onClose={() => {
            setShowGradeModal(false);
            setSelectedStudent(null);
          }}
          schoolId={schoolId!}
          student={selectedStudent}
          classId={classId}
          subject={classData?.teachers?.[0]?.subject || undefined}
          termId={activeSession?.term?.id || undefined}
          academicYear={classData?.academicYear || activeSession?.session?.name}
          onSuccess={() => {
            refetchGrades();
            setShowGradeModal(false);
            setSelectedStudent(null);
          }}
        />
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedGrade(null);
        }}
        onConfirm={async () => {
          if (selectedGrade && schoolId) {
            try {
              await deleteGrade({
                schoolId,
                gradeId: selectedGrade.id,
              }).unwrap();
              toast.success('Grade deleted successfully');
              refetchGrades();
              setShowDeleteModal(false);
              setSelectedGrade(null);
            } catch (error: any) {
              toast.error(error?.data?.message || 'Failed to delete grade');
            }
          }
        }}
        title="Delete Grade"
        message="Are you sure you want to delete this grade? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Upload Resource Modal */}
      {showUploadResourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-light-card dark:bg-dark-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  Upload Resource
                </h2>
                <button
                  onClick={() => {
                    setShowUploadResourceModal(false);
                    setSelectedFile(null);
                    setResourceDescription('');
                  }}
                  className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                    Select File <span className="text-red-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-light-border dark:border-dark-border rounded-lg p-6 text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mb-2" />
                      <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
                      </span>
                      <span className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                        PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV (Max 50MB)
                      </span>
                    </label>
                  </div>
                  {selectedFile && (
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                    Description (Optional)
                  </label>
                  <Input
                    placeholder="Add a description for this resource..."
                    value={resourceDescription}
                    onChange={(e) => setResourceDescription(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowUploadResourceModal(false);
                    setSelectedFile(null);
                    setResourceDescription('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    await handleUpload();
                    setShowUploadResourceModal(false);
                  }}
                  disabled={isUploadingResource || !selectedFile}
                >
                  {isUploadingResource ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Resource
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </ProtectedRoute>
  );
}

// Class Timetable View Component
function ClassTimetableView({
  schoolId,
  classId,
  termId,
  schoolType,
  allTerms,
  selectedTermId,
  onTermChange,
  activeTermId,
  terminology,
}: {
  schoolId: string;
  classId: string;
  termId: string;
  schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | null;
  allTerms?: Array<{ id: string; name: string; sessionName: string }>;
  selectedTermId?: string;
  onTermChange?: (termId: string) => void;
  activeTermId?: string;
  terminology?: any;
}) {
  const { data: timetableResponse, isLoading } = useGetTimetableForClassQuery(
    {
      schoolId,
      classId,
      termId,
    },
    { skip: !schoolId || !classId || !termId }
  );

  const timetable = timetableResponse?.data || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center">
          <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
          <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading timetable...</p>
        </CardContent>
      </Card>
    );
  }

  if (timetable.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center">
          <Clock className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            No timetable periods found for this class.
          </p>
          <p className="text-sm text-light-text-muted dark:text-dark-text-muted mt-2">
            The timetable will appear here once periods are assigned by the administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TeacherTimetableGrid
      timetable={timetable}
      schoolType={schoolType}
      isLoading={false}
      allTerms={allTerms}
      selectedTermId={selectedTermId}
      onTermChange={onTermChange}
      activeTermId={activeTermId}
      terminology={terminology}
    />
  );
}