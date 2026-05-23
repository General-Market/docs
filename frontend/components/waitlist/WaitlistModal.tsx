'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAccount, useConnect } from 'wagmi'
import { SpringBackdrop, SpringModal, glass, ModalClose } from '@/components/ui/spring'
import { useWalletLogin } from '@/hooks/useWalletLogin'

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

const HANDLE_RE = /^[A-Za-z0-9_]{1,32}$/

type Step = 'handle' | 'reveal' | 'redeem'

export function WaitlistModal({ onClose, onRedeemed, onWalletConnected }: Props) {
  const { address, isConnected } = useAccount()
  const { isPending: isConnecting } = useConnect()
  const login = useWalletLogin({ source: 'waitlist-modal' })

  const [step, setStep] = useState<Step>('handle')
  const [handle, setHandle] = useState('')
  const [code, setCode] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)
  const autoRedeemRef = useRef(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isConnected && address) onWalletConnected?.()
  }, [isConnected, address, onWalletConnected])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const cleanHandle = handle.trim().replace(/^@+/, '')

  const handleIssue = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (issuing) return
    if (!HANDLE_RE.test(cleanHandle)) {
      setIssueError('Twitter handles are letters, numbers and underscores only.')
      return
    }
    setIssuing(true)
    setIssueError(null)
    try {
      const res = await fetch('/api/waitlist/issue-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: cleanHandle }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok && typeof data.code === 'string') {
        setCode(data.code)
        setStep('reveal')
        return
      }
      if (res.status === 429) {
        setIssueError('Too many tries. Wait a few minutes and try again.')
      } else if (data?.reason === 'invalid_handle') {
        setIssueError('That handle does not look right.')
      } else {
        setIssueError('Could not issue a code. Try again in a moment.')
      }
    } catch {
      setIssueError('Network error. Try again.')
    } finally {
      setIssuing(false)
    }
  }

  const handleRedeem = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!address || !code.trim() || redeeming) return
    setRedeeming(true)
    setRedeemError(null)
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
      setRedeemError(reason ? REASON_TEXT[reason] : data?.error || 'Could not redeem code.')
    } catch {
      setRedeemError('Network error. Try again.')
    } finally {
      setRedeeming(false)
    }
  }

  // Auto-fire redeem as soon as the wallet connects on the redeem step.
  // One user click on "Connect wallet" now covers connect + redeem; without
  // this, the wallet returns and the user has to click again.
  useEffect(() => {
    if (step !== 'redeem') return
    if (!isConnected || !address || !code) return
    if (redeeming || success || autoRedeemRef.current) return
    autoRedeemRef.current = true
    void handleRedeem()
  // handleRedeem is stable enough — gating is done via autoRedeemRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isConnected, address, code, redeeming, success])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard blocked — the user can still read and re-type the code.
    }
  }

  if (!mounted || typeof document === 'undefined') return null

  const node = (
    <SpringBackdrop
      className={glass.backdrop}
      onClick={success ? undefined : onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <SpringModal className={`${glass.modal} max-w-[640px] w-full p-8 sm:p-10 relative`}>
        {!success && (
          <div className="absolute top-4 right-4">
            <ModalClose onClick={onClose} />
          </div>
        )}

        {success ? (
          <SuccessPanel />
        ) : step === 'handle' ? (
          <HandlePanel
            handle={handle}
            onHandleChange={(v) => { setHandle(v); setIssueError(null) }}
            onSubmit={handleIssue}
            error={issueError}
            submitting={issuing}
            valid={HANDLE_RE.test(cleanHandle)}
          />
        ) : step === 'reveal' ? (
          <RevealPanel
            handle={cleanHandle}
            code={code}
            copied={copied}
            onCopy={copy}
            onContinue={() => setStep('redeem')}
          />
        ) : (
          <RedeemPanel
            code={code}
            isConnected={isConnected}
            isConnecting={isConnecting}
            onConnect={login}
            onSubmit={handleRedeem}
            redeeming={redeeming}
            error={redeemError}
          />
        )}
      </SpringModal>
    </SpringBackdrop>
  )

  return createPortal(node, document.body)
}

function HandlePanel({
  handle,
  onHandleChange,
  onSubmit,
  error,
  submitting,
  valid,
}: {
  handle: string
  onHandleChange: (v: string) => void
  onSubmit: (e?: React.FormEvent) => void
  error: string | null
  submitting: boolean
  valid: boolean
}) {
  return (
    <div className="flex flex-col items-center text-center pt-2">
      <div className="w-14 h-14 rounded-full bg-black/5 border border-black/10 flex items-center justify-center mb-5">
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M18.244 2H21l-6.51 7.44L22 22h-6.86l-4.79-6.26L4.86 22H2.1l6.96-7.95L2 2h7.04l4.33 5.72L18.24 2zm-2.4 18.34h1.83L7.27 3.57H5.32l10.52 16.77z" />
        </svg>
      </div>

      <h2 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.022em] text-text-primary leading-tight">
        Your handle, your code
      </h2>
      <p className="mt-2 text-[15px] text-text-muted max-w-[440px]">
        Drop your Twitter handle. We mint a one-shot code on the spot, and the gate opens.
      </p>

      <form onSubmit={onSubmit} className="mt-7 w-full max-w-[400px]">
        <div className="relative">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-text-muted pointer-events-none"
            aria-hidden
          >
            @
          </span>
          <input
            type="text"
            value={handle.replace(/^@+/, '')}
            onChange={(e) => onHandleChange(e.target.value)}
            placeholder="yourhandle"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={`${glass.input} pl-9 !text-[16px]`}
            disabled={submitting}
            maxLength={32}
          />
        </div>
        <button
          type="submit"
          disabled={!valid || submitting}
          className="mt-3 w-full h-12 bg-zinc-900 text-white text-[15px] font-medium rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Minting your code…' : 'Get my code'}
        </button>
        {error && (
          <p className="mt-3 text-[13px] text-red-600">{error}</p>
        )}
      </form>
    </div>
  )
}

function RevealPanel({
  handle,
  code,
  copied,
  onCopy,
  onContinue,
}: {
  handle: string
  code: string
  copied: boolean
  onCopy: () => void
  onContinue: () => void
}) {
  return (
    <div className="flex flex-col items-center text-center pt-2">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
        style={{
          background: 'rgba(0,82,255,0.08)',
          border: '1px solid rgba(0,82,255,0.22)',
        }}
      >
        <svg className="w-7 h-7" fill="none" stroke="#0052FF" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h2 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.022em] text-text-primary leading-tight">
        Here is your code, @{handle}
      </h2>
      <p className="mt-2 text-[15px] text-text-muted max-w-[440px]">
        Keep it. One wallet, one use. Same handle, same code on every visit.
      </p>

      <button
        type="button"
        onClick={onCopy}
        className="mt-7 group relative inline-flex items-center gap-3 rounded-2xl px-5 py-4 transition-colors"
        style={{
          background: '#0A0A0A',
          color: '#FFFFFF',
          boxShadow: '0 1px 0 rgba(255,255,255,0.10) inset, 0 14px 36px -16px rgba(10,10,12,0.55)',
        }}
        aria-label="Copy code"
      >
        <span className="font-mono tracking-[0.18em] text-[20px] sm:text-[22px] tabular-nums">
          {code}
        </span>
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/10">
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
        </span>
      </button>
      <p className="mt-2 h-4 text-[12px] uppercase tracking-[0.16em] text-text-muted">
        {copied ? 'Copied' : 'Tap to copy'}
      </p>

      <button
        type="button"
        onClick={onContinue}
        className="mt-6 w-full max-w-[400px] h-12 bg-zinc-900 text-white text-[15px] font-medium rounded-full hover:bg-zinc-800 transition-colors"
      >
        Connect wallet &amp; unlock →
      </button>
    </div>
  )
}

function RedeemPanel({
  code,
  isConnected,
  isConnecting,
  onConnect,
  onSubmit,
  redeeming,
  error,
}: {
  code: string
  isConnected: boolean
  isConnecting: boolean
  onConnect: () => void
  onSubmit: (e?: React.FormEvent) => void
  redeeming: boolean
  error: string | null
}) {
  return (
    <div className="flex flex-col items-center text-center pt-2">
      <div className="w-14 h-14 rounded-full bg-black/5 border border-black/10 flex items-center justify-center mb-5">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zm10-12V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>

      <h2 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.022em] text-text-primary leading-tight">
        {isConnected ? 'Last step — redeem' : 'Connect the wallet to unlock'}
      </h2>
      <p className="mt-2 text-[15px] text-text-muted max-w-[440px]">
        {isConnected
          ? 'Your code is pre-filled. Press Redeem and the gate opens.'
          : 'The code is bound to the first wallet you redeem it on. Connect, then redeem.'}
      </p>

      <div className="mt-7 w-full max-w-[400px]">
        <div
          className="flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-mono tracking-[0.18em] text-[15px] tabular-nums"
          style={{ background: '#F4F4F5', border: '1px solid rgba(10,10,12,0.08)' }}
          aria-label="Code being redeemed"
        >
          <span className="text-text-muted text-[11px] uppercase tracking-[0.16em] mr-1">Code</span>
          <span className="text-text-primary">{code}</span>
        </div>

        {!isConnected ? (
          <button
            type="button"
            onClick={onConnect}
            disabled={isConnecting}
            className="mt-3 w-full h-12 bg-zinc-900 text-white text-[15px] font-medium rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        ) : (
          <form onSubmit={onSubmit}>
            <button
              type="submit"
              disabled={redeeming}
              className="mt-3 w-full h-12 bg-zinc-900 text-white text-[15px] font-medium rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {redeeming ? 'Verifying…' : 'Redeem'}
            </button>
          </form>
        )}
        {error && (
          <p className="mt-3 text-[13px] text-red-600">{error}</p>
        )}
      </div>
    </div>
  )
}

function SuccessPanel() {
  return (
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
  )
}
