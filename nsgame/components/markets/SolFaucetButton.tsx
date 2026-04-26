'use client'

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useToast } from '@/lib/contexts/ToastContext'

// Devnet SOL nudge. The public faucet at faucet.solana.com handles the
// rate-limiting, captchas, and IP throttling far better than we ever
// could from a single server. We just copy the user's address and open
// the portal in a new tab.

const FAUCET_URL = 'https://faucet.solana.com/'

// Hide the button once the wallet holds enough lamports for a bet plus
// a few retries — ~0.001 SOL covers ~12 typical fees on devnet.
const SUFFICIENT_LAMPORTS = 0.001 * LAMPORTS_PER_SOL

const POLL_MS = 15_000

export default function SolFaucetButton() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const toast = useToast()
  const [lamports, setLamports] = useState<number | null>(null)

  useEffect(() => {
    if (!connected || !publicKey) {
      setLamports(null)
      return
    }
    let cancelled = false
    const read = async () => {
      try {
        const value = await connection.getBalance(publicKey, 'confirmed')
        if (!cancelled) setLamports(value)
      } catch {
        // Leave the button visible if the read fails — better to over-show
        // a faucet button than to hide a fix the user might need.
        if (!cancelled) setLamports(prev => prev ?? 0)
      }
    }
    read()
    const id = window.setInterval(read, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [connected, publicKey, connection])

  if (process.env.NEXT_PUBLIC_FAUCET_ENABLED !== '1') return null
  if (!connected || !publicKey) return null
  if (lamports !== null && lamports >= SUFFICIENT_LAMPORTS) return null

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
        className="flex h-9 items-center gap-1.5 rounded-[5px] bg-terminal-surface-deep px-2.5 font-mono text-label uppercase tracking-[0.08em] text-emerald-200 transition-colors hover:text-emerald-100"
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
