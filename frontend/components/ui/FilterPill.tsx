'use client'

import { cn } from '@/lib/utils/cn'

interface FilterPillProps {
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export function FilterPill({ label, active = false, onClick, className }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'filter-pill',
        active && 'active',
        className
      )}
    >
      {label}
    </button>
  )
}
