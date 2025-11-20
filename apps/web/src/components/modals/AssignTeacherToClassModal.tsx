'use client';

import { useState, useMemo, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { 
  useGetStaffListQuery,
  useAssignTeacherToClassMutation,
  useGetSubjectsQuery,
  useGetClassesQuery,
  StaffListItem,
  Subject,
} from '@/lib/store/api/schoolAdminApi';
import { useTeacherSubjects } from '@/hooks/useTeacherSubjects';
import toast from 'react-hot-toast';
import { Loader2, Search, User, BookOpen, CheckCircle } from 'lucide-react';

interface AssignTeacherToClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  classId: string;
  className: string;
  schoolType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  existingTeachers: Array<{ teacherId: string; subject: string | null }>;
  onSuccess?: () => void;
}

export function AssignTeacherToClassModal({
  isOpen,
  onClose,
  schoolId,
  classId,
  className,
  schoolType,
  existingTeachers,
  onSuccess,
}: AssignTeacherToClassModalProps) {
  const [step, setStep] = useState<'teacher' | 'subject'>('teacher');
  const [selectedTeacher, setSelectedTeacher] = useState<StaffListItem | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch teachers
  const { data: staffResponse, isLoading: isLoadingStaff } = useGetStaffListQuery(
    { schoolType },
    { skip: !isOpen }
  );

  // Fetch all PRIMARY classes to get already-assigned teachers (only for PRIMARY schools)
  const { data: allClassesResponse, isLoading: isLoadingClasses } = useGetClassesQuery(
    { schoolId, type: 'PRIMARY' },
    { skip: !isOpen || schoolType !== 'PRIMARY' }
  );

  // Fetch subjects (for SECONDARY schools)
  const { data: subjectsResponse, isLoading: isLoadingSubjects } = useGetSubjectsQuery(
    { schoolId, schoolType },
    { skip: !isOpen || schoolType !== 'SECONDARY' }
  );

  // Get teacher's subject competencies (for SECONDARY)
  const { subjects: teacherSubjects, isLoading: isLoadingTeacherSubjects } = useTeacherSubjects({
    schoolId,
    teacherId: selectedTeacher?.id,
    skip: !selectedTeacher || schoolType !== 'SECONDARY',
  });

  const [assignTeacher, { isLoading: isAssigning }] = useAssignTeacherToClassMutation();

  // Filter to only show teachers
  const teachers = useMemo(() => {
    const allStaff = staffResponse?.data?.items || [];
    return allStaff.filter((s) => s.type === 'teacher');
  }, [staffResponse]);

  const subjects = useMemo(() => subjectsResponse?.data || [], [subjectsResponse]);

  // Get teacher IDs who are already assigned as form teachers in OTHER PRIMARY classes
  const teachersAssignedToOtherClasses = useMemo(() => {
    if (schoolType !== 'PRIMARY' || !allClassesResponse?.data) return new Set<string>();
    
    const assignedIds = new Set<string>();
    allClassesResponse.data.forEach((cls) => {
      // Skip the current class - we only want to filter teachers from OTHER classes
      if (cls.id === classId) return;
      
      // Get form teachers (isPrimary = true) from each class
      cls.teachers?.forEach((teacher) => {
        if (teacher.isPrimary) {
          assignedIds.add(teacher.teacherId);
        }
      });
    });
    
    return assignedIds;
  }, [schoolType, allClassesResponse, classId]);

  // Filter teachers by search and exclude already assigned (for PRIMARY schools)
  const filteredTeachers = useMemo(() => {
    let result = teachers;

    // For PRIMARY schools, exclude teachers who are already form teachers in other classes
    if (schoolType === 'PRIMARY') {
      result = result.filter((t) => !teachersAssignedToOtherClasses.has(t.id));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.firstName.toLowerCase().includes(query) ||
          t.lastName.toLowerCase().includes(query) ||
          t.email?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [teachers, searchQuery, schoolType, teachersAssignedToOtherClasses]);

  // Get subjects teacher can teach that aren't already assigned
  const availableSubjectsForTeacher = useMemo(() => {
    if (schoolType !== 'SECONDARY' || !selectedTeacher) return [];

    const assignedSubjects = existingTeachers
      .filter((t) => t.teacherId === selectedTeacher.id)
      .map((t) => t.subject?.toLowerCase())
      .filter(Boolean);

    return teacherSubjects.filter(
      (s) => !assignedSubjects.includes(s.name.toLowerCase())
    );
  }, [schoolType, selectedTeacher, existingTeachers, teacherSubjects]);

  // Check if teacher is already assigned (for PRIMARY - as form teacher)
  const isTeacherAlreadyFormTeacher = useMemo(() => {
    if (!selectedTeacher) return false;
    return existingTeachers.some(
      (t) => t.teacherId === selectedTeacher.id && !t.subject
    );
  }, [selectedTeacher, existingTeachers]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('teacher');
      setSelectedTeacher(null);
      setSelectedSubject('');
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelectTeacher = (teacher: StaffListItem) => {
    setSelectedTeacher(teacher);
    
    if (schoolType === 'PRIMARY') {
      // For PRIMARY, go directly to confirmation
      setStep('subject');
    } else if (schoolType === 'SECONDARY') {
      // For SECONDARY, need to select subject
      setStep('subject');
    } else {
      // For TERTIARY, similar to PRIMARY
      setStep('subject');
    }
  };

  const handleAssign = async () => {
    if (!selectedTeacher) return;

    try {
      await assignTeacher({
        schoolId,
        classId,
        assignment: {
          teacherId: selectedTeacher.id,
          subject: schoolType === 'SECONDARY' ? selectedSubject : undefined,
          // For PRIMARY schools, always set isPrimary to true (single form teacher)
          isPrimary: schoolType === 'PRIMARY' ? true : false,
        },
      }).unwrap();

      const subjectText = selectedSubject ? ` for ${selectedSubject}` : '';
      toast.success(`${selectedTeacher.firstName} ${selectedTeacher.lastName} assigned to ${className}${subjectText}`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to assign teacher');
    }
  };

  const canAssign = useMemo(() => {
    if (!selectedTeacher) return false;
    if (schoolType === 'SECONDARY' && !selectedSubject) return false;
    if (schoolType === 'PRIMARY' && isTeacherAlreadyFormTeacher) return false;
    return true;
  }, [selectedTeacher, selectedSubject, schoolType, isTeacherAlreadyFormTeacher]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'teacher' ? 'Select Teacher' : 'Assign to Class'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Step 1: Select Teacher */}
        {step === 'teacher' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
              <input
                type="text"
                placeholder="Search teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-light-border dark:border-dark-border rounded-lg bg-light-bg dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Teacher List */}
            <div className="max-h-[400px] overflow-y-auto scrollbar-hide space-y-2">
              {(isLoadingStaff || (schoolType === 'PRIMARY' && isLoadingClasses)) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : filteredTeachers.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-2" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">
                    No teachers found
                  </p>
                </div>
              ) : (
                filteredTeachers.map((teacher) => {
                  const isAlreadyAssigned = existingTeachers.some(
                    (t) => t.teacherId === teacher.id
                  );
                  const assignedCount = existingTeachers.filter(
                    (t) => t.teacherId === teacher.id
                  ).length;

                  return (
                    <div
                      key={teacher.id}
                      onClick={() => handleSelectTeacher(teacher)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTeacher?.id === teacher.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-dark-bg'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            {teacher.profileImage ? (
                              <img
                                src={teacher.profileImage}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                {teacher.firstName[0]}{teacher.lastName[0]}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                              {teacher.firstName} {teacher.lastName}
                            </p>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              {teacher.email || teacher.phone}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {teacher.subject && schoolType !== 'SECONDARY' && (
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                              {teacher.subject}
                            </span>
                          )}
                          {isAlreadyAssigned && (
                            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                              {assignedCount} assigned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Step 2: Select Subject (SECONDARY) or Confirm (PRIMARY/TERTIARY) */}
        {step === 'subject' && selectedTeacher && (
          <>
            {/* Selected Teacher Summary */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  {selectedTeacher.profileImage ? (
                    <img
                      src={selectedTeacher.profileImage}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium text-blue-600 dark:text-blue-400">
                      {selectedTeacher.firstName[0]}{selectedTeacher.lastName[0]}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                    {selectedTeacher.firstName} {selectedTeacher.lastName}
                  </p>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Assigning to: {className}
                  </p>
                </div>
              </div>
            </div>

            {/* Subject Selection for SECONDARY */}
            {schoolType === 'SECONDARY' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                  Select Subject to Teach
                </label>

                {isLoadingTeacherSubjects ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : availableSubjectsForTeacher.length === 0 ? (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      {teacherSubjects.length === 0
                        ? 'This teacher has no subject competencies. Please add subjects to their profile first.'
                        : 'This teacher is already assigned to teach all their subjects in this class.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto scrollbar-hide">
                    {availableSubjectsForTeacher.map((subject) => (
                      <div
                        key={subject.id}
                        onClick={() => setSelectedSubject(subject.name)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedSubject === subject.name
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-dark-bg'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className={`h-4 w-4 ${
                            selectedSubject === subject.name
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-light-text-muted dark:text-dark-text-muted'
                          }`} />
                          <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                            {subject.name}
                          </span>
                        </div>
                        {selectedSubject === subject.name && (
                          <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-1" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PRIMARY schools info */}
            {schoolType === 'PRIMARY' && (
              <div className="space-y-3">
                {isTeacherAlreadyFormTeacher ? (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      This teacher is already assigned as the class teacher for this class.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      This teacher will be assigned as the class teacher for this class.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TERTIARY - just confirmation */}
            {schoolType === 'TERTIARY' && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  This teacher will be assigned as an instructor for this course.
                </p>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-2 pt-4 border-t border-light-border dark:border-dark-border">
          {step === 'subject' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('teacher')}
                disabled={isAssigning}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  disabled={isAssigning}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleAssign}
                  disabled={!canAssign || isAssigning}
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    'Assign Teacher'
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex justify-end w-full">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

