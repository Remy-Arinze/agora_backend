'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  showClearButton?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable search input component with search icon and optional clear button
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  containerClassName,
  showClearButton = true,
  size = 'md',
  ...props
}: SearchInputProps) {
  const sizeClasses = {
    sm: 'h-8 text-xs pl-8 pr-3',
    md: 'h-9 text-sm pl-9 pr-4',
    lg: 'h-10 text-base pl-10 pr-4',
  };

  const iconSizeClasses = {
    sm: 'h-3.5 w-3.5 left-2.5',
    md: 'h-4 w-4 left-3',
    lg: 'h-5 w-5 left-3',
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className={cn('relative', containerClassName)}>
      <Search
        className={cn(
          'absolute top-1/2 -translate-y-1/2 text-light-text-muted dark:text-dark-text-muted pointer-events-none',
          iconSizeClasses[size]
        )}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-lg border border-light-border dark:border-dark-border',
          'bg-light-bg-primary dark:bg-dark-bg-primary',
          'text-light-text-primary dark:text-dark-text-primary',
          'placeholder:text-light-text-muted dark:placeholder:text-dark-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
          'transition-colors',
          sizeClasses[size],
          showClearButton && value ? 'pr-8' : '',
          className
        )}
        {...props}
      />
      {showClearButton && value && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'p-1 rounded-full hover:bg-light-bg-secondary dark:hover:bg-dark-bg-secondary',
            'text-light-text-muted dark:text-dark-text-muted hover:text-light-text-primary dark:hover:text-dark-text-primary',
            'transition-colors'
          )}
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

