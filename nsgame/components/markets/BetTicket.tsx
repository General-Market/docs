'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { useWallet } from '@/hooks/useWallet'
import {
  type UpcomingSlot,
  useMarketState,
  usePlaceBet,
  useStakeBalance,
  useSourcePrice,
  useRecentBets,
  payoutMultiplier,
  formatMultiplier,
} from '@/lib/markets/hooks'
import { CountdownTimer } from './CountdownTimer'
import { SourceIcon } from './SourceIcon'
import FaucetButton from './FaucetButton'
import type { Side } from './MarketRow'

// Right rail. Sticky. The bet ticket — same logic as the bottom sheet,
// laid out as a column. Empty until a market is picked.

const USDC_DECIMALS = 6

function displayToUsdcUnits(value: string): bigint {
  const trimmed = value.trim()
  if (!trimmed) return 0n
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) return 0n
  const [whole, frac = ''] = trimmed.split('.')
  const paddedFrac = (frac + '0'.repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS)
  return BigInt(whole || '0') * 10n ** BigInt(USDC_DECIMALS) + BigInt(paddedFrac || '0')
}

function formatUsdcUnits(units: bigint): string {
  if (units === 0n) return '0'
  const base = 10n ** BigInt(USDC_DECIMALS)
  const whole = units / base
  const frac = units % base
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
}

const PRESETS = ['1', '5', '25']

export interface BetTicketProps {
  slot: UpcomingSlot | null
  side: Side
  onSideChange: (s: Side) => void
  className?: string
}

export function BetTicket({ slot, side, onSideChange, className = '' }: BetTicketProps) {
  if (!slot) {
    return (
      <aside
        className={[
          'rounded-md border border-dashed border-zinc-300 bg-white p-6',
          className,
        ].join(' ')}
        aria-label="Bet ticket"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          ticket
        </p>
        <p className="mt-2 text-[13px] text-zinc-600">pick a market to bet.</p>
      </aside>
    )
  }

  return (
    <BetTicketActive
      slot={slot}
      side={side}
      onSideChange={onSideChange}
      className={className}
    />
  )
}

function BetTicketActive({
  slot,
  side,
  onSideChange,
  className,
}: { slot: UpcomingSlot; side: Side; onSideChange: (s: Side) => void; className: string }) {
  const { connected, disconnect } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()
  const state = useMarketState(slot.marketPda)
  const placeBetCtl = usePlaceBet()
  const stakeBalance = useStakeBalance()
  const price = useSourcePrice(slot.sourceId)
  const recentBets = useRecentBets(slot.marketPda)

  const [amount, setAmount] = useState<string>(PRESETS[0])
  const [lastSig, setLastSig] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Reset on slot change.
  useEffect(() => {
    setAmount(PRESETS[0])
    setLastSig(null)
    setLocalError(null)
  }, [slot.marketPda])

  const parsedUnits = useMemo(() => {
    try { return displayToUsdcUnits(amount) } catch { return 0n }
  }, [amount])

  const yesMult = useMemo(
    () => state ? payoutMultiplier(state.totalYes, state.totalNo, 'yes') : null,
    [state],
  )
  const noMult = useMemo(
    () => state ? payoutMultiplier(state.totalYes, state.totalNo, 'no') : null,
    [state],
  )

  const activeMult = side === 'yes' ? yesMult : noMult
  const estPayoutUnits = useMemo(() => {
    if (activeMult === null || !Number.isFinite(activeMult)) return null
    if (parsedUnits <= 0n) return 0n
    // multiplier is a Number; multiply via Number then back to bigint.
    const units = Number(parsedUnits) * activeMult
    if (!Number.isFinite(units)) return null
    return BigInt(Math.floor(units))
  }, [parsedUnits, activeMult])

  async function handleSubmit() {
    setLocalError(null)
    setLastSig(null)
    if (parsedUnits <= 0n) {
      setLocalError('Amount must be positive.')
      return
    }
    try {
      const sig = await placeBetCtl.placeBet(slot, side, parsedUnits)
      setLastSig(sig)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    }
  }

  const error = localError ?? placeBetCtl.error
  const insufficientBalance =
    connected && parsedUnits > 0n && stakeBalance.raw < parsedUnits

  const sourceShort = slot.sourceName.toLowerCase()
  const iconId = (slot.sourceId >= 1 && slot.sourceId <= 5
    ? (slot.sourceId as 1 | 2 | 3 | 4 | 5)
    : null)

  return (
    <aside
      className={[
        'flex flex-col rounded-md border border-zinc-200 bg-white',
        className,
      ].join(' ')}
      aria-label="Bet ticket"
    >
      <header className="border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-zinc-700">
            {iconId ? <SourceIcon sourceId={iconId} className="h-4 w-4" /> : null}
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
              {sourceShort}
            </span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            closes in <CountdownTimer target={slot.closeTime} closedLabel="closed" />
          </span>
        </div>
        <h3 className="mt-2 text-[14px] font-semibold leading-snug text-zinc-900">
          {slot.label}
        </h3>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">
          {sourceShort}: <span className="tabular-nums text-zinc-700">{price.raw === null ? '—' : price.display}</span>
          {price.changeBp !== null && price.changeBp !== 0 ? (
            <span
              className={[
                'ml-1.5',
                price.changeBp > 0 ? 'text-emerald-700' : 'text-rose-700',
              ].join(' ')}
            >
              {price.changeBp > 0 ? '+' : ''}{price.changeBp} bp
            </span>
          ) : null}
        </p>
      </header>

      <div className="space-y-4 px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          pick a side
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSideChange('yes')}
            className={[
              'h-12 rounded-md border text-sm font-semibold transition-colors',
              side === 'yes'
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
            ].join(' ')}
          >
            YES
          </button>
          <button
            type="button"
            onClick={() => onSideChange('no')}
            className={[
              'h-12 rounded-md border text-sm font-semibold transition-colors',
              side === 'no'
                ? 'border-rose-500 bg-rose-500 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
            ].join(' ')}
          >
            NO
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <div className="space-y-0.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-700">
              if YES
            </p>
            <p
              className={[
                'font-mono tabular-nums',
                side === 'yes' ? 'text-xl font-semibold text-emerald-700' : 'text-base text-zinc-700',
              ].join(' ')}
            >
              {formatMultiplier(yesMult)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-rose-700">
              if NO
            </p>
            <p
              className={[
                'font-mono tabular-nums',
                side === 'no' ? 'text-xl font-semibold text-rose-700' : 'text-base text-zinc-700',
              ].join(' ')}
            >
              {formatMultiplier(noMult)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="bet-ticket-amount"
            className="block font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500"
          >
            amount (USDC)
          </label>
          <input
            id="bet-ticket-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 font-mono text-sm focus:border-zinc-900 focus:outline-none"
            placeholder="0.00"
          />
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className={[
                  'h-9 rounded-md border font-mono text-xs',
                  amount === p
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
              {!connected
                ? 'wallet not connected'
                : stakeBalance.loading && stakeBalance.raw === 0n
                  ? 'balance: —'
                  : stakeBalance.error
                    ? `balance: ${stakeBalance.error.toLowerCase()}`
                    : `balance: ${stakeBalance.display} USDC`}
            </p>
            {connected && stakeBalance.raw === 0n ? <FaucetButton /> : null}
          </div>
        </div>

        {estPayoutUnits !== null && parsedUnits > 0n ? (
          <p className="font-mono text-[11px] text-zinc-500">
            payout if you win ·{' '}
            <span className="tabular-nums text-zinc-900">
              {formatUsdcUnits(estPayoutUnits)} USDC
            </span>
          </p>
        ) : null}

        {insufficientBalance ? (
          <p className="font-mono text-[11px] text-rose-700">insufficient balance.</p>
        ) : null}
        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </div>
        ) : null}
        {lastSig ? (
          <div className="break-all rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-[11px] text-emerald-800">
            bet placed · {lastSig.slice(0, 8)}…{lastSig.slice(-8)}
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-200 px-4 py-3">
        {!connected ? (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="h-12 w-full rounded-md bg-zinc-900 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            connect wallet to bet
          </button>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={placeBetCtl.placing || parsedUnits <= 0n || insufficientBalance}
              className={[
                'h-12 w-full rounded-md text-sm font-semibold text-white transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-40',
                'bg-zinc-900 hover:bg-zinc-800',
              ].join(' ')}
            >
              {placeBetCtl.placing
                ? 'sending…'
                : `place bet · ${side.toUpperCase()} ${amount || '0'} USDC`}
            </button>
            <button
              type="button"
              onClick={() => disconnect()}
              className="h-7 w-full font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:text-zinc-700"
            >
              disconnect wallet
            </button>
          </div>
        )}
      </div>

      {recentBets.length > 0 ? (
        <div className="border-t border-zinc-200 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            recent bets
          </p>
          <ul className="space-y-1.5">
            {recentBets.slice(0, 5).map(b => (
              <li
                key={b.sig}
                className="flex items-center justify-between gap-2 font-mono text-[11px]"
              >
                <span className="truncate text-zinc-600">
                  {b.owner.slice(0, 4)}…{b.owner.slice(-4)}
                </span>
                <span
                  className={[
                    'inline-flex h-4 items-center rounded px-1 text-[10px] font-semibold uppercase',
                    b.side === 'yes'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700',
                  ].join(' ')}
                >
                  {b.side}
                </span>
                <span className="tabular-nums text-zinc-700">
                  {formatUsdcUnits(b.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  )
}
