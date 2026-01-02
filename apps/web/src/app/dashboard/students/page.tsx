'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { useApi } from '@/hooks/useApi';
import { useState, useEffect } from 'react';

interface Student {
  id: string;
  uid: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  profileLocked: boolean;
}

export default function StudentsPage() {
  const { apiCall } = useApi();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      setError(null);

      const result = await apiCall<{ items: Student[]; total: number }>(
        '/students?page=1&limit=50'
      );

      if (result.success && result.data) {
        setStudents(result.data.items || []);
      } else {
        setError(result.message || 'Failed to fetch students');
      }

      setIsLoading(false);
    };

    fetchStudents();
  }, [apiCall]);

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-600 mt-2">Manage and view all students</p>
        </div>

        {isLoading ? (
          <LoadingSpinner size="lg" className="py-12" />
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Student List</CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No students found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          UID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date of Birth
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                            {student.uid}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.firstName} {student.lastName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(student.dateOfBirth).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                student.profileLocked
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {student.profileLocked ? 'Locked' : 'Unclaimed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}

