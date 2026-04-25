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
      catalog: CATALOG,
      nowSecs,
      horizonDays,
      programId: PREDICTION_MARKET_PROGRAM_ID,
      source,
    })
  }, [nowSecs, horizonDays, source])
}

// ── useMarketState ──────────────────────────────────────────────────────

const MARKET_POLL_MS = 15_000

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
