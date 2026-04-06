'use client'

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { OnboardingState, OnboardingStep } from '@/hooks/useOnboarding'

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

/* ─────────────────────────────────────────────
   Step definitions
   ───────────────────────────────────────────── */

interface StepDef {
  id: OnboardingStep
  number: number
  title: string
  description: string
  action: string
}

const STEP_DEFS: StepDef[] = [
  {
    id: 'wallet',
    number: 1,
    title: 'Connect Wallet',
    description: 'Install MetaMask if needed, then connect to the Index network.',
    action: 'CONNECT WALLET',
  },
  {
    id: 'faucet',
    number: 2,
    title: 'Claim Test Funds',
    description: '1,000 USDC + gas. One click. Enough to start.',
    action: 'CLAIM FAUCET',
  },
  {
    id: 'vault',
    number: 3,
    title: 'Join a Vault',
    description: 'Deposit into a vault. Your money trades automatically.',
    action: 'DEPOSIT',
  },
  {
    id: 'bot',
    number: 4,
    title: 'Deploy Your Bot',
    description: 'Go further. Build your own strategy with AI.',
    action: 'DEPLOY BOT',
  },
]

const FOLLOW_TUTO = [
  { flag: '\u{1F1EC}\u{1F1E7}', text: 'Follow the tutorial first' },
  { flag: '\u{1F1EF}\u{1F1F5}', text: '\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB\u3092\u5148\u306B\u5B8C\u4E86\u3057\u3066\u304F\u3060\u3055\u3044' },
  { flag: '\u{1F1E8}\u{1F1F3}', text: '\u8BF7\u5148\u5B8C\u6210\u6559\u7A0B' },
  { flag: '\u{1F1F0}\u{1F1F7}', text: '\uD29C\uD1A0\uB9AC\uC5BC\uC744 \uBA3C\uC800 \uC644\uB8CC\uD558\uC138\uC694' },
]

/* ─────────────────────────────────────────────
   Scanning light — CSS keyframes injected once
   ───────────────────────────────────────────── */

const LIGHT_STYLE_ID = 'onboarding-light-style'

function ensureLightStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(LIGHT_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = LIGHT_STYLE_ID
  style.textContent = `
    @keyframes onboarding-scan {
      0%   { transform: translateX(-100%) rotate(45deg); }
      100% { transform: translateX(300%) rotate(45deg); }
    }
  `
  document.head.appendChild(style)
}

/* ─────────────────────────────────────────────
   OnboardingGuide — sticky progress panel
   ───────────────────────────────────────────── */

interface OnboardingGuideProps {
  state: OnboardingState
  onVaultDeposit: () => void
  onBotDeploy: () => void
}

export function OnboardingGuide({ state, onVaultDeposit, onBotDeploy }: OnboardingGuideProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!state.isActive) return null

  const currentDef = STEP_DEFS.find(s => s.id === state.currentStep)!

  const handleAction = () => {
    switch (state.currentStep) {
      case 'wallet':
        state.connectWallet()
        break
      case 'faucet':
        state.claimFaucet()
        break
      case 'vault':
        onVaultDeposit()
        break
      case 'bot':
        onBotDeploy()
        break
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      className="relative bg-terminal-dark border border-white/[0.08] overflow-hidden"
    >
      {/* progress bar */}
      <div className="h-[2px] bg-white/[0.04]">
        <motion.div
          className="h-full bg-white/60"
          initial={{ width: 0 }}
          animate={{ width: `${(state.stepIndex / state.totalSteps) * 100}%` }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
        />
      </div>

      <div className="p-5">
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold tracking-[0.14em] text-white/30 uppercase">
              Getting Started
            </span>
            <span className="text-[10px] font-mono text-white/20">
              {state.stepIndex + 1}/{state.totalSteps}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="text-[10px] font-bold text-white/25 hover:text-white/50 transition-colors"
            >
              {collapsed ? 'EXPAND' : 'HIDE'}
            </button>
            <button
              onClick={state.dismiss}
              className="text-[10px] font-bold text-white/25 hover:text-white/50 transition-colors"
            >
              DISMISS
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            >
              {/* step pills */}
              <div className="flex gap-2 mb-5">
                {STEP_DEFS.map((def) => {
                  const isDone = state.completed[def.id]
                  const isCurrent = state.currentStep === def.id
                  return (
                    <div
                      key={def.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-[0.04em] transition-all ${
                        isDone
                          ? 'bg-white/[0.08] text-white/50'
                          : isCurrent
                            ? 'bg-white/[0.12] text-white border border-white/[0.15]'
                            : 'bg-white/[0.03] text-white/20'
                      }`}
                    >
                      {isDone ? (
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <span className="text-[9px] font-mono">{def.number}</span>
                      )}
                      <span className="hidden sm:inline">{def.title}</span>
                    </div>
                  )
                })}
              </div>

              {/* current step detail */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
                <div>
                  <h3 className="text-[16px] sm:text-[18px] font-black text-white leading-tight mb-1">
                    {currentDef.title}
                  </h3>
                  <p className="text-[11px] sm:text-[12px] text-white/35 leading-relaxed max-w-md">
                    {currentDef.description}
                  </p>
                </div>

                <button
                  onClick={handleAction}
                  disabled={state.currentStep === 'faucet' && state.faucetLoading}
                  className="shrink-0 w-full sm:w-auto px-6 py-2.5 bg-white text-black text-[12px] font-black tracking-[0.04em] hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  {state.currentStep === 'faucet' && state.faucetLoading
                    ? 'CLAIMING...'
                    : currentDef.action}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   FloatingReminder — fixed viewport, scanning light
   ───────────────────────────────────────────── */

export function FloatingReminder({ state }: { state: OnboardingState }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { ensureLightStyles() }, [])

  // Only show when onboarding is active (not dismissed, not complete)
  if (!state.isActive) return null

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="relative overflow-hidden bg-terminal-dark border border-white/[0.1] px-5 py-3.5 shadow-2xl">
        {/* scanning light */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
            width: '40%',
            animation: 'onboarding-scan 3s ease-in-out infinite',
          }}
        />

        <div className="relative space-y-1.5">
          {FOLLOW_TUTO.map(({ flag, text }) => (
            <div key={flag} className="flex items-center gap-2.5">
              <span className="text-[14px] leading-none shrink-0">{flag}</span>
              <span className="text-[11px] font-bold text-white/70 whitespace-nowrap">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   OnboardingGate — wraps sections to block
   ───────────────────────────────────────────── */

interface OnboardingGateProps {
  requiredStep: OnboardingStep
  state: OnboardingState
  children: ReactNode
}

const STEP_ORDER: Record<OnboardingStep, number> = {
  wallet: 0,
  faucet: 1,
  vault: 2,
  bot: 3,
}

export function OnboardingGate({
  requiredStep,
  state,
  children,
}: OnboardingGateProps) {
  const stepReached = state.isComplete || STEP_ORDER[state.currentStep] >= STEP_ORDER[requiredStep]
  const isDormant = state.dismissed && !stepReached

  const handleTrapClick = useCallback((e: React.MouseEvent) => {
    if (stepReached) return
    e.stopPropagation()
    if (isDormant) {
      e.preventDefault()
      state.reset()
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [stepReached, isDormant, state])

  if (stepReached) return <>{children}</>

  if (isDormant) {
    return (
      <div onClickCapture={handleTrapClick}>
        {children}
      </div>
    )
  }

  return (
    <div className="relative" onClickCapture={handleTrapClick}>
      <div className="opacity-30 pointer-events-none select-none transition-opacity duration-300">
        {children}
      </div>
      <div className="absolute inset-0 cursor-not-allowed z-10" />
    </div>
  )
}
