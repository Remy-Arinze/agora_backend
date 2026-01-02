'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useCreateGradeMutation, useGetTeacherSubjectsForClassQuery } from '@/lib/store/api/schoolAdminApi';
import type { GradeType, CreateGradeDto, StudentWithEnrollment } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, Info } from 'lucide-react';

interface GradeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  student: StudentWithEnrollment;
  classId: string; // Required for subject authorization
  subject?: string; // Optional: pre-selected subject name (for backward compatibility)
  termId?: string;
  academicYear?: string;
  onSuccess?: () => void;
}

interface FormData extends Omit<CreateGradeDto, 'subjectId'> {
  subjectId?: string;
}

export function GradeEntryModal({
  isOpen,
  onClose,
  schoolId,
  student,
  classId,
  subject,
  termId,
  academicYear,
  onSuccess,
}: GradeEntryModalProps) {
  const [formData, setFormData] = useState<FormData>({
    enrollmentId: student.enrollment?.id || '',
    subjectId: '',
    subject: subject || '',
    gradeType: 'CA',
    assessmentName: '',
    assessmentDate: undefined,
    sequence: undefined,
    score: 0,
    maxScore: 100,
    termId: termId,
    academicYear: academicYear,
    remarks: '',
    isPublished: false,
  });

  const [createGrade, { isLoading }] = useCreateGradeMutation();

  // Fetch teacher's authorized subjects for this class
  const { data: subjectsResponse, isLoading: isLoadingSubjects } = useGetTeacherSubjectsForClassQuery(
    { classId },
    { skip: !isOpen || !classId }
  );

  const subjectsData = subjectsResponse?.data;
  const subjects = subjectsData?.subjects || [];
  const isPrimaryTeacher = subjectsData?.isPrimaryTeacher || false;
  const canGradeAllSubjects = subjectsData?.canGradeAllSubjects || false;
  const schoolType = subjectsData?.schoolType;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && student) {
      // Try to find a matching subject if one was provided
      let initialSubjectId = '';
      let initialSubjectName = subject || '';

      if (subject && subjects.length > 0) {
        const matchingSubject = subjects.find(
          s => s.name.toLowerCase() === subject.toLowerCase()
        );
        if (matchingSubject) {
          initialSubjectId = matchingSubject.id;
          initialSubjectName = matchingSubject.name;
        }
      }

      setFormData({
        enrollmentId: student.enrollment?.id || '',
        subjectId: initialSubjectId,
        subject: initialSubjectName,
        gradeType: 'CA',
        assessmentName: '',
        assessmentDate: undefined,
        sequence: undefined,
        score: 0,
        maxScore: 100,
        termId: termId,
        academicYear: academicYear,
        remarks: '',
        isPublished: false,
      });
    }
  }, [isOpen, student, subject, termId, academicYear, subjects]);

  const handleSubjectChange = (subjectId: string) => {
    const selectedSubject = subjects.find(s => s.id === subjectId);
    setFormData({
      ...formData,
      subjectId,
      subject: selectedSubject?.name || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.enrollmentId) {
      toast.error('Student enrollment not found');
      return;
    }

    if (!formData.subjectId && !formData.subject) {
      toast.error('Please select a subject');
      return;
    }

    if (formData.score < 0 || formData.score > formData.maxScore) {
      toast.error(`Score must be between 0 and ${formData.maxScore}`);
      return;
    }

    if (formData.assessmentDate && new Date(formData.assessmentDate) > new Date()) {
      toast.error('Assessment date cannot be in the future');
      return;
    }

    try {
      await createGrade({
        schoolId,
        gradeData: {
          enrollmentId: formData.enrollmentId,
          subjectId: formData.subjectId || undefined,
          subject: formData.subject,
          gradeType: formData.gradeType,
          assessmentName: formData.assessmentName,
          assessmentDate: formData.assessmentDate,
          sequence: formData.sequence,
          score: formData.score,
          maxScore: formData.maxScore,
          termId: formData.termId,
          academicYear: formData.academicYear,
          remarks: formData.remarks,
          isPublished: formData.isPublished,
        },
      }).unwrap();

      toast.success('Grade created successfully');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create grade');
    }
  };

  const percentage = formData.maxScore > 0 
    ? ((formData.score / formData.maxScore) * 100).toFixed(1)
    : '0.0';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enter Grade"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
            Student
          </label>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName} ({student.uid})
          </p>
        </div>

        {/* Subject Selection */}
        <div>
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
                value={formData.subjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
              >
                <option value="">-- Select Subject --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </Select>
              
              {/* Show info badge for primary class teachers */}
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
          value={formData.gradeType}
          onChange={(e) => setFormData({ ...formData, gradeType: e.target.value as GradeType })}
        >
          <option value="CA">CA (Continuous Assessment)</option>
          <option value="ASSIGNMENT">Assignment</option>
          <option value="EXAM">Exam</option>
        </Select>

        <div>
          <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
            Assessment Name (Optional)
          </label>
          <Input
            type="text"
            value={formData.assessmentName || ''}
            onChange={(e) => setFormData({ ...formData, assessmentName: e.target.value || undefined })}
            placeholder="e.g., CA1, Assignment 1, First Term Exam"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              Assessment Date (Optional)
            </label>
            <Input
              type="date"
              value={formData.assessmentDate || ''}
              onChange={(e) => setFormData({ ...formData, assessmentDate: e.target.value || undefined })}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              Sequence (Optional)
            </label>
            <Input
              type="number"
              value={formData.sequence || ''}
              onChange={(e) => setFormData({ ...formData, sequence: e.target.value ? parseInt(e.target.value) : undefined })}
              min={1}
              placeholder="e.g., 1, 2, 3"
            />
            <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
              Order of assessment
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              Score <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={formData.score}
              onChange={(e) => setFormData({ ...formData, score: parseFloat(e.target.value) || 0 })}
              min={0}
              max={formData.maxScore}
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
              Max Score <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={formData.maxScore}
              onChange={(e) => setFormData({ ...formData, maxScore: parseFloat(e.target.value) || 100 })}
              min={0}
              step="0.01"
              required
            />
          </div>
        </div>

        {formData.maxScore > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Percentage: <span className="font-semibold">{percentage}%</span>
            </p>
          </div>
        )}

        <Textarea
          label="Remarks (Optional)"
          value={formData.remarks || ''}
          onChange={(e) => setFormData({ ...formData, remarks: e.target.value || undefined })}
          rows={3}
          placeholder="Additional notes or comments..."
          className="resize-none"
        />

        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <input
            type="checkbox"
            id="isPublished"
            checked={formData.isPublished}
            onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isPublished" className="text-sm text-blue-900 dark:text-blue-100">
            <span className="font-medium">Publish immediately</span>
            <span className="text-blue-700 dark:text-blue-300 ml-1">
              (Student will be able to see this grade)
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
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
            disabled={isLoading || subjects.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Grade'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
