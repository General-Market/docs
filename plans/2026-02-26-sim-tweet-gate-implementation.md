# Simulation Tweet Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gate simulations behind X posts with an escalating tier system (3 free → post to unlock more → unlimited), all client-side.

**Architecture:** New `useSimQuota` hook manages localStorage-backed quota state bound by wallet signature. A `TweetGateModal` intercepts the Run button when quota is exhausted. `html2canvas` captures the chart with a watermark for tweet image attachment.

**Tech Stack:** React, wagmi (useAccount, useSignMessage), localStorage, html2canvas, twitter intent URLs, Recharts

---

### Task 1: Install html2canvas

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install the dependency**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm install html2canvas`

**Step 2: Verify installation**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && node -e "require('html2canvas'); console.log('ok')"`
Expected: `ok`

**Step 3: Commit**

```bash
cd /Users/maxguillabert/Downloads/index/frontend
git add package.json package-lock.json
git commit -m "chore: add html2canvas for sim chart export"
```

---

### Task 2: Create useSimQuota hook

**Files:**
- Create: `frontend/hooks/useSimQuota.ts`

**Step 1: Create the hook**

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'

interface QuotaState {
  tier: number
  used: number
  signatures: string[]
  lastUnlock: string | null
}

const TIER_LIMITS: Record<number, number> = {
  0: 3,
  1: 8,   // 3 + 5
  2: 18,  // 8 + 10
  3: Infinity,
}

const STORAGE_PREFIX = 'vision-sim-quota:'
const ANON_KEY = 'vision-sim-anonymous'

function getStorageKey(address: string): string {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`
}

function loadQuota(key: string): QuotaState {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { tier: 0, used: 0, signatures: [], lastUnlock: null }
}

function saveQuota(key: string, state: QuotaState) {
  localStorage.setItem(key, JSON.stringify(state))
}

export function useSimQuota() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const storageKey = isConnected && address ? getStorageKey(address) : ANON_KEY
  const [quota, setQuota] = useState<QuotaState>(() => loadQuota(storageKey))

  // Reload when wallet changes
  useEffect(() => {
    setQuota(loadQuota(storageKey))
  }, [storageKey])

  const remaining = Math.max(0, (TIER_LIMITS[quota.tier] ?? 3) - quota.used)
  const limit = TIER_LIMITS[quota.tier] ?? 3
  const isUnlimited = quota.tier >= 3
  const canRun = isUnlimited || remaining > 0
  const needsWallet = !isConnected && remaining <= 0

  const consume = useCallback(() => {
    if (isUnlimited) return
    const next = { ...quota, used: quota.used + 1 }
    saveQuota(storageKey, next)
    setQuota(next)
  }, [quota, storageKey, isUnlimited])

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address) return false
    const nextTier = quota.tier + 1
    if (nextTier > 3) return false

    try {
      const message = `Vision Simulation Unlock | Tier ${nextTier} | ${new Date().toISOString()}`
      const signature = await signMessageAsync({ message })

      const next: QuotaState = {
        tier: nextTier,
        used: quota.used,
        signatures: [...quota.signatures, signature],
        lastUnlock: new Date().toISOString(),
      }
      saveQuota(storageKey, next)
      setQuota(next)
      return true
    } catch {
      return false
    }
  }, [isConnected, address, quota, storageKey, signMessageAsync])

  return {
    tier: quota.tier,
    used: quota.used,
    remaining,
    limit,
    isUnlimited,
    canRun,
    needsWallet,
    consume,
    unlock,
  }
}
```

**Step 2: Commit**

```bash
git add frontend/hooks/useSimQuota.ts
git commit -m "feat: add useSimQuota hook for tweet-gated simulation quota"
```

---

### Task 3: Create chart export utility

**Files:**
- Create: `frontend/lib/chartExport.ts`

**Step 1: Create the utility**

```ts
import html2canvas from 'html2canvas'

const WATERMARK_TEXT = 'indexvision.com'
const WATERMARK_FONT = '14px Inter, system-ui, sans-serif'
const WATERMARK_COLOR = 'rgba(255, 255, 255, 0.5)'
const WATERMARK_PADDING = 16

export async function exportChartAsImage(
  chartElement: HTMLElement
): Promise<Blob | null> {
  try {
    const canvas = await html2canvas(chartElement, {
      backgroundColor: '#09090b', // matches bg-card / zinc-950
      scale: 2,
      logging: false,
      useCORS: true,
    })

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Stamp watermark
    ctx.font = WATERMARK_FONT
    ctx.fillStyle = WATERMARK_COLOR
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(
      WATERMARK_TEXT,
      canvas.width - WATERMARK_PADDING,
      canvas.height - WATERMARK_PADDING
    )

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
  } catch {
    return null
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

**Step 2: Commit**

```bash
git add frontend/lib/chartExport.ts
git commit -m "feat: add chart export utility with watermark stamping"
```

---

### Task 4: Create tweet template builder

**Files:**
- Create: `frontend/lib/tweetTemplates.ts`

**Step 1: Create the templates**

```ts
interface SimStats {
  topN: number
  category: string
  totalReturn: string
  sharpe: string
  totalSimsRun: number
  bestStrategy?: string
  bestReturn?: string
  uniqueStrategies?: number
  uniqueCategories?: number
}

export function getTweetText(tier: number, stats: SimStats): string {
  switch (tier) {
    case 1:
      return [
        'Should I tokenize this index?',
        '',
        `${stats.topN} ${stats.category} assets. ${stats.totalReturn}% since Jan 2020. ${stats.sharpe} Sharpe.`,
      ].join('\n')

    case 2:
      return [
        'Should I tokenize this one too?',
        '',
        `${stats.totalSimsRun} backtests deep. Best so far: ${stats.bestStrategy} at ${stats.bestReturn}%.`,
      ].join('\n')

    case 3:
      return [
        `${stats.totalSimsRun} backtests. Still looking for the one to tokenize.`,
      ].join('\n')

    default:
      return ''
  }
}

export function buildTweetIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}
```

**Step 2: Commit**

```bash
git add frontend/lib/tweetTemplates.ts
git commit -m "feat: add tweet template builder for sim gate tiers"
```

---

### Task 5: Create TweetGateModal component

**Files:**
- Create: `frontend/components/domain/simulation/TweetGateModal.tsx`

This is the main modal. References the modal pattern from `BuyItpModal.tsx` (fixed backdrop, bg-card card, &times; close button).

**Step 1: Create the modal**

```tsx
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
  const imageBlobRef = useRef<Blob | null>(null)

  const nextTier = tier + 1
  const tweetText = getTweetText(nextTier, stats)

  // Pre-generate the chart image on mount
  useEffect(() => {
    if (!chartRef.current) return
    exportChartAsImage(chartRef.current).then((blob) => {
      imageBlobRef.current = blob
      setImageReady(!!blob)
    })
  }, [chartRef])

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
```

**Step 2: Commit**

```bash
git add frontend/components/domain/simulation/TweetGateModal.tsx
git commit -m "feat: add TweetGateModal component for sim tweet gate"
```

---

### Task 6: Add chart ref to SimPerformanceChart

**Files:**
- Modify: `frontend/components/domain/simulation/SimPerformanceChart.tsx`

**Step 1: Add a forwarded ref to the chart wrapper div**

In `SimPerformanceChart.tsx`, the component needs to accept a `chartContainerRef` prop so BacktestSection can pass it down for canvas export.

Add a new prop to the component's props interface and attach it to the outer chart `<div>`. The single-mode chart wrapper is at approx line 163 (`<div className="mb-6">`). Add a `ref={chartContainerRef}` to it.

Similarly for sweep mode, attach to the wrapper at approx line 308 (`<div className="flex-1 min-w-0">`).

Add to the props type:
```ts
chartContainerRef?: React.RefObject<HTMLDivElement | null>
```

Attach to both chart wrapper divs:
```tsx
<div className="mb-6" ref={chartContainerRef}>
```
```tsx
<div className="flex-1 min-w-0" ref={chartContainerRef}>
```

**Step 2: Commit**

```bash
git add frontend/components/domain/simulation/SimPerformanceChart.tsx
git commit -m "feat: expose chart container ref from SimPerformanceChart"
```

---

### Task 7: Integrate quota + gate into BacktestSection

**Files:**
- Modify: `frontend/components/domain/simulation/BacktestSection.tsx`

This is the main integration task. Changes needed:

**Step 1: Add imports and state**

At the top of `BacktestSection.tsx`, add:
```ts
import { useSimQuota } from '@/hooks/useSimQuota'
import TweetGateModal from './TweetGateModal'
```

Inside the component, add:
```ts
const quota = useSimQuota()
const [showGateModal, setShowGateModal] = useState(false)
const chartContainerRef = useRef<HTMLDivElement>(null)
```

**Step 2: Modify handleRun (currently lines 139–149)**

Replace `handleRun` to check quota before running:
```ts
const handleRun = useCallback(() => {
  if (isLoading) {
    if (isSweep) sweep.cancel()
    else sim.cancel()
    return
  }

  if (!quota.canRun) {
    setShowGateModal(true)
    return
  }

  quota.consume()
  if (isSweep) sweep.run()
  else sim.run()
}, [isSweep, isLoading, sim, sweep, quota])
```

**Step 3: Pass chartContainerRef to SimPerformanceChart**

In both the single-mode and sweep-mode `<SimPerformanceChart>` usages (lines ~196 and ~234), add the prop:
```tsx
<SimPerformanceChart
  chartContainerRef={chartContainerRef}
  // ... existing props
/>
```

**Step 4: Add quota counter below the filter panel**

After `<SimFilterPanel>` (around line 291), add a quota counter:
```tsx
{!quota.isUnlimited && (
  <p className="text-xs text-text-muted mt-2 text-right">
    {quota.remaining === 0
      ? 'Time to pay... with a tweet'
      : quota.remaining === 1
        ? 'Last free sim'
        : `${quota.remaining} sims left`}
  </p>
)}
{quota.isUnlimited && (
  <p className="text-xs text-text-muted mt-2 text-right">Unlimited</p>
)}
```

**Step 5: Add the TweetGateModal render**

At the end of the component's return, before the closing fragment/div:
```tsx
{showGateModal && (
  <TweetGateModal
    onClose={() => setShowGateModal(false)}
    onUnlock={async () => {
      const success = await quota.unlock()
      if (success) {
        setShowGateModal(false)
        // Auto-run after unlock
        quota.consume()
        if (isSweep) sweep.run()
        else sim.run()
      }
      return success
    }}
    tier={quota.tier}
    chartRef={chartContainerRef}
    stats={{
      topN: filters.topN,
      category: filters.category?.name ?? 'Mixed',
      totalReturn: sim.result
        ? (sim.result.total_return * 100).toFixed(1)
        : '0',
      sharpe: sim.result ? sim.result.sharpe.toFixed(2) : '0',
      totalSimsRun: quota.used,
      bestStrategy: filters.strategy,
      bestReturn: sim.result
        ? (sim.result.total_return * 100).toFixed(1)
        : undefined,
    }}
  />
)}
```

**Step 6: Commit**

```bash
git add frontend/components/domain/simulation/BacktestSection.tsx
git commit -m "feat: integrate tweet gate quota into BacktestSection"
```

---

### Task 8: Manual testing

**Step 1: Start the frontend**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm run dev`

**Step 2: Test the full flow**

1. Open browser, navigate to the backtest section
2. Without wallet connected:
   - Run 3 simulations — should work
   - 4th attempt — modal should appear saying "Connect your wallet"
3. Connect wallet:
   - Quota counter should show remaining sims
   - Run sims until exhausted
   - Modal should show tweet preview + "Download Image" + "Open X" buttons
4. Click "Download Image" — PNG should download with chart + watermark
5. Click "Open X" — twitter intent should open with pre-filled text
6. Wait 15s — "I posted" button should enable
7. Click "I posted" — MetaMask signature popup
8. After signing — toast shows tier message, modal closes, sim auto-runs
9. Repeat for tier 2 and tier 3
10. At tier 3 — counter shows "Unlimited", gate never triggers again

**Step 3: Test localStorage reset**

1. Clear localStorage for the quota key
2. Verify quota resets to tier 0 with 3 free sims

**Step 4: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix: address issues found during manual testing"
```

---

Plan complete and saved to `docs/plans/2026-02-26-sim-tweet-gate-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
