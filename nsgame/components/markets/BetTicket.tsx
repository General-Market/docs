'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import SolFaucetButton from './SolFaucetButton'
import WalletNetworkNotice from './WalletNetworkNotice'
import { SourceIcon } from './SourceIcon'
import { SparkLine } from './SparkLine'
import { DualTimer } from './DualTimer'
import { InlineTip } from './InlineTip'
import type { Side } from './MarketRow'

// Right rail. Sticky. Same body the sheet renders, just without the
// chrome — pick a side, type a number, sign. Only mounted when a market
// is picked; the empty state is the absence of the column.

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
const STAKE_STORAGE_KEY = 'nsgame_last_stake'
const DEFAULT_STAKE = '1'
const STAKE_PATTERN = /^\d+(\.\d{1,6})?$/

/**
 * The sheet should never open empty. Read the last stake the user
 * confirmed; fall back to a dollar. Pure read — caller controls when.
 */
export function readDefaultStake(): string {
  if (typeof window === 'undefined') return DEFAULT_STAKE
  try {
    const raw = window.localStorage.getItem(STAKE_STORAGE_KEY)
    if (raw && STAKE_PATTERN.test(raw)) return raw
  } catch {
    // localStorage may throw in private mode. Silence is consent.
  }
  return DEFAULT_STAKE
}

export function persistStake(value: string) {
  if (typeof window === 'undefined') return
  if (!STAKE_PATTERN.test(value)) return
  try {
    window.localStorage.setItem(STAKE_STORAGE_KEY, value)
  } catch {
    // Same forgiveness as above.
  }
}

function formatDollars(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0.00'
  if (n >= 1000) return `$${n.toFixed(0)}`
  return `$${n.toFixed(2)}`
}

export interface BetTicketProps {
  slot: UpcomingSlot
  side: Side
  onSideChange: (s: Side) => void
  /** Dismiss the ticket — typically clears the parent's selectedSlot. */
  onClose?: () => void
  className?: string
}

export function BetTicket({ slot, side, onSideChange, onClose, className = '' }: BetTicketProps) {
  return (
    <div className={['flex flex-col gap-3', className].join(' ')}>
      <BetTicketActive slot={slot} side={side} onSideChange={onSideChange} onClose={onClose} />
    </div>
  )
}

function BetTicketActive({
  slot,
  side,
  onSideChange,
  onClose,
}: { slot: UpcomingSlot; side: Side; onSideChange: (s: Side) => void; onClose?: () => void }) {
  const { connected, disconnect } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()
  const state = useMarketState(slot.marketPda)
  const placeBetCtl = usePlaceBet()
  const stakeBalance = useStakeBalance()

  const [amount, setAmount] = useState<string>(DEFAULT_STAKE)
  const [lastSig, setLastSig] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Hydrate the stake from localStorage once on mount and again when the
  // slot rotates. The user never types from zero — they correct.
  useEffect(() => {
    setAmount(readDefaultStake())
    setLastSig(null)
    setLocalError(null)
  }, [slot.marketPda])

  // Cohort rotation cue. CalendarPageClient reseats the selected slot to
  // the next cohort by catalogId every 15s; without a visual cue the
  // ticket silently swaps the market under the user. Track the previous
  // PDA so a real rotation (not the initial mount) flashes the header
  // and exposes a "rolled" badge for ~2s.
  const prevPdaRef = useRef<string | null>(null)
  const [justRolled, setJustRolled] = useState(false)
  useEffect(() => {
    const prev = prevPdaRef.current
    prevPdaRef.current = slot.marketPda
    if (prev === null || prev === slot.marketPda) return
    setJustRolled(true)
    const id = window.setTimeout(() => setJustRolled(false), 2_500)
    return () => window.clearTimeout(id)
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
      persistStake(amount)
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
      className={[
        'flex flex-col rounded-md border bg-terminal-surface transition-[border-color,box-shadow] duration-700 ease-out',
        justRolled
          ? 'border-emerald-400/70 shadow-[0_0_0_1px_rgb(52_211_153/0.4),0_8px_24px_-12px_rgb(52_211_153/0.5)]'
          : 'border-terminal-border',
      ].join(' ')}
      aria-label="Bet ticket"
    >
      {justRolled ? (
        <div
          className="rounded-t-md bg-emerald-400/10 px-4 py-1.5 text-caption uppercase tracking-[0.1em] text-emerald-300"
          role="status"
          aria-live="polite"
        >
          rolled to next cohort · stake preserved
        </div>
      ) : null}
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
        showClose={!!onClose}
        onClose={onClose}
        sparkWidth={84}
        sparkHeight={20}
      />

      <div className="border-t border-terminal-border px-4 py-3">
        <div className="mb-3 empty:hidden">
          <WalletNetworkNotice />
        </div>
        <PrimaryAction
          connected={connected}
          placing={placeBetCtl.placing}
          disabled={parsedUnits <= 0n || insufficientBalance}
          amount={amount}
          mult={side === 'yes' ? yesMult : noMult}
          onConnect={() => setShowModal(true)}
          onSubmit={handleSubmit}
        />

        <div className="mt-2 min-h-[16px]">
          {insufficientBalance ? (
            <p className="text-label text-rose-400">Insufficient balance.</p>
          ) : null}
          {error ? (
            <div className="mt-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-label text-rose-300">
              {error}
            </div>
          ) : null}
          {lastSig ? (
            <div className="mt-1 break-all rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-mono text-label text-emerald-300">
              Bet placed · {lastSig.slice(0, 8)}…{lastSig.slice(-8)}
            </div>
          ) : null}
        </div>

        {connected ? (
          <button
            type="button"
            onClick={() => disconnect()}
            className="mt-2 block w-full text-label text-terminal-fg-faint transition-colors hover:text-terminal-fg-muted"
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

  const stakeNum = Number(amount || '0')
  const activeMult = side === 'yes' ? yesMult : noMult
  const winTotal = activeMult && stakeNum > 0 ? stakeNum * activeMult : 0
  const winNet = winTotal > 0 ? winTotal - stakeNum : 0

  function adjustStake(delta: number) {
    const next = Math.max(0, Math.round((stakeNum + delta) * 100) / 100)
    setAmount(next === 0 ? '0' : String(next))
  }

  return (
    <>
      <header className="flex items-start gap-3 border-b border-terminal-border px-4 py-4">
        <SourceIcon
          sourceId={slot.sourceId as 1 | 2 | 3 | 4 | 5}
          className="!h-7 !w-7 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-terminal-fg">
            {slot.displayA} vs {slot.displayB}
          </h3>
          <p className="mt-0.5 truncate text-body text-terminal-fg-muted">
            <span className={verbColor}>Buy {verb}</span> · {pickedName}
          </p>
          <div className="mt-1 flex items-center gap-2 text-caption text-terminal-fg-faint">
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
            <p className="mt-2 text-caption leading-relaxed text-terminal-fg-faint">
              {slot.description}
            </p>
          ) : null}
        </div>
        {showClose && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="-m-2 grid h-9 w-9 place-items-center rounded-md text-terminal-fg-faint transition-colors hover:bg-terminal-surface-elevated hover:text-terminal-fg"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        ) : null}
      </header>

      <div className="flex flex-col gap-5 px-4 py-5">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-caption uppercase tracking-[0.1em] text-terminal-fg-faint">
            <span>Side</span>
            <InlineTip
              ariaLabel="What does Yes and No mean"
              label="Yes pays if the first name wins the score. No pays if the second wins. The market resolves on a signed score, not a vote."
            />
          </div>
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
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-caption text-terminal-fg-faint" id="bet-amount-label">Stake</p>
              <p className="text-label text-terminal-fg-faint">
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
                {connected ? (
                  <span className="ml-2 inline-block">
                    <SolFaucetButton />
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex items-stretch overflow-hidden rounded-md border border-terminal-border focus-within:border-terminal-border-strong">
              <button
                type="button"
                onClick={() => adjustStake(-1)}
                aria-label="Decrease stake"
                disabled={stakeNum <= 0}
                className="grid w-9 place-items-center bg-terminal-surface/60 text-title text-terminal-fg-muted transition-colors hover:text-terminal-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                aria-label="Bet amount in USD"
                aria-labelledby="bet-amount-label"
                className="h-12 w-20 bg-terminal-surface/60 px-2 text-right text-title font-semibold tabular-nums text-terminal-fg placeholder:text-terminal-fg-faint focus:outline-none sm:w-24"
              />
              <button
                type="button"
                onClick={() => adjustStake(1)}
                aria-label="Increase stake"
                className="grid w-9 place-items-center bg-terminal-surface/60 text-title text-terminal-fg-muted transition-colors hover:text-terminal-fg"
              >
                +
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className="h-9 rounded-full border border-terminal-border px-3 text-caption text-terminal-fg-muted transition-colors hover:border-terminal-border-strong hover:text-terminal-fg"
              >
                ${p}
              </button>
            ))}
          </div>
        </div>

        <RiskPanel
          stake={stakeNum}
          mult={activeMult}
          winTotal={winTotal}
          winNet={winNet}
          side={side}
        />

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-caption uppercase tracking-[0.1em] text-terminal-fg-faint">
            <span>Window</span>
            <InlineTip
              ariaLabel="What do the timers mean"
              label="First number is when betting closes. Second is when the answer arrives."
            />
          </div>
          <DualTimer
            closeTime={slot.closeTime}
            settlementTime={slot.settlementTime}
          />
        </div>
      </div>
    </>
  )
}

interface RiskPanelProps {
  stake: number
  mult: number | null
  winTotal: number
  winNet: number
  side: Side
}

function RiskPanel({ stake, mult, winTotal, winNet, side }: RiskPanelProps) {
  const hue = side === 'yes' ? 'text-emerald-300' : 'text-rose-300'
  const multText = mult === null ? '—' : `${mult.toFixed(2)}×`
  const empty = stake <= 0 || mult === null
  return (
    <div className="rounded-md border border-terminal-border bg-terminal-surface-deep/60 px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-caption uppercase tracking-[0.1em] text-terminal-fg-faint">
        <span>Payoff</span>
        <InlineTip
          ariaLabel="How is payoff calculated"
          label="Pool-based. Your share of the winners' pool, scaled to your stake. The multiplier shifts as the pool moves."
        />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-title font-semibold tabular-nums text-terminal-fg">
          {empty ? (
            <span className="text-terminal-fg-faint">Set a stake.</span>
          ) : (
            <>
              <span className="text-terminal-fg-muted">Risk {formatDollars(stake)}</span>
              <span className="mx-2 text-terminal-fg-faint">→</span>
              <span className={hue}>Win {formatDollars(winTotal)}</span>
            </>
          )}
        </p>
      </div>
      <p className="mt-0.5 text-caption text-terminal-fg-faint">
        {empty
          ? 'Pool-based. Multiplier moves as others enter.'
          : (
            <>
              <span>{multText}</span>
              <span className="mx-1.5">·</span>
              <span>+{formatDollars(winNet)} net</span>
            </>
          )}
      </p>
    </div>
  )
}

export interface PrimaryActionProps {
  connected: boolean
  placing: boolean
  disabled: boolean
  amount: string
  mult: number | null
  onConnect: () => void
  onSubmit: () => void
}

export function PrimaryAction({
  connected,
  placing,
  disabled,
  amount,
  mult,
  onConnect,
  onSubmit,
}: PrimaryActionProps) {
  const stakeNum = Number(amount || '0')
  const winTotal = mult && stakeNum > 0 ? stakeNum * mult : 0
  const showWin = winTotal > 0
  const label = !connected
    ? 'Connect to place bet'
    : placing
      ? 'Sending…'
      : showWin
        ? `Place bet · ${formatDollars(stakeNum)} → ${formatDollars(winTotal)}`
        : `Place bet · ${formatDollars(stakeNum)}`
  return (
    <button
      type="button"
      onClick={connected ? onSubmit : onConnect}
      disabled={connected && disabled}
      className="h-12 w-full rounded-md bg-emerald-400 font-semibold text-terminal-surface-deep transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
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
        'flex h-12 items-center justify-center gap-2 rounded-full text-body font-semibold transition-colors',
        active ? activeClasses : idleClasses,
      ].join(' ')}
    >
      <span>{label}</span>
      <span className="text-caption tabular-nums opacity-70">{multText}</span>
    </button>
  )
}
