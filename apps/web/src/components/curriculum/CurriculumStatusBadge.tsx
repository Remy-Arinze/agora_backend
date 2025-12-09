'use client';

import React from 'react';
import { CurriculumStatus } from '@/lib/store/api/schoolAdminApi';

interface CurriculumStatusBadgeProps {
  status: CurriculumStatus | null;
  size?: 'sm' | 'md';
}

export function CurriculumStatusBadge({ status, size = 'sm' }: CurriculumStatusBadgeProps) {
  const getStatusConfig = (status: CurriculumStatus | null) => {
    switch (status) {
      case 'DRAFT':
        return {
          label: 'Draft',
          className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        };
      case 'SUBMITTED':
        return {
          label: 'Pending Approval',
          className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        };
      case 'APPROVED':
        return {
          label: 'Approved',
          className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        };
      case 'ACTIVE':
        return {
          label: 'Active',
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
        };
      case 'REJECTED':
        return {
          label: 'Rejected',
          className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        };
      default:
        return {
          label: 'Not Created',
          className: 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${config.className}`}>
      {config.label}
    </span>
  );
}

