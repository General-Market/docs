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
          'transition-[border-color,box-shadow] duration-[250ms] ease-out',
          'focus:outline-none focus:border-black focus:shadow-[0_0_0_2px_rgba(0,0,0,0.06)]',
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
