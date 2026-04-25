/**
 * Card component following Shadcn/ui patterns
 * Dark surface that survives on bg-zinc-950.
 */

import { forwardRef } from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** Enable interactive hover effects */
  interactive?: boolean
}

/**
 * Card container component
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', children, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 ${interactive ? 'card-interactive cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
)
Card.displayName = 'Card'

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/**
 * Card header section
 */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col space-y-1.5 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
)
CardHeader.displayName = 'CardHeader'

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
}

/**
 * Card title component
 */
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = '', children, ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-xs uppercase tracking-[0.08em] text-zinc-500 font-medium ${className}`}
      {...props}
    >
      {children}
    </h3>
  )
)
CardTitle.displayName = 'CardTitle'

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/**
 * Card content section
 */
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`p-6 pt-0 text-zinc-400 ${className}`} {...props}>
      {children}
    </div>
  )
)
CardContent.displayName = 'CardContent'

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/**
 * Card footer section
 */
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex items-center p-6 pt-0 text-zinc-400 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
)
CardFooter.displayName = 'CardFooter'
