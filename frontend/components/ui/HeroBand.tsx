'use client'

import { cn } from '@/lib/utils/cn'

interface HeroBandProps {
  eyebrow: string
  title: string
  subtitle?: string
  className?: string
  children?: React.ReactNode
}

export function HeroBand({ eyebrow, title, subtitle, className, children }: HeroBandProps) {
  return (
    <div className={cn('hero-band', className)}>
      <div className="hero-band-inner">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-2">
          {eyebrow}
        </div>
        <h2 className="text-[42px] font-black tracking-tight text-black leading-[1.1] mb-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-base text-text-secondary max-w-[600px]">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}
