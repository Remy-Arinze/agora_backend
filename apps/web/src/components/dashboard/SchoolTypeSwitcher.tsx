'use client';

import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { GraduationCap, BookOpen, University, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useSchoolType } from '@/hooks/useSchoolType';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const typeConfig = {
  PRIMARY: {
    label: 'Primary',
    icon: GraduationCap,
    color: 'from-blue-500 to-blue-600',
  },
  SECONDARY: {
    label: 'Secondary',
    icon: BookOpen,
    color: 'from-purple-500 to-purple-600',
  },
  TERTIARY: {
    label: 'Tertiary',
    icon: University,
    color: 'from-emerald-600 to-emerald-700',
  },
} as const;

export function SchoolTypeSwitcher() {
  const { open: sidebarOpen } = useSidebar();
  const { isMixed, availableTypes, currentType, setCurrentType } = useSchoolType();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isExpanded) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setIsExpanded(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isExpanded]);

  // GSAP: animate dropdown open/close
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el || !sidebarOpen) return;

    if (isExpanded) {
      gsap.killTweensOf(el);
      gsap.set(el, { height: 0, opacity: 0, overflow: 'hidden' });
      gsap.to(el, {
        height: 'auto',
        opacity: 1,
        duration: 0.32,
        ease: 'power2.out',
        overflow: 'hidden',
      });
    } else {
      gsap.killTweensOf(el);
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.28,
        ease: 'power2.in',
        overflow: 'hidden',
        onComplete: () => { gsap.set(el, { overflow: 'hidden' }); },
      });
    }
  }, [isExpanded, sidebarOpen]);

  // Don't render if school is not mixed
  if (!isMixed || availableTypes.length <= 1) {
    return null;
  }

  const activeType = currentType ?? availableTypes[0];
  const config = typeConfig[activeType];
  const Icon = config.icon;

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-light-border dark:border-dark-border overflow-hidden bg-light-card dark:bg-dark-surface/50"
    >
      {/* Selected row: gradient bg, icon + label + chevron */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          'relative flex w-full items-center gap-2.5 px-3 py-2 rounded-t-lg text-[10px] font-medium transition-all duration-200 overflow-hidden',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-dark-bg',
          'text-white'
        )}
      >
        <div
          className={cn(
            'absolute inset-0 rounded-t-lg bg-gradient-to-r',
            config.color,
            'shadow-sm z-0'
          )}
        />
        <Icon className="relative z-10 h-4 w-4 flex-shrink-0" />
        {sidebarOpen && (
          <span
            className={cn(
              'relative z-10 flex-1 text-left truncate transition-opacity duration-200',
              sidebarOpen ? 'opacity-100' : 'opacity-0'
            )}
          >
            {config.label}
          </span>
        )}
        {sidebarOpen && (
          <span className="relative z-10 flex-shrink-0 opacity-90">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        )}
      </button>

      {/* Dropdown: GSAP animates height + opacity */}
      {sidebarOpen && (
        <div
          ref={dropdownRef}
          className="overflow-hidden origin-top"
          style={{ height: 0, opacity: 0 }}
        >
          <div className="flex flex-col py-1.5 px-1 border-t border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg">
            {availableTypes.map((type) => {
              const typeCfg = typeConfig[type];
              const TypeIcon = typeCfg.icon;
              const isSelected = currentType === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setCurrentType(type);
                    setIsExpanded(false);
                  }}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                    'focus:outline-none focus:ring-0',
                    'text-light-text-primary dark:text-dark-text-primary',
                    'hover:bg-light-card dark:hover:bg-dark-surface'
                  )}
                >
                  <TypeIcon className="h-3.5 w-3.5 flex-shrink-0 text-light-text-secondary dark:text-dark-text-secondary" />
                  <span className="flex-1 text-left">{typeCfg.label}</span>
                  {isSelected ? (
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" strokeWidth={2.5} />
                  ) : (
                    <span className="w-4 h-4 flex-shrink-0" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
