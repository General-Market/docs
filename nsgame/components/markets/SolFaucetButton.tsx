'use client'

import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useToast } from '@/lib/contexts/ToastContext'

// Dev-only SOL airdrop trigger. Companion to FaucetButton: that one mints
// USDC, this one asks devnet for the SOL the wallet needs to pay fees.

interface SolFaucetButtonProps {
  onAirdropped?: () => void
}

type AirdropResponse =
  | { ok: true; signature: string; lamports: number }
  | { ok: false; error: string }

export default function SolFaucetButton({ onAirdropped }: SolFaucetButtonProps) {
  const { publicKey, connected } = useWallet()
  const toast = useToast()
  const [pending, setPending] = useState(false)
  const [inlineMsg, setInlineMsg] = useState<string | null>(null)
  const inlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showInlineMessage = (msg: string) => {
    setInlineMsg(msg)
    if (inlineTimer.current) clearTimeout(inlineTimer.current)
    inlineTimer.current = setTimeout(() => setInlineMsg(null), 3000)
  }

  useEffect(() => {
    return () => {
      if (inlineTimer.current) clearTimeout(inlineTimer.current)
    }
  }, [])

  if (process.env.NEXT_PUBLIC_FAUCET_ENABLED !== '1') return null
  if (!connected || !publicKey) return null

  async function handleAirdrop() {
    if (!publicKey) return
    setPending(true)
    setInlineMsg(null)
    try {
      const res = await fetch('/api/faucet/sol', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: publicKey.toBase58() }),
      })
      const raw = await res.text()
      let data: AirdropResponse | null = null
      try {
        data = JSON.parse(raw) as AirdropResponse
      } catch {
        /* non-JSON body — fall through */
      }
      if (!res.ok || !data || !data.ok) {
        const err =
          data && !data.ok
            ? data.error
            : `Airdrop failed (${res.status}). Try again in a moment.`
        toast.showError(err)
        showInlineMessage(err)
        return
      }
      toast.showSuccess('Airdrop sent. Wait a few seconds for confirmation.')
      showInlineMessage(`Sent. ${data.signature.slice(0, 8)}…`)
      onAirdropped?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Airdrop failed.'
      toast.showError(msg)
      showInlineMessage(msg)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleAirdrop}
        disabled={pending}
        className={[
          'h-7 rounded-md border px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
          pending
            ? 'cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-600'
            : 'border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800',
        ].join(' ')}
      >
        {pending ? 'Requesting…' : 'Get devnet SOL'}
      </button>
      {inlineMsg && (
        <span className="font-mono text-[10px] text-zinc-500">{inlineMsg}</span>
      )}
    </div>
  )
}
