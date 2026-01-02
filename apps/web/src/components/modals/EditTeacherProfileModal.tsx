'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useUpdateTeacherMutation, useUpdateAdminMutation, useUploadTeacherImageMutation, useUploadAdminImageMutation } from '@/lib/store/api/schoolsApi';
import { useTeacherSubjects } from '@/hooks/useTeacherSubjects';
import { SubjectMultiSelect } from '@/components/teachers/SubjectMultiSelect';
import toast from 'react-hot-toast';
import { Loader2, User, BookOpen } from 'lucide-react';

type TabType = 'profile' | 'subjects';

interface EditTeacherProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    subject?: string | null;
    isTemporary?: boolean;
    role?: string | null;
    profileImage?: string | null;
  };
  schoolId: string;
  staffType?: 'teacher' | 'admin';
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  onSuccess?: () => void;
}

export function EditTeacherProfileModal({
  isOpen,
  onClose,
  teacher,
  schoolId,
  staffType = 'teacher',
  schoolType,
  onSuccess,
}: EditTeacherProfileModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [formData, setFormData] = useState({
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    phone: teacher.phone,
    subject: teacher.subject || '',
    isTemporary: teacher.isTemporary || false,
    profileImage: teacher.profileImage || null,
  });

  // State for subject management (SECONDARY schools)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [updateTeacher, { isLoading: isUpdatingTeacher }] = useUpdateTeacherMutation();
  const [updateAdmin, { isLoading: isUpdatingAdmin }] = useUpdateAdminMutation();
  const [uploadTeacherImage, { isLoading: isUploadingTeacherImage }] = useUploadTeacherImageMutation();
  const [uploadAdminImage, { isLoading: isUploadingAdminImage }] = useUploadAdminImageMutation();

  // Teacher subjects hook (only for teachers in SECONDARY schools)
  const {
    subjects: teacherSubjects,
    isLoading: isLoadingSubjects,
    updateSubjects,
    isUpdating: isUpdatingSubjects,
  } = useTeacherSubjects({
    schoolId,
    teacherId: teacher.id,
    skip: staffType !== 'teacher' || schoolType !== 'SECONDARY',
  });

  const isLoading = isUpdatingTeacher || isUpdatingAdmin || isUploadingTeacherImage || isUploadingAdminImage || isUpdatingSubjects;
  const showSubjectsTab = staffType === 'teacher' && schoolType === 'SECONDARY';

  useEffect(() => {
    if (isOpen && teacher) {
      setFormData({
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        phone: teacher.phone,
        subject: teacher.subject || '',
        isTemporary: teacher.isTemporary || false,
        profileImage: teacher.profileImage || null,
      });
      setSelectedImageFile(null);
      setActiveTab('profile');
    }
  }, [isOpen, teacher]);

  // Sync selectedSubjectIds with teacherSubjects when loaded
  useEffect(() => {
    if (teacherSubjects.length > 0) {
      setSelectedSubjectIds(teacherSubjects.map((s) => s.id));
    }
  }, [teacherSubjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Update profile first
      if (staffType === 'teacher') {
        await updateTeacher({
          schoolId,
          teacherId: teacher.id,
          teacher: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            subject: formData.subject || undefined,
            isTemporary: formData.isTemporary,
            profileImage: formData.profileImage || undefined,
          },
        }).unwrap();
      } else {
        await updateAdmin({
          schoolId,
          adminId: teacher.id,
          admin: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            role: teacher.role || undefined,
            profileImage: formData.profileImage || undefined,
          },
        }).unwrap();
      }

      // Upload image if a new file was selected
      if (selectedImageFile) {
        try {
          if (staffType === 'teacher') {
            await uploadTeacherImage({
              schoolId,
              teacherId: teacher.id,
              file: selectedImageFile,
            }).unwrap();
          } else {
            await uploadAdminImage({
              schoolId,
              adminId: teacher.id,
              file: selectedImageFile,
            }).unwrap();
          }
        } catch (error: any) {
          console.error('Failed to upload image:', error);
          toast.error('Profile updated but image upload failed. Please try uploading the image again.');
        }
      }

      toast.success(`${staffType === 'teacher' ? 'Teacher' : 'Admin'} profile updated successfully`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.data?.message || `Failed to update ${staffType === 'teacher' ? 'teacher' : 'admin'} profile`);
    }
  };

  // Handle saving subjects
  const handleSaveSubjects = async () => {
    try {
      await updateSubjects(selectedSubjectIds);
      onSuccess?.();
    } catch (error) {
      // Error is handled in the hook
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${staffType === 'teacher' ? 'Teacher' : 'Admin'} Profile`} size="lg">
      {/* Tabs for Profile and Subjects (SECONDARY teachers only) */}
      {showSubjectsTab && (
        <div className="mb-4 border-b border-light-border dark:border-dark-border">
          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
              }`}
            >
              <User className="h-4 w-4" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subjects')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'subjects'
                  ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Subjects ({teacherSubjects.length})
            </button>
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Image Upload */}
          <div>
            <ImageUpload
              value={formData.profileImage}
              onChange={(url) => {
                setFormData({ ...formData, profileImage: url });
              }}
              onUpload={async (file) => {
                setSelectedImageFile(file);
                // Return a temporary URL for preview
                return URL.createObjectURL(file);
              }}
              label="Profile Image"
              helperText="Upload a passport-sized profile image (optional). Image will be cropped to square format."
              maxSizeMB={5}
              disabled={isLoading}
            />
          </div>

          <div>
            <Input
              label="First Name"
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Input
              label="Last Name"
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Input
              label="Phone Number"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>

          {staffType === 'teacher' && schoolType !== 'SECONDARY' && (
            <>
              <div>
                <Input
                  label="Subject (Optional)"
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Mathematics, English"
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {staffType === 'teacher' && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isTemporary"
                checked={formData.isTemporary}
                onChange={(e) =>
                  setFormData({ ...formData, isTemporary: e.target.checked })
                }
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 border-light-border dark:border-dark-border rounded focus:ring-blue-500"
              />
              <label htmlFor="isTemporary" className="text-sm text-light-text-primary dark:text-dark-text-primary cursor-pointer">
                Temporary Employee
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Profile'
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Subjects Tab (SECONDARY teachers only) */}
      {activeTab === 'subjects' && showSubjectsTab && (
        <div className="space-y-4">
          <div className="relative">
            <SubjectMultiSelect
              schoolId={schoolId}
              selectedSubjectIds={selectedSubjectIds}
              onChange={setSelectedSubjectIds}
              schoolType="SECONDARY"
              label="Subjects Teacher Can Teach"
              helperText="Select all subjects this teacher is qualified to teach. They can be assigned to different classes for these subjects."
              disabled={isLoading || isLoadingSubjects}
            />
          </div>

          {/* Info about subject changes */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Note:</p>
            <p>
              Subjects with active class assignments cannot be removed. 
              To remove a subject, first unassign the teacher from any classes where they teach that subject.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="primary" 
              onClick={handleSaveSubjects}
              disabled={isLoading || isLoadingSubjects}
            >
              {isUpdatingSubjects ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Subjects'
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

