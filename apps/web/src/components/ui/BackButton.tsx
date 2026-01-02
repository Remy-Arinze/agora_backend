'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  /** Custom label (default: "Back") */
  label?: string;
  /** Fallback URL if no history exists */
  fallbackUrl?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable back navigation button
 * Uses router.back() to navigate to the previous page
 */
export function BackButton({ 
  label = 'Back', 
  fallbackUrl,
  className = '' 
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    // Check if there's history to go back to
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (fallbackUrl) {
      router.push(fallbackUrl);
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {/* <span>{label}</span> */}
    </button>
  );
}

export default BackButton;

