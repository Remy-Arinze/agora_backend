'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getSchoolTypeDisplayName } from '@/lib/utils/terminology';
import type { SchoolType } from '@/lib/store/api/schoolAdminApi';

export function SchoolTypeSelector() {
  const { availableTypes, isMixed, currentType, setCurrentType } = useSchoolType();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Don't show if no types available or only one type (not mixed)
  if (availableTypes.length === 0 || (!isMixed && availableTypes.length === 1)) {
    if (currentType) {
      return (
        <div className="px-3 py-1.5 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary bg-light-card dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border">
          {getSchoolTypeDisplayName(currentType)}
        </div>
      );
    }
    return null;
  }

  const handleTypeSelect = (type: SchoolType) => {
    setCurrentType(type);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-blue-600 dark:text-dark-text-primary bg-[var(--light-bg)] dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        <span>{currentType ? getSchoolTypeDisplayName(currentType) : 'Select Type'}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-light-card dark:bg-dark-surface rounded-lg shadow-lg border border-light-border dark:border-dark-border z-50">
          <div className="py-1">
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeSelect(type)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  currentType === type
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-light-text-primary dark:text-dark-text-primary hover:bg-gray-100 dark:hover:bg-[var(--dark-hover)]'
                }`}
              >
                {getSchoolTypeDisplayName(type)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

