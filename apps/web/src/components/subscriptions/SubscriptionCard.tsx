'use client';

import { useSubscription, SubscriptionTier } from '@/hooks/useSubscription';
import { useToolAccess } from '@/hooks/useToolAccess';

interface SubscriptionCardProps {
  className?: string;
}

/**
 * Displays the current subscription status and quick stats
 * For use in school admin dashboard
 */
export function SubscriptionCard({ className = '' }: SubscriptionCardProps) {
  const { subscription, summary, isLoading } = useSubscription();
  const { aiCredits, accessibleTools } = useToolAccess();

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const tier = summary?.tier || SubscriptionTier.FREE;
  const tierColors: Record<SubscriptionTier, { bg: string; text: string; badge: string }> = {
    [SubscriptionTier.FREE]: {
      bg: 'bg-gray-50 dark:bg-gray-900',
      text: 'text-gray-600 dark:text-gray-400',
      badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    },
    [SubscriptionTier.STARTER]: {
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      text: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
    },
    [SubscriptionTier.PROFESSIONAL]: {
      bg: 'bg-purple-50 dark:bg-purple-950/30',
      text: 'text-purple-600 dark:text-purple-400',
      badge: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400',
    },
    [SubscriptionTier.ENTERPRISE]: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
    },
  };

  const colors = tierColors[tier];

  return (
    <div className={`${colors.bg} rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Subscription
        </h3>
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${colors.badge}`}>
          {tier}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* AI Credits */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI Credits</p>
          <p className={`text-lg font-semibold ${colors.text}`}>
            {aiCredits.remaining === -1 ? '♾️' : aiCredits.remaining}
            {aiCredits.total > 0 && aiCredits.total !== -1 && (
              <span className="text-sm font-normal text-gray-400">/{aiCredits.total}</span>
            )}
          </p>
        </div>

        {/* Admin Slots */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Admin Slots</p>
          <p className={`text-lg font-semibold ${colors.text}`}>
            {summary?.limits.maxAdmins === -1 ? '♾️' : summary?.limits.maxAdmins || 2}
          </p>
        </div>
      </div>

      {/* Active Tools */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Active Tools</p>
        <div className="flex flex-wrap gap-2">
          {accessibleTools.length > 0 ? (
            accessibleTools.map((tool) => (
              <span
                key={tool.slug}
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md"
              >
                {tool.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-400">No premium tools active</span>
          )}
        </div>
      </div>

      {/* Upgrade Link */}
      {tier !== SubscriptionTier.ENTERPRISE && (
        <a
          href="/dashboard/school/subscription"
          className={`mt-4 block text-center text-sm font-medium ${colors.text} hover:underline`}
        >
          Upgrade Plan →
        </a>
      )}
    </div>
  );
}

















