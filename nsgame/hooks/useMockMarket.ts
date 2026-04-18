'use client'

import { useCallback, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useSession } from '@/lib/solana/SessionContext'
import { useWallet } from '@/hooks/useWallet'
import { buildBetTx, MOCK_MARKETS, type MockBet } from '@/lib/solana/mockMarket'
import { getExplorerTxUrl } from '@/lib/solana/cluster'

// React bridge for the mock market. Exposes markets, the bet action, and
// a small local history. The session layer decides whether the bet tx
// goes through the main wallet (popup) or the session key (no popup).

export function useMockMarket() {
  const { enabled: sessionEnabled, sessionPublicKey, signAndSend } = useSession()
  const { publicKey, address } = useWallet()
  const [bets, setBets] = useState<MockBet[]>([])
  const [placing, setPlacing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const placeBet = useCallback(
    async (marketId: string, outcomeId: string, amountSol: number) => {
      if (!publicKey || !address) throw new Error('Connect a wallet first')
      setPlacing(true)
      setLastError(null)
      try {
        // When a session is live, the session key is the bettor — it owns
        // the SOL transferred at enable, and signs with no popup. When no
        // session, the main wallet signs and pays from its own balance.
        const bettorKey = sessionEnabled && sessionPublicKey
          ? new PublicKey(sessionPublicKey)
          : publicKey

        const tx = buildBetTx(bettorKey, marketId, outcomeId, amountSol)
        const signature = await signAndSend(tx)

        const bet: MockBet = {
          signature,
          marketId,
          outcomeId,
          amountSol,
          timestamp: Date.now(),
          bettor: bettorKey.toBase58(),
        }
        setBets(prev => [bet, ...prev])
        return { signature, explorerUrl: getExplorerTxUrl(signature) }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setLastError(msg)
        throw e
      } finally {
        setPlacing(false)
      }
    },
    [publicKey, address, sessionEnabled, sessionPublicKey, signAndSend],
  )

  return {
    markets: MOCK_MARKETS,
    bets,
    placeBet,
    placing,
    lastError,
    sessionActive: sessionEnabled,
  }
}
