'use client'

import { Component, ReactNode } from 'react'
import { posthog } from '@/lib/posthog'
import { EmptyState } from './EmptyState'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

// A reload button that admits its job is small.
function ReloadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] text-zinc-700 underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
    >
      Reload
    </button>
  )
}

/**
 * Default fallback. Quiet. The page failed; we say so and offer a way back.
 */
function ErrorFallback({ onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <EmptyState
          title="Something collapsed."
          description="The page does not know what to say."
          icon={null}
          action={<ReloadButton onClick={onRetry} />}
        />
      </div>
    </div>
  )
}

/**
 * ErrorBoundary — catches descendant errors, shows a calm fallback,
 * and lets the user re-mount the subtree. No alarm-red blocks.
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
