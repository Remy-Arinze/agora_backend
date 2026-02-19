'use client';

import { forwardRef, useRef, useEffect, useImperativeHandle } from 'react';
import gsap from 'gsap';
import { cn } from '@/lib/utils';

export interface FadeInUpProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  duration?: number;
  delay?: number;
  ease?: string;
  staggerIndex?: number;
  staggerDelay?: number;
  when?: boolean;
}

const defaultFrom = { opacity: 0, y: 20 };
const defaultTo = { opacity: 1, y: 0 };

export const FadeInUp = forwardRef<HTMLDivElement, FadeInUpProps>(function FadeInUp(
  {
    className,
    from = defaultFrom,
    to = defaultTo,
    duration = 0.35,
    delay = 0,
    ease = 'power2.out',
    staggerIndex,
    staggerDelay = 0.05,
    when = true,
    children,
    ...props
  },
  forwardedRef
) {
  const internalRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => internalRef.current as HTMLDivElement, []);

  useEffect(() => {
    const el = internalRef.current;
    if (!el || !when) return;
    const totalDelay = delay + (staggerIndex != null ? staggerIndex * staggerDelay : 0);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { ...from, overwrite: 'auto' },
        { ...to, duration, ease, delay: totalDelay, overwrite: 'auto', clearProps: 'all' }
      );
    }, el);
    return () => ctx.revert();
  }, [when]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={internalRef} className={cn(className)} {...props}>
      {children}
    </div>
  );
});
