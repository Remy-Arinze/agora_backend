'use client';

import { useState } from 'react';
import { useSubscription, SubscriptionTier } from '@/hooks/useSubscription';

interface PricingTableProps {
  onSelectPlan?: (tier: SubscriptionTier, isYearly: boolean) => void;
  className?: string;
}

/**
 * Displays pricing tiers with comparison
 * For use in subscription upgrade page
 */
export function PricingTable({ onSelectPlan, className = '' }: PricingTableProps) {
  const [isYearly, setIsYearly] = useState(true);
  const { subscription, pricing, canUpgradeTo, upgrade, isUpgrading } = useSubscription();

  const currentTier = subscription?.tier || SubscriptionTier.FREE;

  const plans = [
    {
      tier: SubscriptionTier.FREE,
      name: 'Free',
      description: 'Get started with the basics',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [
        { text: '♾️ Unlimited Students', included: true },
        { text: '♾️ Unlimited Teachers', included: true },
        { text: '10 Admin Users', included: true },
        { text: 'Core Platform', included: true },
        { text: 'Basic Bursary', included: true },
        { text: 'PrepMaster', included: false },
        { text: 'Socrates', included: false },
        { text: 'RollCall', included: false },
      ],
      highlight: false,
      cta: 'Current Plan',
    },
    {
      tier: SubscriptionTier.STARTER,
      name: 'Starter',
      description: 'All AI tools for growing schools',
      monthlyPrice: 15000,
      yearlyPrice: 150000,
      features: [
        { text: '♾️ Unlimited Students', included: true },
        { text: '♾️ Unlimited Teachers', included: true },
        { text: '50 Admin Users', included: true },
        { text: 'Core Platform', included: true },
        { text: 'Full Bursary Pro', included: true },
        { text: 'PrepMaster', included: true },
        { text: 'Socrates', included: true },
        { text: '500 AI Credits/month', included: true },
      ],
      highlight: true,
      cta: 'Upgrade',
    },
    {
      tier: SubscriptionTier.ENTERPRISE,
      name: 'Enterprise',
      description: 'Unlimited everything for large institutions',
      monthlyPrice: null,
      yearlyPrice: null,
      features: [
        { text: '♾️ Unlimited Students', included: true },
        { text: '♾️ Unlimited Teachers', included: true },
        { text: '♾️ Unlimited Admins', included: true },
        { text: 'All Platform Features', included: true },
        { text: 'RollCall + Hardware', included: true },
        { text: '♾️ Unlimited AI Credits', included: true },
        { text: 'Dedicated Support', included: true },
        { text: 'Custom Integrations', included: true },
      ],
      highlight: false,
      cta: 'Contact Sales',
    },
  ];

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (onSelectPlan) {
      onSelectPlan(tier, isYearly);
    } else if (tier === SubscriptionTier.ENTERPRISE) {
      // Open contact form or mailto
      window.location.href = 'mailto:sales@agora.ng?subject=Enterprise%20Inquiry';
    } else if (canUpgradeTo(tier)) {
      const result = await upgrade(tier, isYearly);
      if (result.success && result.url) {
        window.location.href = result.url;
      }
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return 'Custom';
    if (price === 0) return 'Free';
    return `₦${price.toLocaleString()}`;
  };

  return (
    <div className={className}>
      {/* Billing Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setIsYearly(false)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              !isYearly
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isYearly
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Yearly
            <span className="ml-1.5 text-xs text-green-600 dark:text-green-400">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
          const isCurrentPlan = plan.tier === currentTier;
          const canSelect = canUpgradeTo(plan.tier) || plan.tier === SubscriptionTier.ENTERPRISE;

          return (
            <div
              key={plan.tier}
              className={`relative rounded-2xl border p-6 ${
                plan.highlight
                  ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700'
              } ${
                isCurrentPlan
                  ? 'bg-blue-50/50 dark:bg-blue-950/20'
                  : 'bg-white dark:bg-gray-800'
              }`}
            >
              {/* Popular Badge */}
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-blue-500 text-white rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-green-500 text-white rounded-full">
                    Current Plan
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {plan.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="text-center mb-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(price)}
                </span>
                {price !== null && price > 0 && (
                  <span className="text-gray-500 dark:text-gray-400">
                    /{isYearly ? 'year' : 'month'}
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    {feature.included ? (
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={`text-sm ${feature.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSelectPlan(plan.tier)}
                disabled={isCurrentPlan || isUpgrading || (!canSelect && plan.tier !== SubscriptionTier.FREE)}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  isCurrentPlan
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : plan.highlight
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : canSelect
                        ? 'bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                {isUpgrading ? 'Processing...' : isCurrentPlan ? 'Current Plan' : plan.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

