'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { ArrowRight, Clock, CheckCircle, XCircle, Ban, School, Copy, Calendar, FileText, AlertCircle } from 'lucide-react';
import { useGetMyStudentTransfersQuery } from '@/lib/store/api/schoolAdminApi';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'APPROVED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'REJECTED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'PENDING':
      return <Clock className="h-4 w-4" />;
    case 'APPROVED':
      return <CheckCircle className="h-4 w-4" />;
    case 'REJECTED':
      return <XCircle className="h-4 w-4" />;
    case 'CANCELLED':
      return <Ban className="h-4 w-4" />;
    case 'COMPLETED':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
};

export default function StudentTransfersPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Fetch transfers
  const { data: transfersResponse, isLoading } = useGetMyStudentTransfersQuery(
    { status: statusFilter },
    { skip: false }
  );
  const transfers = transfersResponse?.data || [];

  // Group transfers by status for stats
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: transfers.length,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0,
      COMPLETED: 0,
    };

    transfers.forEach((transfer: any) => {
      if (counts[transfer.status] !== undefined) {
        counts[transfer.status]++;
      }
    });

    return counts;
  }, [transfers]);

  if (isLoading) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <div className="text-light-text-secondary dark:text-dark-text-secondary">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

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
              Transfer History
            </h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              View your transfer requests and history across all schools
            </p>
          </div>
        </motion.div>

        {/* Status Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3 flex-wrap">
              <Button
                variant={statusFilter === undefined ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(undefined)}
              >
                All ({statusCounts.ALL})
              </Button>
              <Button
                variant={statusFilter === 'PENDING' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('PENDING')}
              >
                Pending ({statusCounts.PENDING})
              </Button>
              <Button
                variant={statusFilter === 'APPROVED' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('APPROVED')}
              >
                Approved ({statusCounts.APPROVED})
              </Button>
              <Button
                variant={statusFilter === 'REJECTED' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('REJECTED')}
              >
                Rejected ({statusCounts.REJECTED})
              </Button>
              <Button
                variant={statusFilter === 'CANCELLED' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('CANCELLED')}
              >
                Cancelled ({statusCounts.CANCELLED})
              </Button>
              <Button
                variant={statusFilter === 'COMPLETED' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('COMPLETED')}
              >
                Completed ({statusCounts.COMPLETED})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transfers List */}
        {transfers.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-light-text-secondary dark:text-dark-text-secondary">
              <School className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transfers found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {transfers.map((transfer: any, index: number) => {
              const isTacExpired = transfer.tacExpiresAt
                ? new Date(transfer.tacExpiresAt) < new Date()
                : false;
              const isTacUsed = !!transfer.tacUsedAt;

              return (
                <motion.div
                  key={transfer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                transfer.status
                              )}`}
                            >
                              {getStatusIcon(transfer.status)}
                              {transfer.status}
                            </span>
                            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              Requested: {format(new Date(transfer.createdAt), 'MMM dd, yyyy')}
                            </div>
                          </div>

                          {/* School Transfer Path */}
                          <div className="flex items-center gap-4 mb-4">
                            <div className="flex items-center gap-2">
                              <School className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              <div>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                  From
                                </p>
                                <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                  {transfer.fromSchool?.name || 'Unknown School'}
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
                            <div className="flex items-center gap-2">
                              <School className="h-5 w-5 text-green-600 dark:text-green-400" />
                              <div>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                  To
                                </p>
                                <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                  {transfer.toSchool?.name || 'Pending Selection'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* TAC Section */}
                          {transfer.tac && (
                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                                    Transfer Access Code (TAC)
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <code className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">
                                      {transfer.tac}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(transfer.tac)}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {transfer.tacExpiresAt && (
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                      {isTacExpired
                                        ? 'Expired'
                                        : isTacUsed
                                        ? 'Used'
                                        : `Expires: ${format(new Date(transfer.tacExpiresAt), 'MMM dd, yyyy')}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Dates */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {transfer.approvedAt && (
                              <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                  Approved
                                </p>
                                <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                  {format(new Date(transfer.approvedAt), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            )}
                            {transfer.rejectedAt && (
                              <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                  Rejected
                                </p>
                                <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                  {format(new Date(transfer.rejectedAt), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            )}
                            {transfer.completedAt && (
                              <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                  Completed
                                </p>
                                <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                  {format(new Date(transfer.completedAt), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            )}
                            {transfer.tacUsedAt && (
                              <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                  TAC Used
                                </p>
                                <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                  {format(new Date(transfer.tacUsedAt), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Reason and Notes */}
                          {(transfer.reason || transfer.notes) && (
                            <div className="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
                              {transfer.reason && (
                                <div className="mb-2">
                                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                    Reason
                                  </p>
                                  <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                    {transfer.reason}
                                  </p>
                                </div>
                              )}
                              {transfer.notes && (
                                <div>
                                  <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                    Notes
                                  </p>
                                  <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                                    {transfer.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

