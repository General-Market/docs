'use client'

import { Component, ReactNode } from 'react'
import Link from 'next/link'
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

const IS_DEV = process.env.NODE_ENV === 'development'

/**
 * Default fallback UI — functional component so it can use hooks. Calm and
 * branded: no raw minified stack trace shoved at the reader (that goes to
 * PostHog + the console), just a plain account of what happened and a way out.
 */
function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const t = useTranslations('common')

  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-6">
      <div className="text-center animate-fade-up max-w-[560px]">
        <h1 className="text-[56px] font-black tracking-tight text-black leading-none">
          {t('errors.something_went_wrong')}
        </h1>
        <p className="text-body text-text-secondary mt-3">
          {t('errors.unexpected_error')}
        </p>

        {IS_DEV && error && (
          <pre className="mt-5 text-left text-xs text-text-muted bg-surface-down rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        )}

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="inline-block px-6 py-3 bg-black text-white text-caption font-bold hover:bg-zinc-800 transition-colors"
          >
            {t('actions.try_again')}
          </button>
          <Link
            href="/sources"
            className="inline-block px-6 py-3 border border-zinc-200 bg-white text-caption font-bold text-black hover:bg-zinc-50 transition-colors"
          >
            Browse markets
          </Link>
          <Link
            href="/"
            className="inline-block px-6 py-3 text-caption font-bold text-text-secondary hover:text-black transition-colors"
          >
            Back to General Market
          </Link>
        </div>
      </div>
    </main>
  )
}

/**
 * Error boundary — catches client render errors anywhere beneath it and shows
 * a clean branded page instead of a white screen or a raw React stack. Wraps
 * the whole app in client-providers, so every page degrades gracefully.
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
