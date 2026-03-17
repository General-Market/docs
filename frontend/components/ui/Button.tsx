'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'buy' | 'sell' | 'pill'
  disableInteractions?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', disableInteractions = false, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-zinc-900 text-white hover:bg-zinc-800 rounded-md',
      outline: 'border-2 border-brand text-brand bg-transparent hover:bg-brand hover:text-white rounded-md',
      ghost: 'text-text-secondary hover:bg-muted hover:text-text-primary bg-transparent rounded-md',
      buy: 'bg-color-up text-white hover:brightness-110 rounded-md',
      sell: 'bg-color-down text-white hover:brightness-110 rounded-md',
      pill: 'rounded-full border-2 border-brand text-brand bg-white hover:bg-brand-light data-[active=true]:bg-brand data-[active=true]:text-white',
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center h-10 px-4',
          'text-sm font-semibold transition-colors press',
          'focus:outline-none focus:ring-1 focus:ring-brand',
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
