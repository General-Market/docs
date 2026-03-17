'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
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

const TIER_TOAST_KEYS: Record<number, string> = {
  1: 'gate.tier1_toast',
  2: 'gate.tier2_toast',
  3: 'gate.tier3_toast',
}

export default function TweetGateModal({
  onClose,
  onUnlock,
  tier,
  chartRef,
  stats,
}: TweetGateModalProps) {
  const t = useTranslations('backtest')
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
      const toastKey = TIER_TOAST_KEYS[nextTier]
      showSuccess(toastKey ? t(toastKey) : t('gate.unlocked'))
      onClose()
    } else {
      showError(t('gate.signature_failed'))
    }
  }, [onUnlock, onClose, nextTier, showSuccess, showError, t])

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
              {t('gate.title')}
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              {t('gate.subtitle')}
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
              {t('gate.connect_wallet')}
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
                  alt={t('gate.chart_alt')}
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
                  {t('gate.download_image')}
                </button>
                <button
                  onClick={handleOpenTweet}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                >
                  {t('gate.open_x')}
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
