'use client';

import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { CopyToClipboard } from './CopyToClipboard';
import { formatRoleDisplayName } from '@/lib/utils/school-utils';
import { SchoolAdmin, Teacher } from '@/hooks/useSchools';

interface PersonCardProps {
  person: SchoolAdmin | Teacher;
  type: 'admin' | 'teacher' | 'principal';
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  index?: number;
}

export function PersonCard({ person, type, onClick, onDelete, index = 0 }: PersonCardProps) {
  const isTeacher = type === 'teacher';
  const teacher = isTeacher ? (person as Teacher) : null;
  const admin = !isTeacher ? (person as SchoolAdmin) : null;
  const uniqueId = isTeacher ? teacher?.teacherId : admin?.adminId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface/80 transition-colors relative group cursor-pointer"
    >
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-500 z-10"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary pr-6">
        {person.firstName} {person.lastName}
        {isTeacher && teacher?.isTemporary && (
          <span className="ml-2 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 rounded text-xs font-medium">
            Temporary
          </span>
        )}
      </h4>
      {uniqueId && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-light-text-muted dark:text-dark-text-muted font-medium">
            ID:
          </span>
          <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
            {uniqueId}
          </span>
          <div onClick={(e) => e.stopPropagation()}>
            <CopyToClipboard
              text={uniqueId}
              id={`${type}-card-${person.id}`}
              size="sm"
              className="opacity-0 group-hover:opacity-100"
            />
          </div>
        </div>
      )}
      {person.email && (
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
          {person.email}
        </p>
      )}
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
        {person.phone}
      </p>
      {isTeacher && teacher?.subject && (
        <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
          Subject: {teacher.subject}
        </p>
      )}
      {isTeacher && teacher?.employeeId && (
        <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
          Employee ID: {teacher.employeeId}
        </p>
      )}
      {!isTeacher && admin && type !== 'principal' && (
        <span className="inline-block mt-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded text-xs font-medium">
          {formatRoleDisplayName(admin.role)}
        </span>
      )}
      {type === 'principal' && (
        <span className="inline-block mt-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 rounded-full text-xs font-medium">
          Principal
        </span>
      )}
    </motion.div>
  );
}

