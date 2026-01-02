'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useState, FormEvent } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';

export default function BulkImportPage() {
  const token = useSelector((state: RootState) => state.auth.token);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: {
      totalRows: number;
      successCount: number;
      errorCount: number;
      generatedUids: string[];
      errors: Array<{ row: number; error: string }>;
    };
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || !token) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/onboarding/bulk-import`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Import failed');
      }

      setResult({
        success: true,
        message: data.message || 'Import completed',
        data: data.data,
      });
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Import Students</h1>
          <p className="text-gray-600 mt-2">
            Upload an Excel/CSV file to import students in bulk
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Import File</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Excel/CSV File
                </label>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  Required columns: firstName, lastName, dateOfBirth, class, parentPhone, parentEmail
                </p>
              </div>

              <Button
                type="submit"
                isLoading={isLoading}
                disabled={!file}
                className="w-full"
              >
                Import Students
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card variant={result.success ? 'default' : 'outlined'}>
            <CardHeader>
              <CardTitle
                className={result.success ? 'text-green-700' : 'text-red-700'}
              >
                {result.success ? 'Import Successful' : 'Import Failed'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{result.message}</p>
              {result.data && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Total Rows</p>
                      <p className="text-lg font-semibold">{result.data.totalRows}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Successful</p>
                      <p className="text-lg font-semibold text-green-600">
                        {result.data.successCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Errors</p>
                      <p className="text-lg font-semibold text-red-600">
                        {result.data.errorCount}
                      </p>
                    </div>
                  </div>

                  {result.data.generatedUids.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Generated UIDs ({result.data.generatedUids.length}):
                      </p>
                      <div className="max-h-40 overflow-y-auto bg-gray-50 p-3 rounded">
                        <div className="flex flex-wrap gap-2">
                          {result.data.generatedUids.slice(0, 20).map((uid) => (
                            <span
                              key={uid}
                              className="text-xs font-mono bg-white px-2 py-1 rounded border"
                            >
                              {uid}
                            </span>
                          ))}
                          {result.data.generatedUids.length > 20 && (
                            <span className="text-xs text-gray-500">
                              +{result.data.generatedUids.length - 20} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {result.data.errors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-red-700 mb-2">Errors:</p>
                      <div className="max-h-40 overflow-y-auto bg-red-50 p-3 rounded">
                        <ul className="space-y-1">
                          {result.data.errors.map((error, idx) => (
                            <li key={idx} className="text-sm text-red-700">
                              Row {error.row}: {error.error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}

