'use client';

import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { motion } from 'framer-motion';
import { ArrowLeft, GraduationCap, Copy, Check } from 'lucide-react';
import { useSchool } from '@/hooks/useSchools';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function AllTeachersPage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.id as string;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { school, isLoading, error } = useSchool(schoolId);

  // Copy to clipboard function
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Get teachers
  const teachers = school?.teachers || [];

  if (isLoading) {
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !school) {
    const errorMessage = error && 'status' in error 
      ? (error as any).data?.message || 'Failed to fetch school data'
      : 'Failed to load school data';
    
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/super-admin/schools/${schoolId}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to School Details
          </Button>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="w-full">
        {/* Header with Back Button */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/super-admin/schools/${schoolId}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to School Details
          </Button>
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            All Teachers - {school.name}
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Complete list of all teachers in this school
          </p>
        </motion.div>

        {/* Teachers List */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                Teachers ({teachers.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {teachers.length === 0 ? (
              <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                No teachers found. Add teachers from the school detail page.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teachers.map((teacher, index) => (
                <motion.div
                  key={teacher.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface/80 transition-colors"
                >
                  <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                    {teacher.firstName} {teacher.lastName}
                    {teacher.isTemporary && (
                      <span className="ml-2 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 rounded text-xs font-medium">
                        Temporary
                      </span>
                    )}
                  </h4>
                  {teacher.teacherId && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-light-text-muted dark:text-dark-text-muted font-medium">
                        ID:
                      </span>
                      <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                        {teacher.teacherId}
                      </span>
                      <button
                        onClick={() => copyToClipboard(teacher.teacherId!, `teacher-${teacher.id}`)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-dark-surface rounded transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedId === `teacher-${teacher.id}` ? (
                          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  )}
                  {teacher.email && (
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                      {teacher.email}
                    </p>
                  )}
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {teacher.phone}
                  </p>
                  {teacher.subject && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">
                        {teacher.subject}
                      </span>
                    </div>
                  )}
                </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

