'use client'

/**
 * Real Solana-backed hooks. The shapes here match the stub shapes Agent A
 * built against — same names, same return types — so swapping the import
 * path is the only refactor.
 *
 * Polling cadences (chosen for devnet, not production):
 *  - useUpcomingSlots: recomputes every 60 s (a slot's "now" only matters
 *    at minute granularity; the program enforces a 60s grid).
 *  - useMarketState: 15 s poll. Devnet is fast enough that this won't
 *    hammer Helius free tier.
 *  - useRecentBets: 20 s poll against /api/markets/[pda]/bets.
 *  - usePlaceBet: no polling — it builds, signs, sends.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { useWallet } from '@/hooks/useWallet'
import { useSession } from '@/lib/solana/SessionContext'
import {
  buildPlaceBetTx,
  decodeMarket,
  PREDICTION_MARKET_PROGRAM_ID,
} from '@/lib/solana/predictionMarket'
import { CATALOG, getCatalogEntryByPairIndex, type CatalogEntry } from './catalog'
import { generateSlots, type UpcomingSlot } from './slots'
import type { Board } from './pairs'
import { track } from '@/lib/analytics/track'
import { activeCluster } from '@/lib/solana/cluster'

// Re-export so consumers can import from a single module.
export type { UpcomingSlot } from './slots'
export type { CatalogEntry } from './catalog'
export type { Board, PvpFormat, PvpPair } from './pairs'
export type { UserPosition, PositionState } from './positions'
export { useUserPositions } from './positions'
export { PAIR_REGISTRY, pairById, pairsForBoard, formatLabel, formatPillLabel, windowLabel, compactAudience, audienceUnit } from './pairs'

export interface MarketState {
  totalYes: bigint
  totalNo: bigint
  resolved: boolean
  outcomeYes: boolean | null
  baselinePrice: bigint | null
  finalPrice: bigint | null
}

export interface RecentBet {
  owner: string
  side: 'yes' | 'no'
  amount: bigint
  sig: string
}

export interface UseUpcomingSlotsOpts {
  /** Board filter — `all` includes both stars and cams. */
  board?: Board | 'all'
  horizonDays?: number
}

export interface UsePlaceBetReturn {
  placing: boolean
  error: string | null
  placeBet: (slot: UpcomingSlot, side: 'yes' | 'no', amount: bigint) => Promise<string>
}

export interface StakeBalance {
  /** Raw u64, in token-ladder units. */
  raw: bigint
  /** Formatted decimal string, trimmed of trailing zeros. */
  display: string
  /** Mint decimals — 6 for the devnet USDC proxy. */
  decimals: number
  loading: boolean
  error: string | null
}

export interface SourcePrice {
  /** Raw observation. Null until the proxy returns a real value. */
  raw: bigint | null
  /** Compact display string ("1.95B"). Empty when raw is null. */
  display: string
  /** Unix seconds the observation was recorded, if known. */
  ts: number | null
  /** True only on the very first fetch — flips false after that. */
  loading: boolean
  /** Direction vs the previous tick. Drives the flash. */
  direction: 'up' | 'down' | 'flat' | null
  /** Signed change in basis points, vs previous tick. Null at first tick. */
  changeBp: number | null
}

// The Side enum the program expects, expressed as the string variants the
// hand-rolled client encoder accepts. The encoder maps "Yes" → 0, "No" → 1.
type ProgramSide = 'Yes' | 'No'
function toProgramSide(s: 'yes' | 'no'): ProgramSide {
  return s === 'yes' ? 'Yes' : 'No'
}

// Stake mint — the program reads the canonical mint from GlobalConfig at
// runtime. We resolve it once per session via env override, falling back
// to the devnet bootstrap mint from PLAN.md.
const STAKE_MINT_FALLBACK = '5BNaj6SeidyLp9PKRFTEKCTGsww9SQmsTp7yEqgHiEkT'
function stakeMintFromEnv(): PublicKey {
  const override = process.env.NEXT_PUBLIC_PREDICTION_STAKE_MINT
  if (override) {
    try { return new PublicKey(override) } catch { /* fall through */ }
  }
  return new PublicKey(STAKE_MINT_FALLBACK)
}

// ── useUpcomingSlots ────────────────────────────────────────────────────

export function useUpcomingSlots(opts?: UseUpcomingSlotsOpts): UpcomingSlot[] {
  const { board = 'all', horizonDays = 7 } = opts ?? {}

  // Refresh every 15s. Cams cohorts are 2-minute, so a 60s tick was
  // wide enough to miss a rotation entirely — the slot stayed stale,
  // its closeTime crept past, and the program rejected bets with
  // "closeTime must be at least 10s in the future". 15s gives ~8 ticks
  // per cams cohort and never lets a live cohort fall off the page.
  const [nowSecs, setNowSecs] = useState<number>(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const tick = () => setNowSecs(Math.floor(Date.now() / 1000))
    const id = window.setInterval(tick, 15_000)
    return () => window.clearInterval(id)
  }, [])

  return useMemo(() => {
    return generateSlots({
      // Hard cap: render the next few slots per catalog entry. The free
      // tier of Helius cannot survive hundreds of getAccountInfo polls
      // every minute.
      maxSlotsPerEntry: 4,
      catalog: CATALOG,
      nowSecs,
      horizonDays,
      programId: PREDICTION_MARKET_PROGRAM_ID,
      board,
    })
  }, [nowSecs, horizonDays, board])
}

// ── useMarketState ──────────────────────────────────────────────────────

// Devnet Helius free tier rate-limits hard at burst > ~50 req/s. With
// dozens of cards calling this hook in parallel, 15s polls would 429 the
// account-info endpoint within the first minute. 60s is enough for a
// market that closes in minutes; the close/resolve cadence is on the
// chain, not on this poll.
const MARKET_POLL_MS = 60_000

// Shared cache so the row pill and the buy panel can never disagree
// about the same market. `useMarketStatesBatch` and `useMarketState`
// both publish their decoded state here, and any subscriber for that
// pda is notified — whichever fetch lands fresher wins.
const marketStateCache = new Map<string, MarketState | null>()
const marketStateSubscribers = new Map<string, Set<(s: MarketState | null) => void>>()

function publishMarketState(pda: string, state: MarketState | null): void {
  marketStateCache.set(pda, state)
  const subs = marketStateSubscribers.get(pda)
  if (!subs) return
  for (const cb of subs) cb(state)
}

function subscribeMarketState(pda: string, cb: (s: MarketState | null) => void): () => void {
  let set = marketStateSubscribers.get(pda)
  if (!set) {
    set = new Set()
    marketStateSubscribers.set(pda, set)
  }
  set.add(cb)
  return () => {
    set!.delete(cb)
    if (set!.size === 0) marketStateSubscribers.delete(pda)
  }
}

export function useMarketState(marketPda: string | null): MarketState | null {
  const { connection } = useWallet()
  const [state, setState] = useState<MarketState | null>(
    () => (marketPda ? marketStateCache.get(marketPda) ?? null : null),
  )

  // Track the last requested pda so we don't write stale results after an
  // address change — pyramid-of-doom prevention.
  const lastPdaRef = useRef<string | null>(null)

  // Subscribe to the shared cache: if a sibling hook (typically the
  // batch poller in MarketList) refreshes this pda, this component sees
  // it without waiting for its own next interval to fire.
  useEffect(() => {
    if (!marketPda) return
    const cached = marketStateCache.get(marketPda)
    if (cached !== undefined) setState(cached)
    return subscribeMarketState(marketPda, setState)
  }, [marketPda])

  useEffect(() => {
    if (!marketPda) {
      setState(null)
      lastPdaRef.current = null
      return
    }

    lastPdaRef.current = marketPda
    let cancelled = false

    const pubkey = (() => {
      try { return new PublicKey(marketPda) } catch { return null }
    })()

    if (!pubkey) {
      setState(null)
      return
    }

    const fetchOnce = async () => {
      try {
        const info = await connection.getAccountInfo(pubkey, 'confirmed')
        if (cancelled || lastPdaRef.current !== marketPda) return
        if (!info) {
          publishMarketState(marketPda, null)
          return
        }
        const decoded = decodeMarket(info.data)
        publishMarketState(marketPda, {
          totalYes: decoded.totalYes,
          totalNo: decoded.totalNo,
          resolved: decoded.resolved,
          outcomeYes: decoded.resolved ? decoded.outcomeYes : null,
          baselinePrice: decoded.baselinePrice ?? null,
          finalPrice: decoded.resolved ? decoded.finalPrice : null,
        })
      } catch {
        // Network hiccup or layout mismatch — keep the last value.
      }
    }

    void fetchOnce()
    const id = window.setInterval(fetchOnce, MARKET_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [marketPda, connection])

  return state
}

// ── useRecentBets ───────────────────────────────────────────────────────

interface RecentBetDTO {
  signature: string
  owner: string
  side: 'yes' | 'no'
  amount: string
  slot: string
  blockTime: number | null
}

const BETS_POLL_MS = 20_000

export function useRecentBets(marketPda: string | null): RecentBet[] {
  const [bets, setBets] = useState<RecentBet[]>([])

  useEffect(() => {
    if (!marketPda) {
      setBets([])
      return
    }

    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/markets/${marketPda}/bets`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const payload = (await res.json()) as { bets?: RecentBetDTO[] }
        if (cancelled) return
        const next: RecentBet[] = (payload.bets ?? []).map(b => ({
          owner: b.owner,
          side: b.side,
          amount: BigInt(b.amount),
          sig: b.signature,
        }))
        setBets(next)
      } catch {
        // Indexer offline or DB unset — keep showing the last result.
      }
    }

    void fetchOnce()
    const id = window.setInterval(fetchOnce, BETS_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [marketPda])

  return bets
}

// ── usePlaceBet ─────────────────────────────────────────────────────────

export function usePlaceBet(): UsePlaceBetReturn {
  const { publicKey } = useWallet()
  const { enabled: sessionEnabled, sessionPublicKey, signAndSend, refreshSessionBalance } = useSession()
  const stakeMint = useMemo(() => stakeMintFromEnv(), [])

  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeBet = useCallback<UsePlaceBetReturn['placeBet']>(
    async (slot, side, amount) => {
      setError(null)

      if (!publicKey) {
        const msg = 'Wallet not connected.'
        setError(msg)
        throw new Error(msg)
      }
      if (amount <= 0n) {
        const msg = 'Bet amount must be positive.'
        setError(msg)
        throw new Error(msg)
      }
      if (slot.closeTime % 60 !== 0) {
        const msg = 'Slot close time off-grid.'
        setError(msg)
        throw new Error(msg)
      }

      setPlacing(true)
      try {
        const bettor = sessionEnabled && sessionPublicKey
          ? new PublicKey(sessionPublicKey)
          : publicKey

        const { tx } = buildPlaceBetTx(bettor, stakeMint, {
          sourceId: slot.sourceId,
          closeTime: BigInt(slot.closeTime),
          settlementTime: BigInt(slot.settlementTime),
          thresholdBps: slot.thresholdBps,
          side: toProgramSide(side),
          amount,
        })

        const signature = await signAndSend(tx)
        void refreshSessionBalance()

        // Fire-and-forget product analytics. The 'a' / 'b' wire labels
        // outlive the program's Yes/No naming — the markets are PvP
        // pairs, not boolean propositions.
        track('bet_placed', {
          pair_index: slot.pairIndex,
          board: slot.board,
          format: slot.format,
          side: side === 'yes' ? 'a' : 'b',
          amount_raw: amount.toString(),
          amount_display: formatStake(amount, STAKE_DECIMALS_FALLBACK),
          slug_a: slot.slugA,
          slug_b: slot.slugB,
          source_id: slot.sourceId,
          source_name: slot.sourceName,
          market_pda: slot.marketPda,
          close_time: slot.closeTime,
          signature,
          cluster: activeCluster,
        })

        return signature
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e)
        // Normalise the most common program-side rejections to short copy.
        const msg = normaliseError(raw)
        setError(msg)
        throw e instanceof Error ? e : new Error(msg)
      } finally {
        setPlacing(false)
      }
    },
    [publicKey, sessionEnabled, sessionPublicKey, stakeMint, signAndSend, refreshSessionBalance],
  )

  return { placing, error, placeBet }
}

// ── useStakeBalance ─────────────────────────────────────────────────────

const STAKE_BALANCE_POLL_MS = 10_000
const STAKE_DECIMALS_FALLBACK = 6

function formatStake(raw: bigint, decimals: number): string {
  if (raw === 0n) return '0'
  const base = 10n ** BigInt(decimals)
  const whole = raw / base
  const frac = raw % base
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
}

export function useStakeBalance(): StakeBalance {
  const { publicKey, connection } = useWallet()
  const stakeMint = useMemo(() => stakeMintFromEnv(), [])

  const [raw, setRaw] = useState<bigint>(0n)
  const [decimals, setDecimals] = useState<number>(STAKE_DECIMALS_FALLBACK)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Track latest owner so a late RPC response from a previous wallet can't
  // overwrite the current one.
  const lastOwnerRef = useRef<string | null>(null)

  useEffect(() => {
    if (!publicKey) {
      lastOwnerRef.current = null
      setRaw(0n)
      setDecimals(STAKE_DECIMALS_FALLBACK)
      setLoading(false)
      setError(null)
      return
    }

    const owner = publicKey.toBase58()
    lastOwnerRef.current = owner
    let cancelled = false

    const ata = getAssociatedTokenAddressSync(stakeMint, publicKey, true)

    const fetchOnce = async () => {
      try {
        const bal = await connection.getTokenAccountBalance(ata, 'confirmed')
        if (cancelled || lastOwnerRef.current !== owner) return
        setRaw(BigInt(bal.value.amount))
        setDecimals(bal.value.decimals)
        setError(null)
      } catch (e) {
        if (cancelled || lastOwnerRef.current !== owner) return
        const msg = e instanceof Error ? e.message : String(e)
        // ATA not yet created — treat as zero, no error surfaced.
        if (
          msg.includes('could not find account') ||
          msg.includes('Invalid param: could not find account') ||
          msg.includes('AccountNotFound')
        ) {
          setRaw(0n)
          setError(null)
          return
        }
        setError('Failed to read balance.')
      } finally {
        if (!cancelled && lastOwnerRef.current === owner) {
          setLoading(false)
        }
      }
    }

    setLoading(true)
    void fetchOnce()
    const id = window.setInterval(fetchOnce, STAKE_BALANCE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [publicKey, connection, stakeMint])

  const display = useMemo(() => formatStake(raw, decimals), [raw, decimals])

  return { raw, display, decimals, loading, error }
}

// ── Payout multiplier ───────────────────────────────────────────────────

export const FEE_BPS = 50

/**
 * Parimutuel multiplier for the winning side.
 *
 *   multiplier = (totalPool × (10000 − fee_bps) / 10000) ÷ sidePool
 *
 * Returns null when the requested side has zero stake — there is nothing
 * to multiply against. The component shows "—" in that case.
 *
 * Pure math: applies the formula even for one-sided pools. Display
 * layers that want the *realised* multiplier (1.0× refund when the
 * opposite side is empty) should call `realisedMultiplier` instead.
 *
 * Uses Number for the final division: pool sizes never exceed a few
 * million USDC of a 6-decimal token, well inside f64's safe range.
 */
export function payoutMultiplier(
  totalYes: bigint,
  totalNo: bigint,
  side: 'yes' | 'no',
): number | null {
  const totalPool = totalYes + totalNo
  const sidePool = side === 'yes' ? totalYes : totalNo
  if (totalPool === 0n || sidePool === 0n) return null
  const grossPool = Number(totalPool)
  const fee = (grossPool * FEE_BPS) / 10_000
  return (grossPool - fee) / Number(sidePool)
}

/** True iff exactly one side has zero stake. Program refunds 1.0× then. */
export function isOneSided(totalYes: bigint, totalNo: bigint): boolean {
  if (totalYes === 0n && totalNo === 0n) return false
  return totalYes === 0n || totalNo === 0n
}

/**
 * Multiplier the bettor will *actually* receive at current pool sizes.
 *
 * Mirrors `payoutMultiplier` except for one-sided pools: the program
 * refunds rather than applying the parimutuel formula, so showing the
 * fee-discounted 0.995× would lie. Returns 1 there. Returns null when
 * the bettor's own side has zero stake — nothing to multiply against.
 *
 * Use this for live ledgers, position cards, anywhere the number is
 * meant to read as "what your stake becomes". Use `payoutMultiplier`
 * when the math itself is what you want.
 */
export function realisedMultiplier(
  totalYes: bigint,
  totalNo: bigint,
  side: 'yes' | 'no',
): number | null {
  const sidePool = side === 'yes' ? totalYes : totalNo
  if (sidePool === 0n) return null
  if (isOneSided(totalYes, totalNo)) return 1
  return payoutMultiplier(totalYes, totalNo, side)
}

export function formatMultiplier(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '—'
  return `${m.toFixed(2)}×`
}

/**
 * Three-tier yes-side probability, in percent (0–100).
 *
 *  1. Pool-implied — when bets exist on at least one side.
 *  2. Audience baseline — clamped to [15, 85] so a heavy favourite
 *     never reads as "already over". Both sides need a reason.
 *  3. 50/50 — the market admitting it has heard nothing.
 *
 * Used for both the row pill and the sidebar teaser, so the rail and
 * the list can never disagree about who the market thinks is winning.
 */
export function deriveYesPct(
  state: MarketState | null,
  audA: bigint,
  audB: bigint,
): number {
  if (state) {
    const total = state.totalYes + state.totalNo
    if (total > 0n) return Number((state.totalYes * 1000n) / total) / 10
  }
  const totalAud = audA + audB
  if (totalAud > 0n) {
    const raw = Number((audA * 1000n) / totalAud) / 10
    return Math.max(15, Math.min(85, raw))
  }
  return 50
}

/**
 * Convert a yes-side percent (0–100) to a parimutuel decimal odd that
 * mirrors `payoutMultiplier`'s fee accounting. Useful when a teaser has
 * to display odds for an empty pool: the audience-prior pct flows
 * straight through this and out as a number a bettor recognises.
 *
 *   payoutMultiplier = totalPool × (1 − fee) / sidePool
 *                    = (1 − fee) / (sidePool / totalPool)
 *                    = (1 − fee) / (pct / 100)
 *
 * Returns null at pct ≤ 0 or ≥ 100 — no finite odd at the limits.
 */
export function pctToDecimalOdd(pct: number): number | null {
  if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return null
  return ((10_000 - FEE_BPS) / 100) / pct
}

// ── useSourcePrice ──────────────────────────────────────────────────────

const SOURCE_PRICE_POLL_MS = 5_000

interface SourcePriceDTO {
  price?: number | string | null
  ts?: number | null
  error?: string
}

function formatSourcePrice(raw: bigint): string {
  // Tube counts are raw integers, not 1e18-scaled. Render compact units
  // once we cross thousands. Below 1k, show the integer outright.
  const abs = raw < 0n ? -raw : raw
  if (abs < 1_000n) return raw.toString()
  const n = Number(raw)
  if (abs < 1_000_000n) return `${(n / 1_000).toFixed(1)}K`
  if (abs < 1_000_000_000n) return `${(n / 1_000_000).toFixed(1)}M`
  return `${(n / 1_000_000_000).toFixed(2)}B`
}

function toBigIntOrNull(v: number | string | null | undefined): bigint | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    return BigInt(Math.trunc(v))
  }
  // String form — strip a fractional tail if present, the data-node
  // sometimes emits floats.
  const trimmed = v.trim()
  if (!trimmed) return null
  const head = trimmed.split('.')[0]
  if (!/^-?\d+$/.test(head)) return null
  try { return BigInt(head) } catch { return null }
}

export function useSourcePrice(sourceId: number | null): SourcePrice {
  const [raw, setRaw] = useState<bigint | null>(null)
  const [ts, setTs] = useState<number | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [direction, setDirection] = useState<'up' | 'down' | 'flat' | null>(null)
  const [changeBp, setChangeBp] = useState<number | null>(null)

  const prevRawRef = useRef<bigint | null>(null)
  const lastSourceRef = useRef<number | null>(null)

  useEffect(() => {
    if (sourceId == null) {
      setRaw(null)
      setTs(null)
      setLoading(false)
      setDirection(null)
      setChangeBp(null)
      prevRawRef.current = null
      lastSourceRef.current = null
      return
    }

    // Reset prev-raw whenever the source id changes — a delta against a
    // different source is meaningless.
    if (lastSourceRef.current !== sourceId) {
      prevRawRef.current = null
      lastSourceRef.current = sourceId
      setLoading(true)
      setDirection(null)
      setChangeBp(null)
    }

    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/sources/${sourceId}/price`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const payload = (await res.json()) as SourcePriceDTO
        if (cancelled || lastSourceRef.current !== sourceId) return

        const next = toBigIntOrNull(payload.price ?? null)
        const prev = prevRawRef.current

        // Compute direction + bp delta against the previous tick.
        if (next === null) {
          // Nothing to compare — leave direction as-is for now.
        } else if (prev === null) {
          setDirection(null)
          setChangeBp(null)
        } else if (next > prev) {
          setDirection('up')
          setChangeBp(prev === 0n ? null : Number(((next - prev) * 10_000n) / prev))
        } else if (next < prev) {
          setDirection('down')
          setChangeBp(prev === 0n ? null : -Number(((prev - next) * 10_000n) / prev))
        } else {
          setDirection('flat')
          setChangeBp(0)
        }

        if (next !== null) prevRawRef.current = next
        setRaw(next)
        setTs(typeof payload.ts === 'number' ? payload.ts : null)
      } catch {
        // Silent — the UI degrades gracefully.
      } finally {
        if (!cancelled && lastSourceRef.current === sourceId) {
          setLoading(false)
        }
      }
    }

    void fetchOnce()
    const id = window.setInterval(fetchOnce, SOURCE_PRICE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [sourceId])

  const display = useMemo(() => (raw === null ? '' : formatSourcePrice(raw)), [raw])

  return { raw, display, ts, loading, direction, changeBp }
}

// ── useSourceHistory ────────────────────────────────────────────────────

export interface SourceHistoryPoint {
  /** Unix seconds the observation was recorded. */
  ts: number
  /** Source aggregate value, raw integer. */
  raw: bigint
}

export interface UseSourceHistory {
  points: SourceHistoryPoint[]
  /** True only on the very first render — flips false after the seed call. */
  loading: boolean
}

/**
 * Rolling 30-minute history of source observations.
 *
 * On mount: fetches `/api/sources/{id}/history?minutes=30` and seeds the
 * buffer. The data-node may not implement that route yet — the proxy
 * returns `{ points: [] }` in that case and we degrade to live-only.
 *
 * Then: piggybacks on `useSourcePrice` ticks. Each tick with a fresh `ts`
 * pushes a new point. Buffer capped at MAX_POINTS so we don't grow without
 * bound across long sessions.
 */
const HISTORY_MAX_POINTS = 360

interface SourceHistoryDTO {
  points?: Array<{ ts?: number; raw?: number | string }>
}

export function useSourceHistory(sourceId: number | null): UseSourceHistory {
  const live = useSourcePrice(sourceId)
  const [points, setPoints] = useState<SourceHistoryPoint[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const lastTsRef = useRef<number | null>(null)
  const lastSourceRef = useRef<number | null>(null)

  // Seed from the proxy on mount / source change.
  useEffect(() => {
    if (sourceId == null) {
      setPoints([])
      setLoading(false)
      lastTsRef.current = null
      lastSourceRef.current = null
      return
    }

    if (lastSourceRef.current !== sourceId) {
      setPoints([])
      lastTsRef.current = null
      lastSourceRef.current = sourceId
      setLoading(true)
    }

    let cancelled = false

    const seed = async () => {
      try {
        const res = await fetch(`/api/sources/${sourceId}/history?minutes=30`, {
          cache: 'no-store',
        })
        if (cancelled || lastSourceRef.current !== sourceId) return
        if (!res.ok) {
          setLoading(false)
          return
        }
        const payload = (await res.json()) as SourceHistoryDTO
        if (cancelled || lastSourceRef.current !== sourceId) return
        const parsed: SourceHistoryPoint[] = []
        for (const p of payload.points ?? []) {
          if (typeof p.ts !== 'number') continue
          const raw = toBigIntOrNull(p.raw ?? null)
          if (raw === null) continue
          parsed.push({ ts: p.ts, raw })
        }
        // Keep oldest-first, trim to cap.
        parsed.sort((a, b) => a.ts - b.ts)
        const seeded = parsed.slice(-HISTORY_MAX_POINTS)
        setPoints(seeded)
        lastTsRef.current = seeded.length > 0 ? seeded[seeded.length - 1]!.ts : null
      } catch {
        // Silent — empty buffer is acceptable.
      } finally {
        if (!cancelled && lastSourceRef.current === sourceId) {
          setLoading(false)
        }
      }
    }

    void seed()
    return () => { cancelled = true }
  }, [sourceId])

  // Append fresh ticks from useSourcePrice.
  useEffect(() => {
    if (sourceId == null) return
    if (live.raw === null || live.ts === null) return
    if (lastTsRef.current !== null && live.ts <= lastTsRef.current) return
    lastTsRef.current = live.ts
    const next: SourceHistoryPoint = { ts: live.ts, raw: live.raw }
    setPoints(prev => {
      const merged = [...prev, next]
      return merged.length > HISTORY_MAX_POINTS
        ? merged.slice(-HISTORY_MAX_POINTS)
        : merged
    })
  }, [sourceId, live.raw, live.ts])

  return { points, loading }
}

// ── usePairScore / usePairHistory ───────────────────────────────────────
//
// The site-aggregate trend is the wrong shape for a head-to-head ticket.
// What the chain settles on is the per-pair signed score: F1 → Δ_A − Δ_B,
// F2 → value_A − value_B. Positive favours A, negative favours B.

const PAIR_PRICE_POLL_MS = 5_000
const PAIR_HISTORY_POLL_MS = 30_000
const PAIR_HISTORY_MAX_POINTS = 360

interface PairPriceDTO {
  score?: number | string | null
  deltaA?: number | string | null
  deltaB?: number | string | null
  valueA?: number | string | null
  valueB?: number | string | null
  missing?: Array<'a' | 'b'> | null
  ts?: number | null
  error?: string
}

export interface PairScore {
  score: bigint | null
  deltaA: bigint | null
  deltaB: bigint | null
  valueA: bigint | null
  valueB: bigint | null
  missing: Array<'a' | 'b'>
  ts: number | null
  loading: boolean
  direction: 'up' | 'down' | 'flat' | null
}

export function usePairScore(pairIndex: number | null): PairScore {
  const [score, setScore] = useState<bigint | null>(null)
  const [deltaA, setDeltaA] = useState<bigint | null>(null)
  const [deltaB, setDeltaB] = useState<bigint | null>(null)
  const [valueA, setValueA] = useState<bigint | null>(null)
  const [valueB, setValueB] = useState<bigint | null>(null)
  const [missing, setMissing] = useState<Array<'a' | 'b'>>([])
  const [ts, setTs] = useState<number | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [direction, setDirection] = useState<'up' | 'down' | 'flat' | null>(null)

  const prevScoreRef = useRef<bigint | null>(null)
  const lastPairRef = useRef<number | null>(null)

  useEffect(() => {
    if (pairIndex == null) {
      setScore(null)
      setDeltaA(null)
      setDeltaB(null)
      setValueA(null)
      setValueB(null)
      setMissing([])
      setTs(null)
      setLoading(false)
      setDirection(null)
      prevScoreRef.current = null
      lastPairRef.current = null
      return
    }

    if (lastPairRef.current !== pairIndex) {
      prevScoreRef.current = null
      lastPairRef.current = pairIndex
      setLoading(true)
      setDirection(null)
    }

    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/pairs/${pairIndex}/price`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const payload = (await res.json()) as PairPriceDTO
        if (cancelled || lastPairRef.current !== pairIndex) return

        const nextScore = toBigIntOrNull(payload.score ?? null)
        const prev = prevScoreRef.current

        if (nextScore === null) {
          // Hold direction — nothing to compare against.
        } else if (prev === null) {
          setDirection(null)
        } else if (nextScore > prev) {
          setDirection('up')
        } else if (nextScore < prev) {
          setDirection('down')
        } else {
          setDirection('flat')
        }

        if (nextScore !== null) prevScoreRef.current = nextScore

        setScore(nextScore)
        setDeltaA(toBigIntOrNull(payload.deltaA ?? null))
        setDeltaB(toBigIntOrNull(payload.deltaB ?? null))
        setValueA(toBigIntOrNull(payload.valueA ?? null))
        setValueB(toBigIntOrNull(payload.valueB ?? null))
        setMissing(Array.isArray(payload.missing) ? payload.missing : [])
        setTs(typeof payload.ts === 'number' ? payload.ts : null)
      } catch {
        // Silent — UI degrades to a dash.
      } finally {
        if (!cancelled && lastPairRef.current === pairIndex) {
          setLoading(false)
        }
      }
    }

    void fetchOnce()
    const id = window.setInterval(fetchOnce, PAIR_PRICE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pairIndex])

  return { score, deltaA, deltaB, valueA, valueB, missing, ts, loading, direction }
}

export interface PairHistoryPoint {
  /** Unix seconds. */
  ts: number
  /** Signed pair score. Positive → A wins. */
  score: bigint
}

export interface UsePairHistory {
  points: PairHistoryPoint[]
  /** True only on the very first render — flips false after the seed call. */
  loading: boolean
}

interface PairHistoryDTO {
  points?: Array<{ ts?: number; score?: number | string }>
}

/**
 * Bucketed pair signed-score history. The data-node returns the series
 * already pre-bucketed; we don't append client-side (as we do for
 * `useSourceHistory`), we just re-fetch on a poll.
 */
export function usePairHistory(
  pairIndex: number | null,
  minutes: number = 30,
): UsePairHistory {
  const [points, setPoints] = useState<PairHistoryPoint[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const lastPairRef = useRef<number | null>(null)

  useEffect(() => {
    if (pairIndex == null) {
      setPoints([])
      setLoading(false)
      lastPairRef.current = null
      return
    }

    if (lastPairRef.current !== pairIndex) {
      setPoints([])
      lastPairRef.current = pairIndex
      setLoading(true)
    }

    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch(
          `/api/pairs/${pairIndex}/history?minutes=${minutes}`,
          { cache: 'no-store' },
        )
        if (cancelled || lastPairRef.current !== pairIndex) return
        if (!res.ok) {
          return
        }
        const payload = (await res.json()) as PairHistoryDTO
        if (cancelled || lastPairRef.current !== pairIndex) return

        const parsed: PairHistoryPoint[] = []
        for (const p of payload.points ?? []) {
          if (typeof p.ts !== 'number') continue
          const score = toBigIntOrNull(p.score ?? null)
          if (score === null) continue
          parsed.push({ ts: p.ts, score })
        }
        parsed.sort((a, b) => a.ts - b.ts)
        const capped =
          parsed.length > PAIR_HISTORY_MAX_POINTS
            ? parsed.slice(-PAIR_HISTORY_MAX_POINTS)
            : parsed
        setPoints(capped)
      } catch {
        // Silent — empty buffer is acceptable.
      } finally {
        if (!cancelled && lastPairRef.current === pairIndex) {
          setLoading(false)
        }
      }
    }

    void fetchOnce()
    const id = window.setInterval(fetchOnce, PAIR_HISTORY_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pairIndex, minutes])

  return { points, loading }
}

/** Comma-grouped, signed, with the proper unicode minus for symmetry. */
export function formatPairScore(score: bigint | null): string {
  if (score === null) return '—'
  if (score === 0n) return '0'
  const abs = score < 0n ? -score : score
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return score < 0n ? `−${grouped}` : `+${grouped}`
}

// ── useMarketStatesBatch ────────────────────────────────────────────────

const MARKET_BATCH_POLL_MS = 30_000
const MARKET_BATCH_CHUNK = 100

export type MarketStateMap = Record<string, MarketState | null>

function chunked<T>(xs: readonly T[], size: number): T[][] {
  if (size <= 0) return [xs.slice()]
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

export function useMarketStatesBatch(pdas: readonly string[]): MarketStateMap {
  const { connection } = useWallet()
  const [states, setStates] = useState<MarketStateMap>({})

  // A stable key for the input so we only refetch when the *set* changes.
  // Sorting is intentional — the upstream component may re-order without
  // changing membership.
  const key = useMemo(() => {
    const valid = pdas.filter(p => typeof p === 'string' && p.length > 0)
    return valid.slice().sort().join(',')
  }, [pdas])

  useEffect(() => {
    if (!key) {
      setStates({})
      return
    }

    const list = key.split(',')
    let cancelled = false

    const fetchAll = async () => {
      try {
        const pubkeys: PublicKey[] = []
        const labels: string[] = []
        for (const p of list) {
          try {
            pubkeys.push(new PublicKey(p))
            labels.push(p)
          } catch {
            // Skip malformed entries silently.
          }
        }

        const next: MarketStateMap = {}
        let cursor = 0
        for (const group of chunked(pubkeys, MARKET_BATCH_CHUNK)) {
          const infos = await connection.getMultipleAccountsInfo(group, 'confirmed')
          if (cancelled) return
          infos.forEach((info, i) => {
            const label = labels[cursor + i]
            if (!info) {
              next[label] = null
              return
            }
            try {
              const decoded = decodeMarket(info.data)
              next[label] = {
                totalYes: decoded.totalYes,
                totalNo: decoded.totalNo,
                resolved: decoded.resolved,
                outcomeYes: decoded.resolved ? decoded.outcomeYes : null,
                baselinePrice: decoded.baselinePrice ?? null,
                finalPrice: decoded.resolved ? decoded.finalPrice : null,
              }
            } catch {
              next[label] = null
            }
          })
          cursor += group.length
        }

        if (cancelled) return
        // Publish each decoded entry to the shared cache so siblings
        // (BetTicket, BetSheet, anything calling useMarketState on the
        // same pda) observe the same snapshot the row pill does.
        for (const k of list) {
          publishMarketState(k, next[k] ?? null)
        }
        setStates(prev => {
          // Merge: keep any keys still in the current set, drop the rest.
          const merged: MarketStateMap = {}
          for (const k of list) {
            merged[k] = next[k] ?? prev[k] ?? null
          }
          return merged
        })
      } catch {
        // Network blip — keep the last snapshot.
      }
    }

    void fetchAll()
    const id = window.setInterval(fetchAll, MARKET_BATCH_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [key, connection])

  return states
}

function normaliseError(raw: string): string {
  // Map common Anchor / SPL errors to the project's voice. Surface the
  // raw message under the hood — useful for debugging — but show this to
  // the user.
  const lower = raw.toLowerCase()
  if (lower.includes('window closed') || lower.includes('windowclosed')) return 'Market window already closed.'
  if (lower.includes('window open') || lower.includes('windowopen')) return 'Market window not yet open.'
  if (lower.includes('source disabled') || lower.includes('sourcedisabled')) return 'Source disabled on chain.'
  if (lower.includes('paused')) return 'Program paused by admin.'
  if (lower.includes('insufficient')) return 'Insufficient stake balance.'
  if (lower.includes('bad threshold') || lower.includes('badthreshold')) return 'Threshold rejected by program.'
  if (lower.includes('bad time') || lower.includes('badtime')) return 'Time window rejected by program.'
  if (lower.includes('user rejected')) return 'Signature declined.'
  return 'Bet rejected by program.'
}

// ── useResolvedSlots ────────────────────────────────────────────────────
//
// The forward-only `useUpcomingSlots` cannot answer "show me what already
// settled" — it walks the cohort grid into the future and stops. Resolved
// markets are stored in the indexer; this hook fetches them, reconstructs
// the same `UpcomingSlot` shape the rest of the UI expects (catalog
// metadata threaded through `threshold_bps == pairIndex`), and pairs each
// row with a synthetic `MarketState` so the row renders the actual
// outcome instead of a 50/50 fallback.

const RESOLVED_POLL_MS = 60_000
const RESOLVED_DEFAULT_LIMIT = 60

interface ResolvedMarketDTO {
  market: string
  sourceId: number
  closeTime: number
  settlementTime: number
  thresholdBps: number
  outcomeYes: boolean
  baselinePrice: string
  finalPrice: string
  resolvedAt: number | null
  totalYes: string
  totalNo: string
}

export interface ResolvedSlotsResult {
  slots: UpcomingSlot[]
  states: MarketStateMap
  loading: boolean
}

function safeBigInt(s: string | null | undefined): bigint {
  if (!s) return 0n
  try { return BigInt(s) } catch { return 0n }
}

export interface SettlingSlotsResult {
  slots: UpcomingSlot[]
  states: MarketStateMap
  loading: boolean
}

interface SettlingMarketDTO {
  market: string
  sourceId: number
  closeTime: number
  settlementTime: number
  thresholdBps: number
  totalYes: string
  totalNo: string
}

const SETTLING_POLL_MS = 60_000
const SETTLING_DEFAULT_LIMIT = 60

/**
 * Markets in purgatory: bet window has closed, oracle has not yet paid out.
 *
 * Same shape contract as `useResolvedSlots` — synthesises an `UpcomingSlot`
 * per indexer row by routing `threshold_bps` back through the catalog, and
 * pairs each row with a `MarketState` whose `resolved=false` so the row
 * still renders the in-flight pool distribution.
 */
export function useSettlingSlots(opts?: {
  limit?: number
  board?: Board | 'all'
}): SettlingSlotsResult {
  const limit = opts?.limit ?? SETTLING_DEFAULT_LIMIT
  const board = opts?.board ?? 'all'

  const [slots, setSlots] = useState<UpcomingSlot[]>([])
  const [states, setStates] = useState<MarketStateMap>({})
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/markets/settling?limit=${limit}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const payload = (await res.json()) as { markets?: SettlingMarketDTO[] }
        if (cancelled) return

        const nextSlots: UpcomingSlot[] = []
        const nextStates: MarketStateMap = {}

        for (const m of payload.markets ?? []) {
          const entry = getCatalogEntryByPairIndex(m.thresholdBps)
          if (!entry) continue
          if (board !== 'all' && entry.board !== board) continue

          nextSlots.push({
            catalogId: entry.id,
            sourceId: entry.sourceId,
            sourceName: entry.sourceName,
            label: entry.label,
            description: entry.description,
            hook: entry.hook,
            thresholdBps: entry.thresholdBps,
            pairIndex: entry.pairIndex,
            board: entry.board,
            format: entry.format,
            displayA: entry.displayA,
            displayB: entry.displayB,
            slugA: entry.slugA,
            slugB: entry.slugB,
            audienceA: entry.audienceA,
            audienceB: entry.audienceB,
            windowSecs: entry.windowSecs,
            closeTime: m.closeTime,
            settlementTime: m.settlementTime,
            marketPda: m.market,
          })

          nextStates[m.market] = {
            totalYes: safeBigInt(m.totalYes),
            totalNo: safeBigInt(m.totalNo),
            resolved: false,
            outcomeYes: null,
            baselinePrice: null,
            finalPrice: null,
          }
        }

        setSlots(nextSlots)
        setStates(nextStates)
      } catch {
        // Indexer offline or DB unset — keep last snapshot.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setLoading(true)
    void fetchOnce()
    const id = window.setInterval(fetchOnce, SETTLING_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [limit, board])

  return { slots, states, loading }
}

export function useResolvedSlots(opts?: {
  limit?: number
  board?: Board | 'all'
}): ResolvedSlotsResult {
  const limit = opts?.limit ?? RESOLVED_DEFAULT_LIMIT
  const board = opts?.board ?? 'all'

  const [slots, setSlots] = useState<UpcomingSlot[]>([])
  const [states, setStates] = useState<MarketStateMap>({})
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/markets/resolved?limit=${limit}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const payload = (await res.json()) as { markets?: ResolvedMarketDTO[] }
        if (cancelled) return

        const nextSlots: UpcomingSlot[] = []
        const nextStates: MarketStateMap = {}

        for (const m of payload.markets ?? []) {
          const entry = getCatalogEntryByPairIndex(m.thresholdBps)
          if (!entry) continue
          if (board !== 'all' && entry.board !== board) continue

          nextSlots.push({
            catalogId: entry.id,
            sourceId: entry.sourceId,
            sourceName: entry.sourceName,
            label: entry.label,
            description: entry.description,
            hook: entry.hook,
            thresholdBps: entry.thresholdBps,
            pairIndex: entry.pairIndex,
            board: entry.board,
            format: entry.format,
            displayA: entry.displayA,
            displayB: entry.displayB,
            slugA: entry.slugA,
            slugB: entry.slugB,
            audienceA: entry.audienceA,
            audienceB: entry.audienceB,
            windowSecs: entry.windowSecs,
            closeTime: m.closeTime,
            settlementTime: m.settlementTime,
            marketPda: m.market,
          })

          nextStates[m.market] = {
            totalYes: safeBigInt(m.totalYes),
            totalNo: safeBigInt(m.totalNo),
            resolved: true,
            outcomeYes: m.outcomeYes,
            baselinePrice: safeBigInt(m.baselinePrice),
            finalPrice: safeBigInt(m.finalPrice),
          }
        }

        setSlots(nextSlots)
        setStates(nextStates)
      } catch {
        // Indexer offline or DB unset — keep last snapshot.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setLoading(true)
    void fetchOnce()
    const id = window.setInterval(fetchOnce, RESOLVED_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [limit, board])

  return { slots, states, loading }
}
