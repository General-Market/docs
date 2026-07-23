# ITP Buy Card — Exact Underlying Fills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user buys an ITP, show the exact underlying assets acquired — symbol, on-chain quantity, unit price, USD contribution — instead of the current weight-based approximation.

**Architecture:** The on-chain `getITPState(itpId)` view already returns `(assets, weights, inventory)`, where `inventory[i]` is the qty-per-share (18-dec) for asset `i`. Combined with the existing `fillPrice` and `fillAmount` from the buy receipt, per-asset acquisition is fully derivable client-side: `sharesAcquired = fillAmount / fillPrice`, `qtyAcquired[i] = inventory[i] × sharesAcquired`. We add (1) an `address` field on `EnrichedHolding` so we can join inventory by address, (2) a wagmi hook to read inventory, (3) a pure helper that computes the breakdown, and (4) replace the approximation block in `BuyItpModal.renderFillDetails`. No backend changes.

**Tech Stack:** TypeScript, Next.js 14 App Router, wagmi `useReadContract`, viem `formatUnits`, vitest.

**Why this matters (current bug):** `BuyItpModal.tsx:743-767` computes `units = (fillAmount × weight) / price`. After any rebalance — or when displayed price has drifted from fill-time price — the displayed quantity diverges from what was actually minted into the basket. The protocol invariant is `inventory[i] × shares`, never `weight × USD`.

---

## File Structure

**Create:**
- `frontend/lib/itp/fill-breakdown.ts` — pure helper, no React, no wagmi
- `frontend/lib/itp/fill-breakdown.test.ts` — vitest unit tests
- `frontend/hooks/useItpInventory.ts` — wagmi `getITPState` reader

**Modify:**
- `frontend/lib/itp-enrichment-types.ts` — add `address` to `EnrichedHolding`
- `frontend/lib/api/itp-enrichment.ts` — populate `address` in the three holding-resolution paths
- `frontend/components/domain/BuyItpModal.tsx` — replace the per-asset block in `renderFillDetails`
- `frontend/messages/en.json` (and any other locales used by the modal) — add the two new microcopy keys

---

## Task 1: Pure helper — failing test

**Files:**
- Create: `frontend/lib/itp/fill-breakdown.ts`
- Create: `frontend/lib/itp/fill-breakdown.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/lib/itp/fill-breakdown.test.ts
import { describe, it, expect } from 'vitest'
import { computeFillBreakdown } from './fill-breakdown'

const ONE = 10n ** 18n

describe('computeFillBreakdown', () => {
  it('returns empty when fillPrice is zero', () => {
    expect(
      computeFillBreakdown({
        fillAmount: 100n * ONE,
        fillPrice: 0n,
        holdings: [{ symbol: 'AAPL', address: '0xa', price: 100, weight: 0.5 }],
        inventory: [{ address: '0xa', qtyPerShare: ONE / 100n }],
      }),
    ).toEqual([])
  })

  it('computes exact qty for an equal-weight 2-asset basket at NAV $1', () => {
    // Basket: AAPL @ $1, BTC @ $1, equal weight, NAV = $1.
    // qtyPerShare = (weight * 1e18) / price = 0.5e18 each.
    // User buys 10 USDC at fillPrice $1 → 10 shares.
    // Expected: 5 AAPL, 5 BTC.
    const half = ONE / 2n
    const out = computeFillBreakdown({
      fillAmount: 10n * ONE,
      fillPrice: ONE,
      holdings: [
        { symbol: 'AAPL', address: '0xa', price: 1, weight: 0.5 },
        { symbol: 'BTC', address: '0xb', price: 1, weight: 0.5 },
      ],
      inventory: [
        { address: '0xa', qtyPerShare: half },
        { address: '0xB', qtyPerShare: half }, // case-insensitive join
      ],
    })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ symbol: 'AAPL', qtyAcquired: 5, usd: 5 })
    expect(out[1]).toMatchObject({ symbol: 'BTC', qtyAcquired: 5, usd: 5 })
  })

  it('returns null usd when price is missing but keeps qty', () => {
    const out = computeFillBreakdown({
      fillAmount: 10n * ONE,
      fillPrice: ONE,
      holdings: [{ symbol: 'X', address: '0xa', price: 0, weight: 1 }],
      inventory: [{ address: '0xa', qtyPerShare: ONE }],
    })
    expect(out[0].qtyAcquired).toBe(10)
    expect(out[0].usd).toBeNull()
  })

  it('skips holdings with no matching inventory entry', () => {
    const out = computeFillBreakdown({
      fillAmount: ONE,
      fillPrice: ONE,
      holdings: [
        { symbol: 'A', address: '0xa', price: 1, weight: 1 },
        { symbol: 'B', address: '0xb', price: 1, weight: 0 },
      ],
      inventory: [{ address: '0xa', qtyPerShare: ONE }],
    })
    expect(out.map(h => h.symbol)).toEqual(['A'])
  })
})
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd frontend && npx vitest run lib/itp/fill-breakdown.test.ts
```

Expected: FAIL — `Cannot find module './fill-breakdown'`.

- [ ] **Step 3: Commit the failing test**

```bash
git add frontend/lib/itp/fill-breakdown.test.ts
git commit -m "test(itp): failing tests for exact fill breakdown helper"
```

---

## Task 2: Pure helper — implementation

**Files:**
- Create: `frontend/lib/itp/fill-breakdown.ts`

- [ ] **Step 1: Write the helper**

```ts
// frontend/lib/itp/fill-breakdown.ts

export type FillBreakdownHolding = {
  symbol: string
  address: string
  price: number       // current display price; 0 means unknown
  weight: number      // 0..1, kept for display continuity
  image?: string
}

export type FillBreakdownInventory = {
  address: string
  qtyPerShare: bigint // 18-dec token units per 1e18 shares
}

export type FillBreakdownRow = {
  symbol: string
  image?: string
  qtyAcquired: number      // float, decimal token units
  price: number | null     // null when unknown
  usd: number | null       // null when price unknown
  weight: number
}

export type FillBreakdownArgs = {
  fillAmount: bigint  // 18-dec USDC paid
  fillPrice: bigint   // 18-dec NAV per share at fill
  holdings: FillBreakdownHolding[]
  inventory: FillBreakdownInventory[]
}

const ONE = 10n ** 18n

export function computeFillBreakdown(args: FillBreakdownArgs): FillBreakdownRow[] {
  const { fillAmount, fillPrice, holdings, inventory } = args
  if (fillPrice === 0n || fillAmount === 0n) return []

  // shares (18-dec) = fillAmount * 1e18 / fillPrice
  const sharesBn = (fillAmount * ONE) / fillPrice

  const invByAddr = new Map<string, bigint>()
  for (const inv of inventory) invByAddr.set(inv.address.toLowerCase(), inv.qtyPerShare)

  const rows: FillBreakdownRow[] = []
  for (const h of holdings) {
    const qtyPerShareBn = invByAddr.get(h.address.toLowerCase())
    if (qtyPerShareBn === undefined) continue

    // qtyAcquired (token units, float) = qtyPerShareBn * sharesBn / 1e36
    // Use BigInt for the multiplication, then divide once into float.
    const qtyAcquired = Number(qtyPerShareBn * sharesBn) / 1e36
    const price = h.price > 0 ? h.price : null
    const usd = price === null ? null : qtyAcquired * price

    rows.push({
      symbol: h.symbol,
      image: h.image,
      qtyAcquired,
      price,
      usd,
      weight: h.weight,
    })
  }
  return rows
}
```

- [ ] **Step 2: Run the test — confirm it passes**

```bash
cd frontend && npx vitest run lib/itp/fill-breakdown.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/itp/fill-breakdown.ts
git commit -m "feat(itp): exact fill-breakdown helper using on-chain inventory"
```

---

## Task 3: Surface `address` on `EnrichedHolding`

**Files:**
- Modify: `frontend/lib/itp-enrichment-types.ts`
- Modify: `frontend/lib/api/itp-enrichment.ts`

The enrichment route already knows the asset address in all three resolution paths — it just discards it. We need it on the holding object to join with inventory client-side.

- [ ] **Step 1: Add `address` to the type**

Modify `frontend/lib/itp-enrichment-types.ts:31-51` — add the field after `symbol`:

```ts
export interface EnrichedHolding {
  symbol: string
  address: string   // ← new; lowercased 0x asset address
  name: string
  weight: number
  price: number
  // ...rest unchanged
}
```

Also update the local `rawHoldings` type in `itp-enrichment.ts:311` to include `address: string`.

- [ ] **Step 2: Populate `address` in priority 1 (server holdings)**

Modify `frontend/lib/api/itp-enrichment.ts:307-321`. Extend the `serverHoldings` parameter shape and pass-through:

```ts
export async function computeEnrichment(
  itpId: string,
  serverHoldings?: { symbol: string; weight: number; price: number; address?: string }[],
): Promise<ItpEnrichment> {
  let rawHoldings: { symbol: string; address: string; weight: number; price: number; name: string }[] = []

  if (serverHoldings && serverHoldings.length > 0) {
    rawHoldings = serverHoldings.map(h => ({
      symbol: h.symbol,
      address: (h.address ?? '').toLowerCase(),
      weight: h.weight,
      price: h.price,
      name: h.symbol,
    }))
  }
  // ...
```

- [ ] **Step 3: Populate `address` in priority 2 (chain itp-state)**

Modify `frontend/lib/api/itp-enrichment.ts:336-344`:

```ts
      const equalWeight = addresses.length > 0 ? 1 / addresses.length : 0
      rawHoldings = addresses.map((addr) => {
        const symbol = deployedMap[addr.toLowerCase()] || ''
        return {
          symbol: symbol.toUpperCase(),
          address: addr.toLowerCase(),
          weight: equalWeight,
          price: 0,
          name: symbol.toUpperCase(),
        }
      }).filter(h => h.symbol)
```

- [ ] **Step 4: Populate `address` in priority 3 (deployed-assets fallback)**

Modify `frontend/lib/api/itp-enrichment.ts:351-365`:

```ts
      rawHoldings = assets.map(a => ({
        symbol: a.symbol,
        address: a.address.toLowerCase(),
        weight: equalWeight,
        price: 0,
        name: a.symbol,
      }))
```

- [ ] **Step 5: Pass `address` through `enrichedHoldings.map`**

Modify `frontend/lib/api/itp-enrichment.ts:372-379`. The spread already covers it, but verify by inspection — `...h` will include `address` once `rawHoldings` carries it.

- [ ] **Step 6: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. If a caller of `computeEnrichment` somewhere else used `serverHoldings` without `address`, the field's optionality on the parameter handles it.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/itp-enrichment-types.ts frontend/lib/api/itp-enrichment.ts
git commit -m "feat(itp): expose asset address on EnrichedHolding for inventory join"
```

---

## Task 4: `useItpInventory` hook

**Files:**
- Create: `frontend/hooks/useItpInventory.ts`

This hook reads `getITPState(itpId)` once on mount and exposes `inventory` joined with `assets` by index. It mirrors the conventions of `useItpNav.ts` — same return shape (data, isLoading, error, refresh).

- [ ] **Step 1: Locate the existing `useReadContract` pattern**

Run:

```bash
grep -rn "getITPState\|getITPInfo" frontend/hooks frontend/lib frontend/components | head -20
```

Use whichever existing hook calls `getITPState` as the template for chain id, address, and ABI imports. If no hook calls it yet, use the pattern from any wagmi `useReadContract` in `frontend/hooks` (e.g. one that targets the Index contract).

- [ ] **Step 2: Write the hook**

```ts
// frontend/hooks/useItpInventory.ts
'use client'

import { useMemo } from 'react'
import { useReadContract } from 'wagmi'
import { IndexProtocolABI } from '@/lib/contracts/index-protocol-abi'
import { getIndexAddress, L3_CHAIN_ID } from '@/lib/config'

export type ItpInventoryEntry = { address: string; qtyPerShare: bigint }

export type UseItpInventoryResult = {
  inventory: ItpInventoryEntry[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useItpInventory(itpId: string | undefined): UseItpInventoryResult {
  const { data, isLoading, error, refetch } = useReadContract({
    chainId: L3_CHAIN_ID,
    address: getIndexAddress(),
    abi: IndexProtocolABI,
    functionName: 'getITPState',
    args: itpId ? [itpId as `0x${string}`] : undefined,
    query: { enabled: Boolean(itpId) },
  })

  const inventory = useMemo<ItpInventoryEntry[]>(() => {
    if (!data) return []
    // getITPState returns (creator, totalSupply, nav, assets, weights, inventory)
    const tuple = data as readonly [string, bigint, bigint, readonly string[], readonly bigint[], readonly bigint[]]
    const [, , , assets, , inv] = tuple
    if (!assets || !inv || assets.length !== inv.length) return []
    return assets.map((addr, i) => ({ address: addr.toLowerCase(), qtyPerShare: inv[i] }))
  }, [data])

  return {
    inventory,
    isLoading,
    error: error ? error.message : null,
    refresh: () => { void refetch() },
  }
}
```

**Verify the imports before writing.** `getIndexAddress` and `L3_CHAIN_ID` are placeholders for whatever the existing wagmi reads use. Run:

```bash
grep -rn "L3_CHAIN_ID\|INDEX_PROTOCOL_ADDRESS\|indexAddress\|getIndexAddress" frontend/lib/config.ts frontend/lib/contracts | head -20
```

Replace the imports with the actual symbols from `frontend/lib/config.ts` and `frontend/lib/contracts/`. If `IndexProtocolABI` is exported under a different name (e.g. `IndexABI`), use that.

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/hooks/useItpInventory.ts
git commit -m "feat(itp): useItpInventory hook reading getITPState"
```

---

## Task 5: Wire breakdown into `BuyItpModal`

**Files:**
- Modify: `frontend/components/domain/BuyItpModal.tsx`
- Modify: `frontend/messages/en.json` (and any other locales the modal already uses)

- [ ] **Step 1: Update local `Holding` type and imports**

In `frontend/components/domain/BuyItpModal.tsx:100`, extend the inline `Holding` type to carry `address`:

```ts
type Holding = { symbol: string; address: string; weight: number; price: number; name?: string; image?: string }
```

Add imports near the other hook/lib imports at the top of the file:

```ts
import { useItpInventory } from '@/hooks/useItpInventory'
import { computeFillBreakdown } from '@/lib/itp/fill-breakdown'
```

- [ ] **Step 2: Call the inventory hook**

Find the section where `useItpNav` is called (search for `useItpNav(`). Add directly below it:

```ts
const { inventory } = useItpInventory(itpId)
```

- [ ] **Step 3: Replace the per-asset block in `renderFillDetails`**

Replace `frontend/components/domain/BuyItpModal.tsx:739-770` with:

```tsx
{holdings.length > 0 && fillPrice && fillAmount && (() => {
  const rows = computeFillBreakdown({
    fillAmount,
    fillPrice,
    holdings: holdings.map(h => ({
      symbol: h.symbol,
      address: h.address,
      price: h.price,
      weight: h.weight,
      image: h.image,
    })),
    inventory,
  })
  if (rows.length === 0) return null
  return (
    <div className="pt-3 border-t border-black/5">
      <p className="text-[11px] uppercase tracking-wide text-text-muted mb-2">
        {t('fill_details.underlying_title')}
      </p>
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {rows.map(r => (
          <div key={r.symbol} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {r.image && <img src={r.image} alt="" className="w-4 h-4 rounded-full flex-shrink-0" />}
              <span className="font-mono text-text-primary truncate">{r.symbol}</span>
              <span className="text-text-muted tabular-nums">{(r.weight * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-text-muted">
                {r.price !== null
                  ? `$${r.price < 1 ? r.price.toFixed(4) : r.price.toFixed(2)}`
                  : '—'}
              </span>
              <span className="text-text-primary">
                {r.qtyAcquired < 1 ? r.qtyAcquired.toFixed(6) : r.qtyAcquired.toFixed(4)}
              </span>
              <span className="text-text-muted w-16 text-right">
                {r.usd !== null ? `$${r.usd.toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-text-muted mt-2">
        {t('fill_details.underlying_note')}
      </p>
    </div>
  )
})()}
```

- [ ] **Step 4: Add the two i18n keys**

Modify `frontend/messages/en.json`. Find the `fill_details` block used by `BuyItpModal` (search for `"fill_price"` near a key whose siblings match the existing modal copy) and add:

```json
"underlying_title": "Underlying assets acquired",
"underlying_note": "Quantities are exact (on-chain inventory × shares minted). Prices reflect the current oracle quote."
```

Add the same keys to every other locale file the modal touches. Find them with:

```bash
grep -rln "amount_filled" frontend/messages
```

For non-English locales: copy the English value as a placeholder — the existing translation pipeline will catch it.

- [ ] **Step 5: Type-check + lint**

```bash
cd frontend && npx tsc --noEmit && npx eslint components/domain/BuyItpModal.tsx hooks/useItpInventory.ts lib/itp/fill-breakdown.ts --quiet
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

```bash
./switch-env.sh testnet
cd frontend && npm run dev
```

In the browser:
1. Connect a funded wallet on the L3 testnet.
2. Open any ITP and trigger a small buy ($1–$5 range).
3. Wait for the modal to reach `DONE`.
4. Confirm the underlying-assets table now shows three columns: unit price, qty acquired, USD value.
5. Sum the USD column mentally — it should approximate `fillAmount` (small drift is fine if oracle prices have moved since fill).
6. Pick one asset, multiply its `qtyAcquired` by an outside price source — confirm the qty matches what the basket actually delivers (compare against `getITPState` → `inventory` if needed).

If the table is empty, log the inventory and holdings arrays to console and check the address join — most likely culprit is mixed-case address comparison.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/domain/BuyItpModal.tsx frontend/messages/en.json
# plus any other locale files that were touched
git commit -m "feat(buy-modal): show exact underlying qty + USD per asset on fill"
```

---

## Task 6: Push

- [ ] **Step 1: Push**

```bash
git push mono main
```

The post-commit hook will trigger the Dokploy webhook on VPS 3. Verify deploy by tailing logs ~3 minutes later:

```bash
ssh vps3 'docker service ls | grep -i frontend'
ssh vps3 'docker service logs <service-name> --tail 80'
```

---

## Out of Scope

- **Sell modal symmetry.** `SellItpModal.renderFillDetails` has the same approximation problem. Worth doing — but tracked as a separate plan to keep this one bounded. After this plan ships, the helper and hook are reusable; the sell change is ~30 lines.
- **Fill-time prices.** This plan uses the *current* oracle price for the USD column and labels it as such. Capturing the exact per-asset price the oracle used at fill time would require either reading from a new event (none exists), reconstructing from `nav.rs` history, or a contract change. None of those is justified for a display-only refinement.
- **Per-asset slippage / VWAP.** The AP executes vault trades against CEX with its own slippage. We do not surface that. The AP's per-asset CEX fills are not currently indexed; surfacing them is a backend project.

---

## Self-Review

- **Spec coverage:** "underlying asset bought by price and qty" → Tasks 1–5 deliver exact qty (on-chain inventory) and per-unit price (from enrichment) per asset, in the buy modal's success state.
- **Placeholder scan:** none. Every step has either runnable code or a runnable command. The wagmi hook (Task 4 Step 2) flags the two import names that must be confirmed against the live config — explicit instruction, not a TODO.
- **Type consistency:** `FillBreakdownHolding`, `FillBreakdownInventory`, `FillBreakdownRow` are defined once in Task 2 and reused unchanged in Task 5. `EnrichedHolding.address` is added in Task 3 and consumed in Task 5. Hook return type `UseItpInventoryResult` defined in Task 4 and consumed by destructuring in Task 5.
