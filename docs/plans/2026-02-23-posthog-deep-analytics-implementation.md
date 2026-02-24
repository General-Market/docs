# PostHog Deep Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Instrument the entire frontend with PostHog (hybrid autocapture + manual events, full session replay) to diagnose drop-offs and optimize conversion across all flows.

**Architecture:** PostHog JS SDK initialized in a client-side provider, with a thin `usePostHog()` hook as the single import point for all components. Autocapture for broad coverage, manual events on every critical flow step with rich properties. Session replay enabled globally.

**Tech Stack:** `posthog-js` + `posthog-js/react`, Next.js 15 App Router, React 19

---

### Task 1: Install PostHog + Create Core Library

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/lib/posthog.ts`

**Step 1: Install posthog-js**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm install posthog-js`

**Step 2: Create PostHog client config**

Create `frontend/lib/posthog.ts`:

```typescript
import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window === 'undefined') return
  if (posthog.__loaded) return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: true,
    capture_pageview: false, // manual via App Router hook
    capture_pageleave: true,
    person_profiles: 'identified_only',
    session_recording: {
      maskAllInputs: false,
    },
  })
}

export { posthog }
```

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/lib/posthog.ts
git commit -m "feat: install posthog-js and create config"
```

---

### Task 2: Create usePostHog Hook

**Files:**
- Create: `frontend/hooks/usePostHog.ts`

**Step 1: Create the hook**

Create `frontend/hooks/usePostHog.ts`:

```typescript
'use client'

import { useCallback } from 'react'
import { posthog } from '@/lib/posthog'

type Properties = Record<string, unknown>

export function usePostHogTracker() {
  const capture = useCallback((event: string, properties?: Properties) => {
    posthog.capture(event, properties)
  }, [])

  const identify = useCallback((distinctId: string, properties?: Properties) => {
    posthog.identify(distinctId, properties)
  }, [])

  const reset = useCallback(() => {
    posthog.reset()
  }, [])

  return { capture, identify, reset }
}
```

**Step 2: Commit**

```bash
git add frontend/hooks/usePostHog.ts
git commit -m "feat: add usePostHogTracker hook"
```

---

### Task 3: Create PostHogProvider + PageView Tracker

**Files:**
- Create: `frontend/components/PostHogProvider.tsx`
- Modify: `frontend/app/providers.tsx`
- Modify: `frontend/next.config.ts` (CSP)

**Step 1: Create PostHogProvider**

Create `frontend/components/PostHogProvider.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog()
  }, [])

  // Track page views on route changes
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname
    posthog.capture('page_viewed', {
      path: pathname,
      url,
      referrer: document.referrer || undefined,
    })
  }, [pathname, searchParams])

  return <>{children}</>
}
```

**Step 2: Add PostHogProvider to provider tree**

In `frontend/app/providers.tsx`, add to imports:

```typescript
import { PostHogProvider } from '@/components/PostHogProvider'
```

Wrap children inside the return (outermost position, before WagmiProvider):

```tsx
return (
  <PostHogProvider>
    <WagmiProvider config={getWagmiConfig()}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SSEWrapper>
            <ChainGuard>
              {children}
            </ChainGuard>
          </SSEWrapper>
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </PostHogProvider>
)
```

**Step 3: Update CSP in next.config.ts**

In `frontend/next.config.ts:59`, add PostHog domains to `connect-src`:

Add `https://us.i.posthog.com https://us-assets.i.posthog.com` to the connect-src directive.

Also add `https://us-assets.i.posthog.com` to `script-src` (for session replay recorder).

**Step 4: Commit**

```bash
git add frontend/components/PostHogProvider.tsx frontend/app/providers.tsx frontend/next.config.ts
git commit -m "feat: add PostHogProvider with pageview tracking and CSP"
```

---

### Task 4: Wallet Connection Events + Identity

**Files:**
- Modify: `frontend/components/domain/WalletConnectButton.tsx`

**Step 1: Add tracking to wallet events**

Add import at top:
```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
```

Inside the component, add:
```typescript
const { capture, identify, reset: resetPostHog } = usePostHogTracker()
```

**Step 2: Track connect click**

In `handleConnect`, add before the connector logic:
```typescript
capture('wallet_connect_clicked', { source: 'header' })
```

After `connect()` call succeeds — use a `useEffect` watching `isConnected` + `address`:
```typescript
// Track wallet connected / identify user
useEffect(() => {
  if (isConnected && address) {
    const connectorName = connectors.find(c => c.id === 'injected')?.name || 'injected'
    identify(address, { wallet_type: connectorName, chain_id: chainId })
    capture('wallet_connected', {
      wallet_address: address,
      connector_type: connectorName,
      chain_id: chainId,
    })
  }
}, [isConnected, address])
```

**Step 3: Track wrong network**

In the wrong network detection area, add a useEffect:
```typescript
useEffect(() => {
  if (isWrongNetwork) {
    capture('wallet_wrong_network', {
      current_chain_id: chainId,
      target_chain_id: indexL3.id,
    })
  }
}, [isWrongNetwork])
```

**Step 4: Track disconnect**

In the disconnect button onClick, add before `disconnect()`:
```typescript
capture('wallet_disconnected')
resetPostHog()
```

**Step 5: Track network switch failures**

In `addAndSwitchChain`, wrap the switch call catch:
```typescript
} catch (err) {
  capture('wallet_network_switch_failed', { error_message: String(err) })
}
```

**Step 6: Commit**

```bash
git add frontend/components/domain/WalletConnectButton.tsx
git commit -m "feat: add PostHog wallet connection tracking + identity"
```

---

### Task 5: Buy Flow Funnel Events

**Files:**
- Modify: `frontend/components/domain/BuyItpModal.tsx`

This is the most critical funnel. Instrument every step of the 10-step buy flow.

**Step 1: Add import and hook**

```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
```

Inside component:
```typescript
const { capture } = usePostHogTracker()
const buyStartTime = useRef<number>(0)
```

**Step 2: Track modal open**

Add useEffect at mount:
```typescript
useEffect(() => {
  capture('buy_modal_opened', { itp_id: itpId, itp_name: itpName, current_nav: navPerShare })
}, [])
```

**Step 3: Track amount entered**

Add debounced capture on `setAmount`:
```typescript
// After setAmount — track once user enters amount (debounce via ref)
const amountTracked = useRef(false)
useEffect(() => {
  if (amount && !amountTracked.current) {
    amountTracked.current = true
    capture('buy_amount_entered', {
      itp_id: itpId,
      amount_usd: amount,
      user_balance: formattedBalance,
    })
  }
}, [amount])
```

**Step 4: Track slippage change**

In the slippage tier button onClick, add:
```typescript
capture('buy_slippage_changed', { itp_id: itpId, slippage_tier: tier.label })
```

**Step 5: Track buy submitted**

In `handleApprove` (when needsApproval) and `handleBuy` (when not), add at the start:
```typescript
buyStartTime.current = Date.now()
capture('buy_submitted', {
  itp_id: itpId,
  amount_usd: amount,
  slippage: SLIPPAGE_TIERS[slippageTier].label,
  deadline_hours: deadlineHours,
  is_limit_order: Boolean(limitPrice && parseFloat(limitPrice) > 0),
})
```

**Step 6: Track micro-step progression**

Add a useEffect watching `micro`:
```typescript
useEffect(() => {
  if (micro < 0) return
  const stepName = BuyMicro[micro] || `step_${micro}`
  capture('buy_step_reached', {
    itp_id: itpId,
    step_name: stepName,
    step_index: micro,
    time_since_submit_ms: buyStartTime.current ? Date.now() - buyStartTime.current : 0,
  })
}, [micro])
```

**Step 7: Track buy completed**

In the DONE detection (where `toastFired` is set), add:
```typescript
capture('buy_completed', {
  itp_id: itpId,
  amount_usd: amount,
  fill_price: fillPrice ? formatUnits(fillPrice, 18) : null,
  total_time_ms: buyStartTime.current ? Date.now() - buyStartTime.current : 0,
})
```

**Step 8: Track errors**

In the approveError and buyError useEffects, add:
```typescript
capture('buy_failed', {
  itp_id: itpId,
  step_name: micro >= 0 ? BuyMicro[micro] : 'INPUT',
  step_index: micro,
  error_message: shortMsg,
  time_since_submit_ms: buyStartTime.current ? Date.now() - buyStartTime.current : 0,
})
```

**Step 9: Track modal close**

In the `onClose` button handler and the backdrop click, add:
```typescript
capture('buy_modal_closed', {
  itp_id: itpId,
  last_step: micro >= 0 ? BuyMicro[micro] : 'INPUT',
  had_entered_amount: Boolean(amount),
})
```

**Step 10: Commit**

```bash
git add frontend/components/domain/BuyItpModal.tsx
git commit -m "feat: add PostHog buy funnel tracking (10-step)"
```

---

### Task 6: Create ITP Funnel Events

**Files:**
- Modify: `frontend/components/domain/CreateItpSection.tsx`

**Step 1: Add import and hook**

```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
// Inside component:
const { capture } = usePostHogTracker()
```

**Step 2: Instrument events**

- On asset selection change: `capture('create_itp_assets_selected', { asset_count, asset_ids })`
- On weight configuration: `capture('create_itp_weights_set', { asset_count, weight_distribution })`
- On deploy button click: `capture('create_itp_submitted', { asset_count, name })`
- On successful deploy: `capture('create_itp_completed', { itp_id, asset_count, tx_hash })`
- On deploy failure: `capture('create_itp_failed', { error_message, step })`

Exact placement depends on the component's state machine. Look for:
- Asset toggle/select handlers
- The deploy/create button handler
- The success callback (tx receipt)
- The error callback

**Step 3: Commit**

```bash
git add frontend/components/domain/CreateItpSection.tsx
git commit -m "feat: add PostHog create ITP funnel tracking"
```

---

### Task 7: Rebalance Funnel Events

**Files:**
- Modify: `frontend/components/domain/RebalanceModal.tsx`

**Step 1: Add import and hook**

```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
// Inside component:
const { capture } = usePostHogTracker()
```

**Step 2: Instrument events**

- On mount: `capture('rebalance_modal_opened', { itp_id: itpId })`
- On submit: `capture('rebalance_submitted', { itp_id: itpId, assets_changed_count })`
- On success (status === 'success'): `capture('rebalance_completed', { itp_id: itpId, tx_hash })`
- On error (status === 'error'): `capture('rebalance_failed', { itp_id: itpId, error_message })`

**Step 3: Commit**

```bash
git add frontend/components/domain/RebalanceModal.tsx
git commit -m "feat: add PostHog rebalance funnel tracking"
```

---

### Task 8: Lending (Morpho) Events

**Files:**
- Modify: `frontend/components/domain/LendItpModal.tsx`

**Step 1: Add import and hook**

```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
// Inside component:
const { capture } = usePostHogTracker()
```

**Step 2: Instrument events**

- On modal open (when `isOpen` becomes true): `capture('lend_modal_opened', { itp_id: itpInfo.id })`
- On tab switch: track which lending action is selected
- On deposit/borrow/repay/withdraw actions in sub-components: pass `capture` down or use the hook in each sub-component (DepositCollateral, BorrowUsdc, RepayDebt, WithdrawCollateral)
- On success: `capture('lend_completed', { itp_id, action, tx_hash })`
- On failure: `capture('lend_failed', { itp_id, action, error_message })`

**Step 3: Commit**

```bash
git add frontend/components/domain/LendItpModal.tsx
git commit -m "feat: add PostHog lending funnel tracking"
```

---

### Task 9: Vision Platform Events

**Files:**
- Modify: `frontend/components/domain/vision/VisionPage.tsx`
- Modify: `frontend/components/domain/vision/CreateBatchModal.tsx`
- Modify: `frontend/components/domain/vision/DepositModal.tsx`
- Modify: `frontend/components/domain/vision/WithdrawModal.tsx`

**Step 1: VisionPage — track page view**

```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
// Inside component:
const { capture } = usePostHogTracker()
useEffect(() => { capture('vision_page_viewed') }, [])
```

**Step 2: CreateBatchModal — track batch creation funnel**

```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
const { capture } = usePostHogTracker()
```

- On modal open: `capture('vision_batch_create_started')`
- On batch created: `capture('vision_batch_created', { batch_id, initial_deposit })`

**Step 3: DepositModal — track deposits**

```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
const { capture } = usePostHogTracker()
```

- On submit: `capture('vision_deposit_submitted', { batch_id: batchId, amount })`

**Step 4: WithdrawModal — track withdrawals**

```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
const { capture } = usePostHogTracker()
```

- On submit: `capture('vision_withdraw_submitted', { batch_id: batchId, amount })`

**Step 5: Commit**

```bash
git add frontend/components/domain/vision/VisionPage.tsx frontend/components/domain/vision/CreateBatchModal.tsx frontend/components/domain/vision/DepositModal.tsx frontend/components/domain/vision/WithdrawModal.tsx
git commit -m "feat: add PostHog vision platform tracking"
```

---

### Task 10: Error & Diagnostic Events

**Files:**
- Modify: `frontend/components/ui/ErrorBoundary.tsx`
- Modify: `frontend/lib/contexts/ToastContext.tsx`
- Modify: `frontend/hooks/useSSE.tsx`

**Step 1: ErrorBoundary — track caught errors**

In `componentDidCatch`, add PostHog capture. Since this is a class component, import posthog directly (can't use hooks):

```typescript
import { posthog } from '@/lib/posthog'
```

In `componentDidCatch`:
```typescript
posthog.capture('error_boundary_triggered', {
  error_message: error.message,
  component_stack: errorInfo.componentStack?.slice(0, 500),
})
```

**Step 2: ToastContext — track error toasts**

```typescript
import { posthog } from '@/lib/posthog'
```

In `showError` callback, add:
```typescript
posthog.capture('toast_error_shown', { message })
```

**Step 3: SSE — track connection health**

```typescript
import { posthog } from '@/lib/posthog'
```

In the SSEProvider's `connect` function:
- When first event listener fires (connected): `posthog.capture('sse_connected', { topic: topicsKey })`
- In `es.onerror`: `posthog.capture('sse_disconnected', { topic: topicsKey, reconnect_attempt: reconnectAttemptRef.current })`

Note: Use posthog directly here (not the hook) since SSEProvider is a standalone context.

**Step 4: Commit**

```bash
git add frontend/components/ui/ErrorBoundary.tsx frontend/lib/contexts/ToastContext.tsx frontend/hooks/useSSE.tsx
git commit -m "feat: add PostHog error and diagnostic tracking"
```

---

### Task 11: Section Time Tracking

**Files:**
- Create: `frontend/hooks/useSectionTimeTracker.ts`
- Modify: `frontend/components/domain/HomeClient.tsx` (or wherever sections are rendered)

**Step 1: Create the hook**

Create `frontend/hooks/useSectionTimeTracker.ts`:

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { posthog } from '@/lib/posthog'

/**
 * Tracks time spent on each section using IntersectionObserver.
 * Fires 'section_time_spent' when user scrolls away from a section.
 */
export function useSectionTimeTracker(sectionIds: string[]) {
  const enterTimes = useRef<Map<string, number>>(new Map())
  const interacted = useRef<Set<string>>(new Set())

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      for (const id of sectionIds) {
        const section = document.getElementById(id)
        if (section?.contains(target)) {
          interacted.current.add(id)
          break
        }
      }
    }
    document.addEventListener('click', handleClick, true)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting) {
            enterTimes.current.set(id, Date.now())
          } else if (enterTimes.current.has(id)) {
            const enterTime = enterTimes.current.get(id)!
            const timeSpent = (Date.now() - enterTime) / 1000
            if (timeSpent > 1) { // only track if > 1 second
              posthog.capture('section_time_spent', {
                section_name: id,
                time_spent_seconds: Math.round(timeSpent),
                had_interaction: interacted.current.has(id),
              })
            }
            enterTimes.current.delete(id)
            interacted.current.delete(id)
          }
        }
      },
      { threshold: 0.3 }
    )

    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
      // Flush any sections still visible
      for (const [id, enterTime] of enterTimes.current.entries()) {
        const timeSpent = (Date.now() - enterTime) / 1000
        if (timeSpent > 1) {
          posthog.capture('section_time_spent', {
            section_name: id,
            time_spent_seconds: Math.round(timeSpent),
            had_interaction: interacted.current.has(id),
          })
        }
      }
    }
  }, [sectionIds])
}
```

**Step 2: Use the hook in the home page client component**

Find the client component that renders all sections (likely `HomeClient.tsx`). Add:

```typescript
import { useSectionTimeTracker } from '@/hooks/useSectionTimeTracker'

// Inside component:
useSectionTimeTracker(['markets', 'portfolio', 'create', 'lend', 'backtest', 'system'])
```

**Step 3: Commit**

```bash
git add frontend/hooks/useSectionTimeTracker.ts frontend/components/domain/HomeClient.tsx
git commit -m "feat: add PostHog section time tracking"
```

---

### Task 12: Section Navigation Tracking

**Files:**
- Modify: `frontend/components/layout/Header.tsx`

**Step 1: Add tracking to header navigation**

```typescript
import { usePostHogTracker } from '@/hooks/usePostHog'
// Inside component:
const { capture } = usePostHogTracker()
```

**Step 2: Track section clicks**

In `scrollTo` function, add:
```typescript
capture('section_scrolled_to', { section_name: id })
```

**Step 3: Commit**

```bash
git add frontend/components/layout/Header.tsx
git commit -m "feat: add PostHog section navigation tracking"
```

---

### Task 13: Add Environment Variables + Verify

**Files:**
- Modify: `frontend/.env.local` (or `.env`)

**Step 1: Add env vars**

```
NEXT_PUBLIC_POSTHOG_KEY=<your-posthog-project-api-key>
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Step 2: Run frontend and verify**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npm run dev`

- Open browser, check Network tab for requests to `us.i.posthog.com`
- Verify `$pageview` and `$autocapture` events appear in PostHog dashboard
- Connect wallet → verify `wallet_connected` event + identity set
- Open Buy modal → verify `buy_modal_opened` event
- Check session replay is recording

**Step 3: Commit env template**

Don't commit actual keys. Just verify locally.

---

### Task 14: Final Review + Sell Modal

**Files:**
- Find the sell modal component (likely in same directory or embedded in BuyItpModal)
- Add sell funnel events: `sell_modal_opened`, `sell_submitted`, `sell_completed`, `sell_failed`

Check if selling is in BuyItpModal.tsx or a separate SellItpModal. Instrument accordingly with same pattern as buy flow.

**Step 1: Commit**

```bash
git add -u
git commit -m "feat: complete PostHog instrumentation across all flows"
```
