'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useSession } from '@/lib/solana/SessionContext'
import { useWallet } from '@/hooks/useWallet'
import { getExplorerTxUrl } from '@/lib/solana/cluster'
import {
  buildPlaceBetTx,
  decodeMarket,
  deriveMarketPda,
  fetchMarket,
  fetchPositionsForOwner,
  type MarketAccount,
  type PositionAccount,
} from '@/lib/solana/predictionMarket'
import { CATALOG, resolveWindow, type CatalogEntry } from '@/lib/solana/catalog'
import type { Side } from '@/lib/solana/idl/prediction_market'

// The stake mint the program expects. Placeholder: devnet USDC.
// TODO: resolve from GlobalConfig.stake_mint once the program is live.
const DEVNET_USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')

function stakeMintFromEnv(): PublicKey {
  const override = process.env.NEXT_PUBLIC_PREDICTION_STAKE_MINT
  if (override) {
    try { return new PublicKey(override) } catch { /* fall through */ }
  }
  return DEVNET_USDC_MINT
}

export interface OnChainPosition {
  pda: string
  market: string
  marketSourceId: number | null
  marketThresholdBps: number | null
  yesAmount: bigint
  noAmount: bigint
  claimed: boolean
  // The resolved Market state, if we fetched it. Null for stale rows.
  marketState: MarketAccount | null
}

export interface MarketSummary {
  key: string
  pda: string
  entry: CatalogEntry
  // The latest concrete window these users are likely to join, computed
  // off `now` at the time of snapshot. Reading logic is client-local
  // because Markets exist only after the first bet instantiates them.
  nextCloseTime: bigint
  nextSettlementTime: bigint
  state: MarketAccount | null
}

export function usePredictionMarket() {
  const { publicKey, connection } = useWallet()
  const { enabled: sessionEnabled, sessionPublicKey, signAndSend, refreshSessionBalance } = useSession()

  const stakeMint = useMemo(() => stakeMintFromEnv(), [])

  // Catalog entry the user has selected. Defaults to the first entry.
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(CATALOG[0]?.id ?? '')
  const selectedEntry = useMemo(
    () => CATALOG.find(e => e.id === selectedCatalogId) ?? null,
    [selectedCatalogId],
  )

  // Per-entry snapshot of the next live Market (if instantiated). Refreshed
  // on mount and after any place_bet.
  const [marketStates, setMarketStates] = useState<Record<string, MarketAccount | null>>({})
  const [positions, setPositions] = useState<OnChainPosition[]>([])
  const [placing, setPlacing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  // Build the snapshot of windows the UI would open right now. Markets
  // for future bets are deterministic PDAs — we can look them up before
  // placing the first bet and surface any existing pool totals.
  const computeWindows = useCallback((): Record<string, { closeTime: bigint; settlementTime: bigint }> => {
    const now = Math.floor(Date.now() / 1000)
    const out: Record<string, { closeTime: bigint; settlementTime: bigint }> = {}
    for (const e of CATALOG) out[e.id] = resolveWindow(e, now)
    return out
  }, [])

  const refreshMarkets = useCallback(async () => {
    const windows = computeWindows()
    const pairs = await Promise.all(
      CATALOG.map(async e => {
        const w = windows[e.id]
        const state = await fetchMarket(connection, {
          sourceId: e.sourceId,
          closeTime: w.closeTime,
          settlementTime: w.settlementTime,
          thresholdBps: e.thresholdBps,
        })
        return [e.id, state] as const
      }),
    )
    setMarketStates(Object.fromEntries(pairs))
  }, [connection, computeWindows])

  const refreshPositions = useCallback(async () => {
    const keys: PublicKey[] = []
    if (publicKey) keys.push(publicKey)
    if (sessionPublicKey) keys.push(new PublicKey(sessionPublicKey))
    if (keys.length === 0) {
      setPositions([])
      return
    }

    const resultSets = await Promise.all(keys.map(k => fetchPositionsForOwner(connection, k)))
    const flat = resultSets.flat()
    // Fetch market state for every unique market referenced by a position.
    const marketPdas = Array.from(new Set(flat.map(p => p.data.market.toBase58())))
    const marketInfoPairs = await Promise.all(
      marketPdas.map(async b58 => {
        const info = await connection.getAccountInfo(new PublicKey(b58))
        if (!info) return [b58, null] as const
        try {
          return [b58, decodeMarket(info.data)] as const
        } catch {
          return [b58, null] as const
        }
      }),
    )
    const marketMap: Record<string, MarketAccount | null> = Object.fromEntries(marketInfoPairs)

    const mapped: OnChainPosition[] = flat.map(({ pda, data }) => {
      const m = marketMap[data.market.toBase58()] ?? null
      return {
        pda: pda.toBase58(),
        market: data.market.toBase58(),
        marketSourceId: m?.sourceId ?? null,
        marketThresholdBps: m?.thresholdBps ?? null,
        yesAmount: data.yesAmount,
        noAmount: data.noAmount,
        claimed: data.claimed,
        marketState: m,
      }
    })
    setPositions(mapped)
  }, [connection, publicKey, sessionPublicKey])

  useEffect(() => { void refreshMarkets() }, [refreshMarkets])
  useEffect(() => { void refreshPositions() }, [refreshPositions])

  const placeBet = useCallback(
    async (entryId: string, side: Side, amount: bigint) => {
      if (!publicKey) throw new Error('Connect a wallet first')
      const entry = CATALOG.find(e => e.id === entryId)
      if (!entry) throw new Error(`Unknown catalog entry: ${entryId}`)
      if (amount <= 0n) throw new Error('Amount must be positive')

      setPlacing(true)
      setLastError(null)
      try {
        const bettor = sessionEnabled && sessionPublicKey
          ? new PublicKey(sessionPublicKey)
          : publicKey

        const { closeTime, settlementTime } = resolveWindow(entry, Math.floor(Date.now() / 1000))

        const { tx, marketPda, positionPda } = buildPlaceBetTx(bettor, stakeMint, {
          sourceId: entry.sourceId,
          closeTime,
          settlementTime,
          thresholdBps: entry.thresholdBps,
          side,
          amount,
        })

        const signature = await signAndSend(tx)

        void refreshMarkets()
        void refreshPositions()
        void refreshSessionBalance()

        return {
          signature,
          explorerUrl: getExplorerTxUrl(signature),
          marketPda: marketPda.toBase58(),
          positionPda: positionPda.toBase58(),
          closeTime,
          settlementTime,
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setLastError(msg)
        throw e
      } finally {
        setPlacing(false)
      }
    },
    [publicKey, sessionEnabled, sessionPublicKey, stakeMint, signAndSend, refreshMarkets, refreshPositions, refreshSessionBalance],
  )

  // Summary of each catalog entry with its next-window Market snapshot.
  const markets = useMemo<MarketSummary[]>(() => {
    const windows = computeWindows()
    return CATALOG.map(entry => {
      const w = windows[entry.id]
      const [pda] = deriveMarketPda({
        sourceId: entry.sourceId,
        closeTime: w.closeTime,
        settlementTime: w.settlementTime,
        thresholdBps: entry.thresholdBps,
      })
      return {
        key: entry.id,
        pda: pda.toBase58(),
        entry,
        nextCloseTime: w.closeTime,
        nextSettlementTime: w.settlementTime,
        state: marketStates[entry.id] ?? null,
      }
    })
  }, [computeWindows, marketStates])

  return {
    catalog: CATALOG,
    selectedEntry,
    selectedCatalogId,
    setSelectedCatalogId,
    markets,
    positions,
    placeBet,
    placing,
    lastError,
    sessionActive: sessionEnabled,
    stakeMint,
    refreshMarkets,
    refreshPositions,
  }
}

export type { CatalogEntry, MarketAccount, PositionAccount }
