'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Input component following Shadcn/ui pattern
 * Dev Arena themed: black background, white/red borders
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-none border border-white/20 bg-terminal px-3 py-2',
          'text-sm text-white font-mono placeholder:text-white/40',
          'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
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
