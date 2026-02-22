'use client'

import { useTranslations } from 'next-intl'

/**
 * Props for ConnectionStatus component
 */
export interface ConnectionStatusProps {
  /** Whether SSE is connected */
  isConnected: boolean
  /** Whether using polling fallback */
  isPolling?: boolean
}

/**
 * Simple connection status indicator
 * Institutional style: semantic dot colors (green up / red down)
 *
 * Displays a colored dot with status text:
 * - Green + "Live": SSE connected
 * - Yellow + "Polling": Polling fallback
 * - Gray + "Offline": Disconnected
 *
 * This is a simplified version of ConnectionStatusIndicator for use
 * in components that only need basic isConnected/isPolling state.
 */
export function ConnectionStatus({ isConnected, isPolling }: ConnectionStatusProps) {
  const t = useTranslations('common')
  const statusText = isConnected ? t('connection.live') : (isPolling ? t('connection.polling') : t('connection.offline'))
  const statusColor = isConnected ? 'text-color-up' : (isPolling ? 'text-color-warning' : 'text-text-muted')
  const dotColor = isConnected ? 'bg-color-up' : (isPolling ? 'bg-color-warning' : 'bg-text-muted')

  return (
    <div className="flex items-center gap-2 text-xs" role="status" aria-live="polite">
      <span
        className={`w-2 h-2 rounded-full ${dotColor} ${isConnected || isPolling ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      />
      <span className={statusColor}>
        {statusText}
      </span>
    </div>
  )
}
