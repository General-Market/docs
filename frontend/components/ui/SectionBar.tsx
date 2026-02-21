'use client'

import { cn } from '@/lib/utils/cn'

interface SectionBarProps {
  title: string
  value?: string
  right?: React.ReactNode
  className?: string
}

export function SectionBar({ title, value, right, className }: SectionBarProps) {
  return (
    <div className={cn('section-bar', className)}>
      <div>
        <div className="section-bar-title">{title}</div>
        {value && <div className="section-bar-value">{value}</div>}
      </div>
      {right && <div className="section-bar-right">{right}</div>}
    </div>
  )
}
