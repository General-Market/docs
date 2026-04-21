'use client'

import { useMemo, useState } from 'react'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useSession } from '@/lib/solana/SessionContext'
import { useWallet } from '@/hooks/useWallet'
import { usePredictionMarket } from '@/hooks/usePredictionMarket'
import { truncateAddress } from '@/lib/utils/address'
import { getExplorerAddressUrl } from '@/lib/solana/cluster'
import type { Side } from '@/lib/solana/idl/prediction_market'

// 1-click prediction market. Catalog → amount → YES/NO → place. Claim
// is invisible because a keeper cranks it after settlement.
//
// Values shown in USDC units (6 decimals). Devnet USDC is the default
// stake mint; NEXT_PUBLIC_PREDICTION_STAKE_MINT overrides.

const DEFAULT_SESSION_SOL = 0.05
const USDC_DECIMALS = 6
const AMOUNT_PRESETS_USDC = [1, 5, 25]

function usdcUnitsToDisplay(units: bigint): string {
  const whole = units / 10n ** BigInt(USDC_DECIMALS)
  const frac = units % 10n ** BigInt(USDC_DECIMALS)
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return `${whole}.${fracStr}`
}

function displayToUsdcUnits(value: string): bigint {
  const trimmed = value.trim()
  if (!trimmed) return 0n
  const [whole, frac = ''] = trimmed.split('.')
  const paddedFrac = (frac + '0'.repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS)
  return BigInt(whole || '0') * 10n ** BigInt(USDC_DECIMALS) + BigInt(paddedFrac || '0')
}

function formatUnixSecs(secs: bigint): string {
  const d = new Date(Number(secs) * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function MockTradePanel() {
  const { connected, address, cluster } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()
  const session = useSession()
  const pm = usePredictionMarket()

  const [amountInput, setAmountInput] = useState(String(AMOUNT_PRESETS_USDC[0]))
  const [side, setSide] = useState<Side>('Yes')
  const [error, setError] = useState<string | null>(null)
  const [lastSignature, setLastSignature] = useState<string | null>(null)

  const parsedAmountUnits = useMemo(() => {
    try { return displayToUsdcUnits(amountInput) } catch { return 0n }
  }, [amountInput])

  const selectedMarket = useMemo(
    () => pm.markets.find(m => m.key === pm.selectedCatalogId) ?? pm.markets[0] ?? null,
    [pm.markets, pm.selectedCatalogId],
  )

  // Roll up the user's position in the selected Market (if any).
  const selectedPosition = useMemo(() => {
    if (!selectedMarket) return null
    return pm.positions.find(p => p.market === selectedMarket.pda) ?? null
  }, [pm.positions, selectedMarket])

  const handleConnect = () => setShowModal(true)

  const handleEnableSession = async () => {
    setError(null)
    try {
      await session.enable({ solFunding: DEFAULT_SESSION_SOL }, { durationMs: 60 * 60 * 1000 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDisableSession = async () => {
    setError(null)
    try { await session.disable() } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  const handlePlaceBet = async () => {
    setError(null)
    setLastSignature(null)
    if (!selectedMarket) {
      setError('No market selected')
      return
    }
    if (parsedAmountUnits <= 0n) {
      setError('Amount must be positive')
      return
    }
    try {
      const res = await pm.placeBet(selectedMarket.key, side, parsedAmountUnits)
      setLastSignature(res.signature)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="flex items-baseline justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">prediction market</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Pick a market. Bet YES or NO. The keeper pays out when it settles.
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-1 rounded bg-zinc-100 text-zinc-700">
          {cluster}
        </span>
      </header>

      {/* Connection + session status */}
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
            <span className={`inline-block w-2 h-2 rounded-full ${
              session.sessionLamports !== null && session.sessionLamports < 0.005 * LAMPORTS_PER_SOL
                ? 'bg-amber-400 animate-pulse'
                : 'bg-emerald-400'
            }`} />
            <div className="flex-1">
              <div className="text-sm font-medium">
                1-click is on
                {session.sessionLamports !== null && (
                  <span className="ml-2 text-xs font-mono text-zinc-500">
                    ({(session.sessionLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL left)
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                session: {session.sessionPublicKey ? truncateAddress(session.sessionPublicKey) : '—'} · you: {address ? truncateAddress(address) : '—'}
              </div>
            </div>
            <button
              onClick={handleDisableSession}
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
                Enabling funds a session key with {DEFAULT_SESSION_SOL} SOL for tx fees.
              </div>
            </div>
            <button
              onClick={handleEnableSession}
              disabled={session.enabling}
              className="px-4 h-9 text-sm font-medium bg-black text-white rounded hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >{session.enabling ? 'Enabling…' : 'Enable 1-click'}</button>
          </>
        )}
      </div>

      {/* Market picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">Market</label>
        <select
          value={pm.selectedCatalogId}
          onChange={e => pm.setSelectedCatalogId(e.target.value)}
          className="w-full px-3 h-10 border border-zinc-300 rounded bg-white text-sm"
        >
          {pm.catalog.map(entry => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        {pm.selectedEntry && (
          <p className="text-xs text-zinc-500">{pm.selectedEntry.description}</p>
        )}
      </div>

      {/* Market state snapshot */}
      {selectedMarket && (
        <div className="p-4 border border-zinc-200 rounded-lg bg-white text-xs font-mono text-zinc-600 space-y-1">
          <div className="flex justify-between">
            <span>Market PDA</span>
            <a
              href={getExplorerAddressUrl(selectedMarket.pda)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-700 hover:underline"
            >{truncateAddress(selectedMarket.pda)}</a>
          </div>
          <div className="flex justify-between">
            <span>Close at</span>
            <span>{formatUnixSecs(selectedMarket.nextCloseTime)}</span>
          </div>
          <div className="flex justify-between">
            <span>Settle at</span>
            <span>{formatUnixSecs(selectedMarket.nextSettlementTime)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total YES</span>
            <span>{selectedMarket.state ? usdcUnitsToDisplay(selectedMarket.state.totalYes) : '—'} USDC</span>
          </div>
          <div className="flex justify-between">
            <span>Total NO</span>
            <span>{selectedMarket.state ? usdcUnitsToDisplay(selectedMarket.state.totalNo) : '—'} USDC</span>
          </div>
          {selectedPosition && (
            <div className="pt-2 mt-2 border-t border-zinc-100 space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-900">Your YES</span>
                <span>{usdcUnitsToDisplay(selectedPosition.yesAmount)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-900">Your NO</span>
                <span>{usdcUnitsToDisplay(selectedPosition.noAmount)} USDC</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Side toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSide('Yes')}
          className={`flex-1 h-10 rounded text-sm font-medium transition-colors ${
            side === 'Yes'
              ? 'bg-emerald-600 text-white'
              : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >YES</button>
        <button
          onClick={() => setSide('No')}
          className={`flex-1 h-10 rounded text-sm font-medium transition-colors ${
            side === 'No'
              ? 'bg-rose-600 text-white'
              : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >NO</button>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">Amount (USDC)</label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={e => setAmountInput(e.target.value)}
            className="flex-1 px-3 h-10 border border-zinc-300 rounded bg-white text-sm font-mono"
          />
          {AMOUNT_PRESETS_USDC.map(preset => (
            <button
              key={preset}
              onClick={() => setAmountInput(String(preset))}
              className={`px-3 h-10 text-xs rounded border ${
                amountInput === String(preset)
                  ? 'bg-black text-white border-black'
                  : 'bg-white border-zinc-300 hover:bg-zinc-50'
              }`}
            >{preset}</button>
          ))}
        </div>
      </div>

      {/* Place bet */}
      <button
        onClick={handlePlaceBet}
        disabled={!connected || pm.placing || parsedAmountUnits <= 0n || !selectedMarket}
        className="w-full h-11 rounded bg-black text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
      >
        {pm.placing ? 'Placing…' : `Place bet: ${side} on ${pm.selectedEntry?.label ?? '—'}`}
      </button>

      {error && (
        <div className="p-3 border border-rose-200 bg-rose-50 text-rose-800 text-sm rounded">
          {error}
        </div>
      )}
      {lastSignature && (
        <div className="p-3 border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs rounded font-mono break-all">
          Placed: {truncateAddress(lastSignature)}
        </div>
      )}

      {/* All positions — passive list, keeper claims on the user's behalf */}
      {pm.positions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700">Your positions ({pm.positions.length})</h2>
          <div className="space-y-1">
            {pm.positions.map(p => {
              const resolved = p.marketState?.resolved
              const outcome = p.marketState?.outcomeYes
              return (
                <a
                  key={p.pda}
                  href={getExplorerAddressUrl(p.pda)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded border border-zinc-100 text-xs font-mono hover:bg-zinc-50"
                >
                  <span className="flex-1 truncate">
                    src {p.marketSourceId ?? '?'} @ {p.marketThresholdBps ?? '?'}bps
                  </span>
                  <span>Y {usdcUnitsToDisplay(p.yesAmount)}</span>
                  <span>N {usdcUnitsToDisplay(p.noAmount)}</span>
                  {resolved !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      outcome ? 'bg-emerald-900 text-white' : 'bg-rose-900 text-white'
                    }`}>
                      {outcome ? 'YES' : 'NO'}{p.marketState?.forceResolved ? '*' : ''}
                    </span>
                  )}
                  {p.claimed && (
                    <span className="px-1.5 py-0.5 bg-zinc-900 text-white rounded text-[10px]">claimed</span>
                  )}
                </a>
              )
            })}
          </div>
          <p className="text-[11px] text-zinc-500">
            No claim button — the keeper sweeps resolved markets and credits your wallet automatically.
          </p>
        </div>
      )}
    </div>
  )
}
