'use client';

import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { ArrowLeft, Users, Copy, Check, UserCog, Trash2 } from 'lucide-react';
import { useSchool } from '@/hooks/useSchools';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function AllAdminsPage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.id as string;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAdminDetailModal, setShowAdminDetailModal] = useState<string | null>(null);
  const [showPrincipalDetailModal, setShowPrincipalDetailModal] = useState(false);

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

  // Get principal (admin with exact "Principal" role - case-insensitive)
  const principal = school?.admins.find((admin) => {
    const roleLower = admin.role?.trim().toLowerCase() || '';
    return roleLower === 'principal'; // Only exact match, not contains
  }) || null;

  // Get other admins (excluding principal - only exact "Principal" role)
  const admins = school?.admins.filter((admin) => {
    const roleLower = admin.role?.trim().toLowerCase() || '';
    return roleLower !== 'principal'; // Only exact match, not contains
  }) || [];

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
            All Administrators - {school.name}
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Complete list of principal and administrators in this school
          </p>
        </motion.div>

        {/* Principal Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
                School Principal
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {principal ? (
              <div
                onClick={() => setShowPrincipalDetailModal(true)}
                className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-surface/80 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                      {principal.firstName} {principal.lastName}
                    </h4>
                    {principal.adminId && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-light-text-muted dark:text-dark-text-muted font-medium">
                          ID:
                        </span>
                        <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                          {principal.adminId}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(principal.adminId!, `principal-${principal.id}`);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-dark-surface rounded transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === `principal-${principal.id}` ? (
                            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                          )}
                        </button>
                      </div>
                    )}
                    {principal.email && (
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        {principal.email}
                      </p>
                    )}
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      {principal.phone}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 rounded-full text-xs font-medium">
                    Principal
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                No principal assigned.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admins List */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                School Administrators ({admins.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? (
              <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                No administrators found. Add administrators from the school detail page.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {admins.map((admin, index) => (
                <motion.div
                  key={admin.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setShowAdminDetailModal(admin.id)}
                  className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface/80 transition-colors cursor-pointer relative group"
                >
                  <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary pr-6">
                    {admin.firstName} {admin.lastName}
                  </h4>
                  {admin.adminId && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-light-text-muted dark:text-dark-text-muted font-medium">
                        ID:
                      </span>
                      <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                        {admin.adminId}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(admin.adminId!, `admin-${admin.id}`);
                        }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-dark-surface rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Copy to clipboard"
                      >
                        {copiedId === `admin-${admin.id}` ? (
                          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  )}
                  {admin.email && (
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                      {admin.email}
                    </p>
                  )}
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {admin.phone}
                  </p>
                  <span className="inline-block mt-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded text-xs font-medium">
                    {admin.role.replace('_', ' ')}
                  </span>
                </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Principal Detail Modal */}
        {principal && (
          <Modal
            isOpen={showPrincipalDetailModal}
            onClose={() => setShowPrincipalDetailModal(false)}
            title="Principal Details"
            size="md"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-dark-border">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary">
                    {principal.firstName} {principal.lastName}
                  </h3>
                  <span className="inline-block mt-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 rounded-full text-xs font-medium">
                    Principal
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {principal.email && (
                  <div>
                    <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Email
                    </p>
                    <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                      {principal.email}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Phone
                  </p>
                  <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                    {principal.phone}
                  </p>
                </div>
                {principal.adminId && (
                  <div>
                    <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Admin ID
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono text-light-text-primary dark:text-dark-text-primary">
                        {principal.adminId}
                      </p>
                      <button
                        onClick={() => copyToClipboard(principal.adminId!, `principal-modal-${principal.id}`)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-surface rounded transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedId === `principal-modal-${principal.id}` ? (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Created
                  </p>
                  <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                    {new Date(principal.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-border">
                <Button variant="ghost" onClick={() => setShowPrincipalDetailModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Admin Detail Modal */}
        <Modal
          isOpen={showAdminDetailModal !== null}
          onClose={() => setShowAdminDetailModal(null)}
          title="Administrator Details"
          size="md"
        >
          {showAdminDetailModal && (() => {
            const admin = admins.find(a => a.id === showAdminDetailModal);
            if (!admin) return null;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-dark-border">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary">
                      {admin.firstName} {admin.lastName}
                    </h3>
                    <span className="inline-block mt-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full text-xs font-medium">
                      {admin.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  {admin.email && (
                    <div>
                      <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                        Email
                      </p>
                      <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                        {admin.email}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Phone
                    </p>
                    <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                      {admin.phone}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Role
                    </p>
                    <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                      {admin.role.replace('_', ' ')}
                    </p>
                  </div>
                  {admin.adminId && (
                    <div>
                      <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                        Admin ID
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono text-light-text-primary dark:text-dark-text-primary">
                          {admin.adminId}
                        </p>
                        <button
                          onClick={() => copyToClipboard(admin.adminId!, `admin-modal-${admin.id}`)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-surface rounded transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === `admin-modal-${admin.id}` ? (
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Created
                    </p>
                    <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-border">
                  <Button variant="ghost" onClick={() => setShowAdminDetailModal(null)}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      </div>
    </ProtectedRoute>
  );
}

