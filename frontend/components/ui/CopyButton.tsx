'use client'

import { useState, useCallback } from 'react'

interface CopyButtonProps {
  text: string
  className?: string
  /** Callback after successful copy */
  onCopy?: () => void
  /** Size of the icon */
  size?: number
}

/**
 * Copy to clipboard button with "Copied!" tooltip feedback
 * Dev Arena themed: white/gray icon with hover state
 *
 * Story 11-1, AC5: Micro-interactions
 * - Tooltip shows "Copied!" for 2s after click
 * - Green checkmark icon when copied
 */
export function CopyButton({ text, className = '', onCopy, size = 16 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setShowTooltip(true)
      onCopy?.()
      setTimeout(() => {
        setCopied(false)
        setShowTooltip(false)
      }, 2000)
    } catch {
      // Handle permission denied gracefully - silently fail
      // User will see the icon didn't change to checkmark
    }
  }, [text, onCopy])

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleCopy}
        className={`inline-flex items-center justify-center p-1 rounded hover:bg-white/10 transition-colors btn-interactive ${
          copied ? 'text-green-400' : 'text-white/60 hover:text-white'
        } ${className}`}
        title={copied ? 'Copied!' : 'Copy to clipboard'}
        aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      {/* Tooltip */}
      {showTooltip && (
        <span
          className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black border border-white/20 text-xs text-green-400 font-mono whitespace-nowrap z-50"
          role="status"
          aria-live="polite"
        >
          Copied!
        </span>
      )}
    </div>
  )
}
