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
        <div className="text-label font-semibold tracking-[0.08em] uppercase text-zinc-500 mb-2">
          {eyebrow}
        </div>
        <h1 className="text-[42px] font-black tracking-tight text-zinc-100 leading-[1.1] mb-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-base text-zinc-400 max-w-[600px]">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}
