'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  trend?: number;
}

export function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  trend,
}: StatCardProps) {
  const changeColors = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-dark-text-secondary',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardContent className="" style={{ padding: 'var(--stat-card-padding)' }}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-[#9ca3af] dark:text-[#9ca3af] mb-1" style={{ fontSize: 'var(--text-stat-label)' }}>
                {title}
              </p>
              <p className="font-bold text-white dark:text-white mb-1" style={{ fontSize: 'var(--text-stat-value)' }}>
                {value}
              </p>
              {change && (
                <div className="flex items-center gap-1">
                  {changeType === 'positive' && (
                    <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  )}
                  {changeType === 'negative' && (
                    <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  )}
                  <span className={`text-xs font-medium ${changeColors[changeType]}`} style={{ fontSize: 'var(--text-small)' }}>
                    {change}
                  </span>
                </div>
              )}
            </div>
            {icon && (
              <div className="ml-3 flex-shrink-0" style={{ fontSize: 'var(--stat-icon-size)' }}>
                {icon}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

