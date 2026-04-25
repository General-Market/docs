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
      default: 'bg-zinc-100 text-zinc-950 hover:bg-white rounded-md',
      outline: 'border border-zinc-700 text-zinc-100 bg-transparent hover:bg-zinc-800 hover:text-white rounded-md',
      ghost: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 bg-transparent rounded-md',
      buy: 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 rounded-md',
      sell: 'bg-rose-500 text-zinc-950 hover:bg-rose-400 rounded-md',
      pill: 'rounded-full border border-zinc-700 text-zinc-300 bg-transparent hover:bg-zinc-800 data-[active=true]:bg-zinc-100 data-[active=true]:text-zinc-950',
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center h-10 px-4',
          'text-sm font-semibold transition-colors duration-150',
          'fluid-press',
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
