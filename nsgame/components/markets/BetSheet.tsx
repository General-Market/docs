'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { useWallet } from '@/hooks/useWallet'
import {
  type UpcomingSlot,
  useMarketState,
  usePlaceBet,
} from '@/lib/markets/hooks.stub'
import { useStakeBalance } from '@/lib/markets/hooks'
import { CountdownTimer } from './CountdownTimer'
import FaucetButton from './FaucetButton'

// Bottom sheet on mobile. Right drawer on desktop. The size of the
// commitment is small; the framing should match.

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

export interface BetSheetProps {
  slot: UpcomingSlot | null
  onClose: () => void
}

type Side = 'yes' | 'no'

export function BetSheet({ slot, onClose }: BetSheetProps) {
  const { connected } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()
  const state = useMarketState(slot?.marketPda ?? null)
  const placeBetCtl = usePlaceBet()
  const stakeBalance = useStakeBalance()

  const [side, setSide] = useState<Side>('yes')
  const [amount, setAmount] = useState<string>(PRESETS[0])
  const [lastSig, setLastSig] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Reset local state when a different slot opens.
  useEffect(() => {
    if (slot) {
      setSide('yes')
      setAmount(PRESETS[0])
      setLastSig(null)
      setLocalError(null)
    }
  }, [slot?.marketPda])

  // Lock body scroll while open.
  useEffect(() => {
    if (!slot) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [slot])

  // Close on Escape.
  useEffect(() => {
    if (!slot) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slot, onClose])

  const parsedUnits = useMemo(() => {
    try { return displayToUsdcUnits(amount) } catch { return 0n }
  }, [amount])

  const yesPct = useMemo(() => {
    if (!state) return null
    const total = state.totalYes + state.totalNo
    if (total === 0n) return null
    return Number((state.totalYes * 1000n) / total) / 10
  }, [state])

  async function handleSubmit() {
    if (!slot) return
    setLocalError(null)
    setLastSig(null)
    if (parsedUnits <= 0n) {
      setLocalError('Amount must be positive.')
      return
    }
    try {
      // TODO(agent-b): replace with the real placeBet flow once wired.
      // Expected signature:
      //   placeBet(slot: UpcomingSlot, side: 'yes' | 'no', amount: bigint)
      //     => Promise<string /* signature */>
      const sig = await placeBetCtl.placeBet(slot, side, parsedUnits)
      setLastSig(sig)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    }
  }

  const open = !!slot
  const error = localError ?? placeBetCtl.error
  const insufficientBalance =
    connected && parsedUnits > 0n && stakeBalance.raw < parsedUnits

  return (
    <AnimatePresence>
      {open && slot && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-hidden
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Place bet"
            className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-white shadow-modal lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:w-[420px] lg:max-h-none lg:rounded-none lg:border-l lg:border-zinc-200"
            initial={{ y: '100%', x: 0, opacity: 0 }}
            animate={{ y: 0, x: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  {slot.sourceName.replace(/^tubes_/, '')} · closes in{' '}
                  <CountdownTimer target={slot.closeTime} closedLabel="closed" />
                </p>
                <h2 className="text-base font-semibold leading-snug text-zinc-900">
                  {slot.label}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-m-2 grid h-11 w-11 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {slot.description && (
                <p className="text-sm text-zinc-600">{slot.description}</p>
              )}

              <div className="space-y-1.5 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.08em] text-zinc-500">
                  <span>current odds</span>
                  <span>{state ? 'live' : 'no pool yet'}</span>
                </div>
                {yesPct === null ? (
                  <p className="text-sm text-zinc-700">Be the first to take a side.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-[12px] font-mono">
                      <span className="text-emerald-700">YES {yesPct.toFixed(0)}%</span>
                      <span className="text-rose-700">NO {(100 - yesPct).toFixed(0)}%</span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-white">
                      <span className="block h-full bg-emerald-500" style={{ width: `${yesPct}%` }} aria-hidden />
                      <span className="block h-full bg-rose-500" style={{ width: `${100 - yesPct}%` }} aria-hidden />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSide('yes')}
                  className={[
                    'h-12 rounded-md text-sm font-semibold transition-colors',
                    side === 'yes'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  ].join(' ')}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setSide('no')}
                  className={[
                    'h-12 rounded-md text-sm font-semibold transition-colors',
                    side === 'no'
                      ? 'bg-rose-600 text-white'
                      : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  ].join(' ')}
                >
                  NO
                </button>
              </div>

              <div className="space-y-2">
                <label htmlFor="bet-amount" className="block text-[11px] font-mono uppercase tracking-[0.08em] text-zinc-500">
                  Amount (USDC)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="bet-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="h-11 flex-1 rounded-md border border-zinc-300 bg-white px-3 font-mono text-sm focus:border-zinc-900 focus:outline-none"
                    placeholder="0.00"
                  />
                  {PRESETS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(p)}
                      className={[
                        'h-11 min-w-[44px] rounded-md border px-3 font-mono text-xs',
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
                      ? 'Connect a wallet to see balance.'
                      : stakeBalance.loading && stakeBalance.raw === 0n
                        ? 'balance: —'
                        : stakeBalance.error
                          ? `balance: ${stakeBalance.error.toLowerCase()}`
                          : `balance: ${stakeBalance.display} USDC`}
                  </p>
                  {connected && stakeBalance.raw === 0n && <FaucetButton />}
                </div>
              </div>

              {insufficientBalance && (
                <p className="font-mono text-[11px] text-rose-700">
                  insufficient balance.
                </p>
              )}
              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {error}
                </div>
              )}
              {lastSig && (
                <div className="break-all rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-[11px] text-emerald-800">
                  Bet placed. {lastSig.slice(0, 8)}…{lastSig.slice(-8)}
                </div>
              )}
            </div>

            <div className="border-t border-zinc-200 bg-white px-5 py-4">
              {!connected ? (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="h-12 w-full rounded-md bg-zinc-900 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
                >
                  Connect a wallet to bet.
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={placeBetCtl.placing || parsedUnits <= 0n || insufficientBalance}
                  className={[
                    'h-12 w-full rounded-md text-sm font-semibold text-white transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    side === 'yes'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700',
                  ].join(' ')}
                >
                  {placeBetCtl.placing
                    ? 'Sending…'
                    : `Place ${side.toUpperCase()} · ${amount || '0'} USDC`}
                </button>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
