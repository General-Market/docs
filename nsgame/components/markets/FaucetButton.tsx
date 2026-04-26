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
      // Some upstream errors (nginx timeouts, container restarts) come back
      // as plain text. Read the body once, then attempt JSON.
      const raw = await res.text()
      let data: MintResponse | null = null
      try {
        data = JSON.parse(raw) as MintResponse
      } catch {
        /* non-JSON body — fall through */
      }
      if (!res.ok || !data || !data.ok) {
        const err =
          data && !data.ok
            ? data.error
            : `Mint failed (${res.status}). Try again in a moment.`
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
      <span className="faucet-glow inline-block p-px align-middle">
        <button
          type="button"
          onClick={handleMint}
          disabled={pending}
          className={[
            'h-9 rounded-[5px] px-2.5 font-mono text-label uppercase tracking-[0.08em] transition-colors',
            pending
              ? 'cursor-not-allowed bg-terminal-surface text-terminal-fg-faint'
              : 'bg-terminal-surface-deep text-emerald-200 hover:text-emerald-100',
          ].join(' ')}
        >
          {pending ? 'Minting…' : 'Mint 100 USDC'}
        </button>
      </span>
      {inlineMsg && (
        <span className="font-mono text-label text-terminal-fg-faint">{inlineMsg}</span>
      )}
    </div>
  )
}
