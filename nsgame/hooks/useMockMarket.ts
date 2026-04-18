'use client'

import { useCallback, useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useSession } from '@/lib/solana/SessionContext'
import { useWallet } from '@/hooks/useWallet'
import { MOCK_MARKETS, type MockBet } from '@/lib/solana/mockMarket'
import {
  buildCreateMarketTx,
  buildPlaceBetTx,
  buildRedeemTx,
  buildResolveMarketTx,
  deriveMarketPda,
  fetchBetsForBettor,
  fetchMarket,
  type MarketAccount,
  type BetAccount,
} from '@/lib/solana/nsMarketProgram'
import { getExplorerTxUrl } from '@/lib/solana/cluster'

// React bridge for the ns-market program on devnet. Exposes markets, the
// bet/seed/resolve/redeem actions, and a chain-backed bet history.

function outcomeToId(outcomeId: string): 0 | 1 {
  return outcomeId === 'yes' ? 0 : 1
}

export interface OnChainBet {
  pda: string
  bettor: string
  market: string
  marketId: string | null
  outcome: number
  amount: bigint
  timestamp: bigint
  redeemed: boolean
}

export function useMockMarket() {
  const { enabled: sessionEnabled, sessionPublicKey, signAndSend } = useSession()
  const { publicKey, address, signAndSendTransaction, connection } = useWallet()

  const [marketStates, setMarketStates] = useState<Record<string, MarketAccount | null>>({})
  const [onChainBets, setOnChainBets] = useState<OnChainBet[]>([])
  const [recentBets, setRecentBets] = useState<MockBet[]>([])
  const [placing, setPlacing] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  // Persist recentBets to localStorage, keyed by main wallet pubkey, so
  // redeem still works after a reload. Only bet metadata (nonce + PDA)
  // lands on disk — the session keypair itself stays in memory.
  const storageKey = address ? `nsmarket:recent-bets:${address}` : null
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setRecentBets([])
      return
    }
    const raw = window.localStorage.getItem(storageKey)
    if (raw) {
      try {
        setRecentBets(JSON.parse(raw) as MockBet[])
      } catch {
        setRecentBets([])
      }
    } else {
      setRecentBets([])
    }
  }, [storageKey])

  const persistRecentBets = useCallback(
    (updater: (prev: MockBet[]) => MockBet[]) => {
      setRecentBets(prev => {
        const next = updater(prev)
        if (storageKey && typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, JSON.stringify(next))
        }
        return next
      })
    },
    [storageKey],
  )

  // Pull the on-chain state for every mock market. Runs once on mount and
  // again after any write that might have mutated state.
  const refreshMarkets = useCallback(async () => {
    const entries = await Promise.all(
      MOCK_MARKETS.map(async m => [m.id, await fetchMarket(connection, m.id)] as const),
    )
    setMarketStates(Object.fromEntries(entries))
  }, [connection])

  const refreshBets = useCallback(async () => {
    // Aggregate bets across both the main wallet and the active session key
    // so the history is contiguous when the user toggles session on/off.
    const keys: PublicKey[] = []
    if (publicKey) keys.push(publicKey)
    if (sessionPublicKey) keys.push(new PublicKey(sessionPublicKey))
    if (keys.length === 0) {
      setOnChainBets([])
      return
    }
    const results = await Promise.all(keys.map(k => fetchBetsForBettor(connection, k)))
    const marketIdByPda: Record<string, string> = {}
    for (const [id, state] of Object.entries(marketStates)) {
      if (state) marketIdByPda[deriveMarketPda(id)[0].toBase58()] = id
    }
    const flat: OnChainBet[] = results
      .flat()
      .map(({ pda, data }) => ({
        pda: pda.toBase58(),
        bettor: data.bettor.toBase58(),
        market: data.market.toBase58(),
        marketId: marketIdByPda[data.market.toBase58()] ?? null,
        outcome: data.outcome,
        amount: data.amount,
        timestamp: data.timestamp,
        redeemed: data.redeemed,
      }))
      .sort((a, b) => Number(b.timestamp - a.timestamp))
    setOnChainBets(flat)
  }, [connection, publicKey, sessionPublicKey, marketStates])

  useEffect(() => { void refreshMarkets() }, [refreshMarkets])
  useEffect(() => { void refreshBets() }, [refreshBets])

  // Seeds any missing markets on chain. Uses the MAIN wallet — whoever
  // clicks becomes the market authority and can later resolve. Runs per
  // market so a partial failure does not block the rest.
  const seedMarkets = useCallback(async () => {
    if (!publicKey) throw new Error('Connect a wallet first')
    setSeeding(true)
    setLastError(null)
    const results: Array<{ id: string; created: boolean; signature?: string; error?: string }> = []
    try {
      for (const m of MOCK_MARKETS) {
        const existing = await fetchMarket(connection, m.id)
        if (existing) {
          results.push({ id: m.id, created: false })
          continue
        }
        try {
          const { tx } = buildCreateMarketTx(publicKey, m.id, m.question)
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
          tx.recentBlockhash = blockhash
          tx.feePayer = publicKey
          const signature = await signAndSendTransaction(tx)
          await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
          results.push({ id: m.id, created: true, signature })
        } catch (e) {
          results.push({ id: m.id, created: false, error: e instanceof Error ? e.message : String(e) })
        }
      }
      await refreshMarkets()
    } finally {
      setSeeding(false)
    }
    return results
  }, [publicKey, signAndSendTransaction, connection, refreshMarkets])

  const placeBet = useCallback(
    async (marketId: string, outcomeId: string, amountSol: number) => {
      if (!publicKey || !address) throw new Error('Connect a wallet first')
      setPlacing(true)
      setLastError(null)
      try {
        const bettorKey = sessionEnabled && sessionPublicKey
          ? new PublicKey(sessionPublicKey)
          : publicKey

        const { tx, betPda, nonce } = buildPlaceBetTx(
          bettorKey,
          marketId,
          outcomeToId(outcomeId),
          amountSol,
        )
        const signature = await signAndSend(tx)

        const bet: MockBet = {
          signature,
          marketId,
          outcomeId,
          amountSol,
          timestamp: Date.now(),
          bettor: bettorKey.toBase58(),
          nonce: nonce.toString(),
          betPda: betPda.toBase58(),
        }
        persistRecentBets(prev => [bet, ...prev])
        // Refresh chain state in the background — don't block the UI on it.
        void refreshMarkets()
        void refreshBets()
        return {
          signature,
          explorerUrl: getExplorerTxUrl(signature),
          betPda: betPda.toBase58(),
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setLastError(msg)
        throw e
      } finally {
        setPlacing(false)
      }
    },
    [publicKey, address, sessionEnabled, sessionPublicKey, signAndSend, refreshMarkets, refreshBets, persistRecentBets],
  )

  const resolveMarket = useCallback(
    async (marketId: string, winningOutcomeId: string) => {
      if (!publicKey) throw new Error('Connect a wallet first')
      setLastError(null)
      const { tx } = buildResolveMarketTx(publicKey, marketId, outcomeToId(winningOutcomeId))
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = publicKey
      const signature = await signAndSendTransaction(tx)
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      await refreshMarkets()
      return { signature, explorerUrl: getExplorerTxUrl(signature) }
    },
    [publicKey, signAndSendTransaction, connection, refreshMarkets],
  )

  // Redeem requires the nonce used at bet time — it's part of the PDA seed
  // and can't be recovered from chain. We store it in `recentBets` when
  // placing; callers pass the local MockBet record in.
  const redeemBet = useCallback(
    async (bet: MockBet) => {
      if (!publicKey) throw new Error('Connect a wallet first')
      setLastError(null)

      const bettorKey = new PublicKey(bet.bettor)
      const [marketPda] = deriveMarketPda(bet.marketId)
      const nonce = BigInt(bet.nonce)
      const { tx } = buildRedeemTx(bettorKey, marketPda, nonce)

      // Whoever is the bettor must sign. If the session key placed the bet
      // and is still live, the session signs; otherwise fall through to
      // the main wallet. signAndSend handles that routing.
      const signature = await signAndSend(tx)
      // Clear the Redeem button on the local record so the UI stays honest
      // even before the chain refresh lands. Chain state catches up on the
      // next refresh anyway.
      persistRecentBets(prev =>
        prev.map(b => (b.signature === bet.signature ? { ...b, redeemed: true } : b)),
      )
      await refreshMarkets()
      await refreshBets()
      return { signature, explorerUrl: getExplorerTxUrl(signature) }
    },
    [publicKey, signAndSend, refreshMarkets, refreshBets, persistRecentBets],
  )

  return {
    markets: MOCK_MARKETS,
    marketStates,
    bets: recentBets,
    onChainBets,
    placeBet,
    placing,
    seedMarkets,
    seeding,
    resolveMarket,
    redeemBet,
    refreshMarkets,
    refreshBets,
    lastError,
    sessionActive: sessionEnabled,
  }
}

// Re-exports for consumers that want the raw account shapes.
export type { BetAccount, MarketAccount }

export { buildRedeemTx }
