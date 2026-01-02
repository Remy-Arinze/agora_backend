'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { School } from '@/hooks/useSchools';
import { Users, UserCog, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface SchoolStatsCardProps {
  school: School;
}

export function SchoolStatsCard({ school }: SchoolStatsCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-light-bg dark:bg-dark-surface rounded-lg">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-light-text-secondary dark:text-dark-text-secondary">Teachers</span>
        </div>
        <span className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
          {school.teachersCount}
        </span>
      </div>
      <div className="flex items-center justify-between p-4 bg-light-bg dark:bg-dark-surface rounded-lg">
        <div className="flex items-center gap-3">
          <UserCog className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="text-light-text-secondary dark:text-dark-text-secondary">Admins</span>
        </div>
        <span className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
          {school.admins.length}
        </span>
      </div>
      <div className="flex items-center justify-between p-4 bg-light-bg dark:bg-dark-surface rounded-lg">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <span className="text-light-text-secondary dark:text-dark-text-secondary">Created</span>
        </div>
        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          {new Date(school.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex items-center justify-between p-4 bg-light-bg dark:bg-dark-surface rounded-lg">
        <span className="text-light-text-secondary dark:text-dark-text-secondary">Status</span>
        <span
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
            school.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {school.isActive ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {school.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  );
}

