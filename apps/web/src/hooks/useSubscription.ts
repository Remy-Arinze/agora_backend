'use client';

import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';
import { 
  useGetMySubscriptionQuery,
  useGetSubscriptionSummaryQuery,
  SubscriptionTier,
  SubscriptionDto,
  SubscriptionSummaryDto,
} from '@/lib/store/api/subscriptionsApi';
import {
  useGetPricingQuery,
  useInitializePaymentMutation,
  PricingResponse,
} from '@/lib/store/api/paymentsApi';

export interface SubscriptionManagement {
  // Current subscription
  subscription: SubscriptionDto | null;
  summary: SubscriptionSummaryDto | null;
  isLoading: boolean;
  
  // Pricing
  pricing: PricingResponse | null;
  
  // Upgrade flow
  upgrade: (tier: SubscriptionTier, isYearly: boolean) => Promise<{ success: boolean; url?: string; error?: string }>;
  isUpgrading: boolean;
  
  // Helper functions
  canUpgradeTo: (tier: SubscriptionTier) => boolean;
  getPriceForTier: (tier: SubscriptionTier, isYearly: boolean) => number | null;
  getFeatureComparison: () => FeatureComparison[];
}

export interface FeatureComparison {
  feature: string;
  free: boolean | string;
  starter: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
}

/**
 * Hook for managing subscription and payments
 * 
 * @example
 * ```tsx
 * function UpgradePage() {
 *   const { subscription, pricing, upgrade, isUpgrading } = useSubscription();
 * 
 *   const handleUpgrade = async () => {
 *     const result = await upgrade(SubscriptionTier.PROFESSIONAL, true);
 *     if (result.success && result.url) {
 *       window.location.href = result.url; // Redirect to Paystack
 *     }
 *   };
 * 
 *   return <button onClick={handleUpgrade}>Upgrade to Professional</button>;
 * }
 * ```
 */
export function useSubscription(): SubscriptionManagement {
  const user = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = !!user;

  // Fetch subscription data
  const { data: subscriptionResponse, isLoading: isLoadingSubscription } = useGetMySubscriptionQuery(undefined, {
    skip: !isAuthenticated,
  });

  const { data: summaryResponse, isLoading: isLoadingSummary } = useGetSubscriptionSummaryQuery(undefined, {
    skip: !isAuthenticated,
  });

  // Fetch pricing
  const { data: pricingResponse } = useGetPricingQuery();

  // Payment mutation
  const [initializePayment, { isLoading: isUpgrading }] = useInitializePaymentMutation();

  const subscription = subscriptionResponse?.data || null;
  const summary = summaryResponse?.data || null;
  const pricing = pricingResponse?.data || null;

  /**
   * Check if user can upgrade to a tier
   */
  const canUpgradeTo = useCallback((tier: SubscriptionTier): boolean => {
    if (!subscription) return true;
    
    const tierOrder = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.STARTER]: 1,
      [SubscriptionTier.PROFESSIONAL]: 2,
      [SubscriptionTier.ENTERPRISE]: 3,
    };

    return tierOrder[tier] > tierOrder[subscription.tier];
  }, [subscription]);

  /**
   * Get price for a tier
   */
  const getPriceForTier = useCallback((tier: SubscriptionTier, isYearly: boolean): number | null => {
    if (!pricing) return null;
    const plan = pricing[tier];
    return isYearly ? plan.yearly : plan.monthly;
  }, [pricing]);

  /**
   * Start upgrade flow
   */
  const upgrade = useCallback(async (
    tier: SubscriptionTier, 
    isYearly: boolean
  ): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (tier === SubscriptionTier.FREE) {
      return { success: false, error: 'Cannot upgrade to free tier' };
    }

    if (tier === SubscriptionTier.ENTERPRISE) {
      // Enterprise requires custom handling
      return { success: false, error: 'Please contact sales for Enterprise pricing' };
    }

    try {
      const result = await initializePayment({ tier, isYearly }).unwrap();
      
      if (result.success && result.data?.authorizationUrl) {
        return { success: true, url: result.data.authorizationUrl };
      }

      return { success: false, error: result.message || 'Failed to initialize payment' };
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Failed to start upgrade' };
    }
  }, [initializePayment]);

  /**
   * Get feature comparison table data
   */
  const getFeatureComparison = useCallback((): FeatureComparison[] => {
    return [
      { feature: 'Students', free: '♾️ Unlimited', starter: '♾️ Unlimited', professional: '♾️ Unlimited', enterprise: '♾️ Unlimited' },
      { feature: 'Teachers', free: '♾️ Unlimited', starter: '♾️ Unlimited', professional: '♾️ Unlimited', enterprise: '♾️ Unlimited' },
      { feature: 'Admins', free: '10', starter: '50', professional: '50', enterprise: '♾️ Unlimited' },
      { feature: 'Core Platform', free: true, starter: true, professional: true, enterprise: true },
      { feature: 'PrepMaster', free: false, starter: true, professional: true, enterprise: true },
      { feature: 'Socrates', free: false, starter: true, professional: true, enterprise: true },
      { feature: 'RollCall', free: false, starter: false, professional: false, enterprise: true },
      { feature: 'Bursary Pro', free: 'Basic', starter: 'Full', professional: 'Full', enterprise: 'Full' },
      { feature: 'AI Credits/Month', free: '0', starter: '500', professional: '500', enterprise: '♾️ Unlimited' },
      { feature: 'Support', free: 'Community', starter: 'Email', professional: 'Email', enterprise: 'Dedicated' },
    ];
  }, []);

  return {
    subscription,
    summary,
    isLoading: isLoadingSubscription || isLoadingSummary,
    pricing,
    upgrade,
    isUpgrading,
    canUpgradeTo,
    getPriceForTier,
    getFeatureComparison,
  };
}

export { SubscriptionTier };

