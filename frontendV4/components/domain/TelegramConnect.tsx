/**
 * Telegram Connect Component
 *
 * Story 6-3, Task 6: Displays Telegram connection status and QR code
 * for linking wallet to Telegram notifications.
 *
 * AC10: Shows QR code, connection status, and instructions
 */

'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'

// Use relative path to go through Vercel rewrites to production backend
const BACKEND_URL = ''
const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'AgiArenaBot'

interface TelegramConnectProps {
  walletAddress: string
}

interface TelegramStatus {
  connected: boolean
  telegramUserId: number | null
}

/**
 * Fetches Telegram connection status for a wallet
 */
async function fetchTelegramStatus(walletAddress: string): Promise<TelegramStatus> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/telegram/status/${walletAddress}`)
    if (!res.ok) {
      return { connected: false, telegramUserId: null }
    }
    return await res.json()
  } catch (error) {
    console.error('Failed to fetch Telegram status:', error)
    return { connected: false, telegramUserId: null }
  }
}

/**
 * TelegramConnect - Agent detail page section for Telegram notifications
 *
 * Displays:
 * - QR code linking to t.me/BotUsername
 * - Connection status (Connected ✓ or Not Connected)
 * - Step-by-step instructions
 */
export function TelegramConnect({ walletAddress }: TelegramConnectProps) {
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch connection status on mount
  useEffect(() => {
    let mounted = true

    async function loadStatus() {
      setIsLoading(true)
      const result = await fetchTelegramStatus(walletAddress)
      if (mounted) {
        setStatus(result)
        setIsLoading(false)
      }
    }

    loadStatus()

    return () => {
      mounted = false
    }
  }, [walletAddress])

  const telegramUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}`

  return (
    <div className="border border-white/20 bg-terminal mb-8">
      <div className="flex justify-between items-center p-4 border-b border-white/20">
        <h2 className="text-lg font-bold text-white font-mono">
          Telegram Notifications
        </h2>
        {/* Connection Status Badge */}
        {isLoading ? (
          <span className="text-white/40 text-sm font-mono">Checking...</span>
        ) : status?.connected ? (
          <span className="text-white text-sm font-mono flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full" />
            Connected
          </span>
        ) : (
          <span className="text-[#C40000] text-sm font-mono flex items-center gap-2">
            <span className="w-2 h-2 bg-[#C40000] rounded-full" />
            Not Connected
          </span>
        )}
      </div>

      <div className="p-6">
        {status?.connected ? (
          /* Connected State */
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-white font-mono mb-2">
              Notifications Enabled
            </p>
            <p className="text-white/60 text-sm font-mono">
              You'll receive Telegram notifications for bet matches, settlements, and rank changes.
            </p>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 px-4 py-2 border border-white/20 text-white/60 hover:text-white hover:bg-white/10 font-mono text-sm transition-colors"
            >
              Open Bot →
            </a>
          </div>
        ) : (
          /* Not Connected State */
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* QR Code */}
            <div className="flex-shrink-0">
              <div className="bg-white p-3 rounded">
                <QRCodeSVG
                  value={telegramUrl}
                  size={120}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Instructions */}
            <div className="flex-1 text-center md:text-left">
              <p className="text-white font-mono mb-4">
                Get notified on Telegram
              </p>
              <ol className="text-white/60 text-sm font-mono space-y-2 list-decimal list-inside">
                <li>Open Telegram on your phone</li>
                <li>Scan the QR code or <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="text-white underline hover:no-underline">click here</a></li>
                <li>Send <code className="bg-white/10 px-1 rounded">/start</code> to the bot</li>
                <li>Follow the link to verify your wallet</li>
              </ol>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 px-4 py-2 bg-white text-black hover:bg-white/90 font-mono text-sm transition-colors"
              >
                Open @{TELEGRAM_BOT_USERNAME}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
