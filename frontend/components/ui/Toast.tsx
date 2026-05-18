'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

const ACCENT: Record<ToastType, string> = {
  success: '#34C759',   // iOS systemGreen
  celebrate: '#34C759',
  error: '#FF3B30',     // iOS systemRed
  warning: '#FF9500',   // iOS systemOrange
  info: '#007AFF',      // iOS systemBlue
}

/**
 * Apple-style toast notification.
 *
 * Visual rules — all values pulled from Apple HIG / apple.com production CSS:
 * - 16px corner radius (iOS notification standard)
 * - Soft layered shadow, no harsh outline
 * - SF Pro Display / SF Pro Text via apple-tokens.css
 * - iOS system colors for accent/icon
 * - Tracking −0.022em on body, −0.016em on headline
 * - Enter: 360ms ease-out (Apple's own curve), translateY + fade
 * - Celebrate: 480ms with overshoot keyframe via tailwind animate-toast-pop
 * - Auto-dismiss pauses while the toast is hovered
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const t = useTranslations('common')
  const [isExiting, setIsExiting] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [paused, setPaused] = useState(false)
  const remainingRef = useRef<number>(toast.duration ?? 5000)
  const enteredAtRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCelebrate = toast.type === 'celebrate'
  const accent = ACCENT[toast.type]

  // Pause-resume aware auto-dismiss.
  useEffect(() => {
    if (paused) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      remainingRef.current -= Date.now() - enteredAtRef.current
      return
    }
    enteredAtRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 280)
    }, Math.max(remainingRef.current, 600))
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [paused, toast.id, onDismiss])

  // Entrance: invisible on mount, visible next frame so the transition runs.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 280)
  }

  const baseStyle: CSSProperties = {
    background: 'var(--apple-panel,#ffffff)',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: 16,
    boxShadow:
      '0 12px 32px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)',
    padding: isCelebrate ? '16px 18px' : '13px 14px',
    width: 'min(360px, calc(100vw - 32px))',
    color: 'var(--apple-text,#1d1d1f)',
    fontFamily: 'var(--apple-font-text)',
    letterSpacing: 'var(--apple-track-tight,-0.022em)',
    transition:
      'opacity 280ms cubic-bezier(0.25, 0.1, 0.3, 1), transform 280ms cubic-bezier(0.25, 0.1, 0.3, 1)',
    transform: isExiting
      ? 'translateY(-6px) scale(0.97)'
      : isVisible
        ? 'translateY(0) scale(1)'
        : 'translateY(16px) scale(0.96)',
    opacity: isExiting ? 0 : isVisible ? 1 : 0,
    willChange: 'transform, opacity',
  }

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      style={baseStyle}
      className={isCelebrate && isVisible && !isExiting ? 'animate-toast-pop' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            flexShrink: 0,
            marginTop: toast.headline ? 1 : 0,
            color: accent,
          }}
        >
          <ToastIcon type={toast.type} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {toast.headline ? (
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--apple-font-display)',
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tighter,-0.016em)',
                color: 'var(--apple-text,#1d1d1f)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {toast.headline}
            </p>
          ) : null}
          <p
            style={{
              margin: 0,
              marginTop: toast.headline ? 2 : 0,
              fontSize: toast.headline ? 13 : 15,
              fontWeight: 400,
              color: toast.headline
                ? 'var(--apple-text-secondary,#6e6e73)'
                : 'var(--apple-text,#1d1d1f)',
              letterSpacing: 'var(--apple-track-tight,-0.022em)',
              wordBreak: 'break-word',
            }}
          >
            {toast.message}
          </p>
          {toast.link ? (
            <a
              href={toast.link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 6,
                fontSize: 13,
                fontWeight: 500,
                color: '#007AFF',
                textDecoration: 'none',
              }}
            >
              {toast.link.text}
              <svg
                width="11"
                height="11"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5.5 3h7.5v7.5" />
                <path d="M13 3 3.5 12.5" />
              </svg>
            </a>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('aria.dismiss')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--apple-text-tertiary,#6e6e73)',
            cursor: 'pointer',
            padding: 4,
            margin: -4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderRadius: 999,
            transition: 'background-color 140ms cubic-bezier(0.25, 0.1, 0.3, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <svg
            width="14"
            height="14"
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

function ToastIcon({ type }: { type: ToastType }) {
  // SF Symbol style monoline. 22×22 host, 20px artwork centered.
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (type === 'success' || type === 'celebrate') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m8.5 12 2.5 2.5L16 9.5" />
      </svg>
    )
  }
  if (type === 'error') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <line x1="9" y1="9" x2="15" y2="15" />
        <line x1="15" y1="9" x2="9" y2="15" />
      </svg>
    )
  }
  if (type === 'warning') {
    return (
      <svg {...common}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  }
  // info
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

interface ToastContainerProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

/**
 * Bottom-right stack with safe-area padding for iOS. Tighter gap and
 * column-reverse so new toasts slide in at the bottom and existing ones
 * lift to make room.
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        right: 'max(16px, env(safe-area-inset-right))',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        pointerEvents: 'none',
      }}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}
