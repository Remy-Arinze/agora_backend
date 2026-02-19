'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Zap, AlertCircle, CheckCircle, Info, ArrowRight, ExternalLink } from 'lucide-react';
import { FadeInUp } from '@/components/ui/FadeInUp';

interface ActivityItem {
  type: string;
  description: string;
  timestamp: string;
}

interface ActivityLogProps {
  activities: ActivityItem[];
  onViewAll?: () => void;
}

const getActivityIcon = (type: string) => {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('success') || typeLower.includes('completed') || typeLower.includes('created')) {
    return <CheckCircle className="h-5 w-5 text-green-400" />;
  }
  if (typeLower.includes('alert') || typeLower.includes('warning') || typeLower.includes('failed')) {
    return <AlertCircle className="h-5 w-5 text-orange-400" />;
  }
  if (typeLower.includes('performance') || typeLower.includes('peak') || typeLower.includes('growth')) {
    return <Zap className="h-5 w-5 text-yellow-400" />;
  }
  return <Info className="h-5 w-5 text-blue-400" />;
};

const getActivityColor = (type: string) => {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('success') || typeLower.includes('completed') || typeLower.includes('created')) {
    return 'bg-green-500';
  }
  if (typeLower.includes('alert') || typeLower.includes('warning') || typeLower.includes('failed')) {
    return 'bg-orange-500';
  }
  if (typeLower.includes('performance') || typeLower.includes('peak') || typeLower.includes('growth')) {
    return 'bg-yellow-500';
  }
  return 'bg-blue-500';
};

const formatTimestamp = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return timestamp;
  }
};

export function ActivityLog({ activities, onViewAll }: ActivityLogProps) {
  // Limit to 2 most recent activities for the card view
  const displayActivities = activities.slice(0, 2);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="font-semibold text-light-text-primary dark:text-white" style={{ fontSize: 'var(--text-section-title)' }}>
            Activity Log
          </CardTitle>
          <p className="text-light-text-secondary dark:text-[#9ca3af] mt-1" style={{ fontSize: 'var(--text-body)' }}>
            Recent platform activities and events
          </p>
        </div>
        <button className="text-light-text-secondary dark:text-[#9ca3af] hover:text-light-text-primary dark:hover:text-white transition-colors">
          <ExternalLink className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent>
        {displayActivities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-light-text-secondary dark:text-[#9ca3af]" style={{ fontSize: 'var(--text-body)' }}>
              No recent activity
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayActivities.map((activity, index) => (
              <FadeInUp
                key={index}
                from={{ opacity: 0, x: -10 }}
                to={{ opacity: 1, x: 0 }}
                delay={index * 0.1}
                className="relative flex items-start gap-3 p-3 rounded-lg bg-light-surface dark:bg-[#1a1f2e] hover:bg-light-hover dark:hover:bg-[#1f2937] transition-colors"
              >
                {/* Colored vertical bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${getActivityColor(activity.type)}`} />
                
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5 ml-1">
                  {getActivityIcon(activity.type)}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-medium text-light-text-primary dark:text-white" style={{ fontSize: 'var(--text-body)' }}>
                      {activity.type}
                    </h4>
                    <span className="text-light-text-muted dark:text-[#6b7280] flex-shrink-0" style={{ fontSize: 'var(--text-small)' }}>
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-light-text-secondary dark:text-[#9ca3af] leading-relaxed" style={{ fontSize: 'var(--text-body)' }}>
                    {activity.description}
                  </p>
                </div>
              </FadeInUp>
            ))}
          </div>
        )}

        {activities.length > 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="w-full mt-4 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
            style={{ fontSize: 'var(--text-body)' }}
          >
            View Detailed Analysis
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
