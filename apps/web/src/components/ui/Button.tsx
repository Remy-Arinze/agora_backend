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
      'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:pointer-events-none relative overflow-hidden';

    const variants = {
      primary:
        '!bg-gradient-to-b from-[#2490FD] to-[#1a7ae6] !opacity-100 text-white hover:from-[#2a9fff] hover:to-[#2490FD] focus:ring-agora-blue shadow-[0_4px_0_#0f4a8a] hover:shadow-[0_6px_0_#0f4a8a] active:shadow-[0_2px_0_#0f4a8a] active:translate-y-[2px] border-t border-[#3ba0ff]/50',
      accent:
        '!bg-gradient-to-b from-[#FF532A] to-[#e6451f] !opacity-100 text-white hover:from-[#ff6340] hover:to-[#FF532A] focus:ring-agora-accent shadow-[0_4px_0_#cc4219] hover:shadow-[0_6px_0_#cc4219] active:shadow-[0_2px_0_#cc4219] active:translate-y-[2px] border-t border-[#ff6b4d]/50',
      white:
        '!bg-gradient-to-b from-white to-gray-100 !opacity-100 text-agora-text hover:from-gray-50 hover:to-white focus:ring-white shadow-[0_4px_0_#d1d5db] hover:shadow-[0_6px_0_#d1d5db] active:shadow-[0_2px_0_#d1d5db] active:translate-y-[2px] border-t border-white/80',
      secondary:
        'bg-gradient-to-b from-gray-200 to-gray-300 dark:from-dark-surface dark:to-dark-border text-gray-900 dark:text-dark-text-primary hover:from-gray-300 hover:to-gray-400 dark:hover:from-dark-border dark:hover:to-dark-hover focus:ring-gray-500 shadow-[0_2px_0_#9ca3af] hover:shadow-[0_3px_0_#9ca3af] active:shadow-[0_1px_0_#9ca3af] active:translate-y-[1px]',
      outline:
        'border-2 border-gray-300 dark:border-dark-border bg-transparent text-gray-700 dark:text-dark-text-primary hover:bg-gray-50 dark:hover:bg-dark-surface focus:ring-gray-500 shadow-[0_2px_0_#9ca3af] hover:shadow-[0_3px_0_#9ca3af] active:shadow-[0_1px_0_#9ca3af] active:translate-y-[1px]',
      ghost: 'bg-transparent text-gray-700 dark:text-dark-text-primary hover:bg-gray-100 dark:hover:bg-dark-surface focus:ring-gray-500',
      danger:
        'bg-gradient-to-b from-red-600 to-red-700 dark:from-red-500 dark:to-red-600 text-white hover:from-red-700 hover:to-red-800 dark:hover:from-red-600 dark:hover:to-red-700 focus:ring-red-500 shadow-[0_4px_0_#b91c1c] hover:shadow-[0_6px_0_#b91c1c] active:shadow-[0_2px_0_#b91c1c] active:translate-y-[2px] border-t border-red-400/50',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm leading-tight',
      md: 'px-4 py-2 text-base leading-tight',
      lg: 'px-6 py-3 text-lg leading-tight',
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
          // Add inner highlight for 3D effect on primary, accent, white, and danger variants
          (variant === 'primary' || variant === 'accent' || variant === 'white' || variant === 'danger') && !bgColor && 
          'before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:rounded-lg before:pointer-events-none',
          className
        )}
        style={customStyles}
        disabled={disabled || isLoading}
        {...props}
      >
        <span className="relative z-10 flex items-center justify-center whitespace-nowrap">
          {isLoading ? (
            <>
              <svg
                className="animate-spin mr-2 h-4 w-4 flex-shrink-0"
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
              <span>Loading...</span>
            </>
          ) : (
            children
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

