'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface CopyToClipboardProps {
  text: string;
  id: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CopyToClipboard({ text, id, size = 'md', className = '' }: CopyToClipboardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <button
      onClick={copyToClipboard}
      className={`p-1 hover:bg-gray-100 dark:hover:bg-dark-surface rounded transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copiedId === id ? (
        <Check className={`${sizeClasses[size]} text-green-600 dark:text-green-400`} />
      ) : (
        <Copy className={`${sizeClasses[size]} text-gray-600 dark:text-gray-400`} />
      )}
    </button>
  );
}

