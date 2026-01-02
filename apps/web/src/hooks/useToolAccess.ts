'use client';

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';
import { 
  useGetSubscriptionSummaryQuery,
  useCheckToolAccessQuery,
  useUseAiCreditsMutation,
  ToolStatus,
  SubscriptionTier,
} from '@/lib/store/api/subscriptionsApi';

export type ToolSlug = 'prepmaster' | 'socrates' | 'rollcall' | 'bursary';

export interface ToolAccessInfo {
  hasAccess: boolean;
  status: ToolStatus | null;
  isLoading: boolean;
  isTrial: boolean;
  trialDaysRemaining?: number;
  reason?: string;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  isActive: boolean;
  aiCredits: number;
  aiCreditsUsed: number;
  aiCreditsRemaining: number;
  limits: {
    maxStudents: number;
    maxTeachers: number;
    maxAdmins: number;
  };
  isLoading: boolean;
}

export interface UseToolAccessReturn {
  // Check access to a specific tool
  hasAccess: (toolSlug: ToolSlug) => boolean;
  
  // Get detailed access info for a tool
  getToolAccess: (toolSlug: ToolSlug) => ToolAccessInfo;
  
  // Subscription info
  subscription: SubscriptionInfo;
  
  // AI Credits
  aiCredits: {
    total: number;
    used: number;
    remaining: number;
    useCredits: (credits: number, action?: string) => Promise<{ success: boolean; remaining: number }>;
    isUsingCredits: boolean;
  };
  
  // List of tools user has access to
  accessibleTools: { slug: string; name: string; status: ToolStatus }[];
  
  // Loading state
  isLoading: boolean;
}

/**
 * Hook to manage tool access and subscriptions
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { hasAccess, subscription, aiCredits } = useToolAccess();
 * 
 *   if (!hasAccess('socrates')) {
 *     return <UpgradePrompt tool="socrates" />;
 *   }
 * 
 *   return <SocratesFeature />;
 * }
 * ```
 */
export function useToolAccess(): UseToolAccessReturn {
  const user = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = !!user;

  // Fetch subscription summary
  const { 
    data: summaryResponse, 
    isLoading: isSummaryLoading,
  } = useGetSubscriptionSummaryQuery(undefined, {
    skip: !isAuthenticated,
  });

  const summary = summaryResponse?.data;

  // AI Credits mutation
  const [useAiCredits, { isLoading: isUsingCredits }] = useUseAiCreditsMutation();

  // Memoized subscription info
  const subscription = useMemo<SubscriptionInfo>(() => {
    if (!summary) {
      return {
        tier: SubscriptionTier.FREE,
        isActive: false,
        aiCredits: 0,
        aiCreditsUsed: 0,
        aiCreditsRemaining: 0,
        limits: {
          maxStudents: -1,  // Unlimited
          maxTeachers: -1,  // Unlimited
          maxAdmins: 10,
        },
        isLoading: isSummaryLoading,
      };
    }

    return {
      tier: summary.tier,
      isActive: summary.isActive,
      aiCredits: summary.aiCredits,
      aiCreditsUsed: summary.aiCreditsUsed,
      aiCreditsRemaining: summary.aiCreditsRemaining,
      limits: summary.limits,
      isLoading: false,
    };
  }, [summary, isSummaryLoading]);

  // Memoized accessible tools list
  const accessibleTools = useMemo(() => {
    if (!summary) return [];
    
    return summary.tools.filter(t => t.hasAccess);
  }, [summary]);

  // Check if user has access to a tool
  const hasAccess = (toolSlug: ToolSlug): boolean => {
    if (!summary) return false;
    
    const tool = summary.tools.find(t => t.slug === toolSlug);
    return tool?.hasAccess ?? false;
  };

  // Get detailed tool access info
  const getToolAccess = (toolSlug: ToolSlug): ToolAccessInfo => {
    if (!summary) {
      return {
        hasAccess: false,
        status: null,
        isLoading: isSummaryLoading,
        isTrial: false,
      };
    }

    const tool = summary.tools.find(t => t.slug === toolSlug);
    
    if (!tool) {
      return {
        hasAccess: false,
        status: null,
        isLoading: false,
        isTrial: false,
        reason: 'tool_not_found',
      };
    }

    return {
      hasAccess: tool.hasAccess,
      status: tool.status,
      isLoading: false,
      isTrial: tool.status === ToolStatus.TRIAL,
    };
  };

  // Use AI credits
  const handleUseCredits = async (credits: number, action?: string): Promise<{ success: boolean; remaining: number }> => {
    try {
      const result = await useAiCredits({ credits, action }).unwrap();
      return {
        success: result.data.success,
        remaining: result.data.creditsRemaining,
      };
    } catch (error) {
      return {
        success: false,
        remaining: subscription.aiCreditsRemaining,
      };
    }
  };

  return {
    hasAccess,
    getToolAccess,
    subscription,
    aiCredits: {
      total: subscription.aiCredits,
      used: subscription.aiCreditsUsed,
      remaining: subscription.aiCreditsRemaining,
      useCredits: handleUseCredits,
      isUsingCredits,
    },
    accessibleTools,
    isLoading: isSummaryLoading,
  };
}

/**
 * Hook to check access to a single tool
 * More efficient when you only need to check one tool
 * 
 * @example
 * ```tsx
 * function SocratesPage() {
 *   const { hasAccess, isLoading, isTrial } = useSingleToolAccess('socrates');
 * 
 *   if (isLoading) return <Loading />;
 *   if (!hasAccess) return <UpgradePrompt />;
 *   
 *   return <SocratesContent />;
 * }
 * ```
 */
export function useSingleToolAccess(toolSlug: ToolSlug) {
  const user = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = !!user;

  const { 
    data: response, 
    isLoading, 
    isFetching,
  } = useCheckToolAccessQuery(toolSlug, {
    skip: !isAuthenticated,
  });

  const accessInfo = response?.data;

  return {
    hasAccess: accessInfo?.hasAccess ?? false,
    status: accessInfo?.status ?? null,
    tool: accessInfo?.tool ?? null,
    isLoading: isLoading || isFetching,
    isTrial: accessInfo?.status === ToolStatus.TRIAL,
    trialDaysRemaining: accessInfo?.trialDaysRemaining,
    reason: accessInfo?.reason,
  };
}

export { ToolStatus, SubscriptionTier };

