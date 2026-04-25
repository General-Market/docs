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
import { CATALOG, type CatalogEntry } from './catalog'
import { generateSlots, type UpcomingSlot } from './slots'

// Re-export so consumers can import from a single module.
export type { UpcomingSlot } from './slots'
export type { CatalogEntry } from './catalog'

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
  source?: number | 'all'
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
  const { source = 'all', horizonDays = 7 } = opts ?? {}

  // Pin "now" to a minute boundary and refresh once per minute. Slots
  // themselves are deterministic given (catalog, now) — re-computing more
  // often would just churn references.
  const [nowSecs, setNowSecs] = useState<number>(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const tick = () => setNowSecs(Math.floor(Date.now() / 1000))
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  return useMemo(() => {
    return generateSlots({
      // Hard cap: render the next few slots per catalog entry. The free
      // tier of Helius cannot survive hundreds of getAccountInfo polls
      // every minute. The user can paginate by horizon when we add it.
      maxSlotsPerEntry: 4,
      catalog: CATALOG,
      nowSecs,
      horizonDays,
      programId: PREDICTION_MARKET_PROGRAM_ID,
      source,
    })
  }, [nowSecs, horizonDays, source])
}

// ── useMarketState ──────────────────────────────────────────────────────

// Devnet Helius free tier rate-limits hard at burst > ~50 req/s. With
// dozens of cards calling this hook in parallel, 15s polls would 429 the
// account-info endpoint within the first minute. 60s is enough for a
// market that closes in minutes; the close/resolve cadence is on the
// chain, not on this poll.
const MARKET_POLL_MS = 60_000

export function useMarketState(marketPda: string | null): MarketState | null {
  const { connection } = useWallet()
  const [state, setState] = useState<MarketState | null>(null)

  // Track the last requested pda so we don't write stale results after an
  // address change — pyramid-of-doom prevention.
  const lastPdaRef = useRef<string | null>(null)

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
          setState(null)
          return
        }
        const decoded = decodeMarket(info.data)
        setState({
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

export function formatMultiplier(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '—'
  return `${m.toFixed(2)}×`
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
