'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { isDevnet, isTestnet } from '@/lib/solana/cluster'

// Solana wallets don't expose their selected cluster, so we can't truly
// detect a mismatch — we can only warn. When the dapp is on devnet, this
// banner reminds the user that their wallet (Phantom, Solflare, …) needs
// its own toggle flipped to show the right balance and fees. Dismissible
// per wallet so it stops nagging once the user has done it.

interface WalletGuide {
  match: (name: string) => boolean
  label: string
  steps: string
}

const GUIDES: WalletGuide[] = [
  {
    match: n => /phantom/i.test(n),
    label: 'Phantom',
    steps: 'Settings → Developer Settings → Testnet Mode',
  },
  {
    match: n => /solflare/i.test(n),
    label: 'Solflare',
    steps: 'wallet header → network picker → Devnet',
  },
  {
    match: n => /trust/i.test(n),
    label: 'Trust',
    steps: 'Settings → Preferences → Developer Mode',
  },
]

function dismissKey(walletName: string, cluster: string): string {
  return `nsgame:netnotice:dismissed:${cluster}:${walletName.toLowerCase()}`
}

export default function WalletNetworkNotice() {
  const { wallet, connected } = useWallet()
  const [dismissed, setDismissed] = useState(true)

  // Active cluster is fixed at build time — pick the label once.
  const clusterLabel = isDevnet ? 'devnet' : isTestnet ? 'testnet' : null

  const walletName = wallet?.adapter.name ?? null
  const guide = walletName ? GUIDES.find(g => g.match(walletName)) ?? null : null

  useEffect(() => {
    if (!walletName || !clusterLabel) {
      setDismissed(true)
      return
    }
    try {
      const stored = window.localStorage.getItem(dismissKey(walletName, clusterLabel))
      setDismissed(stored === '1')
    } catch {
      setDismissed(false)
    }
  }, [walletName, clusterLabel])

  if (!clusterLabel) return null
  if (!connected || !walletName) return null
  if (!guide) return null
  if (dismissed) return null

  function handleDismiss() {
    if (!walletName || !clusterLabel) return
    try {
      window.localStorage.setItem(dismissKey(walletName, clusterLabel), '1')
    } catch {
      /* private mode — best effort */
    }
    setDismissed(true)
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-label text-amber-200/90">
      <svg
        aria-hidden="true"
        className="mt-[1px] shrink-0 text-amber-400"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
      <div className="flex-1">
        <p className="font-medium text-amber-100">
          {guide.label} needs {clusterLabel} mode.
        </p>
        <p className="mt-0.5 leading-snug text-amber-200/70">
          {guide.steps}. Otherwise the wallet shows mainnet balances and rejects fees.
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="-mr-1 -mt-1 rounded-md p-1 text-amber-300/60 transition-colors hover:bg-amber-500/10 hover:text-amber-100"
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}
