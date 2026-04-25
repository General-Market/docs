'use client'

import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useToast } from '@/lib/contexts/ToastContext'

// Dev-only faucet trigger. Renders nothing unless the env flag is set
// and a wallet is connected. The mint authority lives on the server;
// the client just asks politely.

interface FaucetButtonProps {
  onMinted?: () => void
}

type MintResponse =
  | { ok: true; signature: string; ata: string }
  | { ok: false; error: string }

export default function FaucetButton({ onMinted }: FaucetButtonProps) {
  const { publicKey, connected } = useWallet()
  const toast = useToast()
  const [pending, setPending] = useState(false)
  const [inlineMsg, setInlineMsg] = useState<string | null>(null)
  const inlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The toast context is optional from the component's perspective —
  // if a project ever renders this outside the provider, fall back
  // to inline messages.
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

  async function handleMint() {
    if (!publicKey) return
    setPending(true)
    setInlineMsg(null)
    try {
      const res = await fetch('/api/faucet/mint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: publicKey.toBase58() }),
      })
      const data = (await res.json()) as MintResponse
      if (!res.ok || !data.ok) {
        const err = !data.ok ? data.error : 'Mint failed.'
        toast.showError(err)
        showInlineMessage(err)
        return
      }
      toast.showSuccess('Minted.')
      showInlineMessage(`Minted. ${data.signature.slice(0, 8)}…`)
      onMinted?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mint failed.'
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
        onClick={handleMint}
        disabled={pending}
        className={[
          'h-7 rounded-md border px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
          pending
            ? 'cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-600'
            : 'border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800',
        ].join(' ')}
      >
        {pending ? 'Minting…' : 'Mint 100 USDC'}
      </button>
      {inlineMsg && (
        <span className="font-mono text-[10px] text-zinc-500">{inlineMsg}</span>
      )}
    </div>
  )
}
