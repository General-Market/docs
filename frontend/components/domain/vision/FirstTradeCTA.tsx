'use client'

import { Link } from '@/i18n/routing'
import { useAccount } from 'wagmi'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'

/**
 * Big tutorial banner shown when connected wallet has zero Vision history.
 * Renders nothing if wallet is disconnected or has any prior batches.
 */
export function FirstTradeCTA() {
  const { address } = useAccount()
  const { profile, isLoading } = usePlayerProfile(address ?? '')

  // Don't show if not connected, still loading, or has history
  if (!address || isLoading) return null
  if (profile && profile.batches.length > 0) return null

  return (
    <Link
      href="/first-trade"
      className="block border-2 border-dashed border-brand bg-brand-light hover:bg-brand/10 transition-colors px-6 py-5 group"
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0 w-10 h-10 bg-brand text-white flex items-center justify-center text-title font-black rounded-full animate-soft-pulse">
          ?
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body-sm font-black text-black group-hover:underline">
            New here? Place your first prediction
          </div>
          <div className="text-caption text-text-secondary mt-0.5">
            A 2-minute walkthrough — from picking a source to collecting winnings.
          </div>
        </div>
        <div className="shrink-0 text-text-muted text-lg">
          →
        </div>
      </div>
    </Link>
  )
}
