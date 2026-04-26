'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { useWallet } from '@/hooks/useWallet'
import {
  type UpcomingSlot,
  useMarketState,
  usePlaceBet,
  useStakeBalance,
  deriveYesPct,
  pctToDecimalOdd,
} from '@/lib/markets/hooks'
import { BetBody } from './BetTicket'
import WalletNetworkNotice from './WalletNetworkNotice'

// Bottom sheet on mobile. Right drawer on desktop. Same body BetTicket
// renders, dressed in slide-up chrome and a close affordance.

const USDC_DECIMALS = 6

function displayToUsdcUnits(value: string): bigint {
  const trimmed = value.trim()
  if (!trimmed) return 0n
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) return 0n
  const [whole, frac = ''] = trimmed.split('.')
  const paddedFrac = (frac + '0'.repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS)
  return BigInt(whole || '0') * 10n ** BigInt(USDC_DECIMALS) + BigInt(paddedFrac || '0')
}

export interface BetSheetProps {
  slot: UpcomingSlot | null
  onClose: () => void
}

type Side = 'yes' | 'no'

export function BetSheet({ slot, onClose }: BetSheetProps) {
  const { connected, disconnect } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()
  const state = useMarketState(slot?.marketPda ?? null)
  const placeBetCtl = usePlaceBet()
  const stakeBalance = useStakeBalance()

  const [side, setSide] = useState<Side>('yes')
  const [amount, setAmount] = useState<string>('')
  const [lastSig, setLastSig] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Reset local state when a different slot opens.
  useEffect(() => {
    if (slot) {
      setSide('yes')
      setAmount('')
      setLastSig(null)
      setLocalError(null)
    }
  }, [slot?.marketPda])

  // Lock body scroll on mobile only. Desktop keeps the page scrollable
  // because the sheet lives in a side rail there.
  useEffect(() => {
    if (!slot) return
    if (typeof window !== 'undefined' &&
        window.matchMedia('(min-width: 1024px)').matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [slot])

  // Escape closes.
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

  // Same prior chain as BetTicket — empty pools fall back to the
  // audience baseline so the multiplier is never a dash.
  const yesPct = useMemo(
    () => slot ? deriveYesPct(state, slot.audienceA, slot.audienceB) : 50,
    [state, slot],
  )
  const noPct = 100 - yesPct
  const yesMult = useMemo(() => pctToDecimalOdd(yesPct), [yesPct])
  const noMult = useMemo(() => pctToDecimalOdd(noPct), [noPct])

  async function handleSubmit() {
    if (!slot) return
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

  const open = !!slot
  const error = localError ?? placeBetCtl.error
  const insufficientBalance =
    connected && parsedUnits > 0n && stakeBalance.raw < parsedUnits

  const pickedName = slot ? (side === 'yes' ? slot.displayA : slot.displayB) : ''
  const isOpen = slot ? slot.closeTime * 1000 > Date.now() : false

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
            className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl border-t border-terminal-border bg-terminal-surface shadow-modal lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:w-[420px] lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0"
            initial={{ y: '100%', x: 0, opacity: 0 }}
            animate={{ y: 0, x: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="flex-1 overflow-y-auto">
              <BetBody
                slot={slot}
                side={side}
                onSideChange={setSide}
                amount={amount}
                setAmount={setAmount}
                connected={connected}
                stakeBalance={stakeBalance}
                yesMult={yesMult}
                noMult={noMult}
                pickedName={pickedName}
                isOpen={isOpen}
                showClose
                onClose={onClose}
                sparkWidth={60}
                sparkHeight={16}
              />
            </div>

            <div className="border-t border-terminal-border px-4 py-3">
              <div className="mb-3 empty:hidden">
                <WalletNetworkNotice />
              </div>
              {!connected ? (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="h-12 w-full rounded-md bg-emerald-400 font-semibold text-terminal-surface-deep transition-colors hover:bg-emerald-300"
                >
                  Connect wallet to bet
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={placeBetCtl.placing || parsedUnits <= 0n || insufficientBalance}
                  className="h-12 w-full rounded-md bg-emerald-400 font-semibold text-terminal-surface-deep transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {placeBetCtl.placing
                    ? 'Sending…'
                    : `Buy ${pickedName} · $${amount || '0'}`}
                </button>
              )}

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
                  className="mt-2 block w-full text-micro text-terminal-fg-faint transition-colors hover:text-terminal-fg-muted"
                >
                  disconnect
                </button>
              ) : null}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
