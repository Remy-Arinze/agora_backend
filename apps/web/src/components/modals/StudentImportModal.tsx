'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Upload, FileText, X, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react';
import { useBulkImportStudentsMutation } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  generatedUids: string[];
  errors: Array<{ row: number; error: string }>;
}

export function StudentImportModal({ isOpen, onClose, schoolId }: StudentImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [showGuidance, setShowGuidance] = useState(true);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [bulkImportStudents, { isLoading }] = useBulkImportStudentsMutation();

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
      const result = await bulkImportStudents({ schoolId, file }).unwrap();
      if (result.data) {
        setImportResult(result.data);
        if (result.data.errorCount === 0) {
          toast.success(`Successfully imported ${result.data.successCount} students`);
        } else {
          toast.warning(`Imported ${result.data.successCount} students with ${result.data.errorCount} errors`);
        }
      }
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to import students. Please check your file format.');
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    setShowGuidance(true);
    onClose();
  };

  const downloadTemplate = () => {
    const csvContent = `firstName,middleName,lastName,dateOfBirth,classLevel,classArm,email,phone,parentName,parentPhone,parentEmail,parentRelationship,bloodGroup,allergies,medications,emergencyContact,emergencyContactPhone,medicalNotes
John,,Doe,2010-05-15,JSS 3,A,john.doe@example.com,+2348012345678,John Doe Sr,+2348012345679,john.sr@example.com,Father,O+,Peanuts,Inhaler,Jane Doe,+2348012345680,Student has asthma
Jane,Mary,Smith,2011-08-20,Primary 1,Gold,jane.smith@example.com,+2348012345681,Mary Smith,+2348012345682,mary@example.com,Mother,A-,,,"`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Students from CSV/Excel"
      size="xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
          Upload a CSV or Excel file to import multiple students at once. Uses the same validation as individual student admission.
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
                      <strong className="text-blue-900 dark:text-blue-100">Required columns:</strong>
                      <ul className="list-disc list-inside ml-2 text-blue-800 dark:text-blue-200">
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">firstName</code> - Student first name</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">lastName</code> - Student last name</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">dateOfBirth</code> - Date of birth (YYYY-MM-DD format)</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">classLevel</code> - Class level (e.g., "JSS 3", "Primary 1", "SS 1")</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">parentName</code> - Parent/Guardian name</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">parentPhone</code> - Parent/Guardian phone number</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="text-blue-900 dark:text-blue-100">Optional columns:</strong>
                      <ul className="list-disc list-inside ml-2 text-blue-800 dark:text-blue-200">
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">classArm</code> - Class arm name (e.g., "A", "Gold", "Blue") - <span className="text-green-600 dark:text-green-400 font-medium">Recommended for schools with multiple arms per class</span></li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">middleName</code> - Student middle name</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">email</code> - Student email (recommended)</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">phone</code> - Student phone number</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">parentEmail</code> - Parent email</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">parentRelationship</code> - Relationship (e.g., Father, Mother, Guardian)</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">bloodGroup</code> - Blood group</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">allergies</code> - Allergies</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">medications</code> - Medications</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">emergencyContact</code> - Emergency contact name</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">emergencyContactPhone</code> - Emergency contact phone</li>
                        <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">medicalNotes</code> - Medical notes</li>
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
                    <li><code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">classLevel</code> must match an existing class level (e.g., "JSS 3", "Primary 1")</li>
                    <li><code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">classArm</code> should match the arm name only (e.g., "A", "Gold") - the system will find the full class</li>
                    <li>If a student email already exists in the Agora system, you'll need to initiate a transfer instead</li>
                    <li>Students will be automatically enrolled in the specified class/arm</li>
                    <li>Password reset emails will be sent to students with email addresses</li>
                    <li>Each row will be processed individually - errors in one row won't stop others</li>
                    <li>Date format must be YYYY-MM-DD (e.g., 2010-05-15)</li>
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
                id="student-file-input"
              />
              <label
                htmlFor="student-file-input"
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
                Import Students
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

