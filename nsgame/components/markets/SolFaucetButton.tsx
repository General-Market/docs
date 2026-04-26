'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useToast } from '@/lib/contexts/ToastContext'

// Devnet SOL nudge. The public faucet at faucet.solana.com handles the
// rate-limiting, captchas, and IP throttling far better than we ever
// could from a single server. We just copy the user's address and open
// the portal in a new tab.

const FAUCET_URL = 'https://faucet.solana.com/'

export default function SolFaucetButton() {
  const { publicKey, connected } = useWallet()
  const toast = useToast()

  if (process.env.NEXT_PUBLIC_FAUCET_ENABLED !== '1') return null
  if (!connected || !publicKey) return null

  async function handleClick() {
    if (!publicKey) return
    const address = publicKey.toBase58()
    try {
      await navigator.clipboard.writeText(address)
      toast.showSuccess('Address copied. Paste it on the Solana faucet.', {
        url: FAUCET_URL,
        text: 'Open faucet',
      })
    } catch {
      toast.showInfo('Open the Solana faucet and paste your address there.')
    }
    window.open(FAUCET_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <span className="faucet-glow inline-block p-px align-middle">
      <button
        type="button"
        onClick={handleClick}
        className="flex h-7 items-center gap-1.5 rounded-[5px] bg-zinc-950 px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-200 transition-colors hover:text-emerald-100"
      >
        Get devnet SOL
        <svg
          aria-hidden="true"
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 17L17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </button>
    </span>
  )
}
