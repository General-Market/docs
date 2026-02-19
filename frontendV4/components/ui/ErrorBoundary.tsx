'use client'

import { Component, ReactNode } from 'react'

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
          <div className="max-w-md w-full rounded-xl border border-color-down bg-surface-down p-6 text-center shadow-card">
            <h2 className="text-xl font-bold text-color-down font-sans mb-2">
              Something went wrong
            </h2>
            <p className="text-text-secondary text-sm mb-4">
              An unexpected error occurred. Please try again.
            </p>
            {this.state.error && (
              <p className="text-text-muted text-xs mb-4 break-words">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-card hover:bg-muted border border-border-medium text-text-primary text-sm rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
