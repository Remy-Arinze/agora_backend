'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent' | 'white';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  bgColor?: string; // Optional custom background color (hex or tailwind class)
  textColor?: string; // Optional custom text color
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'sm',
      isLoading = false,
      disabled,
      children,
      bgColor,
      textColor,
      style,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95';

    const variants = {
      primary:
        '!bg-agora-blue !opacity-100 text-white hover:bg-blue-600 focus:ring-agora-blue',
      accent:
        '!bg-agora-accent !opacity-100 text-white hover:bg-orange-600 focus:ring-agora-accent',
      white:
        '!bg-white !opacity-100 text-agora-text hover:bg-gray-100 focus:ring-white',
      secondary:
        'bg-gray-200 dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary hover:bg-gray-300 dark:hover:bg-dark-border focus:ring-gray-500',
      outline:
        'border border-gray-300 dark:border-dark-border bg-transparent text-gray-700 dark:text-dark-text-primary hover:bg-gray-50 dark:hover:bg-dark-surface focus:ring-gray-500',
      ghost: 'bg-transparent text-gray-700 dark:text-dark-text-primary hover:bg-gray-100 dark:hover:bg-dark-surface focus:ring-gray-500',
      danger:
        'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 focus:ring-red-500',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    // Custom styles for bgColor/textColor if provided
    const customStyles = {
      ...(bgColor && (bgColor.startsWith('#') || bgColor.startsWith('rgb')) ? { backgroundColor: bgColor } : {}),
      ...(textColor && (textColor.startsWith('#') || textColor.startsWith('rgb')) ? { color: textColor } : {}),
      ...style,
    };

    // If bgColor/textColor are Tailwind classes, we add them to className
    const tailwindBg = bgColor && !bgColor.startsWith('#') && !bgColor.startsWith('rgb') ? bgColor : '';
    const tailwindText = textColor && !textColor.startsWith('#') && !textColor.startsWith('rgb') ? textColor : '';

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          !bgColor && variants[variant],
          sizes[size],
          tailwindBg,
          tailwindText,
          className
        )}
        style={customStyles}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

