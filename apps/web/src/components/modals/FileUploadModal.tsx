'use client';

import { useState, useRef, useCallback } from 'react';
import { useModalAnimation } from '@/lib/gsap';
import { X, Upload, FileText, File, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, description?: string) => Promise<void>;
  title?: string;
  acceptedFileTypes?: string[];
  maxFileSizeMB?: number;
  allowDescription?: boolean;
  isUploading?: boolean;
}

const defaultAcceptedTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const fileTypeLabels: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
};

export function FileUploadModal({
  isOpen,
  onClose,
  onUpload,
  title = 'Upload Resource',
  acceptedFileTypes = defaultAcceptedTypes,
  maxFileSizeMB = 50,
  allowDescription = true,
  isUploading = false,
}: FileUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileTypeLabel = (mimeType: string) => {
    return fileTypeLabels[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'FILE';
  };

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxFileSizeMB}MB limit`;
    }

    // Check file type
    if (!acceptedFileTypes.includes(file.type)) {
      const acceptedLabels = acceptedFileTypes
        .map(type => fileTypeLabels[type] || type.split('/')[1])
        .filter(Boolean)
        .join(', ');
      return `File type not allowed. Accepted types: ${acceptedLabels}`;
    }

    return null;
  }, [acceptedFileTypes, maxFileSizeMB]);

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      setErrorMessage(error);
      setSelectedFile(null);
      return;
    }
    setErrorMessage('');
    setSelectedFile(file);
    setUploadStatus('idle');
  }, [validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    // Simulate progress while uploading
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      await onUpload(selectedFile, description || undefined);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('success');
      
      // Auto close after success
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error: any) {
      clearInterval(progressInterval);
      setUploadStatus('error');
      setErrorMessage(error?.data?.message || error?.message || 'Failed to upload file');
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setDescription('');
    setUploadProgress(0);
    setUploadStatus('idle');
    setErrorMessage('');
    setIsDragOver(false);
    onClose();
  };

  const getAcceptString = () => {
    return acceptedFileTypes.map(type => {
      if (type.startsWith('image/')) return type;
      if (type === 'application/pdf') return '.pdf';
      if (type.includes('word')) return '.doc,.docx';
      if (type.includes('excel') || type.includes('spreadsheet')) return '.xls,.xlsx';
      if (type.includes('powerpoint') || type.includes('presentation')) return '.ppt,.pptx';
      if (type === 'text/plain') return '.txt';
      if (type === 'text/csv') return '.csv';
      return type;
    }).join(',');
  };

  const { shouldRender, backdropRef, panelRef } = useModalAnimation(isOpen);
  if (!shouldRender) return null;

  return (
    <div ref={backdropRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ opacity: 0 }}>
      <div ref={panelRef} className="bg-light-card dark:bg-dark-surface rounded-xl shadow-2xl max-w-lg w-full overflow-hidden" style={{ opacity: 0 }}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-light-border dark:border-dark-border flex items-center justify-between">
            <h2 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary">
              {title}
            </h2>
            <button
              onClick={handleClose}
              disabled={uploadStatus === 'uploading'}
              className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-[var(--dark-hover)] transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !selectedFile && fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                ${isDragOver 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : selectedFile 
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)]'
                }
                ${uploadStatus === 'uploading' ? 'pointer-events-none' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={getAcceptString()}
                onChange={handleInputChange}
                className="hidden"
              />

              {!selectedFile ? (
                <div className="space-y-3">
                  <div className={`
                    mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-colors
                    ${isDragOver ? 'bg-blue-100 dark:bg-blue-800/30' : 'bg-gray-100 dark:bg-gray-800'}
                  `}>
                    <Upload className={`h-8 w-8 ${isDragOver ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-light-text-primary dark:text-dark-text-primary">
                      {isDragOver ? 'Drop your file here' : 'Drag and drop your file here'}
                    </p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                      or <span className="text-blue-600 dark:text-blue-400 font-medium">browse</span> to upload
                    </p>
                  </div>
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                    Max file size: {maxFileSizeMB}MB
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* File Preview */}
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-light-text-primary dark:text-dark-text-primary truncate max-w-[200px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {getFileTypeLabel(selectedFile.type)} • {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>

                  {/* Upload Progress */}
                  {uploadStatus === 'uploading' && (
                    <div className="space-y-2">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-[width] duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        Uploading... {uploadProgress}%
                      </p>
                    </div>
                  )}

                  {/* Success State */}
                  {uploadStatus === 'success' && (
                    <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Upload successful!</span>
                    </div>
                  )}

                  {/* Change File Button */}
                  {uploadStatus === 'idle' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        fileInputRef.current?.click();
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Choose a different file
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{errorMessage}</p>
              </div>
            )}

            {/* Description Field */}
            {allowDescription && selectedFile && uploadStatus === 'idle' && (
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Add a description for this resource..."
                  className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-light-text-primary dark:text-dark-text-primary placeholder-light-text-muted dark:placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-light-border dark:border-dark-border flex justify-end gap-3 bg-gray-50 dark:bg-dark-bg">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={uploadStatus === 'uploading'}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!selectedFile || uploadStatus === 'uploading' || uploadStatus === 'success'}
            >
              {uploadStatus === 'uploading' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : uploadStatus === 'success' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Done
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
      </div>
    </div>
  );
}

