'use client'

import { Component, ReactNode } from 'react'
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
    // Log error for debugging - could integrate with error tracking service
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    posthog.capture('error_boundary_triggered', {
      error_message: error.message,
      component_stack: errorInfo.componentStack?.slice(0, 500),
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

      return (
        <div className="min-h-screen bg-page flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-md border border-border-light bg-card p-8 shadow-card animate-fade-in">
            <div className="font-mono text-micro font-bold tracking-[0.08em] uppercase text-text-muted mb-4">System Fault</div>
            <h2 className="text-lg font-bold text-text-primary mb-2">
              The interface collapsed.
            </h2>
            <p className="text-text-secondary text-sm mb-4">
              All working things are temporary. This one stopped early. Reload the page to try again.
            </p>
            {this.state.error && (
              <p className="text-text-muted text-xs font-mono mb-4 break-words border-l-2 border-border-medium pl-3">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-brand hover:bg-brand-dark text-white text-sm rounded-md transition-colors press"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
