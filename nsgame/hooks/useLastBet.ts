'use client'

import { useEffect, useState } from 'react'

// The last open bet the user placed. Persisted in localStorage so the
// page always knows where the user left off, even after a reload. The
// writer is BetSheet's success path — wired in a follow-up phase. This
// hook only reads. If the entry is missing or malformed, it returns
// null and the consumer renders nothing.

export const LAST_BET_STORAGE_KEY = 'nsgame_last_open_bet'

export interface LastOpenBet {
  /** base58 of the Market PDA. */
  marketPda: string
  side: 'yes' | 'no'
  /** USDC base units (6 decimals). String to avoid bigint serialization issues. */
  stake: string
  /** Unix seconds. The market closes at this moment; pill hides past it. */
  closesAt: number
  /** Optional, used for the human label inside the pill. */
  marketLabel?: string
  /** Optional, the picked competitor (yes side display name). */
  pickLabel?: string
}

function parse(raw: string | null): LastOpenBet | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<LastOpenBet>
    if (
      typeof v.marketPda === 'string' &&
      (v.side === 'yes' || v.side === 'no') &&
      typeof v.stake === 'string' &&
      typeof v.closesAt === 'number'
    ) {
      return {
        marketPda: v.marketPda,
        side: v.side,
        stake: v.stake,
        closesAt: v.closesAt,
        marketLabel: typeof v.marketLabel === 'string' ? v.marketLabel : undefined,
        pickLabel: typeof v.pickLabel === 'string' ? v.pickLabel : undefined,
      }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Reads the last open bet from localStorage and listens for cross-tab
 * updates via the `storage` event and same-tab updates via a custom
 * `nsgame:last-bet-changed` event. The writer (Phase 2) should
 * `localStorage.setItem(LAST_BET_STORAGE_KEY, JSON.stringify(...))` and
 * dispatch a `new Event('nsgame:last-bet-changed')` so this hook
 * picks it up without a reload.
 */
export function useLastBet(): LastOpenBet | null {
  const [bet, setBet] = useState<LastOpenBet | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setBet(parse(window.localStorage.getItem(LAST_BET_STORAGE_KEY)))

    const reread = () => {
      setBet(parse(window.localStorage.getItem(LAST_BET_STORAGE_KEY)))
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_BET_STORAGE_KEY) reread()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('nsgame:last-bet-changed', reread)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('nsgame:last-bet-changed', reread)
    }
  }, [])

  return bet
}
