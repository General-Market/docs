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
          'flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2',
          'text-sm text-zinc-100 placeholder:text-zinc-500',
          'transition-[border-color,box-shadow] duration-[250ms] ease-out',
          'focus:outline-none focus:border-zinc-600 focus:shadow-[0_0_0_2px_rgba(255,255,255,0.04)]',
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
