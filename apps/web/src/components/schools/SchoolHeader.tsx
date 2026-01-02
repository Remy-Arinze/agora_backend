'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CopyToClipboard } from './CopyToClipboard';
import { School } from '@/hooks/useSchools';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

interface SchoolHeaderProps {
  school: School;
  onEdit: () => void;
  onDelete: () => void;
}

export function SchoolHeader({ school, onEdit, onDelete }: SchoolHeaderProps) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/dashboard/super-admin/schools')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Schools
      </Button>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary">
              {school.name}
            </h1>
            {school.schoolId && (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full text-sm font-medium">
                  ID: {school.schoolId}
                </span>
                <CopyToClipboard
                  text={school.schoolId}
                  id={`school-header-${school.id}`}
                  size="sm"
                />
              </div>
            )}
          </div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Detailed information about the school, admin, teachers, and plugins
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit School
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete School
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

