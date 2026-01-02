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
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary mb-1">
                {title}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary">
                {value}
              </p>
              {change && (
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${changeColors[changeType]}`}>
                    {change}
                  </span>
                  {trend !== undefined && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-dark-text-muted">
                      vs last month
                    </span>
                  )}
                </div>
              )}
            </div>
            {icon && (
              <div className="ml-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                {icon}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

