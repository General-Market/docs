'use client'

import { useState, useEffect, useCallback } from 'react'
import { YouTubeLite } from '@/components/ui/YouTubeLite'

const STORAGE_KEY = 'gm-onboarding-completed'
const TOTAL_STEPS = 3

// Replace with real video ID when available
const ONBOARDING_VIDEO_ID = ''

interface StepProps {
  onNext: () => void
  onSkip: () => void
}

/* ── Step 1: Welcome + Video ── */
function StepWelcome({ onNext, onSkip }: StepProps) {
  return (
    <div className="animate-fade-up">
      <div className="type-label mb-6">WELCOME TO GENERAL MARKET</div>

      <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary leading-tight mb-3">
        Index products for<br />the digital asset economy.
      </h2>

      <p className="text-sm text-text-secondary mb-8 max-w-md">
        Create diversified crypto portfolios in one transaction.
        Buy, sell, lend, and backtest — all on-chain.
      </p>

      {/* Video or placeholder */}
      <div className="rounded-card overflow-hidden border border-border-light mb-6">
        {ONBOARDING_VIDEO_ID ? (
          <YouTubeLite videoId={ONBOARDING_VIDEO_ID} title="General Market — How It Works" />
        ) : (
          <div className="aspect-video bg-zinc-100 flex items-center justify-center">
            <div className="text-center">
              <div className="font-mono text-4xl text-text-muted mb-2">▶</div>
              <div className="type-label">VIDEO COMING SOON</div>
            </div>
          </div>
        )}
      </div>

      {/* Feature pills below video */}
      <div className="grid grid-cols-3 gap-2 mb-8 stagger">
        <FeaturePill
          label="ON-CHAIN"
          detail="Fully transparent"
          icon="◈"
        />
        <FeaturePill
          label="1 TOKEN"
          detail="= diversified portfolio"
          icon="●"
        />
        <FeaturePill
          label="YIELD"
          detail="Lend ITP shares"
          icon="◐"
        />
      </div>

      {/* Scrolling ticker of what you can do */}
      <div className="flex gap-3 overflow-x-auto pb-1 mb-8 -mx-1 px-1 scrollbar-hide stagger">
        <ActionChip onClick={onNext}>See live ITPs →</ActionChip>
        <ActionChip onClick={() => {
          onSkip()
          setTimeout(() => document.getElementById('backtest')?.scrollIntoView({ behavior: 'smooth' }), 100)
        }}>Backtest a strategy →</ActionChip>
        <ActionChip onClick={() => {
          onSkip()
          setTimeout(() => document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' }), 100)
        }}>Create your own →</ActionChip>
      </div>

      <StepFooter step={1} onNext={onNext} onSkip={onSkip} nextLabel="How ITPs Work" />
    </div>
  )
}

/* ── Step 2: How ITPs Work ── */
function StepItpExplainer({ onNext, onSkip }: StepProps) {
  return (
    <div className="animate-fade-up">
      <div className="type-label mb-6">HOW IT WORKS</div>

      <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary leading-tight mb-8">
        One token. Many assets.
      </h2>

      <div className="space-y-0 stagger">
        {/* Step cards */}
        <FlowStep
          number="1"
          title="PICK"
          description="Choose assets and weights — or start from a backtest."
          example="40% ETH, 30% BTC, 15% SOL, 15% LINK"
        />
        <div className="flex justify-center py-1">
          <div className="w-px h-6 bg-border-light" />
        </div>
        <FlowStep
          number="2"
          title="MINT"
          description="Your ITP is deployed on-chain. One token represents the whole basket."
          example="NAV starts at $1.00 — floats with underlying prices"
        />
        <div className="flex justify-center py-1">
          <div className="w-px h-6 bg-border-light" />
        </div>
        <FlowStep
          number="3"
          title="TRADE"
          description="Buy, sell, rebalance. Lend your ITP shares to earn yield."
          example="No custody risk — settlement is atomic"
        />
      </div>

      <div className="mt-8">
        <StepFooter step={2} onNext={onNext} onSkip={onSkip} nextLabel="Get Started" />
      </div>
    </div>
  )
}

/* ── Step 3: Get Started ── */
function StepGetStarted({ onNext, onSkip }: StepProps) {
  return (
    <div className="animate-fade-up">
      <div className="type-label mb-6">GET STARTED</div>

      <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary leading-tight mb-3">
        Three paths forward.
      </h2>

      <p className="text-sm text-text-secondary mb-8">
        Every interesting system offers more than one entrance.
      </p>

      <div className="space-y-3 stagger">
        <PathCard
          icon="┌─────┐"
          title="Browse Markets"
          description="See what's deployed. Study the NAVs. No wallet needed."
          action="Continue"
          onClick={onNext}
          primary
        />
        <PathCard
          icon="○ ○ ○"
          title="Create an ITP"
          description="Design a portfolio, backtest it, deploy it on-chain."
          action="Go to Create"
          onClick={() => {
            onNext()
            setTimeout(() => {
              document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
          }}
        />
        <PathCard
          icon="$ _"
          title="Deploy an Agent"
          description="Let your AI trade autonomously across all markets."
          action="Read the Docs"
          onClick={() => {
            onNext()
            window.open('https://docs.generalmarket.io', '_blank')
          }}
        />
      </div>

      <div className="mt-8 flex justify-between items-center">
        <StepDots current={3} total={TOTAL_STEPS} />
        <button
          onClick={onSkip}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}

/* ── Shared: Feature Pill ── */
function FeaturePill({ label, detail, icon }: { label: string; detail: string; icon: string }) {
  return (
    <div className="text-center p-3 rounded-card border border-border-light bg-zinc-50 animate-fade-up">
      <div className="font-mono text-lg text-text-primary mb-1">{icon}</div>
      <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-text-primary">{label}</div>
      <div className="text-[10px] text-text-muted mt-0.5">{detail}</div>
    </div>
  )
}

/* ── Shared: Action Chip ── */
function ActionChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-4 py-2 border-2 border-black rounded-full text-xs font-semibold text-black bg-white hover:bg-black hover:text-white transition-colors press animate-fade-up"
    >
      {children}
    </button>
  )
}

/* ── Shared: Flow Step Card ── */
function FlowStep({ number, title, description, example }: {
  number: string
  title: string
  description: string
  example: string
}) {
  return (
    <div className="flex gap-4 items-start p-4 border border-border-light rounded-card bg-white animate-fade-up">
      <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-black flex items-center justify-center">
        <span className="font-mono text-xs font-bold">{number}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs font-bold tracking-[0.08em] mb-1">{title}</div>
        <div className="text-sm text-text-secondary">{description}</div>
        <div className="text-xs text-text-muted font-mono mt-1">{example}</div>
      </div>
    </div>
  )
}

/* ── Shared: Path Card ── */
function PathCard({ icon, title, description, action, onClick, primary }: {
  icon: string
  title: string
  description: string
  action: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-card border transition-all press animate-fade-up group ${
        primary
          ? 'border-black bg-white hover:bg-zinc-50'
          : 'border-border-light bg-white hover:border-black'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="font-mono text-xs text-text-muted leading-none whitespace-pre mt-1">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-text-primary mb-0.5">{title}</div>
          <div className="text-xs text-text-secondary">{description}</div>
        </div>
        <div className="flex-shrink-0 text-xs font-semibold text-text-muted group-hover:text-text-primary transition-colors mt-1">
          {action} →
        </div>
      </div>
    </button>
  )
}

/* ── Shared: Step Dots ── */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="tablist" aria-label="Onboarding progress">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            i + 1 === current ? 'bg-black' : 'bg-zinc-300'
          }`}
          role="tab"
          aria-selected={i + 1 === current}
          aria-label={`Step ${i + 1} of ${total}`}
        />
      ))}
    </div>
  )
}

/* ── Shared: Step Footer ── */
function StepFooter({ step, onNext, onSkip, nextLabel }: {
  step: number
  onNext: () => void
  onSkip: () => void
  nextLabel: string
}) {
  return (
    <div className="flex justify-between items-center">
      <StepDots current={step} total={TOTAL_STEPS} />
      <div className="flex items-center gap-4">
        <button
          onClick={onSkip}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Skip
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-md hover:bg-zinc-800 transition-colors press"
        >
          {nextLabel} →
        </button>
      </div>
    </div>
  )
}

/* ── Main Modal ── */
export function OnboardingModal() {
  const [step, setStep] = useState(1)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    if (!completed) {
      setVisible(true)
    }
    setMounted(true)
  }, [])

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }, [])

  const next = useCallback(() => {
    if (step >= TOTAL_STEPS) {
      complete()
    } else {
      setStep(s => s + 1)
    }
  }, [step, complete])

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        complete()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        next()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [visible, next, complete])

  if (!mounted || !visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-backdrop-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to General Market"
    >
      {/* Backdrop click to skip */}
      <div className="absolute inset-0" onClick={complete} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-card shadow-modal p-8 animate-modal-in overflow-y-auto max-h-[90vh]">
        {step === 1 && <StepWelcome onNext={next} onSkip={complete} />}
        {step === 2 && <StepItpExplainer onNext={next} onSkip={complete} />}
        {step === 3 && <StepGetStarted onNext={complete} onSkip={complete} />}
      </div>
    </div>
  )
}
