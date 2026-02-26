'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount } from 'wagmi'
import { exportChartAsImage, downloadBlob } from '@/lib/chartExport'
import { getTweetText, buildTweetIntentUrl } from '@/lib/tweetTemplates'
import { useToast } from '@/lib/contexts/ToastContext'

interface TweetGateModalProps {
  onClose: () => void
  onUnlock: () => Promise<boolean>
  tier: number
  chartRef: React.RefObject<HTMLDivElement | null>
  stats: {
    topN: number
    category: string
    totalReturn: string
    sharpe: string
    totalSimsRun: number
    bestStrategy?: string
    bestReturn?: string
  }
}

const TIMER_SECONDS = 15

const TIER_MESSAGES: Record<number, string> = {
  1: '5 more unlocked. Marketing intern.',
  2: '10 more. Employee of the month.',
  3: 'Unlimited. Basically a co-founder.',
}

export default function TweetGateModal({
  onClose,
  onUnlock,
  tier,
  chartRef,
  stats,
}: TweetGateModalProps) {
  const { isConnected } = useAccount()
  const { showSuccess, showError } = useToast()
  const [tweetOpened, setTweetOpened] = useState(false)
  const [countdown, setCountdown] = useState(TIMER_SECONDS)
  const [unlocking, setUnlocking] = useState(false)
  const [imageReady, setImageReady] = useState(false)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const imageBlobRef = useRef<Blob | null>(null)
  const imageUrlRef = useRef<string | null>(null)

  const nextTier = tier + 1
  const tweetText = getTweetText(nextTier, stats)

  // Pre-generate the chart image on mount
  useEffect(() => {
    if (!chartRef.current) return
    exportChartAsImage(chartRef.current).then((blob) => {
      imageBlobRef.current = blob
      setImageReady(!!blob)
      if (blob) {
        const url = URL.createObjectURL(blob)
        imageUrlRef.current = url
        setImagePreviewUrl(url)
      }
    })
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    }
  }, [chartRef])

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Countdown timer after tweet is opened
  useEffect(() => {
    if (!tweetOpened || countdown <= 0) return
    const interval = setInterval(() => {
      setCountdown((c) => c - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [tweetOpened, countdown])

  const handleDownloadImage = useCallback(() => {
    if (imageBlobRef.current) {
      downloadBlob(imageBlobRef.current, 'index-backtest.png')
    }
  }, [])

  const handleOpenTweet = useCallback(() => {
    window.open(buildTweetIntentUrl(tweetText), '_blank')
    setTweetOpened(true)
  }, [tweetText])

  const handleConfirm = useCallback(async () => {
    setUnlocking(true)
    const success = await onUnlock()
    setUnlocking(false)
    if (success) {
      showSuccess(TIER_MESSAGES[nextTier] || 'Unlocked!')
      onClose()
    } else {
      showError('Signature failed. Try again.')
    }
  }, [onUnlock, onClose, nextTier, showSuccess, showError])

  const canConfirm = tweetOpened && countdown <= 0 && !unlocking

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border-light rounded-xl shadow-modal max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-light">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Simulations aren&apos;t free. But almost.
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              One tweet = more backtests. We&apos;re basically giving these away.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tweet preview */}
        <div className="p-5 space-y-4">
          {!isConnected ? (
            <p className="text-sm text-text-secondary">
              Connect your wallet to unlock more simulations.
            </p>
          ) : (
            <>
              <div className="bg-surface rounded-lg p-4 text-sm text-text-primary whitespace-pre-line border border-border-light">
                {tweetText}
              </div>

              {/* Chart image preview */}
              {imagePreviewUrl && (
                <img
                  src={imagePreviewUrl}
                  alt="Backtest chart preview"
                  className="w-full rounded-lg border border-border-light"
                />
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadImage}
                  disabled={!imageReady}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border-light text-text-primary hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Download Image
                </button>
                <button
                  onClick={handleOpenTweet}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                >
                  Open X
                </button>
              </div>

              {/* Confirm */}
              {tweetOpened && (
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {unlocking
                    ? 'Sign with wallet...'
                    : countdown > 0
                      ? `Okay we trust you. Probably. (${countdown}s)`
                      : 'I posted'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
