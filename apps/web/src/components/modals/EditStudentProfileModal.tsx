'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useUploadStudentImageMutation, useUpdateStudentMutation } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface EditStudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    phone?: string;
    profileImage?: string | null;
    healthInfo?: {
      bloodGroup?: string;
      allergies?: string;
      medications?: string;
      emergencyContact?: string;
      emergencyContactPhone?: string;
      medicalNotes?: string;
    } | null;
  };
  schoolId: string;
  onSuccess?: () => void;
}

export function EditStudentProfileModal({
  isOpen,
  onClose,
  student,
  schoolId,
  onSuccess,
}: EditStudentProfileModalProps) {
  const [formData, setFormData] = useState({
    firstName: student.firstName,
    lastName: student.lastName,
    middleName: student.middleName || '',
    phone: student.phone || '',
    profileImage: student.profileImage || null,
    bloodGroup: student.healthInfo?.bloodGroup || '',
    allergies: student.healthInfo?.allergies || '',
    medications: student.healthInfo?.medications || '',
    emergencyContact: student.healthInfo?.emergencyContact || '',
    emergencyContactPhone: student.healthInfo?.emergencyContactPhone || '',
    medicalNotes: student.healthInfo?.medicalNotes || '',
  });

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [uploadStudentImage, { isLoading: isUploadingImage }] = useUploadStudentImageMutation();
  const [updateStudent, { isLoading: isUpdating }] = useUpdateStudentMutation();

  const isLoading = isUploadingImage || isUpdating;

  useEffect(() => {
    if (isOpen && student) {
      setFormData({
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName || '',
        phone: student.phone || '',
        profileImage: student.profileImage || null,
        bloodGroup: student.healthInfo?.bloodGroup || '',
        allergies: student.healthInfo?.allergies || '',
        medications: student.healthInfo?.medications || '',
        emergencyContact: student.healthInfo?.emergencyContact || '',
        emergencyContactPhone: student.healthInfo?.emergencyContactPhone || '',
        medicalNotes: student.healthInfo?.medicalNotes || '',
      });
      setSelectedImageFile(null);
    }
  }, [isOpen, student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Upload image if a new file was selected
      if (selectedImageFile) {
        try {
          await uploadStudentImage({
            schoolId,
            studentId: student.id,
            file: selectedImageFile,
          }).unwrap();
          toast.success('Profile image updated successfully!');
        } catch (uploadError: any) {
          console.error('Failed to upload profile image:', uploadError);
          toast.error(uploadError?.data?.message || 'Failed to upload profile image.');
        }
      }

      // Update student profile data
      const updateData: any = {};
      
      // Only include fields that have changed
      if (formData.firstName !== student.firstName) updateData.firstName = formData.firstName;
      if (formData.lastName !== student.lastName) updateData.lastName = formData.lastName;
      if (formData.middleName !== (student.middleName || '')) updateData.middleName = formData.middleName || null;
      if (formData.phone !== (student.phone || '')) updateData.phone = formData.phone || null;
      
      // Health information
      if (formData.bloodGroup !== (student.healthInfo?.bloodGroup || '')) updateData.bloodGroup = formData.bloodGroup || null;
      if (formData.allergies !== (student.healthInfo?.allergies || '')) updateData.allergies = formData.allergies || null;
      if (formData.medications !== (student.healthInfo?.medications || '')) updateData.medications = formData.medications || null;
      if (formData.emergencyContact !== (student.healthInfo?.emergencyContact || '')) updateData.emergencyContact = formData.emergencyContact || null;
      if (formData.emergencyContactPhone !== (student.healthInfo?.emergencyContactPhone || '')) updateData.emergencyContactPhone = formData.emergencyContactPhone || null;
      if (formData.medicalNotes !== (student.healthInfo?.medicalNotes || '')) updateData.medicalNotes = formData.medicalNotes || null;

      // Only call update if there are changes
      if (Object.keys(updateData).length > 0) {
        await updateStudent({
          schoolId,
          id: student.id,
          data: updateData,
        }).unwrap();
        toast.success('Student profile updated successfully');
        onSuccess?.();
        onClose();
      } else if (!selectedImageFile) {
        toast.info('No changes to save');
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update student profile');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Student Profile">
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
              return URL.createObjectURL(file);
            }}
            label="Profile Image"
            helperText="Upload a passport-sized profile image (optional). Image will be cropped to square format."
            maxSizeMB={5}
            disabled={isLoading}
            enableCrop={true}
            aspectRatio={1}
            cropShape="rect"
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
            label="Middle Name"
            id="middleName"
            value={formData.middleName}
            onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
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

        {student.phone && (
          <div>
            <Input
              label="Phone Number"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Health Information Section */}
        <div className="border-t border-light-border dark:border-dark-border pt-6 mt-6">
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
            Health Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Blood Group"
                id="bloodGroup"
                value={formData.bloodGroup}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                placeholder="e.g., O+, A-, B+"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <Input
                label="Allergies"
                id="allergies"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="e.g., Peanuts, Dust"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <Input
                label="Medications"
                id="medications"
                value={formData.medications}
                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                placeholder="e.g., Inhaler, Insulin"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <Input
                label="Emergency Contact Name"
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                placeholder="Full name"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <Input
                label="Emergency Contact Phone"
                id="emergencyContactPhone"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                placeholder="+1234567890"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label htmlFor="medicalNotes" className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
              Medical Notes
            </label>
            <textarea
              id="medicalNotes"
              value={formData.medicalNotes}
              onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
              placeholder="Additional medical information or notes..."
              rows={4}
              disabled={isLoading}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

