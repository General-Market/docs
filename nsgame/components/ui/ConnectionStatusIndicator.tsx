'use client'

import { useTranslations } from 'next-intl'
import { SSEState } from '@/hooks/useLeaderboardSSE'

/**
 * Props for ConnectionStatusIndicator
 */
interface ConnectionStatusIndicatorProps {
  /** Current SSE connection state */
  state: SSEState
  /** Current reconnection attempt number */
  reconnectAttempt: number
}

/**
 * Color configuration per state (colors don't need i18n)
 */
const stateColors: Record<SSEState, string> = {
  connected: 'bg-color-up',
  connecting: 'bg-color-warning animate-pulse',
  error: 'bg-color-warning animate-pulse',
  disconnected: 'bg-color-down',
  disabled: 'bg-text-muted',
  polling: 'bg-color-warning',
}

/**
 * Connection status indicator component
 *
 * Displays a colored dot with status text to indicate SSE connection state:
 * - Green: "Live" (connected)
 * - Yellow pulsing: "Reconnecting (X)..." (connecting/error)
 * - Yellow: "Polling" (fallback mode)
 * - Red: "Offline" (disconnected)
 * - Gray: "Disabled" (SSE not configured)
 */
export function ConnectionStatusIndicator({
  state,
  reconnectAttempt
}: ConnectionStatusIndicatorProps) {
  const t = useTranslations('common')

  const color = stateColors[state]

  const getText = (): string => {
    switch (state) {
      case 'connected':
        return t('connection.live')
      case 'connecting':
        return reconnectAttempt > 0
          ? t('connection.reconnecting', { attempt: reconnectAttempt })
          : t('connection.connecting')
      case 'error':
        return t('connection.reconnecting', { attempt: reconnectAttempt })
      case 'disconnected':
        return t('connection.offline')
      case 'disabled':
        return t('connection.disabled')
      case 'polling':
        return t('connection.polling')
      default:
        return t('connection.offline')
    }
  }

  return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite">
      <span
        className={`w-2 h-2 rounded-full ${color}`}
        aria-hidden="true"
      />
      <span className="text-xs text-text-muted">{getText()}</span>
    </div>
  )
}
