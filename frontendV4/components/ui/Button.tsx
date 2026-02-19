'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'buy' | 'sell'
  /** Disable micro-interactions (for reduced motion) */
  disableInteractions?: boolean
}

/**
 * Button component following Shadcn/ui pattern
 * Institutional style: zinc-900 default, neutral outline/ghost, semantic buy/sell
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', disableInteractions = false, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-zinc-900 text-white hover:bg-zinc-800',
      outline: 'border border-border-medium text-text-primary bg-transparent hover:bg-muted',
      ghost: 'text-text-secondary hover:bg-muted hover:text-text-primary bg-transparent',
      buy: 'bg-color-up text-white hover:brightness-110',
      sell: 'bg-color-down text-white hover:brightness-110',
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center h-10 px-4',
          'text-sm font-medium rounded-lg transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-zinc-400',
          'disabled:pointer-events-none disabled:opacity-50',
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
