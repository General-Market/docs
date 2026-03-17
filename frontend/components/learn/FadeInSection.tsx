'use client';

import { ReactNode } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * Section wrapper for learn articles.
 * Uses scroll-triggered fade-in via useScrollReveal + data-fade-in.
 */
export function FadeInSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={className}>
      <div data-fade-in>{children}</div>
    </div>
  );
}
