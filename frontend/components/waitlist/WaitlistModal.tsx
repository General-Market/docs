'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAccount, useConnect } from 'wagmi'
import { SpringBackdrop, SpringModal, glass, ModalClose } from '@/components/ui/spring'
import { indexL3 } from '@/lib/wagmi'

interface Props {
  onClose: () => void
  onRedeemed: () => void
  onWalletConnected?: () => void
}

type RedeemReason = 'invalid' | 'exhausted' | 'expired' | 'wallet_taken'

const REASON_TEXT: Record<RedeemReason, string> = {
  invalid: 'That code does not exist.',
  exhausted: 'This code has already been used.',
  expired: 'This code has expired.',
  wallet_taken: 'This wallet is already on a different code.',
}

export function WaitlistModal({ onClose, onRedeemed, onWalletConnected }: Props) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const injectedConnector = connectors.find((c) => c.id === 'injected')

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isConnected && address) onWalletConnected?.()
  }, [isConnected, address, onWalletConnected])

  // Lock body scroll while the modal is open — without this, the page
  // behind the backdrop scrolls and the modal feels detached from the
  // user's gaze.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const handleConnect = () => {
    if (!injectedConnector) return
    connect({ connector: injectedConnector, chainId: indexL3.id })
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!address || !code.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/waitlist/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, code: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setSuccess(true)
        setTimeout(() => onRedeemed(), 1400)
        return
      }
      const reason = data?.reason as RedeemReason | undefined
      setError(reason ? REASON_TEXT[reason] : data?.error || 'Could not redeem code.')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = isConnected && code.trim().length >= 3 && !submitting

  if (!mounted || typeof document === 'undefined') return null

  const node = (
    <SpringBackdrop className={glass.backdrop} onClick={success ? undefined : onClose}>
      <SpringModal className={`${glass.modal} max-w-[640px] w-full p-8 sm:p-10 relative`}>
        {!success && (
          <div className="absolute top-4 right-4">
            <ModalClose onClick={onClose} />
          </div>
        )}

        {success ? (
          <div className="flex flex-col items-center text-center py-8 sm:py-12">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
              style={{
                background: 'rgba(16,185,129,0.10)',
                border: '1px solid rgba(16,185,129,0.30)',
                boxShadow: '0 0 0 6px rgba(16,185,129,0.06)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-[-0.022em] text-text-primary leading-tight">
              Welcome aboard.
            </h2>
            <p className="mt-3 text-[15px] text-text-muted max-w-[440px]">
              Your wallet is whitelisted. The faucet is yours, and the rest of the site too.
            </p>
            <p className="mt-5 text-[12px] uppercase tracking-[0.16em] text-text-muted">
              Returning you to what you were doing…
            </p>
          </div>
        ) : (
        <>
        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-14 h-14 rounded-full bg-black/5 border border-black/10 flex items-center justify-center mb-5">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zm10-12V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.022em] text-text-primary leading-tight">
            {isConnected ? 'This wallet is not whitelisted' : 'Whitelist required'}
          </h2>
          <p className="mt-2 text-[15px] text-text-muted max-w-[440px]">
            {isConnected
              ? 'Enter the invite code you were given, or apply on the waitlist if you don\'t have one.'
              : 'The faucet is closed to the curious and open to the chosen. Connect your wallet, enter a code.'}
          </p>

          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting || !injectedConnector}
              className="mt-7 px-8 h-12 bg-zinc-900 text-white text-[15px] font-medium rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[220px]"
            >
              {isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mt-7 w-full max-w-[400px]">
              <input
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(null) }}
                placeholder="Enter invite code"
                autoComplete="off"
                spellCheck={false}
                className={`${glass.input} text-center !text-[16px] tracking-[0.04em] uppercase`}
                disabled={submitting}
                maxLength={64}
              />
              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-3 w-full h-12 bg-zinc-900 text-white text-[15px] font-medium rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Verifying…' : 'Submit code'}
              </button>
              {error && (
                <p className="mt-3 text-[13px] text-red-600">{error}</p>
              )}
            </form>
          )}

          <a
            href="/waitlist"
            className="mt-5 text-[13px] text-text-muted hover:text-text-primary underline underline-offset-4 decoration-black/20 hover:decoration-black/60 transition-colors"
          >
            Don&apos;t have a code? Apply on the waitlist →
          </a>
        </div>

        <div className="mt-10 pt-8 border-t border-black/[0.08]">
          <p className="text-center text-[13px] text-text-muted mb-4">Other ways in — soon.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SoonCard
              title="Refer 3+ friends"
              caption="More invites = faster access"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-6a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <SoonCard
              title="Follow on X"
              caption="One human-shaped signal"
              icon={
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2H21l-6.51 7.44L22 22h-6.86l-4.79-6.26L4.86 22H2.1l6.96-7.95L2 2h7.04l4.33 5.72L18.24 2zm-2.4 18.34h1.83L7.27 3.57H5.32l10.52 16.77z" />
                </svg>
              }
            />
            <SoonCard
              title="Hold $GM"
              caption="Skin in the game"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </div>
        </>
        )}
      </SpringModal>
    </SpringBackdrop>
  )

  return createPortal(node, document.body)
}

function SoonCard({ title, caption, icon }: { title: string; caption: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-black/[0.03] border border-black/[0.06] p-4 opacity-60 select-none relative">
      <div className="absolute top-2 right-2 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted bg-black/[0.05] rounded-full px-2 py-0.5">
        Soon
      </div>
      <div className="w-7 h-7 text-text-primary mb-3">{icon}</div>
      <p className="text-[14px] font-medium text-text-primary leading-tight">{title}</p>
      <p className="mt-1 text-[12px] text-text-muted leading-snug">{caption}</p>
    </div>
  )
}
