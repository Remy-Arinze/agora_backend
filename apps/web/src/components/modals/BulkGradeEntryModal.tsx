'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useBulkCreateGradesMutation, useGetClassGradesQuery, useGetTeacherSubjectsForClassQuery } from '@/lib/store/api/schoolAdminApi';
import type { GradeType, BulkGradeEntryDto, StudentWithEnrollment } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, Info } from 'lucide-react';

interface BulkGradeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  classId: string;
  students: StudentWithEnrollment[];
  subject?: string; // Optional: pre-selected subject name (for backward compatibility)
  termId?: string;
  academicYear?: string;
  onSuccess?: () => void;
}

interface StudentGradeEntry {
  enrollmentId: string;
  studentName: string;
  studentUid: string;
  score: number | '';
  remarks: string;
}

export function BulkGradeEntryModal({
  isOpen,
  onClose,
  schoolId,
  classId,
  students,
  subject,
  termId,
  academicYear,
  onSuccess,
}: BulkGradeEntryModalProps) {
  const [subjectId, setSubjectId] = useState<string>('');
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(subject || '');
  const [gradeType, setGradeType] = useState<GradeType>('CA');
  const [assessmentName, setAssessmentName] = useState('');
  const [maxScore, setMaxScore] = useState<number | ''>(100);
  const [assessmentDate, setAssessmentDate] = useState('');
  const [sequence, setSequence] = useState<number | ''>('');
  const [studentGrades, setStudentGrades] = useState<StudentGradeEntry[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  const [bulkCreateGrades, { isLoading }] = useBulkCreateGradesMutation();

  // Fetch teacher's authorized subjects for this class
  const { data: subjectsResponse, isLoading: isLoadingSubjects } = useGetTeacherSubjectsForClassQuery(
    { classId },
    { skip: !isOpen || !classId }
  );

  const subjectsData = subjectsResponse?.data;
  const subjects = subjectsData?.subjects || [];
  const isPrimaryTeacher = subjectsData?.isPrimaryTeacher || false;
  const canGradeAllSubjects = subjectsData?.canGradeAllSubjects || false;

  // Get existing grades to suggest next sequence number
  const { data: existingGradesResponse } = useGetClassGradesQuery(
    { 
      schoolId, 
      classId,
      gradeType: gradeType,
      termId: termId || undefined,
    },
    { skip: !schoolId || !classId || !isOpen }
  );

  const existingGrades = existingGradesResponse?.data || [];

  // Calculate suggested sequence number based on existing grades
  const suggestedSequence = useMemo(() => {
    if (!gradeType || !termId) return null;
    
    // Get all sequences for this grade type and term
    const sequences = existingGrades
      .filter((g: any) => g.gradeType === gradeType && g.sequence !== null && g.sequence !== undefined)
      .map((g: any) => g.sequence)
      .filter((s: number) => typeof s === 'number' && s > 0);
    
    if (sequences.length === 0) return 1;
    
    // Find the next available sequence
    const maxSequence = Math.max(...sequences);
    return maxSequence + 1;
  }, [existingGrades, gradeType, termId]);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && students.length > 0) {
      // Initialize student grades array
      setStudentGrades(
        students.map((student) => ({
          enrollmentId: student.enrollment?.id || '',
          studentName: `${student.firstName} ${student.middleName ? `${student.middleName} ` : ''}${student.lastName}`,
          studentUid: student.uid,
          score: '',
          remarks: '',
        }))
      );

      // Try to find matching subject if one was provided
      if (subject && subjects.length > 0) {
        const matchingSubject = subjects.find(
          s => s.name.toLowerCase() === subject.toLowerCase()
        );
        if (matchingSubject) {
          setSubjectId(matchingSubject.id);
          setSelectedSubjectName(matchingSubject.name);
        }
      }
    } else if (!isOpen) {
      // Reset form when modal closes
      setSubjectId('');
      setSelectedSubjectName('');
      setGradeType('CA');
      setAssessmentName('');
      setMaxScore(100);
      setAssessmentDate('');
      setSequence('');
      setStudentGrades([]);
      setIsPublished(false);
    }
  }, [isOpen, students, subject, subjects]);

  // Auto-suggest sequence when grade type or term changes
  useEffect(() => {
    if (isOpen && suggestedSequence !== null && sequence === '') {
      setSequence(suggestedSequence);
    }
  }, [suggestedSequence, gradeType, termId, isOpen]);

  const handleSubjectChange = (newSubjectId: string) => {
    const selectedSubject = subjects.find(s => s.id === newSubjectId);
    setSubjectId(newSubjectId);
    setSelectedSubjectName(selectedSubject?.name || '');
  };

  const handleScoreChange = (index: number, value: string) => {
    const newGrades = [...studentGrades];
    newGrades[index].score = value === '' ? '' : parseFloat(value) || '';
    setStudentGrades(newGrades);
  };

  const handleRemarksChange = (index: number, value: string) => {
    const newGrades = [...studentGrades];
    newGrades[index].remarks = value;
    setStudentGrades(newGrades);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate subject selection
    if (!subjectId && !selectedSubjectName) {
      toast.error('Please select a subject');
      return;
    }

    // Validate common fields
    const finalMaxScore = maxScore === '' || maxScore <= 0 ? 100 : maxScore;
    if (finalMaxScore <= 0) {
      toast.error('Max score must be greater than 0');
      return;
    }

    if (!assessmentName.trim()) {
      toast.error('Assessment name is required');
      return;
    }

    // Validate assessment date if provided
    if (assessmentDate && new Date(assessmentDate) > new Date()) {
      toast.error('Assessment date cannot be in the future');
      return;
    }

    // Filter out students with valid scores
    const validGrades = studentGrades.filter(
      (entry) => entry.enrollmentId && entry.score !== '' && typeof entry.score === 'number' && entry.score >= 0 && entry.score <= finalMaxScore
    );

    if (validGrades.length === 0) {
      toast.error('Please enter at least one valid grade');
      return;
    }

    const bulkData: BulkGradeEntryDto = {
      classId,
      subjectId: subjectId || undefined,
      subject: selectedSubjectName || undefined,
      gradeType,
      assessmentName: assessmentName.trim(),
      maxScore: finalMaxScore,
      assessmentDate: assessmentDate || undefined,
      sequence: sequence !== '' ? sequence as number : undefined,
      termId: termId || undefined,
      academicYear: academicYear || undefined,
      isPublished: isPublished,
      grades: validGrades.map((entry) => ({
        enrollmentId: entry.enrollmentId,
        score: entry.score as number,
        remarks: entry.remarks || undefined,
      })),
    };

    try {
      await bulkCreateGrades({
        schoolId,
        classId,
        gradeData: bulkData,
      }).unwrap();

      toast.success(`Successfully created ${validGrades.length} grade(s)`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create grades');
    }
  };

  const finalMaxScore = maxScore === '' || maxScore <= 0 ? 100 : maxScore;
  const validGradesCount = studentGrades.filter(
    (entry) => entry.enrollmentId && entry.score !== '' && typeof entry.score === 'number' && entry.score >= 0 && entry.score <= finalMaxScore
  ).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Grade Entry"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Description */}
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
          Enter grades for multiple students at once. Fill in the assessment details below and then enter scores for each student in the table.
        </p>
        
        {/* Common Fields */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border">
          {/* Subject Selection */}
          <div className="col-span-2">
            {isLoadingSubjects ? (
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading subjects...
              </div>
            ) : subjects.length > 0 ? (
              <>
                <Select
                  label="Subject"
                  required
                  value={subjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                >
                  <option value="">-- Select Subject --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </Select>
                
                {canGradeAllSubjects && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <p className="text-xs text-green-700 dark:text-green-300">
                      As the class teacher, you can grade all subjects for this class
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  No subjects assigned. Please contact your administrator.
                </p>
              </div>
            )}
          </div>

          <Select
            label="Grade Type"
            required
            value={gradeType}
            onChange={(e) => setGradeType(e.target.value as GradeType)}
          >
            <option value="CA">CA (Continuous Assessment)</option>
            <option value="ASSIGNMENT">Assignment</option>
            <option value="EXAM">Exam</option>
          </Select>

          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              Assessment Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={assessmentName}
              onChange={(e) => setAssessmentName(e.target.value)}
              placeholder="e.g., CA1, Assignment 1, First Term Exam"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              Max Score <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={maxScore}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setMaxScore('');
                } else {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setMaxScore(numValue);
                  }
                }
              }}
              onBlur={(e) => {
                if (maxScore === '' || maxScore <= 0) {
                  setMaxScore(100);
                }
              }}
              min={0}
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              Sequence (Optional)
              {suggestedSequence !== null && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">
                  (Suggested: {suggestedSequence})
                </span>
              )}
            </label>
            <Input
              type="number"
              value={sequence}
              onChange={(e) => setSequence(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
              min={1}
              placeholder={suggestedSequence !== null ? `e.g., ${suggestedSequence}` : "e.g., 1, 2, 3"}
            />
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
              Order number for this assessment within the same grade type and term.
              {suggestedSequence !== null && (
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {' '}Next available: {suggestedSequence}
                </span>
              )}
            </p>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              Assessment Date (Optional)
            </label>
            <Input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {/* Students Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
              Student Grades ({validGradesCount} entered)
            </h3>
          </div>

          <div className="border border-light-border dark:border-dark-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-light-surface dark:bg-dark-surface sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Percentage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-dark-border">
                  {studentGrades.map((entry, index) => {
                    const currentMaxScore = maxScore === '' || maxScore <= 0 ? 100 : maxScore;
                    const percentage = currentMaxScore > 0 && typeof entry.score === 'number'
                      ? ((entry.score / currentMaxScore) * 100).toFixed(1)
                      : '-';
                    const isValid = entry.enrollmentId && entry.score !== '' && typeof entry.score === 'number' && entry.score >= 0 && entry.score <= currentMaxScore;

                    return (
                      <tr
                        key={index}
                        className={isValid ? 'bg-light-bg dark:bg-dark-surface' : 'bg-red-50 dark:bg-red-900/10'}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                              {entry.studentName}
                            </p>
                            <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                              {entry.studentUid}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            value={entry.score}
                            onChange={(e) => handleScoreChange(index, e.target.value)}
                            min={0}
                            max={maxScore === '' || maxScore <= 0 ? 100 : maxScore}
                            step="0.01"
                            className="w-24"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="text"
                            value={entry.remarks}
                            onChange={(e) => handleRemarksChange(index, e.target.value)}
                            placeholder="Optional"
                            className="w-full"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <input
            type="checkbox"
            id="bulkIsPublished"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="bulkIsPublished" className="text-sm text-blue-900 dark:text-blue-100">
            <span className="font-medium">Publish immediately</span>
            <span className="text-blue-700 dark:text-blue-300 ml-1">
              (Students will be able to see these grades)
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-dark-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || validGradesCount === 0 || subjects.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              `Save ${validGradesCount} Grade(s)`
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
