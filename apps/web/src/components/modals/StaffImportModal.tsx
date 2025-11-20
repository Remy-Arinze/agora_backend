'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Upload, FileText, X, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react';
import { useBulkImportStaffMutation } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';

interface StaffImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  generatedPublicIds: string[];
  errors: Array<{ row: number; error: string }>;
}

export function StaffImportModal({ isOpen, onClose, schoolId }: StaffImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [showGuidance, setShowGuidance] = useState(true);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [bulkImportStaff, { isLoading }] = useBulkImportStaffMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
        toast.error('Invalid file type. Please upload a CSV or Excel file.');
        return;
      }
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file to import');
      return;
    }

    try {
      const result = await bulkImportStaff({ schoolId, file }).unwrap();
      if (result.data) {
        setImportResult(result.data);
        if (result.data.errorCount === 0) {
          toast.success(`Successfully imported ${result.data.successCount} staff members`);
        } else {
          toast.warning(`Imported ${result.data.successCount} staff members with ${result.data.errorCount} errors`);
        }
      }
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to import staff. Please check your file format.');
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    setShowGuidance(true);
    onClose();
  };

  const downloadTemplate = () => {
    const csvContent = `type,firstName,lastName,email,phone,role,subject,employeeId,isTemporary
teacher,John,Doe,john.doe@school.com,+2348012345678,,Mathematics,EMP001,false
teacher,Jane,Smith,jane.smith@school.com,+2348012345679,,English,EMP002,false
admin,Mary,Johnson,mary.j@school.com,+2348012345680,Bursar,,,
admin,Peter,Williams,peter.w@school.com,+2348012345681,Administrator,,,`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Staff from CSV/Excel"
      size="xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
          Upload a CSV or Excel file to import multiple staff members (teachers and admins) at once.
        </p>

        {showGuidance && !importResult && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">CSV/Excel File Structure</h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                    Your file must include the following columns:
                  </p>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong className="text-blue-900 dark:text-blue-100">Required columns (all staff):</strong>
                      <ul className="list-disc list-inside ml-2 text-blue-800 dark:text-blue-200">
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">type</code> - Must be "teacher" or "admin"</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">firstName</code> - First name</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">lastName</code> - Last name</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">email</code> - Email address</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">phone</code> - Phone number</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="text-blue-900 dark:text-blue-100">For teachers (optional):</strong>
                      <ul className="list-disc list-inside ml-2 text-blue-800 dark:text-blue-200">
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">subject</code> - Subject name (must match an existing subject in your school, e.g., "Mathematics")</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">employeeId</code> - Employee ID</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">isTemporary</code> - "true" or "false"</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="text-blue-900 dark:text-blue-100">For admins (required):</strong>
                      <ul className="list-disc list-inside ml-2 text-blue-800 dark:text-blue-200">
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">role</code> - Admin role (e.g., "Bursar", "Vice Principal")</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Important Notes</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-200">
                    <li>Email and phone must be unique within your school</li>
                    <li>If a principal already exists, you cannot add another one</li>
                    <li>Teaching roles (e.g., "Teacher", "Instructor") cannot be used for admin type</li>
                    <li><strong>For subject assignment:</strong> Generate subjects first, then use the exact subject name (e.g., "Mathematics", "English Language")</li>
                    <li>Each row will be processed individually - errors in one row won't stop others</li>
                    <li>Password reset emails will be sent automatically to imported staff</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download Template CSV
              </Button>
              <Button onClick={() => setShowGuidance(false)}>Continue</Button>
            </div>
          </div>
        )}

        {!showGuidance && !importResult && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-light-border dark:border-dark-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="staff-file-input"
              />
              <label
                htmlFor="staff-file-input"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-10 w-10 text-light-text-muted dark:text-dark-text-muted" />
                <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                  {file ? file.name : 'Click to select CSV or Excel file'}
                </span>
                {file && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="mt-2"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowGuidance(true)}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || isLoading}
                isLoading={isLoading}
              >
                Import Staff
              </Button>
            </div>
          </div>
        )}

        {importResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-light-bg dark:bg-dark-surface rounded-lg">
              <div>
                <h3 className="font-semibold text-lg mb-1">Import Results</h3>
                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                  Processed {importResult.totalRows} rows
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-bold text-lg">{importResult.successCount}</span>
                  </div>
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted">Success</p>
                </div>
                {importResult.errorCount > 0 && (
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <XCircle className="h-5 w-5" />
                      <span className="font-bold text-lg">{importResult.errorCount}</span>
                    </div>
                    <p className="text-xs text-light-text-muted dark:text-dark-text-muted">Errors</p>
                  </div>
                )}
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 max-h-60 overflow-y-auto">
                <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">Errors:</h4>
                <div className="space-y-1">
                  {importResult.errors.map((error, idx) => (
                    <div key={idx} className="text-sm text-red-600 dark:text-red-400">
                      <strong>Row {error.row}:</strong> {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

