'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import {
  BookOpen,
  Users,
  Plus,
  Trash2,
  Calendar,
  GraduationCap,
  Loader2,
  AlertCircle,
  Crown,
  FileText,
  Clock,
  Upload,
  Download,
  File,
  ListOrdered,
  ArrowLeft,
  Edit,
  UserX,
} from 'lucide-react';
import {
  useGetMySchoolQuery,
  useGetClassByIdQuery,
  useRemoveTeacherFromClassMutation,
  useGetClassResourcesQuery,
  useUploadClassResourceMutation,
  useDeleteClassResourceMutation,
  useGetActiveSessionQuery,
  useGetTimetableForClassQuery,
  useGetClassStudentsQuery,
  ClassTeacher,
  ClassResource,
  TimetablePeriod,
  StudentWithEnrollment,
} from '@/lib/store/api/schoolAdminApi';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology } from '@/lib/utils/terminology';
import { AssignTeacherToClassModal } from '@/components/modals/AssignTeacherToClassModal';
import { FileUploadModal } from '@/components/modals/FileUploadModal';
import { ConfirmModal } from '@/components/ui/Modal';
import { BackButton } from '@/components/ui/BackButton';
import { SubjectCurriculumList } from '@/components/curriculum';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { PermissionResource, PermissionType } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';

type TabType = 'students' | 'teachers' | 'timetable' | 'resources' | 'curriculum';

const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>('students');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [removeModal, setRemoveModal] = useState<{
    isOpen: boolean;
    teacher: ClassTeacher | null;
  }>({
    isOpen: false,
    teacher: null,
  });
  const [deleteResourceModal, setDeleteResourceModal] = useState<{
    isOpen: boolean;
    resource: ClassResource | null;
  }>({
    isOpen: false,
    resource: null,
  });
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Get school ID and type
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;
  const { currentType: schoolType } = useSchoolType();
  const terminology = getTerminology(schoolType || 'SECONDARY');

  // Get class data first (to know the school type for session query)
  const {
    data: classResponse,
    isLoading,
    error,
    refetch: refetchClass,
  } = useGetClassByIdQuery(
    { schoolId: schoolId!, classId },
    { skip: !schoolId || !classId }
  );

  const classData = classResponse?.data;

  // Get active session for timetable - use class's school type
  const { data: sessionResponse } = useGetActiveSessionQuery(
    { schoolId: schoolId!, schoolType: classData?.type || schoolType || undefined },
    { skip: !schoolId || !classData?.type }
  );
  const activeSession = sessionResponse?.data;
  const activeTerm = activeSession?.term;

  // Build tabs array - include Teachers tab only for SECONDARY schools
  // Must be defined before early returns to follow React hooks rules
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = useMemo(() => {
    const baseTabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
      { id: 'students', label: 'Students', icon: <Users className="h-4 w-4" /> },
    ];
    
    // Add Teachers tab for SECONDARY schools (they have multiple subject teachers)
    if (classData?.type === 'SECONDARY') {
      baseTabs.push({ id: 'teachers', label: 'Teachers', icon: <GraduationCap className="h-4 w-4" /> });
    }
    
    baseTabs.push(
      { id: 'timetable', label: 'Timetable', icon: <Calendar className="h-4 w-4" /> },
      { id: 'resources', label: 'Resources', icon: <FileText className="h-4 w-4" /> },
      { id: 'curriculum', label: 'Curriculum', icon: <ListOrdered className="h-4 w-4" /> }
    );
    
    return baseTabs;
  }, [classData?.type]);

  // Get class resources
  const { data: resourcesResponse, isLoading: isLoadingResources } = useGetClassResourcesQuery(
    { schoolId: schoolId!, classId },
    { skip: !schoolId || !classId || activeTab !== 'resources' }
  );
  const resources = resourcesResponse?.data || [];

  // Get timetable (also needed for SECONDARY Teachers tab)
  const shouldFetchTimetable = activeTab === 'timetable' || (activeTab === 'teachers' && classData?.type === 'SECONDARY');
  const { data: timetableResponse, isLoading: isLoadingTimetable } = useGetTimetableForClassQuery(
    { schoolId: schoolId!, classId, termId: activeTerm?.id || '' },
    { skip: !schoolId || !classId || !activeTerm?.id || !shouldFetchTimetable }
  );
  const timetable = timetableResponse?.data || [];

  // Extract unique teacher-subject pairs from timetable (for SECONDARY)
  const timetableTeachers = useMemo(() => {
    if (!timetable || timetable.length === 0) return [];
    
    const teacherSubjectMap = new Map<string, {
      teacherId: string;
      teacherName: string;
      subjects: Map<string, { subjectId: string; subjectName: string; periodCount: number }>;
    }>();
    
    timetable.forEach((period) => {
      if (!period.teacherId || !period.teacherName) return;
      if (!period.subjectId || !period.subjectName) return;
      
      if (!teacherSubjectMap.has(period.teacherId)) {
        teacherSubjectMap.set(period.teacherId, {
          teacherId: period.teacherId,
          teacherName: period.teacherName,
          subjects: new Map(),
        });
      }
      
      const teacherData = teacherSubjectMap.get(period.teacherId)!;
      if (!teacherData.subjects.has(period.subjectId)) {
        teacherData.subjects.set(period.subjectId, {
          subjectId: period.subjectId,
          subjectName: period.subjectName,
          periodCount: 0,
        });
      }
      teacherData.subjects.get(period.subjectId)!.periodCount++;
    });
    
    // Convert to array
    return Array.from(teacherSubjectMap.values()).map((teacher) => ({
      teacherId: teacher.teacherId,
      teacherName: teacher.teacherName,
      subjects: Array.from(teacher.subjects.values()),
      totalPeriods: Array.from(teacher.subjects.values()).reduce((sum, s) => sum + s.periodCount, 0),
    })).sort((a, b) => b.totalPeriods - a.totalPeriods);
  }, [timetable]);

  // Get students in class
  const { data: studentsResponse, isLoading: isLoadingStudents } = useGetClassStudentsQuery(
    { schoolId: schoolId!, classId },
    { skip: !schoolId || !classId || activeTab !== 'students' }
  );
  const students = studentsResponse?.data || [];

  // Mutations
  const [removeTeacher, { isLoading: isRemoving }] = useRemoveTeacherFromClassMutation();
  const [uploadResource, { isLoading: isUploading }] = useUploadClassResourceMutation();
  const [deleteResource, { isLoading: isDeletingResource }] = useDeleteClassResourceMutation();

  const handleRemoveTeacher = async () => {
    if (!removeModal.teacher || !schoolId) return;

    try {
      await removeTeacher({
        schoolId,
        classId,
        teacherId: removeModal.teacher.teacherId,
        subject: removeModal.teacher.subject || undefined,
      }).unwrap();

      toast.success(
        `${removeModal.teacher.firstName} ${removeModal.teacher.lastName} removed from ${classData?.name}`
      );
      setRemoveModal({ isOpen: false, teacher: null });
      refetchClass();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to remove teacher');
    }
  };

  const handleFileUpload = async (file: File, description?: string) => {
    if (!schoolId) throw new Error('School not found');

    await uploadResource({
      schoolId,
      classId,
      file,
      description: description || file.name,
    }).unwrap();
    toast.success('Resource uploaded successfully');
  };

  const handleDeleteResource = async () => {
    if (!deleteResourceModal.resource || !schoolId) return;

    try {
      await deleteResource({
    schoolId,
    classId,
        resourceId: deleteResourceModal.resource.id,
      }).unwrap();
      toast.success('Resource deleted successfully');
      setDeleteResourceModal({ isOpen: false, resource: null });
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete resource');
    }
  };

  // Group timetable by time slots
  const timetableByTimeSlot = timetable.reduce((acc: Record<string, TimetablePeriod[]>, period) => {
    const key = `${period.startTime}-${period.endTime}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(period);
    return acc;
  }, {});

  const timeSlots = Object.keys(timetableByTimeSlot).sort();

  // Loading state
  if (isLoading) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </ProtectedRoute>
    );
  }

  // Error state
  if (error || !classData) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="p-6">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-4">
            <AlertCircle className="h-5 w-5" />
            <span>Class not found</span>
          </div>
          <BackButton fallbackUrl="/dashboard/school/courses" />
        </div>
      </ProtectedRoute>
    );
  }

  // Group teachers by role
  const teachersByRole = {
    formTeachers: classData.teachers.filter((t) => t.isPrimary),
    subjectTeachers: classData.teachers.filter((t) => !t.isPrimary && t.subject),
    otherTeachers: classData.teachers.filter((t) => !t.isPrimary && !t.subject),
  };

  // For PRIMARY schools, only allow one form teacher
  const hasFormTeacher = teachersByRole.formTeachers.length > 0;
  const canAssignTeacher = schoolType !== 'PRIMARY' || !hasFormTeacher;

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-6">
          {/* Back Button */}
          <Link 
            href="/dashboard/school/courses"
            className="inline-flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
            style={{ fontSize: 'var(--text-body)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Classes
          </Link>
          
          {/* Class Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Class Icon */}
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg flex-shrink-0">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              
              {/* Class Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-bold text-light-text-primary dark:text-dark-text-primary" style={{ fontSize: 'var(--text-card-title)' }}>
                    {classData.name}
                  </h1>
                  <span className={`px-2.5 py-1 rounded-full font-medium ${
                    classData.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`} style={{ fontSize: 'var(--text-small)' }}>
                    {classData.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                {/* Class Details */}
                <div className="flex flex-wrap items-center gap-6 text-light-text-secondary dark:text-dark-text-secondary" style={{ fontSize: 'var(--text-body)' }}>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 flex-shrink-0" />
                    <span>
                      {classData.classLevel || 'N/A'} • {classData.academicYear || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <UserX className="h-4 w-4 flex-shrink-0" />
                    {classData.type === 'PRIMARY' ? (
                      teachersByRole.formTeachers.length > 0 ? (
                        <>
                          <Link 
                            href={`/dashboard/school/teachers/${teachersByRole.formTeachers[0].teacherId}`}
                            className="font-medium hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                          >
                            {teachersByRole.formTeachers[0].firstName} {teachersByRole.formTeachers[0].lastName}
                          </Link>
                        </>
                      ) : classData.teachers.length > 0 ? (
                        <>
                          <Link 
                            href={`/dashboard/school/teachers/${classData.teachers[0].teacherId}`}
                            className="font-medium hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                          >
                            {classData.teachers[0].firstName} {classData.teachers[0].lastName}
                          </Link>
                        </>
                      ) : (
                        <>
                          <span className="italic">No teacher assigned</span>
                          <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setShowAssignModal(true)}
                              className="ml-1"
                            >
                              Assign Teacher
                            </Button>
                          </PermissionGate>
                        </>
                      )
                    ) : classData.type === 'SECONDARY' ? (
                      teachersByRole.formTeachers.length > 0 ? (
                        <>
                          <Link 
                            href={`/dashboard/school/teachers/${teachersByRole.formTeachers[0].teacherId}`}
                            className="font-medium hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                          >
                            {teachersByRole.formTeachers[0].firstName} {teachersByRole.formTeachers[0].lastName}
                          </Link>
                        </>
                      ) : (
                        <>
                          <span className="italic">No form teacher assigned</span>
                          <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setShowAssignModal(true)}
                              className="ml-1"
                            >
                              Assign Teacher
                            </Button>
                          </PermissionGate>
                        </>
                      )
                    ) : (
                      <>
                        {classData.teachers.length > 0 ? (
                          <span>{classData.teachers.length} lecturer{classData.teachers.length !== 1 ? 's' : ''} assigned</span>
                        ) : (
                          <>
                            <span className="italic">No lecturer assigned</span>
                            <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setShowAssignModal(true)}
                                className="ml-1"
                              >
                                Assign Lecturer
                              </Button>
                            </PermissionGate>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 flex-shrink-0" />
                    <span>{classData.studentsCount || 0} student{(classData.studentsCount || 0) !== 1 ? 's' : ''} enrolled</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Edit Class Button */}
            <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 h-8 text-xs">
                <Edit className="h-3 w-3" />
                Edit Class
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-light-border dark:border-dark-border">
          <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors whitespace-nowrap text-xs ${
                  activeTab === tab.id
                    ? 'border-b-2 border-[#2490FD] dark:border-[#2490FD] text-[#2490FD] dark:text-[#2490FD]'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
                style={{ fontSize: 'var(--text-small)' }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* Students Tab */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              {/* Section Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                  <p className="font-medium text-light-text-secondary dark:text-dark-text-secondary" style={{ fontSize: 'var(--text-section-title)' }}>
                    Students in Class
                  </p>
                </div>
                <PermissionGate resource={PermissionResource.STUDENTS} type={PermissionType.WRITE}>
                  <Link href={`/dashboard/school/admissions?new=true`}>
                    <Button variant="primary" size="sm" className="h-8 text-xs">
                      <Plus className="h-3 w-3 mr-2" />
                      Add Student
                    </Button>
                  </Link>
                </PermissionGate>
              </div>
              
              {/* Content */}
              {isLoadingStudents ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              ) : students.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-light-surface dark:bg-dark-surface flex items-center justify-center mx-auto mb-4">
                      <Users className="h-10 w-10 text-light-text-muted dark:text-dark-text-muted" />
                    </div>
                    <p className="font-medium text-light-text-primary dark:text-dark-text-primary mb-2" style={{ fontSize: 'var(--text-card-title)' }}>
                      No students enrolled yet
                    </p>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6 max-w-md mx-auto" style={{ fontSize: 'var(--text-body)' }}>
                      This class is currently empty. Start by adding new students directly to this class.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-light-border dark:border-dark-border">
                            <th className="text-left py-3 px-4 font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider" style={{ fontSize: 'var(--text-small)' }}>
                              Student
                            </th>
                            <th className="text-left py-3 px-4 font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider" style={{ fontSize: 'var(--text-small)' }}>
                              Student ID
                            </th>
                            <th className="text-left py-3 px-4 font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider" style={{ fontSize: 'var(--text-small)' }}>
                              Class Level
                            </th>
                            <th className="text-left py-3 px-4 font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider" style={{ fontSize: 'var(--text-small)' }}>
                              Status
                            </th>
                            <th className="text-right py-3 px-4 font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider" style={{ fontSize: 'var(--text-small)' }}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr
                              key={student.id}
                              className="border-b border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-dark-bg transition-colors"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                    {student.profileImage ? (
                                      <img
                                        src={student.profileImage}
                                        alt=""
                                        className="w-9 h-9 rounded-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                        {student.firstName?.[0]}{student.lastName?.[0]}
                              </span>
                                    )}
                    </div>
                      <div>
                                    <Link
                                      href={`/dashboard/school/students/${student.id}`}
                                      className="font-medium text-light-text-primary dark:text-dark-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                                    >
                                      {student.firstName} {student.lastName}
                                    </Link>
                                    {student.user?.email && (
                                      <p className="text-light-text-muted dark:text-dark-text-muted" style={{ fontSize: 'var(--text-small)' }}>
                                        {student.user.email}
                                      </p>
                                    )}
                      </div>
                  </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-light-text-primary dark:text-dark-text-primary" style={{ fontSize: 'var(--text-body)' }}>
                                  {student.uid || '-'}
                      </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-light-text-primary dark:text-dark-text-primary" style={{ fontSize: 'var(--text-body)' }}>
                                  {student.enrollment?.classLevel || '-'}
                      </span>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                                    student.user?.accountStatus === 'ACTIVE' || !student.user?.accountStatus
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                  }`}
                                  style={{ fontSize: 'var(--text-small)' }}
                                >
                                  {student.user?.accountStatus || 'Active'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Link href={`/dashboard/school/students/${student.id}`}>
                                  <Button variant="ghost" size="sm" className="text-xs h-8">
                                    View
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pt-4 text-light-text-muted dark:text-dark-text-muted" style={{ fontSize: 'var(--text-body)' }}>
                      Total: {students.length} student{students.length !== 1 ? 's' : ''}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Teachers Tab (SECONDARY schools only) */}
          {activeTab === 'teachers' && classData.type === 'SECONDARY' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <CardTitle>Assigned Teachers</CardTitle>
                  </div>
                  <PermissionGate resource={PermissionResource.CLASSES} type={PermissionType.WRITE}>
                    <Button variant="primary" size="sm" onClick={() => setShowAssignModal(true)}>
                      <Plus className="h-3 w-3 mr-2" />
                      Assign Form Teacher
                    </Button>
                  </PermissionGate>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingTimetable ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : teachersByRole.formTeachers.length === 0 && timetableTeachers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                      No teachers assigned to this class yet.
                    </p>
                    <p className="text-sm text-light-text-muted dark:text-dark-text-muted mb-4">
                      Teachers are assigned through the timetable. Create a timetable and assign teachers to subject periods.
                    </p>
                    <Button variant="ghost" onClick={() => setActiveTab('timetable')} size="sm" className="text-xs">
                      <Calendar className="h-3 w-3 mr-2" />
                      Go to Timetable
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Form Teacher */}
                    {teachersByRole.formTeachers.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-3">
                          Form Teacher
                        </h4>
                        <div className="space-y-2">
                          {teachersByRole.formTeachers.map((teacher) => (
                            <TeacherCard
                              key={`${teacher.teacherId}-primary`}
                              teacher={teacher}
                              isPrimary
                              onRemove={() => setRemoveModal({ isOpen: true, teacher })}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Subject Teachers from Timetable */}
                    {timetableTeachers.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-3" style={{ fontSize: 'var(--text-small)' }}>
                          Subject Teachers (from Timetable)
                        </h4>
                        <div className="space-y-3">
                          {timetableTeachers.map((teacher) => (
                            <div 
                              key={teacher.teacherId}
                              className="p-4 rounded-lg border border-light-border dark:border-dark-border bg-[var(--light-surface)] dark:bg-[var(--dark-surface)] hover:bg-[var(--light-hover)] dark:hover:bg-[var(--dark-hover)] transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <GraduationCap className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  </div>
                                  <div>
                                    <Link 
                                      href={`/dashboard/school/teachers/${teacher.teacherId}`}
                                      className="font-medium text-light-text-primary dark:text-dark-text-primary hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                    >
                                      {teacher.teacherName}
                                    </Link>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {teacher.subjects.map((subject) => (
                                        <span 
                                          key={subject.subjectId}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs"
                                        >
                                          {subject.subjectName}
                                          <span className="text-blue-500 dark:text-blue-300">
                                            ({subject.periodCount})
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                  {teacher.totalPeriods} period{teacher.totalPeriods !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Legacy Subject Teachers (if any still exist) */}
                    {teachersByRole.subjectTeachers.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-3" style={{ fontSize: 'var(--text-small)' }}>
                          Other Subject Teachers
                        </h4>
                        <div className="space-y-2">
                          {teachersByRole.subjectTeachers.map((teacher) => (
                            <TeacherCard
                              key={`${teacher.teacherId}-${teacher.subject}`}
                              teacher={teacher}
                              onRemove={() => setRemoveModal({ isOpen: true, teacher })}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Other Teachers */}
                    {teachersByRole.otherTeachers.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-light-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-3" style={{ fontSize: 'var(--text-small)' }}>
                          Other Teachers
                        </h4>
                        <div className="space-y-2">
                          {teachersByRole.otherTeachers.map((teacher) => (
                            <TeacherCard
                              key={`${teacher.teacherId}-other`}
                              teacher={teacher}
                              onRemove={() => setRemoveModal({ isOpen: true, teacher })}
                            />
                          ))}
                        </div>
                      </div>
                              )}
                    </div>
                  )}
                </CardContent>
              </Card>
          )}

          {/* Timetable Tab */}
          {activeTab === 'timetable' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <CardTitle>Class Timetable</CardTitle>
                      </div>
                  <PermissionGate resource={PermissionResource.TIMETABLES} type={PermissionType.WRITE}>
                    <Link href={`/dashboard/school/timetable?class=${classId}`}>
                      <Button variant="primary" size="sm" className="h-8 text-xs">
                        Edit Timetable
                      </Button>
                    </Link>
                  </PermissionGate>
                  </div>
                </CardHeader>
                <CardContent>
                {isLoadingTimetable ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : !activeTerm ? (
                      <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      No active term. Please set up an academic session first.
                    </p>
                  </div>
                ) : timetable.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                      No timetable set up for this class yet.
                    </p>
                    <PermissionGate resource={PermissionResource.TIMETABLES} type={PermissionType.WRITE}>
                      <Link href={`/dashboard/school/timetable?class=${classId}`}>
                        <Button variant="primary" size="sm" className="text-xs">
                          <Plus className="h-3 w-3 mr-2" />
                          Create Timetable
                        </Button>
                      </Link>
                    </PermissionGate>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                            <tr>
                          <th className="p-2 text-left text-xs font-semibold text-light-text-muted dark:text-dark-text-muted border-b border-light-border dark:border-dark-border">
                            Time
                              </th>
                          {DAY_SHORT.map((day, idx) => (
                            <th key={day} className="p-2 text-center text-xs font-semibold text-light-text-muted dark:text-dark-text-muted border-b border-light-border dark:border-dark-border">
                              {day}
                              </th>
                          ))}
                            </tr>
                          </thead>
                      <tbody>
                        {timeSlots.map((slot) => {
                          const [start, end] = slot.split('-');
                              return (
                            <tr key={slot}>
                              <td className="p-2 text-xs text-light-text-secondary dark:text-dark-text-secondary border-b border-light-border dark:border-dark-border whitespace-nowrap">
                                {start} - {end}
                                  </td>
                              {DAYS_OF_WEEK.map((day) => {
                                const period = timetableByTimeSlot[slot]?.find((p) => p.dayOfWeek === day);
                                return (
                                  <td key={day} className="p-1 border-b border-light-border dark:border-dark-border">
                                    {period ? (
                                      <div className={`p-2 rounded text-xs ${
                                        period.type === 'BREAK' || period.type === 'LUNCH'
                                          ? 'bg-gray-100 dark:bg-gray-800'
                                          : period.type === 'ASSEMBLY'
                                          ? 'bg-purple-50 dark:bg-purple-900/20'
                                          : period.subjectName || period.courseName
                                          ? 'bg-blue-50 dark:bg-blue-900/20'
                                          : 'bg-green-50 dark:bg-green-900/20'
                                      }`}>
                                        {period.type === 'BREAK' ? (
                                          <span className="text-light-text-muted dark:text-dark-text-muted">Break</span>
                                        ) : period.type === 'LUNCH' ? (
                                          <span className="text-light-text-muted dark:text-dark-text-muted">Lunch</span>
                                        ) : period.type === 'ASSEMBLY' ? (
                                          <span className="text-purple-600 dark:text-purple-400 font-medium">Assembly</span>
                                        ) : (
                                          <>
                                            <p className="font-medium text-light-text-primary dark:text-dark-text-primary truncate">
                                              {period.subjectName || period.courseName || 'Free Period'}
                                            </p>
                                            {period.teacherName && (
                                              <p className="text-light-text-muted dark:text-dark-text-muted truncate">
                                                {period.teacherName}
                                              </p>
                                            )}
                                          </>
                                      )}
                                    </div>
                                    ) : (
                                      <div className="h-12" />
                                    )}
                                  </td>
                                );
                              })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                </CardContent>
              </Card>
          )}

          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    <CardTitle>Class Resources</CardTitle>
                  </div>
                  <PermissionGate resource={PermissionResource.RESOURCES} type={PermissionType.WRITE}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowUploadModal(true)}
                      className="h-8 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-2" />
                      Upload Resource
                    </Button>
                  </PermissionGate>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingResources ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      </div>
                ) : resources.length === 0 ? (
                  <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                          No resources uploaded yet.
                        </p>
                    <PermissionGate resource={PermissionResource.RESOURCES} type={PermissionType.WRITE}>
                      <Button variant="primary" onClick={() => setShowUploadModal(true)} size="sm" className="text-xs">
                        <Upload className="h-3 w-3 mr-2" />
                        Upload First Resource
                      </Button>
                    </PermissionGate>
                      </div>
                ) : (
                  <div className="space-y-2">
                    {resources.map((resource) => (
                      <div
                          key={resource.id}
                        className="flex items-center justify-between p-4 border border-light-border dark:border-dark-border rounded-lg hover:bg-light-surface dark:hover:bg-dark-bg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                            <File className="h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
                              </div>
                          <div>
                            <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                  {resource.name}
                            </p>
                            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                              {resource.fileSize} • {new Date(resource.createdAt).toLocaleDateString()}
                            </p>
                                </div>
                              </div>
                        <div className="flex items-center gap-2">
                          {resource.downloadUrl && (
                            <a href={resource.downloadUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Download className="h-3 w-3" />
                              </Button>
                            </a>
                          )}
                              <Button
                                variant="ghost"
                                size="sm"
                            onClick={() => setDeleteResourceModal({ isOpen: true, resource })}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 h-8 w-8 p-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                      ))}
                    </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Curriculum Tab */}
          {activeTab === 'curriculum' && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <ListOrdered className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  <CardTitle>Curriculum / Scheme of Work</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {schoolId && classData?.classLevelId && activeTerm?.id ? (
                  <SubjectCurriculumList
                    schoolId={schoolId}
                    classLevelId={classData.classLevelId}
                    termId={activeTerm.id}
                    schoolType={classData.type || schoolType || 'SECONDARY'}
                    teacherId={classData.teachers?.[0]?.teacherId}
                    canEdit={true}
                  />
                ) : (
                  <div className="text-center py-12">
                    <ListOrdered className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      {!activeTerm?.id 
                        ? 'No active term. Please set up an academic session first.'
                        : 'Unable to load curriculum data.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
                </div>

        {/* Modals */}
        {showAssignModal && schoolId && classData?.type && (
          <AssignTeacherToClassModal
            isOpen={showAssignModal}
            onClose={() => setShowAssignModal(false)}
            schoolId={schoolId}
            classId={classId}
            className={classData.name}
            schoolType={classData.type as 'PRIMARY' | 'SECONDARY' | 'TERTIARY'}
            existingTeachers={classData.teachers.map((t) => ({
              teacherId: t.teacherId,
              subject: t.subject,
            }))}
            onSuccess={() => refetchClass()}
          />
        )}

        <ConfirmModal
          isOpen={removeModal.isOpen}
          onClose={() => setRemoveModal({ isOpen: false, teacher: null })}
          onConfirm={handleRemoveTeacher}
          title="Remove Teacher"
          message={
            removeModal.teacher
              ? `Are you sure you want to remove ${removeModal.teacher.firstName} ${removeModal.teacher.lastName}${
                  removeModal.teacher.subject ? ` from teaching ${removeModal.teacher.subject}` : ''
                } from this class?`
              : ''
          }
          confirmText="Remove"
          variant="danger"
          isLoading={isRemoving}
        />

        <ConfirmModal
          isOpen={deleteResourceModal.isOpen}
          onClose={() => setDeleteResourceModal({ isOpen: false, resource: null })}
          onConfirm={handleDeleteResource}
          title="Delete Resource"
          message={
            deleteResourceModal.resource
              ? `Are you sure you want to delete "${deleteResourceModal.resource.name}"? This action cannot be undone.`
              : ''
          }
          confirmText="Delete"
          variant="danger"
          isLoading={isDeletingResource}
        />

        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleFileUpload}
          title="Upload Class Resource"
          isUploading={isUploading}
        />
      </div>
    </ProtectedRoute>
  );
}

// Teacher Card Component
function TeacherCard({
  teacher,
  isPrimary = false,
  onRemove,
}: {
  teacher: ClassTeacher;
  isPrimary?: boolean;
  onRemove: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between p-3 border border-light-border dark:border-dark-border rounded-lg hover:bg-light-surface dark:hover:bg-dark-bg transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {teacher.firstName[0]}{teacher.lastName[0]}
          </span>
                        </div>
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/school/teachers/${teacher.teacherId}`}
              className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary hover:text-blue-600 dark:hover:text-blue-400"
            >
              {teacher.firstName} {teacher.lastName}
                        </Link>
            {isPrimary && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                <Crown className="h-3 w-3" />
                Form
              </span>
            )}
            </div>
          {teacher.subject && (
            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">{teacher.subject}</p>
          )}
    </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </motion.div>
  );
}
