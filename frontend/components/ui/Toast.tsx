'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'celebrate'

export interface ToastData {
  id: string
  type: ToastType
  message: string
  /** Larger headline rendered above the message. Used by celebrate toasts. */
  headline?: string
  link?: {
    url: string
    text: string
  }
  duration?: number
}

interface ToastProps {
  toast: ToastData
  onDismiss: (id: string) => void
}

/**
 * Individual toast notification component
 * Institutional style: white card with colored left accent bar
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const t = useTranslations('common')
  const [isExiting, setIsExiting] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const duration = toast.duration ?? 5000
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  // Entrance animation — invisible on mount, visible on next frame
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  const accentBar = {
    success: 'border-l-color-up',
    error: 'border-l-color-down',
    warning: 'border-l-color-warning',
    info: 'border-l-zinc-400',
    celebrate: 'border-l-color-up',
  }[toast.type]

  const iconColor = {
    success: 'text-color-up',
    error: 'text-color-down',
    warning: 'text-color-warning',
    info: 'text-zinc-500',
    celebrate: 'text-color-up',
  }[toast.type]

  const isCelebrate = toast.type === 'celebrate'

  return (
    <div
      className={`
        bg-card border border-border-light ${accentBar} text-text-primary rounded-xl shadow-card
        transition-all duration-300 ease-out
        ${isCelebrate ? 'border-l-[6px] p-[18px] shadow-lg' : 'border-l-4 p-4'}
        ${isExiting
          ? 'opacity-0 translate-x-4 scale-[0.97]'
          : isVisible
            ? `opacity-100 translate-x-0 scale-100 ${isCelebrate ? 'animate-toast-pop' : ''}`
            : 'opacity-0 translate-x-6 scale-[0.97]'}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {isCelebrate ? (
            <span
              className={`${iconColor} flex-shrink-0 mt-[2px]`}
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
          ) : null}
          <div className="flex-1 min-w-0">
            {toast.headline ? (
              <p
                className={`${isCelebrate ? 'text-[17px] font-semibold tracking-tight' : 'text-[15px] font-semibold'} text-text-primary`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {toast.headline}
              </p>
            ) : null}
            <p
              className={`
                ${toast.type === 'error' ? 'text-color-down' : 'text-text-primary'}
                ${isCelebrate ? 'text-[13px] text-text-secondary mt-0.5' : ''}
              `}
            >
              {toast.message}
            </p>
            {toast.link && (
              <a
                href={toast.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-1 inline-block text-sm ${iconColor} underline hover:opacity-80`}
              >
                {toast.link.text}
              </a>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
          aria-label={t('aria.dismiss')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

/**
 * Container for rendering multiple toast notifications
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
