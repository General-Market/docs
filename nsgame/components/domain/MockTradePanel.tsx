'use client'

import { useState } from 'react'
import { useSession } from '@/lib/solana/SessionContext'
import { useWallet } from '@/hooks/useWallet'
import { useMockMarket } from '@/hooks/useMockMarket'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { truncateAddress } from '@/lib/utils/address'

// Self-contained demo of the session wallet flow:
//
//   - Connect a Solana wallet (if not connected already).
//   - Enable 1-click: one signature funds the session with 0.05 SOL.
//   - Place bets with zero popups until the SOL is drained or the user
//     disables the session.
//
// Every bet is a real devnet transaction. The market logic is fake; the
// on-chain signature flow is not.

const DEFAULT_SESSION_SOL = 0.05
const BET_AMOUNTS_SOL = [0.001, 0.01, 0.05]

export function MockTradePanel() {
  const { connected, address, cluster } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()
  const session = useSession()
  const market = useMockMarket()
  const [selectedAmount, setSelectedAmount] = useState(BET_AMOUNTS_SOL[0])
  const [error, setError] = useState<string | null>(null)

  const handleConnect = () => setShowModal(true)

  const handleEnable = async () => {
    setError(null)
    try {
      await session.enable({ solFunding: DEFAULT_SESSION_SOL }, { durationMs: 60 * 60 * 1000 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDisable = async () => {
    setError(null)
    try {
      await session.disable()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleBet = async (marketId: string, outcomeId: string) => {
    setError(null)
    try {
      await market.placeBet(marketId, outcomeId, selectedAmount)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-baseline justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mock market</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Devnet. Real on-chain SOL transfers. Fake odds.
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-1 rounded bg-zinc-100 text-zinc-700">
          {cluster}
        </span>
      </header>

      {/* Connection + session status bar */}
      <div className="flex items-center gap-3 p-4 border border-zinc-200 rounded-lg bg-white">
        {!connected ? (
          <>
            <span className="flex-1 text-sm text-zinc-600">Wallet not connected.</span>
            <button
              onClick={handleConnect}
              className="px-4 h-9 text-sm font-medium bg-black text-white rounded hover:bg-zinc-800 transition-colors"
            >
              Connect
            </button>
          </>
        ) : session.enabled ? (
          <>
            <span className={`inline-block w-2 h-2 rounded-full bg-emerald-400`} />
            <div className="flex-1">
              <div className="text-sm font-medium">1-click is on</div>
              <div className="text-xs text-zinc-500 font-mono">
                session: {session.sessionPublicKey ? truncateAddress(session.sessionPublicKey) : '—'} · you: {address ? truncateAddress(address) : '—'}
              </div>
            </div>
            <button
              onClick={handleDisable}
              disabled={session.disabling}
              className="px-3 h-9 text-sm border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-50 transition-colors"
            >
              {session.disabling ? 'Disabling…' : 'Disable'}
            </button>
          </>
        ) : (
          <>
            <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" />
            <div className="flex-1">
              <div className="text-sm font-medium">1-click is off</div>
              <div className="text-xs text-zinc-500">
                Enabling will move {DEFAULT_SESSION_SOL} SOL into a session key.
              </div>
            </div>
            <button
              onClick={handleEnable}
              disabled={session.enabling}
              className="px-4 h-9 text-sm font-medium bg-black text-white rounded hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {session.enabling ? 'Enabling…' : 'Enable 1-click'}
            </button>
          </>
        )}
      </div>

      {/* Amount selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600">Bet size:</span>
        {BET_AMOUNTS_SOL.map(amt => (
          <button
            key={amt}
            onClick={() => setSelectedAmount(amt)}
            className={`px-3 h-8 text-sm rounded font-mono transition-colors ${
              selectedAmount === amt
                ? 'bg-black text-white'
                : 'bg-white border border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            {amt} SOL
          </button>
        ))}
      </div>

      {/* Markets */}
      <div className="space-y-3">
        {market.markets.map(m => (
          <div
            key={m.id}
            className="p-4 border border-zinc-200 rounded-lg bg-white"
          >
            <div className="text-sm font-medium mb-3">{m.question}</div>
            <div className="flex gap-2">
              {m.outcomes.map(o => (
                <button
                  key={o.id}
                  onClick={() => handleBet(m.id, o.id)}
                  disabled={!connected || market.placing}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    o.id === 'yes'
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span>{o.label}</span>
                    <span className="font-mono text-xs opacity-70">
                      {(o.impliedOdds * 100).toFixed(0)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Errors */}
      {error && (
        <div className="p-3 border border-rose-200 bg-rose-50 text-rose-800 text-sm rounded">
          {error}
        </div>
      )}

      {/* Bet history */}
      {market.bets.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700">Bets this session</h2>
          <div className="space-y-1">
            {market.bets.map(b => (
              <a
                key={b.signature}
                href={`https://solscan.io/tx/${b.signature}?cluster=${cluster === 'mainnet-beta' ? '' : cluster}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded hover:bg-zinc-50 border border-zinc-100 text-xs font-mono"
              >
                <span>{b.marketId} → {b.outcomeId}</span>
                <span>{b.amountSol} SOL</span>
                <span className="text-zinc-400">{truncateAddress(b.signature)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
