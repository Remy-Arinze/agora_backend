'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { FileText, Download, X, Loader2, AlertCircle, Upload } from 'lucide-react';
import {
  useGetMyStudentResourcesQuery,
  useGetMyStudentPersonalResourcesQuery,
  useUploadPersonalResourceMutation,
  useDeletePersonalResourceMutation,
  useGetMyStudentClassesQuery,
  useGetMyStudentSchoolQuery,
} from '@/lib/store/api/schoolAdminApi';
import { FileUploadModal } from '@/components/modals/FileUploadModal';
import toast from 'react-hot-toast';

type ResourceType = 'class' | 'personal';

export default function StudentResourcesPage() {
  const [activeTab, setActiveTab] = useState<ResourceType>('class');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Get student's school and classes
  const { data: schoolResponse } = useGetMyStudentSchoolQuery();
  const { data: classesResponse } = useGetMyStudentClassesQuery();
  const schoolId = schoolResponse?.data?.id;
  const classes = classesResponse?.data || [];
  const classData = useMemo(() => classes[0] || null, [classes]);

  // Get class resources - backend automatically filters by student's enrolled classes/classArms
  const { data: classResourcesResponse, isLoading: isLoadingClassResources } = useGetMyStudentResourcesQuery(
    {},
    { skip: !classData } // Skip until we know student is enrolled
  );
  const classResources = classResourcesResponse?.data || [];

  // Get personal resources
  const { data: personalResourcesResponse, isLoading: isLoadingPersonalResources } = useGetMyStudentPersonalResourcesQuery();
  const personalResources = personalResourcesResponse?.data || [];

  // Upload and delete mutations
  const [uploadPersonalResource, { isLoading: isUploadingMutation }] = useUploadPersonalResourceMutation();
  const [deletePersonalResource] = useDeletePersonalResourceMutation();

  // Allowed file types for personal resources (documents only, no images)
  const allowedFileTypes = [
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

  const handleUpload = async (file: File, description?: string) => {
    await uploadPersonalResource({
      file,
      description: description || undefined,
    }).unwrap();
    toast.success('Resource uploaded successfully');
  };

  const handleDownload = async (resource: any, isPersonal: boolean) => {
    try {
      const baseUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000/api';
      let downloadUrl: string;
      
      if (isPersonal) {
        downloadUrl = `${baseUrl}/students/me/personal-resources/${resource.id}/download`;
      } else {
        if (schoolId && classData?.id) {
          downloadUrl = `${baseUrl}/schools/${schoolId}/classes/${classData.id}/resources/${resource.id}/download`;
        } else {
          toast.error('Unable to download resource');
          return;
        }
      }

      // Get auth token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || localStorage.getItem('token') : null;
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      if (token) {
        // For authenticated downloads, we need to fetch and create a blob
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to download resource');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        link.href = url;
        link.download = resource.name || resource.fileName || 'resource';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Fallback to direct link (may not work if auth is required)
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to download resource');
    }
  };

  const handleDelete = async (resourceId: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) {
      return;
    }

    try {
      await deletePersonalResource({ resourceId }).unwrap();
      toast.success('Resource deleted successfully');
    } catch (error: any) {
      toast.error(error?.data?.message || error?.message || 'Failed to delete resource');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'PDF':
        return '📄';
      case 'IMAGE':
        return '🖼️';
      case 'DOCX':
        return '📝';
      case 'XLSX':
        return '📊';
      case 'PPTX':
        return '📽️';
      default:
        return '📎';
    }
  };

  return (
    <ProtectedRoute roles={['STUDENT']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                Resources
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                Access class resources and manage your personal study materials
              </p>
            </div>
        </motion.div>

        {/* Resources List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                Resources
              </CardTitle>
              {activeTab === 'personal' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowUploadModal(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Resource
                </Button>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                variant={activeTab === 'class' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('class')}
              >
                Class Resources ({classResources.length})
              </Button>
              <Button
                variant={activeTab === 'personal' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('personal')}
              >
                Personal Resources ({personalResources.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingClassResources || isLoadingPersonalResources ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted animate-spin" />
              </div>
            ) : activeTab === 'class' ? (
              classResources.length > 0 ? (
                <div className="space-y-3">
                  {classResources.map((resource: any) => (
                    <motion.div
                      key={resource.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-light-border dark:border-dark-border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="text-2xl flex-shrink-0">
                            {getFileIcon(resource.fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                              {resource.title || resource.name}
                            </h3>
                            {resource.description && (
                              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate mt-1">
                                {resource.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-light-text-muted dark:text-dark-text-muted">
                              <span>{resource.fileType}</span>
                              <span>•</span>
                              <span>{formatFileSize(resource.fileSize || 0)}</span>
                              <span>•</span>
                              <span>{new Date(resource.createdAt).toLocaleDateString()}</span>
                              {resource.uploadedByName && (
                                <>
                                  <span>•</span>
                                  <span className="text-light-text-secondary dark:text-dark-text-secondary">
                                    By {resource.uploadedByName}
                                  </span>
                                </>
                              )}
                              {resource.class && (
                                <>
                                  <span>•</span>
                                  <span>From: {resource.class.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(resource, false)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">
                    No class resources available
                  </p>
                </div>
              )
            ) : personalResources.length > 0 ? (
              <div className="space-y-3">
                {personalResources.map((resource: any) => (
                  <motion.div
                    key={resource.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-light-border dark:border-dark-border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="text-2xl flex-shrink-0">
                          {getFileIcon(resource.fileType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                            {resource.name}
                          </h3>
                          {resource.description && (
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate mt-1">
                              {resource.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-light-text-muted dark:text-dark-text-muted">
                            <span>{resource.fileType}</span>
                            <span>•</span>
                            <span>{formatFileSize(resource.fileSize || 0)}</span>
                            <span>•</span>
                            <span>{new Date(resource.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(resource, true)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(resource.id)}
                        >
                          <X className="h-4 w-4" />
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
                  No personal resources yet
                </p>
                <Button
                  variant="primary"
                  onClick={() => setShowUploadModal(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Your First Resource
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Modal */}
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
          title="Upload Personal Resource"
          acceptedFileTypes={allowedFileTypes}
          isUploading={isUploadingMutation}
        />
      </div>
    </ProtectedRoute>
  );
}

