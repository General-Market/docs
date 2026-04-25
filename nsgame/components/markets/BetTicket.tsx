'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { useWallet } from '@/hooks/useWallet'
import {
  type UpcomingSlot,
  useMarketState,
  usePlaceBet,
  useStakeBalance,
  useRecentBets,
  payoutMultiplier,
  formatMultiplier,
  formatLabel,
  windowLabel,
  compactAudience,
  audienceUnit,
} from '@/lib/markets/hooks'
import { CountdownTimer } from './CountdownTimer'
import FaucetButton from './FaucetButton'
import { MyPositions } from './MyPositions'
import type { Side } from './MarketRow'

// Right rail. Sticky. The bet ticket — same logic as the bottom sheet,
// laid out as a column. A and B sit side-by-side; pick one, type a
// number, sign. The wallet adapter still bets YES (=A wins) or NO
// (=B wins); the labels just admit which name they belong to.

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
      <div className={['flex flex-col gap-3', className].join(' ')}>
        <MyPositions />
        <aside
          className="rounded-md border border-dashed border-zinc-700 bg-zinc-900 placeholder:text-zinc-600 p-6"
          aria-label="Bet ticket"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            ticket
          </p>
          <p className="mt-2 text-[13px] text-zinc-400">pick a market to bet.</p>
        </aside>
      </div>
    )
  }

  return (
    <div className={['flex flex-col gap-3', className].join(' ')}>
      <MyPositions />
      <BetTicketActive
        slot={slot}
        side={side}
        onSideChange={onSideChange}
        className=""
      />
    </div>
  )
}

interface NameButtonProps {
  side: Side
  name: string
  audience: bigint
  audienceLabel: string
  multiplier: number | null
  active: boolean
}

function NameButton({ side, name, audience, audienceLabel, multiplier, active }: NameButtonProps) {
  const yes = side === 'yes'
  let surface: string
  if (active) {
    surface = yes
      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-100 shadow-[inset_0_0_24px_rgb(16_185_129/0.18)]'
      : 'border-rose-500 bg-rose-500/15 text-rose-100 shadow-[inset_0_0_24px_rgb(244_63_94/0.18)]'
  } else {
    surface = yes
      ? 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-emerald-500/50'
      : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-rose-500/50'
  }
  const accent = yes ? 'text-emerald-400' : 'text-rose-400'
  return (
    <span
      className={[
        'flex h-full flex-col items-start gap-0.5 rounded-md border px-3 py-2.5 text-left transition-colors',
        surface,
      ].join(' ')}
    >
      <span className="flex w-full items-center gap-2">
        <span aria-hidden className={['inline-block h-2 w-2 shrink-0 rounded-full', yes ? 'bg-emerald-400' : 'bg-rose-400'].join(' ')} />
        <span className="truncate text-[13px] font-semibold leading-tight tracking-tight">
          {name}
        </span>
      </span>
      <span className="text-[11px] tabular-nums text-zinc-500">
        {compactAudience(audience)} {audienceLabel}
      </span>
      <span className={['text-[11px] tabular-nums', active ? 'text-zinc-100' : accent].join(' ')}>
        {formatMultiplier(multiplier)} if wins
      </span>
    </span>
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

  const audienceLbl = audienceUnit(slot.board)
  const pickedName = side === 'yes' ? slot.displayA : slot.displayB

  return (
    <aside
      className={[
        'flex flex-col rounded-md border border-zinc-800 bg-zinc-900',
        className,
      ].join(' ')}
      aria-label="Bet ticket"
    >
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-zinc-400">
          <span className="font-mono text-[10px] tabular-nums text-zinc-500">
            pair #{String(slot.pairIndex).padStart(2, '0')}
          </span>
          <span className="text-zinc-700">·</span>
          <span
            className={[
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]',
              slot.board === 'stars'
                ? 'bg-amber-500/10 text-amber-300'
                : 'bg-sky-500/10 text-sky-300',
            ].join(' ')}
          >
            {slot.board}
          </span>
          <span className="inline-flex items-center rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-400">
            {windowLabel(slot.windowSecs)} {formatLabel(slot.format)}
          </span>
        </div>
        <h3 className="mt-2 text-[14px] font-semibold leading-snug text-zinc-100">
          {slot.displayA} <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">vs</span> {slot.displayB}
        </h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
          closes in <CountdownTimer target={slot.closeTime} closedLabel="closed" />
          {' · '}
          settles in <CountdownTimer target={slot.settlementTime} closedLabel="ready" />
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
            aria-pressed={side === 'yes'}
            className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            <NameButton
              side="yes"
              name={slot.displayA}
              audience={slot.audienceA}
              audienceLabel={audienceLbl}
              multiplier={yesMult}
              active={side === 'yes'}
            />
          </button>
          <button
            type="button"
            onClick={() => onSideChange('no')}
            aria-pressed={side === 'no'}
            className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
          >
            <NameButton
              side="no"
              name={slot.displayB}
              audience={slot.audienceB}
              audienceLabel={audienceLbl}
              multiplier={noMult}
              active={side === 'no'}
            />
          </button>
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
            className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 placeholder:text-zinc-600 px-3 font-mono text-sm focus:border-zinc-500 focus:outline-none"
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
                    ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800',
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
            payout if {pickedName} wins ·{' '}
            <span className="tabular-nums text-zinc-100">
              {formatUsdcUnits(estPayoutUnits)} USDC
            </span>
          </p>
        ) : null}

        {insufficientBalance ? (
          <p className="font-mono text-[11px] text-rose-400">insufficient balance.</p>
        ) : null}
        {error ? (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        ) : null}
        {lastSig ? (
          <div className="break-all rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-300">
            bet placed · {lastSig.slice(0, 8)}…{lastSig.slice(-8)}
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-800 px-4 py-3">
        {!connected ? (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="h-12 w-full rounded-md bg-emerald-400 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-300"
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
                'h-12 w-full rounded-md text-sm font-semibold text-zinc-950 transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-40',
                side === 'yes'
                  ? 'bg-emerald-400 hover:bg-emerald-300'
                  : 'bg-rose-400 hover:bg-rose-300',
              ].join(' ')}
            >
              {placeBetCtl.placing
                ? 'sending…'
                : `bet on ${pickedName} · ${amount || '0'} USDC`}
            </button>
            <button
              type="button"
              onClick={() => disconnect()}
              className="h-7 w-full font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:text-zinc-200"
            >
              disconnect wallet
            </button>
          </div>
        )}
      </div>

      {recentBets.length > 0 ? (
        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            recent bets
          </p>
          <ul className="space-y-1.5">
            {recentBets.slice(0, 5).map(b => (
              <li
                key={b.sig}
                className="flex items-center justify-between gap-2 font-mono text-[11px]"
              >
                <span className="truncate text-zinc-400">
                  {b.owner.slice(0, 4)}…{b.owner.slice(-4)}
                </span>
                <span
                  className={[
                    'inline-flex h-4 items-center rounded px-1 text-[10px] font-semibold uppercase',
                    b.side === 'yes'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300',
                  ].join(' ')}
                  title={b.side === 'yes' ? slot.displayA : slot.displayB}
                >
                  {b.side === 'yes' ? 'A' : 'B'}
                </span>
                <span className="tabular-nums text-zinc-200">
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
