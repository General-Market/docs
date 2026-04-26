'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { useWallet } from '@/hooks/useWallet'
import {
  type UpcomingSlot,
  useMarketState,
  usePlaceBet,
  useStakeBalance,
  usePairHistory,
  usePairScore,
  formatPairScore,
  deriveYesPct,
  pctToDecimalOdd,
} from '@/lib/markets/hooks'
import FaucetButton from './FaucetButton'
import { GlobalActivity } from './GlobalActivity'
import { MyPositions } from './MyPositions'
import { SourceIcon } from './SourceIcon'
import { SparkLine } from './SparkLine'
import type { Side } from './MarketRow'

// Right rail. Sticky. Same body the sheet renders, just without the
// chrome — pick a side, type a number, sign.

const USDC_DECIMALS = 6

function displayToUsdcUnits(value: string): bigint {
  const trimmed = value.trim()
  if (!trimmed) return 0n
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) return 0n
  const [whole, frac = ''] = trimmed.split('.')
  const paddedFrac = (frac + '0'.repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS)
  return BigInt(whole || '0') * 10n ** BigInt(USDC_DECIMALS) + BigInt(paddedFrac || '0')
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
        <GlobalActivity />
        <aside
          className="rounded-md border border-dashed border-zinc-700 bg-zinc-900 p-6"
          aria-label="Bet ticket"
        >
          <p className="text-[12px] text-zinc-500">Pick a market to bet.</p>
        </aside>
      </div>
    )
  }

  return (
    <div className={['flex flex-col gap-3', className].join(' ')}>
      <MyPositions />
      <GlobalActivity />
      <BetTicketActive slot={slot} side={side} onSideChange={onSideChange} />
    </div>
  )
}

function BetTicketActive({
  slot,
  side,
  onSideChange,
}: { slot: UpcomingSlot; side: Side; onSideChange: (s: Side) => void }) {
  const { connected, disconnect } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()
  const state = useMarketState(slot.marketPda)
  const placeBetCtl = usePlaceBet()
  const stakeBalance = useStakeBalance()

  const [amount, setAmount] = useState<string>('')
  const [lastSig, setLastSig] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setAmount('')
    setLastSig(null)
    setLocalError(null)
  }, [slot.marketPda])

  const parsedUnits = useMemo(() => {
    try { return displayToUsdcUnits(amount) } catch { return 0n }
  }, [amount])

  // Same three-tier prior the row pill uses — pool first, then the
  // audience baseline clamped to [15, 85], then 50/50. The pill always
  // carries a real multiplier instead of a long mute dash.
  const yesPct = useMemo(
    () => deriveYesPct(state, slot.audienceA, slot.audienceB),
    [state, slot.audienceA, slot.audienceB],
  )
  const noPct = 100 - yesPct
  const yesMult = useMemo(() => pctToDecimalOdd(yesPct), [yesPct])
  const noMult = useMemo(() => pctToDecimalOdd(noPct), [noPct])

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

  const pickedName = side === 'yes' ? slot.displayA : slot.displayB
  const isOpen = slot.closeTime * 1000 > Date.now()

  return (
    <aside
      className="flex flex-col rounded-md border border-zinc-800 bg-zinc-900"
      aria-label="Bet ticket"
    >
      <BetBody
        slot={slot}
        side={side}
        onSideChange={onSideChange}
        amount={amount}
        setAmount={setAmount}
        connected={connected}
        stakeBalance={stakeBalance}
        yesMult={yesMult}
        noMult={noMult}
        pickedName={pickedName}
        isOpen={isOpen}
        showClose={false}
        sparkWidth={84}
        sparkHeight={20}
      />

      <div className="border-t border-zinc-800 px-4 py-3">
        {!connected ? (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="h-12 w-full rounded-md bg-emerald-400 font-semibold text-zinc-950 transition-colors hover:bg-emerald-300"
          >
            Connect wallet to bet
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={placeBetCtl.placing || parsedUnits <= 0n || insufficientBalance}
            className="h-12 w-full rounded-md bg-emerald-400 font-semibold text-zinc-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {placeBetCtl.placing
              ? 'Sending…'
              : `Buy ${pickedName} · $${amount || '0'}`}
          </button>
        )}

        <div className="mt-2 min-h-[16px]">
          {insufficientBalance ? (
            <p className="text-[11px] text-rose-400">Insufficient balance.</p>
          ) : null}
          {error ? (
            <div className="mt-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
              {error}
            </div>
          ) : null}
          {lastSig ? (
            <div className="mt-1 break-all rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-300">
              Bet placed · {lastSig.slice(0, 8)}…{lastSig.slice(-8)}
            </div>
          ) : null}
        </div>

        {connected ? (
          <button
            type="button"
            onClick={() => disconnect()}
            className="mt-2 block w-full text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
          >
            disconnect
          </button>
        ) : null}
      </div>
    </aside>
  )
}

// Shared body — used by BetTicket and BetSheet so the surfaces look
// identical down to the pixel. Only the chrome around it differs.
interface BetBodyProps {
  slot: UpcomingSlot
  side: Side
  onSideChange: (s: Side) => void
  amount: string
  setAmount: (s: string) => void
  connected: boolean
  stakeBalance: { raw: bigint; display: string; loading: boolean; error: string | null }
  yesMult: number | null
  noMult: number | null
  pickedName: string
  isOpen: boolean
  showClose: boolean
  onClose?: () => void
  /** Sparkline dimensions. Defaults to 60×16 (the SparkLine default). */
  sparkWidth?: number
  sparkHeight?: number
}

export function BetBody({
  slot,
  side,
  onSideChange,
  amount,
  setAmount,
  connected,
  stakeBalance,
  yesMult,
  noMult,
  pickedName,
  isOpen,
  showClose,
  onClose,
  sparkWidth,
  sparkHeight,
}: BetBodyProps) {
  const verbColor = side === 'yes' ? 'text-emerald-300' : 'text-rose-300'
  const verb = side === 'yes' ? 'Yes' : 'No'
  const showDescription = isOpen && slot.description && slot.description.length <= 220

  // Per-pair signed score: the chain settles on this number, not on the
  // site-aggregate. Live tick + 30 min trailing history.
  const pairScore = usePairScore(slot.pairIndex)
  const pairHistory = usePairHistory(slot.pairIndex)
  const sparkValues = useMemo(
    () => pairHistory.points.map(p => Number(p.score)),
    [pairHistory.points],
  )
  const sparkTrend: 'up' | 'down' | 'flat' =
    pairScore.direction ?? 'flat'

  return (
    <>
      <header className="flex items-start gap-3 border-b border-zinc-800 px-4 py-4">
        <SourceIcon
          sourceId={slot.sourceId as 1 | 2 | 3 | 4 | 5}
          className="!h-7 !w-7 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-semibold text-zinc-100">
            {slot.displayA} vs {slot.displayB}
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-zinc-400">
            <span className={verbColor}>Buy {verb}</span> · {pickedName}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-zinc-500">
            <span className="tabular-nums">
              score · {formatPairScore(pairScore.score)}
            </span>
            <SparkLine
              values={sparkValues}
              width={sparkWidth}
              height={sparkHeight}
              trend={sparkTrend}
              aria-label="Pair score trend"
            />
          </div>
          {showDescription ? (
            <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
              {slot.description}
            </p>
          ) : null}
        </div>
        {showClose && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="-m-2 grid h-9 w-9 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        ) : null}
      </header>

      <div className="flex flex-col gap-5 px-4 py-5">
        <div className="grid grid-cols-2 gap-2">
          <SidePill
            side="yes"
            label="Yes"
            mult={yesMult}
            active={side === 'yes'}
            onClick={() => onSideChange('yes')}
          />
          <SidePill
            side="no"
            label="No"
            mult={noMult}
            active={side === 'no'}
            onClick={() => onSideChange('no')}
          />
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[12px] text-zinc-500">Amount</p>
              <p className="text-[11px] text-zinc-600">
                {!connected
                  ? 'Connect wallet to see balance'
                  : stakeBalance.loading && stakeBalance.raw === 0n
                    ? 'Balance · —'
                    : stakeBalance.error
                      ? `Balance · ${stakeBalance.error.toLowerCase()}`
                      : `Balance · $${stakeBalance.display}`}
                {connected && stakeBalance.raw === 0n ? (
                  <span className="ml-2 inline-block">
                    <FaucetButton />
                  </span>
                ) : null}
              </p>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="h-12 w-32 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-right text-[18px] font-semibold tabular-nums text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-600 focus:outline-none sm:w-36"
            />
          </div>
          <div className="mt-3 flex gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className="h-7 rounded-full border border-zinc-800 px-3 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

interface SidePillProps {
  side: Side
  label: string
  mult: number | null
  active: boolean
  onClick: () => void
}

function SidePill({ side, label, mult, active, onClick }: SidePillProps) {
  const yes = side === 'yes'
  // Idle: both pills wear emerald (Kalshi pattern). Active: side hue
  // takes over so the click still confirms which side won the press.
  const activeClasses = yes
    ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400 ring-1 ring-emerald-400/40'
    : 'bg-rose-500/20 text-rose-100 border border-rose-400 ring-1 ring-rose-400/40'
  const idleClasses = 'border-2 border-emerald-400/60 text-emerald-300 hover:bg-emerald-500/10'
  const multText = mult === null ? '—' : `${mult.toFixed(2)}×`
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex h-12 items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors',
        active ? activeClasses : idleClasses,
      ].join(' ')}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-80">{multText}</span>
    </button>
  )
}
