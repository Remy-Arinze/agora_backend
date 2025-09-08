import { useState, useCallback } from 'react';
import { useUploadClassResourceMutation, useDeleteClassResourceMutation, useGetClassResourcesQuery } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';

interface UseClassResourcesParams {
  schoolId: string | undefined;
  classId: string;
  activeTab: string;
}

interface UseClassResourcesReturn {
  resources: any[];
  isLoading: boolean;
  isUploading: boolean;
  isDeleting: boolean;
  selectedFile: File | null;
  resourceDescription: string;
  setSelectedFile: (file: File | null) => void;
  setResourceDescription: (description: string) => void;
  handleUpload: () => Promise<void>;
  handleDelete: (resourceId: string) => Promise<void>;
  refetchResources: () => void;
}

/**
 * Hook to manage class resources with upload and delete functionality
 * Separates business logic for resource management from UI components
 */
export function useClassResources({
  schoolId,
  classId,
  activeTab,
}: UseClassResourcesParams): UseClassResourcesReturn {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resourceDescription, setResourceDescription] = useState('');

  // Get resources for class
  const { data: resourcesResponse, refetch: refetchResources } = useGetClassResourcesQuery(
    { schoolId: schoolId!, classId },
    { skip: !schoolId || !classId || activeTab !== 'resources' }
  );

  const resources = resourcesResponse?.data || [];

  // Resource mutations
  const [uploadResource, { isLoading: isUploading }] = useUploadClassResourceMutation();
  const [deleteResource, { isLoading: isDeleting }] = useDeleteClassResourceMutation();

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !schoolId || !classId) {
      toast.error('Please select a file');
      return;
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error('File size exceeds maximum limit of 50MB');
      return;
    }

    // Validate file type - only documents and spreadsheets, no images
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ];

    if (!allowedMimeTypes.includes(selectedFile.type)) {
      toast.error(`File type ${selectedFile.type} is not allowed. Only documents and spreadsheets are permitted (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV). Images are not allowed.`);
      return;
    }

    try {
      await uploadResource({
        schoolId,
        classId,
        file: selectedFile,
        description: resourceDescription.trim() || undefined,
      }).unwrap();

      toast.success('Resource uploaded successfully');
      setSelectedFile(null);
      setResourceDescription('');
      refetchResources();
    } catch (error: any) {
      // Handle different error types
      const errorMessage = error?.data?.message || error?.message || 'Failed to upload resource';
      
      // Check for specific error types
      if (error?.status === 400) {
        toast.error(errorMessage);
      } else if (error?.status === 413) {
        toast.error('File is too large. Maximum size is 50MB');
      } else if (error?.status === 415) {
        toast.error('File type is not supported');
      } else {
        toast.error(errorMessage);
      }
    }
  }, [selectedFile, schoolId, classId, resourceDescription, uploadResource, refetchResources]);

  const handleDelete = useCallback(async (resourceId: string) => {
    if (!schoolId || !classId) {
      toast.error('Missing required parameters');
      return;
    }

    if (!confirm('Are you sure you want to delete this resource?')) {
      return;
    }

    try {
      await deleteResource({
        schoolId,
        classId,
        resourceId,
      }).unwrap();

      toast.success('Resource deleted successfully');
      refetchResources();
    } catch (error: any) {
      const errorMessage = error?.data?.message || error?.message || 'Failed to delete resource';
      toast.error(errorMessage);
    }
  }, [schoolId, classId, deleteResource, refetchResources]);

  return {
    resources,
    isLoading: false, // Resources query loading state can be added if needed
    isUploading,
    isDeleting,
    selectedFile,
    resourceDescription,
    setSelectedFile,
    setResourceDescription,
    handleUpload,
    handleDelete,
    refetchResources,
  };
}

