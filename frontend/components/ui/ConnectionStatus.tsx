'use client'

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
  const statusText = isConnected ? 'Live' : (isPolling ? 'Polling' : 'Offline')
  const statusColor = isConnected ? 'text-green-400' : (isPolling ? 'text-yellow-400' : 'text-white/40')
  const dotColor = isConnected ? 'bg-green-400' : (isPolling ? 'bg-yellow-400' : 'bg-white/40')

  return (
    <div className="flex items-center gap-2 text-xs font-mono" role="status" aria-live="polite">
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
