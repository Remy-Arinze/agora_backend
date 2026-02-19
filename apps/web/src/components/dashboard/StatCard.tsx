'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { FadeInUp } from '@/components/ui/FadeInUp';

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
    <FadeInUp duration={0.3} className="h-full">
      <Card className="hover:shadow-lg transition-shadow duration-200 h-full">
        <CardContent className="h-full flex flex-col justify-center" style={{ padding: 'var(--stat-card-padding)' }}>
          <div className="flex items-center justify-between gap-3"> {/* Added gap for spacing */}
            <div className="flex-1 min-w-0"> {/* Added min-w-0 for text truncation */}
              <p className="font-medium text-[#9ca3af] dark:text-[#9ca3af] mb-0.5 truncate" style={{ fontSize: 'var(--text-stat-label)' }}>
                {title}
              </p>
              <p className="font-bold text-white dark:text-white leading-tight" style={{ fontSize: 'var(--text-stat-value)' }}>
                {value}
              </p>
              {change && (
                <div className="flex items-center gap-1 mt-0.5">
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
              <div className="flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-[#1a1f2e] p-2 rounded-lg" style={{ width: '40px', height: '40px' }}> {/* Fixed size container for icon */}
                {icon}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </FadeInUp>
  );
}

