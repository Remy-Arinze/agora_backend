'use client';

import { FadeInUp } from '@/components/ui/FadeInUp';
import { CheckCircle2, XCircle, LucideIcon } from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  monetization: string;
  status: 'active' | 'inactive';
  icon: LucideIcon;
}

interface PluginCardProps {
  plugin: Plugin;
  index: number;
}

export function PluginCard({ plugin, index }: PluginCardProps) {
  const Icon = plugin.icon;

  return (
    <FadeInUp
      delay={index * 0.1}
      from={{ opacity: 0, x: -20 }}
      to={{ opacity: 1, x: 0 }}
      className={`p-6 rounded-lg border ${
        plugin.status === 'active'
          ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
          : 'bg-gray-50 dark:bg-dark-surface border-gray-200 dark:border-dark-border'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-lg ${
              plugin.status === 'active'
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            <Icon
              className={`h-6 w-6 ${
                plugin.status === 'active'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
              {plugin.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-dark-text-secondary">{plugin.subtitle}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
            plugin.status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {plugin.status === 'active' ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {plugin.status}
        </span>
      </div>
      <p className="text-gray-700 dark:text-dark-text-secondary mb-4">{plugin.description}</p>
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-text-primary mb-2">
            Features:
          </h4>
          <ul className="space-y-2">
            {plugin.features.map((feature, idx) => (
              <li
                key={idx}
                className="text-sm text-gray-600 dark:text-dark-text-secondary flex items-start gap-2"
              >
                <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="pt-3 border-t border-gray-200 dark:border-dark-border">
          <p className="text-sm">
            <span className="font-semibold text-gray-900 dark:text-dark-text-primary">
              Monetization:
            </span>{' '}
            <span className="text-gray-600 dark:text-dark-text-secondary">
              {plugin.monetization}
            </span>
          </p>
        </div>
      </div>
    </FadeInUp>
  );
}

