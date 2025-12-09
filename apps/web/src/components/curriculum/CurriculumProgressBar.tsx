'use client';

import React from 'react';

interface CurriculumProgressBarProps {
  completed: number;
  total: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function CurriculumProgressBar({ 
  completed, 
  total, 
  showLabel = true,
  size = 'sm' 
}: CurriculumProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
            Progress
          </span>
          <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
            {completed}/{total} weeks
          </span>
        </div>
      )}
      <div className={`w-full ${height} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
        <div
          className={`${height} rounded-full transition-all duration-300 ${
            percentage === 100
              ? 'bg-green-500'
              : percentage >= 50
              ? 'bg-blue-500'
              : 'bg-amber-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {!showLabel && (
        <span className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
          {percentage}%
        </span>
      )}
    </div>
  );
}

