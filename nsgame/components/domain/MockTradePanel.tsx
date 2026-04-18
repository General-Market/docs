'use client'

import { useState } from 'react'
import { useSession } from '@/lib/solana/SessionContext'
import { useWallet } from '@/hooks/useWallet'
import { useMockMarket } from '@/hooks/useMockMarket'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { truncateAddress } from '@/lib/utils/address'
import { getExplorerAddressUrl, getExplorerTxUrl } from '@/lib/solana/cluster'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

// 1-click prediction-market demo. Runs against the ns-market Anchor
// program on devnet. All state — markets, pools, bets — is real.

const DEFAULT_SESSION_SOL = 0.05
const BET_AMOUNTS_SOL = [0.001, 0.01, 0.05]

function lamportsToSol(lamports: bigint): string {
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(4)
}

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
    try { await session.disable() } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  const handleSeed = async () => {
    setError(null)
    try { await market.seedMarkets() } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  const handleBet = async (marketId: string, outcomeId: string) => {
    setError(null)
    try {
      await market.placeBet(marketId, outcomeId, selectedAmount)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleResolve = async (marketId: string, outcomeId: string) => {
    setError(null)
    try {
      await market.resolveMarket(marketId, outcomeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleRedeem = async (bet: (typeof market.bets)[number]) => {
    setError(null)
    try {
      await market.redeemBet(bet)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const allMarketsExist = market.markets.every(m => market.marketStates[m.id])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-baseline justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ns-market demo</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Devnet. Real Anchor program. Parimutuel payouts. Session-wallet 1-click.
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
            >Connect</button>
          </>
        ) : session.enabled ? (
          <>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
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
            >{session.disabling ? 'Disabling…' : 'Disable'}</button>
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
            >{session.enabling ? 'Enabling…' : 'Enable 1-click'}</button>
          </>
        )}
      </div>

      {/* Seed markets — visible only when some are missing on chain */}
      {connected && !allMarketsExist && (
        <div className="flex items-center gap-3 p-4 border border-amber-200 bg-amber-50 rounded-lg">
          <div className="flex-1 text-sm text-amber-900">
            Markets are not yet on chain. Seeding creates them — whoever clicks becomes the resolve authority.
          </div>
          <button
            onClick={handleSeed}
            disabled={market.seeding}
            className="px-4 h-9 text-sm font-medium bg-amber-900 text-white rounded hover:bg-amber-800 disabled:opacity-50 transition-colors"
          >{market.seeding ? 'Seeding…' : 'Seed markets'}</button>
        </div>
      )}

      {/* Amount selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600">Bet size:</span>
        {BET_AMOUNTS_SOL.map(amt => (
          <button
            key={amt}
            onClick={() => setSelectedAmount(amt)}
            className={`px-3 h-8 text-sm rounded font-mono transition-colors ${
              selectedAmount === amt ? 'bg-black text-white' : 'bg-white border border-zinc-300 hover:bg-zinc-50'
            }`}
          >{amt} SOL</button>
        ))}
      </div>

      {/* Markets */}
      <div className="space-y-3">
        {market.markets.map(m => {
          const state = market.marketStates[m.id]
          const seeded = !!state
          const isAuthority = seeded && state!.authority.toBase58() === address
          const resolved = seeded && state!.resolved
          const totalSol = seeded ? lamportsToSol(state!.totalPool) : '0.0000'
          const yesSol = seeded ? lamportsToSol(state!.yesPool) : '0.0000'
          const noSol = seeded ? lamportsToSol(state!.noPool) : '0.0000'
          return (
            <div key={m.id} className="p-4 border border-zinc-200 rounded-lg bg-white">
              <div className="flex items-baseline justify-between gap-4 mb-2">
                <div className="text-sm font-medium">{m.question}</div>
                {resolved && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-white">
                    resolved: {state!.winningOutcome === 0 ? 'YES' : 'NO'}
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500 font-mono mb-3">
                pool: {totalSol} SOL &middot; yes: {yesSol} &middot; no: {noSol}
              </div>
              <div className="flex gap-2">
                {m.outcomes.map(o => (
                  <button
                    key={o.id}
                    onClick={() => handleBet(m.id, o.id)}
                    disabled={!connected || market.placing || !seeded || resolved}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      o.id === 'yes'
                        ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span>{o.label}</span>
                      <span className="font-mono text-xs opacity-70">{(o.impliedOdds * 100).toFixed(0)}%</span>
                    </div>
                  </button>
                ))}
              </div>
              {seeded && isAuthority && !resolved && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100">
                  <span className="text-xs text-zinc-500 self-center mr-auto">you are the authority — </span>
                  <button
                    onClick={() => handleResolve(m.id, 'yes')}
                    className="px-3 h-7 text-xs bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                  >resolve YES wins</button>
                  <button
                    onClick={() => handleResolve(m.id, 'no')}
                    className="px-3 h-7 text-xs bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                  >resolve NO wins</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Errors */}
      {error && (
        <div className="p-3 border border-rose-200 bg-rose-50 text-rose-800 text-sm rounded">
          {error}
        </div>
      )}

      {/* Session-local bet list with redeem */}
      {market.bets.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700">This session's bets</h2>
          <div className="space-y-1">
            {market.bets.map(b => {
              const mState = market.marketStates[b.marketId]
              const canRedeem = mState?.resolved && mState.winningOutcome === (b.outcomeId === 'yes' ? 0 : 1)
              return (
                <div
                  key={b.signature}
                  className="flex items-center gap-3 p-2 rounded border border-zinc-100 text-xs font-mono"
                >
                  <span className="flex-1 truncate">{b.marketId} → {b.outcomeId}</span>
                  <span>{b.amountSol} SOL</span>
                  <a
                    href={getExplorerTxUrl(b.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-700"
                  >{truncateAddress(b.signature)}</a>
                  {canRedeem && (
                    <button
                      onClick={() => handleRedeem(b)}
                      className="px-2 h-6 text-[11px] bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                    >Redeem</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* On-chain history */}
      {market.onChainBets.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700">Your on-chain bets ({market.onChainBets.length})</h2>
          <div className="space-y-1">
            {market.onChainBets.map(b => (
              <a
                key={b.pda}
                href={getExplorerAddressUrl(b.pda)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 rounded border border-zinc-100 text-xs font-mono hover:bg-zinc-50"
              >
                <span className="flex-1 truncate">
                  {b.marketId ?? truncateAddress(b.market)} → {b.outcome === 0 ? 'YES' : 'NO'}
                </span>
                <span>{lamportsToSol(b.amount)} SOL</span>
                {b.redeemed && <span className="px-1.5 py-0.5 bg-zinc-900 text-white rounded text-[10px]">redeemed</span>}
                <span className="text-zinc-400">{truncateAddress(b.pda)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
