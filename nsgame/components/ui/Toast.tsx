'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

// Public type kept intact for ToastContext compatibility. Visually
// 'warning' folds into 'info' — three tones, not four.
export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastData {
  id: string
  type: ToastType
  message: string
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

const EXIT_MS = 200

// Map four exposed tones to three rendered tones. Warning is not a thing
// the eye needs — calmness already implies caution.
function visualTone(type: ToastType): 'success' | 'error' | 'info' {
  if (type === 'success') return 'success'
  if (type === 'error') return 'error'
  return 'info'
}

const ACCENT: Record<'success' | 'error' | 'info', string> = {
  success: 'bg-emerald-400',
  error: 'bg-rose-400',
  info: 'bg-zinc-500',
}

const PROGRESS: Record<'success' | 'error' | 'info', string> = {
  success: 'bg-emerald-400/60',
  error: 'bg-rose-400/60',
  info: 'bg-zinc-500/60',
}

const LINK: Record<'success' | 'error' | 'info', string> = {
  success: 'text-emerald-300',
  error: 'text-rose-300',
  info: 'text-zinc-300',
}

/**
 * Single toast. Slides up, lingers, leaves. A hairline accent on the left
 * tells you the temperature without shouting; a 1px line at the bottom
 * counts down what is left of its life.
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const t = useTranslations('common')
  const [isExiting, setIsExiting] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const duration = toast.duration ?? 5000
  const tone = visualTone(toast.type)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), EXIT_MS)
    }, duration)
    return () => clearTimeout(timer)
  }, [toast.id, duration, onDismiss])

  // Entrance: invisible on mount, visible next frame.
  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), EXIT_MS)
  }

  return (
    <div
      role="alert"
      className={`
        relative overflow-hidden
        bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg
        motion-safe:transition-all motion-safe:duration-200 ease-out
        ${isExiting
          ? 'opacity-0 translate-y-1'
          : isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'}
      `}
    >
      {/* Hairline left-edge accent. 2px. Quiet. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-[2px] ${ACCENT[tone]}`}
      />

      <div className="flex items-start justify-between gap-3 pl-4 pr-3 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-snug text-zinc-100">
            {toast.message}
          </p>
          {toast.link && (
            <a
              href={toast.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1 inline-block text-[12px] underline-offset-4 hover:underline ${LINK[tone]}`}
            >
              {toast.link.text}
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-500 hover:text-zinc-200 transition-colors"
          aria-label={t('aria.dismiss')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
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

      {/* Auto-dismiss progress. 1px line. Width transitions to zero across
          the toast's lifetime. CSS transition, not keyframes — no global
          stylesheet touched. */}
      <span
        aria-hidden="true"
        className={`absolute bottom-0 left-0 h-px ${PROGRESS[tone]} motion-safe:transition-[width] ease-linear`}
        style={{
          width: isVisible && !isExiting ? '0%' : '100%',
          transitionDuration: `${duration}ms`,
        }}
      />
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

/**
 * Stack of toasts. 8px gap. Bottom-right anchor.
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}
