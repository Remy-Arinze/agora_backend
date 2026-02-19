'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';

/**
 * Handles enter/exit GSAP animation for modal backdrop and panel.
 */
export function useModalAnimation(isOpen: boolean) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const isExitingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      isExitingRef.current = false;
      gsap.killTweensOf([backdropRef.current, panelRef.current].filter(Boolean));
      const backdrop = backdropRef.current;
      const panel = panelRef.current;
      if (backdrop) gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' });
      if (panel) gsap.fromTo(panel, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.22, ease: 'power2.out', clearProps: 'all' });
    } else if (shouldRender && !isExitingRef.current) {
      isExitingRef.current = true;
      const backdrop = backdropRef.current;
      const panel = panelRef.current;
      const complete = () => {
        setShouldRender(false);
        isExitingRef.current = false;
      };
      gsap.killTweensOf([backdrop, panel].filter(Boolean));
      const tl = gsap.timeline({ onComplete: complete });
      if (panel) tl.to(panel, { opacity: 0, scale: 0.95, duration: 0.18, ease: 'power2.in' }, 0);
      if (backdrop) tl.to(backdrop, { opacity: 0, duration: 0.18, ease: 'power2.in' }, 0);
    }
  }, [isOpen, shouldRender]);

  return { shouldRender, backdropRef, panelRef };
}
