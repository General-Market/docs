'use client'

import { Component, ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { posthog } from '@/lib/posthog'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Default fallback UI, functional component so it can use hooks.
 */
function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const t = useTranslations('common')

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-xl border border-color-down bg-surface-down p-6 text-center shadow-card">
        <h2 className="text-xl font-bold text-color-down font-sans mb-2">
          {t('errors.something_went_wrong')}
        </h2>
        <p className="text-text-secondary text-sm mb-4">
          {t('errors.unexpected_error')}
        </p>
        {error && (
          <p className="text-text-muted text-xs mb-4 break-words">
            {error.message}
          </p>
        )}
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-card hover:bg-muted border border-border-medium text-text-primary text-sm rounded-lg transition-colors"
        >
          {t('actions.try_again')}
        </button>
      </div>
    </div>
  )
}

/**
 * Error boundary component to catch and display React errors gracefully
 * Institutional style: white card with red error border
 * Prevents entire app from crashing on component errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    posthog.capture('$exception', {
      $exception_type: error.name,
      $exception_message: error.message,
      $exception_source: 'react_error_boundary',
      $exception_component_stack: errorInfo.componentStack?.slice(0, 1000),
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
    }

    return this.props.children
  }
}
