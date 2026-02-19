'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Input component following Shadcn/ui pattern
 * Institutional style: muted background, neutral borders
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-border-medium bg-muted px-3 py-2',
          'text-sm text-text-primary placeholder:text-text-muted',
          'focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
