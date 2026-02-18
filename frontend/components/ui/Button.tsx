'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  /** Disable micro-interactions (for reduced motion) */
  disableInteractions?: boolean
}

/**
 * Button component following Shadcn/ui pattern
 * Dev Arena themed: red accent for default, white borders for outline
 *
 * Story 11-1, AC5: Micro-interactions
 * - Hover: subtle translateY(-1px) lift + border glow
 * - Click: 50ms scale(0.98) press effect
 * - Respects prefers-reduced-motion via CSS
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', disableInteractions = false, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-accent text-white hover:bg-accent/90',
      outline: 'border border-white/20 bg-transparent text-white hover:bg-white/10',
      ghost: 'bg-transparent text-white hover:bg-white/10'
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center h-10 px-4',
          'text-sm font-mono font-medium',
          'focus:outline-none focus:ring-1 focus:ring-accent',
          'disabled:pointer-events-none disabled:opacity-50',
          !disableInteractions && 'btn-interactive',
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
