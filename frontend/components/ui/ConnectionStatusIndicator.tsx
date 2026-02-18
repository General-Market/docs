'use client'

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
 * Connection status configuration per state
 */
const stateConfig: Record<SSEState, { color: string; text: string | ((attempt: number) => string) }> = {
  connected: { color: 'bg-green-400', text: 'Live' },
  connecting: { color: 'bg-yellow-400 animate-pulse', text: (attempt) => attempt > 0 ? `Reconnecting (${attempt})...` : 'Connecting...' },
  error: { color: 'bg-yellow-400 animate-pulse', text: (attempt) => `Reconnecting (${attempt})...` },
  disconnected: { color: 'bg-red-400', text: 'Offline' },
  disabled: { color: 'bg-white/40', text: 'Disabled' },
  polling: { color: 'bg-yellow-400', text: 'Polling' }
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
  const config = stateConfig[state]
  const text = typeof config.text === 'function' ? config.text(reconnectAttempt) : config.text

  return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite">
      <span
        className={`w-2 h-2 rounded-full ${config.color}`}
        aria-hidden="true"
      />
      <span className="text-xs text-white/60 font-mono">{text}</span>
    </div>
  )
}
