'use client';

import { useState } from 'react';
import Image from 'next/image';

interface EntityAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'rounded' | 'square';
}

const sizeClasses = {
  xs: 'h-8 w-8 text-xs',
  sm: 'h-10 w-10 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-2xl',
};

const imageSizes = {
  xs: 32,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 96,
};

// Generate consistent colors based on the name
function getAvatarColor(name: string): string {
  const colors = [
    'from-purple-500 to-indigo-600',
    'from-blue-500 to-cyan-600',
    'from-teal-500 to-emerald-600',
    'from-green-500 to-lime-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-fuchsia-500 to-purple-600',
    'from-sky-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-red-500 to-rose-600',
  ];
  
  // Simple hash of the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Get initials from a name (max 2 characters)
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function EntityAvatar({
  name,
  imageUrl,
  size = 'md',
  className = '',
  variant = 'rounded',
}: EntityAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);
  const sizeClass = sizeClasses[size];
  const imageSize = imageSizes[size];
  const radiusClass = variant === 'rounded' ? 'rounded-full' : 'rounded-lg';

  const showImage = imageUrl && !imageError;

  return (
    <div
      className={`
        ${sizeClass}
        ${radiusClass}
        flex items-center justify-center
        overflow-hidden
        flex-shrink-0
        ${showImage ? '' : `bg-gradient-to-br ${colorClass}`}
        ${className}
      `}
    >
      {showImage ? (
        <Image
          src={imageUrl}
          alt={name}
          width={imageSize}
          height={imageSize}
          className={`w-full h-full object-cover ${radiusClass}`}
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="font-bold text-white">{initials}</span>
      )}
    </div>
  );
}

