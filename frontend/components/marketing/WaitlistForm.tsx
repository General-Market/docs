'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { springs } from '@/components/ui/spring'
import { DotGridBg } from '@/components/marketing/waitlist/DotGridBg'
import { CaveatArrow } from '@/components/marketing/waitlist/CaveatArrow'

const ACCENT = '#0052FF'
const FG = '#0A0A0A'
const FG_SOFT = '#1F1F24'
const DIM = '#6E727A'
const RULE = 'rgba(10,10,12,0.10)'
const SHEET_BG = '#FFFFFF'

type Choice = { value: string; label: string }

type WelcomeStep = {
  type: 'welcome'
  id: 'welcome'
  title: string
  body: string
  cta: string
  takes: string
}
type TextStep = {
  type: 'text' | 'email'
  id: string
  label: string
  description?: string
  placeholder?: string
  required?: boolean
}
type ChoiceStep = {
  type: 'choice'
  id: string
  label: string
  description?: string
  options: Choice[]
  required?: boolean
  multiple?: boolean
}

type Step = WelcomeStep | TextStep | ChoiceStep

const STEPS: Step[] = [
  {
    type: 'welcome',
    id: 'welcome',
    title: 'Be the first to have your pnl shielded from insider trading',
    body: 'Join the waitlist — early access, lower fees, and referral rewards',
    cta: 'Start',
    takes: '~90 seconds',
  },
  {
    type: 'text',
    id: 'twitter',
    label: 'Twitter',
    placeholder: '@handle',
    required: true,
  },
  {
    type: 'text',
    id: 'telegram',
    label: 'Telegram',
    placeholder: '@handle',
    required: true,
  },
  {
    type: 'email',
    id: 'email',
    label: 'Email',
    placeholder: 'you@domain.com',
    required: true,
  },
  {
    type: 'choice',
    id: 'protection_from',
    label: 'Against who your pnl needs protection',
    multiple: true,
    options: [
      { value: 'insider', label: 'Insider Traders' },
      { value: 'frontrun', label: 'Front Runners' },
      { value: 'manip', label: 'Market Manipulators' },
      { value: 'orderflow', label: 'Orderflow Buyers' },
    ],
  },
  {
    type: 'choice',
    id: 'has_invite',
    label: 'Do you have an invite code?',
    description: 'A code earns you trading-fee rakeback — no code? add one later, same waitlist either way',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    type: 'text',
    id: 'invite',
    label: 'Enter your invite code',
    placeholder: 'XXXX-XXXX-XXXX-XXXX',
  },
  {
    type: 'text',
    id: 'volume',
    label: 'Roughly how much do you trade per month?',
    description: 'Example: $5k – $10k',
    placeholder: 'Type your answer here…',
  },
  {
    type: 'choice',
    id: 'affiliate',
    label: 'Do you want to become an affiliate?',
    description: 'Affiliates earn by referring traders and projects',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    type: 'text',
    id: 'reach',
    label: 'How big is your reach?',
    description:
      'eg “5K Twitter followers”, “500 newsletter subs”, “active in 3 Discord communities”',
    placeholder: 'Type your answer here…',
  },
  {
    type: 'text',
    id: 'notes',
    label: 'Anything you’d like us to know?',
    placeholder: 'Type your answer here…',
  },
]

type AnswerValue = string | string[]
type Answers = Record<string, AnswerValue>

function shouldSkip(step: Step, answers: Answers): boolean {
  if (step.type === 'text' && step.id === 'reach' && answers.affiliate !== 'yes') return true
  if (step.type === 'text' && step.id === 'invite' && answers.has_invite !== 'yes') return true
  return false
}

function isValid(
  step: Step,
  value: AnswerValue,
): { ok: true } | { ok: false; reason: string } {
  if (step.type === 'welcome') return { ok: true }
  if (step.type === 'choice') {
    if (step.required) {
      if (step.multiple) {
        if (!Array.isArray(value) || value.length === 0)
          return { ok: false, reason: 'Pick at least one' }
      } else if (typeof value !== 'string' || !value) {
        return { ok: false, reason: 'Pick one' }
      }
    }
    return { ok: true }
  }
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (step.required && !trimmed) return { ok: false, reason: 'Required' }
  if (step.type === 'email' && trimmed) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!ok) return { ok: false, reason: 'That doesn’t look like an email' }
  }
  return { ok: true }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function normalizeHandle(s: string): string {
  return s.trim().replace(/^@+/, '').replace(/\s+/g, '')
}

// ── Audio chirp — Web Audio, programmatic. No asset shipped. ──
// AudioContext can only be created/resumed inside a user gesture, so
// we instantiate lazily inside the play handlers.
function useChirp() {
  const reduced = useReducedMotion()
  const ctxRef = useRef<AudioContext | null>(null)

  function ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      try {
        ctxRef.current = new Ctor()
      } catch {
        return null
      }
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    return ctxRef.current
  }

  function tick() {
    if (reduced) return
    const ctx = ensureCtx()
    if (!ctx) return
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(2400, t0)
    osc.frequency.exponentialRampToValueAtTime(1700, t0 + 0.05)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.045, t0 + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.11)
  }

  function chime() {
    if (reduced) return
    const ctx = ensureCtx()
    if (!ctx) return
    const t0 = ctx.currentTime
    const notes = [880, 1320, 1760]
    notes.forEach((freq, i) => {
      const start = t0 + i * 0.055
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.06, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.5)
    })
  }

  // Two-note rising mini-chime — fires on Continue. Distinct from the
  // multi-choice tick so the user feels the difference between toggling
  // and committing. Short, bright, dopaminergic.
  function step() {
    if (reduced) return
    const ctx = ensureCtx()
    if (!ctx) return
    const t0 = ctx.currentTime
    const notes: Array<[number, number]> = [
      [660, 0],
      [990, 0.04],
    ]
    for (const [freq, dt] of notes) {
      const start = t0 + dt
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.06, start + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.2)
    }
  }

  return { tick, chime, step }
}

// ── Step transition: snap-zoom-soft, mirrors transitions.tsx ──
const stepVariants = {
  enter: { opacity: 0, scale: 0.96, filter: 'blur(8px)' },
  center: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.98, filter: 'blur(6px)' },
}

const StepNumber = ({ n, total }: { n: number; total: number }) => (
  <div
    className="font-mono text-[12px] uppercase tracking-[0.14em]"
    style={{ color: DIM }}
  >
    {pad2(n)} <span style={{ color: 'rgba(110,114,122,0.4)' }}>/</span> {pad2(total)}
  </div>
)

// Avatar pill — top-right, surfaces when we have a handle and unavatar resolves.
function HandleBadge({
  handle,
  pfpUrl,
}: {
  handle: string
  pfpUrl: string | null
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [pfpUrl])

  // Render the avatar only when the image actually loads. If it errors,
  // the pill collapses to just the @handle — no empty grey ghost.
  const showAvatar = Boolean(pfpUrl) && !failed && loaded

  return (
    <AnimatePresence>
      {handle && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={springs.entrance}
          className="fixed right-5 top-5 z-30 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-[0_2px_8px_rgba(10,10,12,0.06)] backdrop-blur sm:right-7 sm:top-7"
          style={{ border: `1px solid ${RULE}` }}
        >
          {pfpUrl && !failed && (
            <img
              src={pfpUrl}
              alt=""
              width={28}
              height={28}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={showAvatar ? 'h-7 w-7 rounded-full object-cover' : 'hidden'}
            />
          )}
          <span className="pr-1 font-mono text-[12px] tabular-nums" style={{ color: FG_SOFT }}>
            @{handle}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type Enemy = { handle: string; label: string }
const ENEMIES: Record<string, Enemy> = {
  insider:   { handle: 'NancyPelosi', label: 'Insider trader' },
  frontrun:  { handle: 'kengriffin',  label: 'Front runner' },
  manip:     { handle: 'SBF_FTX',     label: 'Market manipulator' },
  orderflow: { handle: 'vladtenev',   label: 'Orderflow buyer' },
}

function EnemyPill({ enemy }: { enemy: Enemy }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const src = `https://unavatar.io/x/${encodeURIComponent(enemy.handle)}`
  const showAvatar = !failed && loaded

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 18, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 18, scale: 0.94 }}
      transition={springs.entrance}
      className="flex items-center gap-2 rounded-full bg-white/95 px-2.5 py-1 shadow-[0_2px_8px_rgba(10,10,12,0.06)] backdrop-blur"
      style={{ border: `1px solid ${RULE}` }}
      title={`Shielded from ${enemy.label}`}
    >
      {!failed && (
        <img
          src={src}
          alt=""
          width={24}
          height={24}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={showAvatar ? 'h-6 w-6 rounded-full object-cover' : 'hidden'}
        />
      )}
      <span
        aria-hidden
        className="inline-flex h-4 w-4 items-center justify-center rounded-full"
        style={{
          background: '#9A1F2D',
          color: '#FFFFFF',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
      <span
        className="font-mono text-[11px] tabular-nums"
        style={{
          color: '#9A1F2D',
          textDecoration: 'line-through',
          textDecorationThickness: '1.5px',
          textDecorationColor: 'rgba(154,31,45,0.55)',
        }}
      >
        @{enemy.handle}
      </span>
    </motion.div>
  )
}

function ShieldDivider() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={springs.entrance}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
      style={{
        background: ACCENT,
        color: '#FFFFFF',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px -6px rgba(0,82,255,0.45)',
      }}
      title="Your pnl is shielded from these accounts"
    >
      <svg width="11" height="13" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2 L21 5 L21 13 C21 19 17 24 12 26 C7 24 3 19 3 13 L3 5 Z" />
        <path d="M8.5 13.5 L11 16 L15.5 11" />
      </svg>
      Protected
    </motion.div>
  )
}

function EnemyStack({
  selected,
  hasUserBadge,
}: {
  selected: string[]
  hasUserBadge: boolean
}) {
  const items = selected.map((k) => ENEMIES[k]).filter(Boolean)
  if (items.length === 0) return null
  // The pill row only fits cleanly to the right of the form sheet on
  // wide viewports — anywhere narrower than `lg` (1024px) and the pills
  // collide with the question itself. Below that, the strikethrough on
  // the option labels does the work.
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed right-7 z-30 hidden flex-col items-end gap-1.5 lg:flex"
      style={{ top: hasUserBadge ? 64 : 20 }}
    >
      <ShieldDivider />
      <AnimatePresence>
        {items.map((enemy) => (
          <EnemyPill key={enemy.handle} enemy={enemy} />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

export default function WaitlistForm() {
  const { tick, chime, step: stepSound } = useChirp()
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [whitelisted, setWhitelisted] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const step = STEPS[idx]
  const totalQuestions = STEPS.length - 1
  const visibleQuestionIndex = useMemo(() => {
    let n = 0
    for (let i = 1; i < idx; i++) {
      const s = STEPS[i]
      if (shouldSkip(s, answers)) continue
      n++
    }
    return n + 1
  }, [idx, answers])

  const handle = useMemo(() => {
    const raw = typeof answers.twitter === 'string' ? answers.twitter : ''
    return normalizeHandle(raw)
  }, [answers.twitter])

  const pfpUrl = useMemo(() => {
    if (!handle) return null
    // Drop ?fallback=false: unavatar 404s many real handles (Twitter
    // blocks scraping). Without the flag, unavatar returns the real
    // PFP when it can resolve it, and a generated initials avatar
    // otherwise. Either way the user sees something.
    return `https://unavatar.io/x/${encodeURIComponent(handle)}`
  }, [handle])

  useEffect(() => {
    if (step.type === 'text' || step.type === 'email') {
      const t = setTimeout(() => inputRef.current?.focus(), 220)
      return () => clearTimeout(t)
    }
  }, [step])

  function findNext(from: number, dir: 1 | -1, ans: Answers): number {
    let i = from + dir
    while (i > 0 && i < STEPS.length && shouldSkip(STEPS[i], ans)) {
      i += dir
    }
    return Math.max(0, Math.min(STEPS.length - 1, i))
  }

  async function submit(finalAnswers: Answers) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(finalAnswers),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.whitelisted) setWhitelisted(true)
    } catch {
      // user shouldn't pay for our backend
    } finally {
      setSubmitting(false)
      setSubmitted(true)
      chime()
    }
  }

  async function advance(answersOverride?: Answers) {
    const ans = answersOverride ?? answers
    if (step.type === 'welcome') {
      setDirection(1)
      setIdx(findNext(idx, 1, ans))
      return
    }
    const value = ans[step.id] ?? (step.type === 'choice' && step.multiple ? [] : '')
    const v = isValid(step, value)
    if (!v.ok) {
      setError(v.reason)
      return
    }
    setError(null)
    const next = findNext(idx, 1, ans)
    if (next === idx) {
      await submit(ans)
      return
    }
    setDirection(1)
    setIdx(next)
  }

  function back() {
    if (idx === 0) return
    setError(null)
    setDirection(-1)
    setIdx(findNext(idx, -1, answers))
  }

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((a) => ({ ...a, [id]: value }))
    setError(null)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      stepSound()
      void advance()
    }
  }

  const onSelectSingle = (v: string) => {
    tick()
    const newAnswers = { ...answers, [step.id]: v }
    setAnswers(newAnswers)
    setError(null)
    setTimeout(() => void advance(newAnswers), 200)
  }

  const onToggleMulti = (v: string) => {
    tick()
    const current = answers[step.id]
    const arr = Array.isArray(current) ? current.slice() : []
    const i = arr.indexOf(v)
    if (i >= 0) arr.splice(i, 1)
    else arr.push(v)
    setAnswer(step.id, arr)
  }

  const progress = step.type === 'welcome' ? 0 : visibleQuestionIndex / totalQuestions

  if (submitted) {
    return (
      <Verdict
        handle={handle}
        pfpUrl={pfpUrl}
        whitelisted={whitelisted}
        hasCode={typeof answers.invite === 'string' && answers.invite.trim().length >= 3}
      />
    )
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center" style={{ color: FG }}>
      <DotGridBg />
      <HandleBadge handle={handle} pfpUrl={pfpUrl} />
      {step.type === 'choice' && step.id === 'protection_from' && (
        <EnemyStack
          selected={Array.isArray(answers.protection_from) ? answers.protection_from : []}
          hasUserBadge={Boolean(handle)}
        />
      )}

      <div className="fixed left-0 right-0 top-0 z-20 h-[2px]" aria-hidden>
        <motion.div
          className="h-full origin-left"
          style={{ background: ACCENT, transformOrigin: 'left' }}
          animate={{ scaleX: progress }}
          initial={false}
          transition={springs.expand}
        />
      </div>

      <main className="flex w-full flex-1 items-center justify-center px-6 py-20 sm:px-10">
        <div className="relative w-full max-w-[734px]">
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            <motion.div
              key={step.id}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.6, 1] }}
            >
              {step.type === 'welcome' ? (
                <Welcome step={step} onStart={() => { stepSound(); void advance() }} />
              ) : (
                <Sheet>
                  <div className="mb-7 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <BackChip onClick={back} />
                      <StepNumber n={visibleQuestionIndex} total={totalQuestions} />
                    </div>
                    {'required' in step && step.required && (
                      <span
                        className="font-mono text-[11px] uppercase tracking-[0.14em]"
                        style={{ color: DIM }}
                      >
                        Required
                      </span>
                    )}
                  </div>
                  {(step.type === 'text' || step.type === 'email') && (
                    <TextQuestion
                      step={step}
                      value={typeof answers[step.id] === 'string' ? (answers[step.id] as string) : ''}
                      onChange={(v) => setAnswer(step.id, v)}
                      onKeyDown={onKeyDown}
                      inputRef={inputRef}
                    />
                  )}
                  {step.type === 'choice' && (
                    <ChoiceQuestion
                      step={step}
                      value={answers[step.id]}
                      onSelectSingle={onSelectSingle}
                      onToggleMulti={onToggleMulti}
                    />
                  )}
                  {(step.type === 'text' || step.type === 'email') && step.id === 'invite' && (
                    <>
                      <InviteCodeStatus
                        code={typeof answers.invite === 'string' ? (answers.invite as string) : ''}
                      />
                      <WalletForCode
                        value={typeof answers.wallet === 'string' ? (answers.wallet as string) : ''}
                        onChange={(v) => setAnswer('wallet', v)}
                      />
                    </>
                  )}
                </Sheet>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Marginalia — invite-question step, desktop gutter */}
          {step.type === 'choice' && step.id === 'has_invite' && (
            <CaveatArrow
              key="invite-margin"
              text="rakeback is real"
              direction="left-up"
              delay={0.35}
              className="pointer-events-none absolute -right-[180px] top-24 hidden xl:block"
            />
          )}
        </div>
      </main>

      {step.type !== 'welcome' && (
        <Dock
          error={error}
          submitting={submitting}
          onBack={back}
          onContinue={() => { stepSound(); void advance() }}
          isFinal={findNext(idx, 1, answers) === idx}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Sheet — the white card, hairline border, no glass.
// ─────────────────────────────────────────────────────────────────────
function Sheet({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative rounded-[18px] px-7 py-9 sm:px-10 sm:py-11"
      style={{
        background: SHEET_BG,
        border: `1px solid ${RULE}`,
        boxShadow:
          '0 1px 2px rgba(10,10,12,0.04), 0 24px 60px -20px rgba(10,10,12,0.10)',
      }}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Welcome — no sheet, hero on the dot grid.
// ─────────────────────────────────────────────────────────────────────
function Welcome({ step, onStart }: { step: WelcomeStep; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.6, 1], delay: 0.05 }}
        className="font-mono text-[12px] uppercase tracking-[0.18em]"
        style={{ color: ACCENT }}
      >
        Early Access
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.6, 1], delay: 0.12 }}
        className="mt-5 max-w-[860px] font-semibold leading-[1.05]"
        style={{
          color: FG,
          fontSize: 'clamp(44px, 7.2vw, 96px)',
          letterSpacing: '-0.034em',
        }}
      >
        {step.title}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.6, 1], delay: 0.28 }}
        className="mx-auto mt-6 max-w-[640px] leading-[1.4]"
        style={{
          color: FG_SOFT,
          fontSize: 'clamp(18px, 1.9vw, 22px)',
          letterSpacing: '-0.012em',
        }}
      >
        {step.body}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.6, 1], delay: 0.42 }}
        className="mt-12 w-full max-w-[420px]"
      >
        <PrimaryButton onClick={onStart} autoFocus>
          {step.cta}
        </PrimaryButton>
        <div className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[12px]" style={{ color: DIM }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          <span className="uppercase tracking-[0.14em]">{step.takes}</span>
        </div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// TextQuestion — large headline, bottom-ruled input.
// ─────────────────────────────────────────────────────────────────────
function TextQuestion({
  step,
  value,
  onChange,
  onKeyDown,
  inputRef,
}: {
  step: TextStep
  value: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.MutableRefObject<HTMLInputElement | null>
}) {
  return (
    <div>
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.6, 1] }}
        className="font-semibold leading-[1.15]"
        style={{
          color: FG,
          fontSize: 'clamp(26px, 3.2vw, 36px)',
          letterSpacing: '-0.022em',
        }}
      >
        {step.label}
      </motion.h2>
      {step.description && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.6, 1], delay: 0.06 }}
          className="mt-3 leading-[1.5]"
          style={{ color: FG_SOFT, fontSize: 17, letterSpacing: '-0.01em' }}
        >
          {step.description}
        </motion.p>
      )}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.6, 1], delay: 0.12 }}
        className="mt-9"
      >
        <input
          ref={inputRef}
          type={step.type === 'email' ? 'email' : 'text'}
          inputMode={step.type === 'email' ? 'email' : 'text'}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={step.placeholder}
          className="w-full bg-transparent pb-3 font-light leading-[1.25] focus:outline-none"
          style={{
            color: FG,
            fontSize: 'clamp(22px, 2.6vw, 30px)',
            letterSpacing: '-0.012em',
            borderBottom: `1.5px solid ${RULE}`,
            transition: 'border-color 180ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderBottomColor = ACCENT
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderBottomColor = RULE
          }}
        />
      </motion.div>

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// ChoiceQuestion — option rows on the dot-grid theme.
// ─────────────────────────────────────────────────────────────────────
function ChoiceQuestion({
  step,
  value,
  onSelectSingle,
  onToggleMulti,
}: {
  step: ChoiceStep
  value: AnswerValue | undefined
  onSelectSingle: (v: string) => void
  onToggleMulti: (v: string) => void
}) {
  const selectedSet = useMemo(() => {
    if (step.multiple) return new Set(Array.isArray(value) ? value : [])
    return new Set(typeof value === 'string' && value ? [value] : [])
  }, [step.multiple, value])

  return (
    <div>
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.6, 1] }}
        className="font-semibold leading-[1.15]"
        style={{
          color: FG,
          fontSize: 'clamp(26px, 3.2vw, 36px)',
          letterSpacing: '-0.022em',
        }}
      >
        {step.label}
      </motion.h2>
      {step.description && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.6, 1], delay: 0.06 }}
          className="mt-3 leading-[1.5]"
          style={{ color: FG_SOFT, fontSize: 17, letterSpacing: '-0.01em' }}
        >
          {step.description}
        </motion.p>
      )}
      {step.multiple && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em]"
          style={{ color: DIM }}
        >
          Choose any
        </motion.p>
      )}
      <ul className="mt-7 flex flex-col gap-2">
        {step.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i)
          const selected = selectedSet.has(opt.value)
          return (
            <motion.li
              key={opt.value}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.6, 1], delay: 0.12 + i * 0.05 }}
            >
              <motion.button
                type="button"
                whileTap={{ scale: 0.99 }}
                transition={springs.press}
                onClick={() =>
                  step.multiple ? onToggleMulti(opt.value) : onSelectSingle(opt.value)
                }
                className="group relative flex w-full items-center gap-4 rounded-[12px] px-4 py-3.5 text-left transition-colors"
                style={{
                  background: selected ? 'rgba(0,82,255,0.06)' : '#FCFCFD',
                  border: `1px solid ${selected ? ACCENT : RULE}`,
                  color: FG,
                }}
              >
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] font-mono text-[13px] font-semibold uppercase"
                  style={{
                    background: selected ? ACCENT : 'transparent',
                    color: selected ? '#FFFFFF' : ACCENT,
                    border: selected ? '1px solid transparent' : `1px solid ${ACCENT}33`,
                  }}
                >
                  {letter}
                </span>
                <span
                  className="flex-1"
                  style={{
                    fontSize: 'clamp(17px, 1.9vw, 21px)',
                    letterSpacing: '-0.012em',
                    color: FG_SOFT,
                  }}
                >
                  {opt.label}
                </span>
                {step.multiple && selected && (
                  <motion.span
                    aria-hidden
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={springs.indicator}
                    style={{ color: ACCENT }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </motion.span>
                )}
              </motion.button>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Dock — sticky bottom bar with full-width primary CTA.
// ─────────────────────────────────────────────────────────────────────
function Dock({
  error,
  submitting,
  onBack,
  onContinue,
  isFinal,
}: {
  error: string | null
  submitting: boolean
  onBack: () => void
  onContinue: () => void
  isFinal: boolean
}) {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.entrance, delay: 0.12 }}
      className="sticky bottom-0 z-20 w-full px-4 pb-4 pt-3 sm:px-6 sm:pb-6"
      style={{
        background:
          'linear-gradient(to top, rgba(240,242,244,0.95) 0%, rgba(240,242,244,0.85) 60%, rgba(240,242,244,0) 100%)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="mx-auto w-full max-w-[734px]">
        <div className="mb-2.5 flex items-center justify-between gap-4 px-1">
          <div className="font-mono text-[12px] tabular-nums" style={{ color: DIM }}>
            <AnimatePresence mode="wait">
              <motion.span
                key={error ?? 'hint'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {error ? (
                  <span style={{ color: '#DC2626' }}>{error}</span>
                ) : (
                  <span className="uppercase tracking-[0.14em]">
                    Press <Kbd>Enter</Kbd> to continue
                  </span>
                )}
              </motion.span>
            </AnimatePresence>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-[12px] uppercase tracking-[0.14em] transition-colors"
            style={{ color: DIM }}
            onMouseEnter={(e) => (e.currentTarget.style.color = FG)}
            onMouseLeave={(e) => (e.currentTarget.style.color = DIM)}
          >
            ← Back
          </button>
        </div>
        <PrimaryButton onClick={onContinue} disabled={submitting}>
          {submitting ? 'Sending…' : isFinal ? 'Submit' : 'Continue'}
        </PrimaryButton>
      </div>
    </motion.footer>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  autoFocus,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  autoFocus?: boolean
}) {
  const reduced = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      disabled={disabled}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      transition={springs.press}
      className="w-full rounded-[14px] font-medium focus:outline-none focus:ring-4 focus:ring-[rgba(0,82,255,0.22)] disabled:opacity-60"
      style={{
        background: ACCENT,
        color: '#FFFFFF',
        height: 60,
        fontSize: 17,
        letterSpacing: '-0.011em',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.18) inset, 0 10px 28px -8px rgba(0,82,255,0.55), 0 2px 6px rgba(0,82,255,0.25)',
      }}
    >
      {children}
    </motion.button>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="mx-1 inline-block rounded px-1.5 py-0.5 font-mono text-[11px] font-medium"
      style={{
        background: '#FFFFFF',
        border: `1px solid ${RULE}`,
        color: FG_SOFT,
      }}
    >
      {children}
    </kbd>
  )
}

// ─────────────────────────────────────────────────────────────────────
// BackChip — visible back affordance, lives at the top of every Sheet.
// ─────────────────────────────────────────────────────────────────────
function BackChip({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={springs.press}
      className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
      style={{
        color: DIM,
        border: `1px solid ${RULE}`,
        background: '#FCFCFD',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = FG
        e.currentTarget.style.borderColor = 'rgba(10,10,12,0.20)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = DIM
        e.currentTarget.style.borderColor = RULE
      }}
      aria-label="Go back to previous question"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────
// InviteCodeStatus — debounced live check against /api/waitlist/check-code.
// The endpoint is read-only (no consumption), rate-limited per IP. We
// abort in-flight requests on every keystroke so only the most recent
// check resolves. Empty input renders nothing.
// ─────────────────────────────────────────────────────────────────────
function InviteCodeStatus({ code }: { code: string }) {
  const trimmed = code.trim()
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'checking' }
    | { kind: 'valid' }
    | { kind: 'wrong'; reason: 'invalid' | 'exhausted' | 'expired' | 'error' }
  >({ kind: 'idle' })

  useEffect(() => {
    if (!trimmed) {
      setState({ kind: 'idle' })
      return
    }
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(trimmed)) {
      setState({ kind: 'idle' })
      return
    }
    const ctrl = new AbortController()
    setState({ kind: 'checking' })
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/waitlist/check-code?code=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        )
        const data = (await res.json().catch(() => ({}))) as
          | { ok?: boolean; reason?: string }
        if (data.ok) {
          setState({ kind: 'valid' })
        } else {
          const r = data.reason
          const reason: 'invalid' | 'exhausted' | 'expired' | 'error' =
            r === 'exhausted' || r === 'expired' ? r : r === 'invalid' ? 'invalid' : 'error'
          setState({ kind: 'wrong', reason })
        }
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return
        setState({ kind: 'wrong', reason: 'error' })
      }
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [trimmed])

  if (state.kind === 'idle') return null

  const message =
    state.kind === 'checking'
      ? 'Checking…'
      : state.kind === 'valid'
        ? 'Code validated'
        : state.reason === 'exhausted'
          ? 'Code already used'
          : state.reason === 'expired'
            ? 'Code expired'
            : state.reason === 'invalid'
              ? 'Code wrong'
              : 'Couldn’t check — try again in a moment'

  const color =
    state.kind === 'valid' ? '#10B981' : state.kind === 'checking' ? DIM : '#DC2626'

  return (
    <motion.div
      key={state.kind + ('reason' in state ? state.reason : '')}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.6, 1] }}
      className="mt-3 inline-flex items-center gap-2 text-[13px]"
      style={{ color, letterSpacing: '-0.005em' }}
    >
      {state.kind === 'checking' ? (
        <span
          aria-hidden
          className="animate-spin"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            border: `1.5px solid ${DIM}`,
            borderTopColor: 'transparent',
            display: 'inline-block',
          }}
        />
      ) : state.kind === 'valid' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      )}
      <span>{message}</span>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// WalletForCode — paste field rendered under the invite code input.
// No wallet-connect UX, no window.ethereum. The user already has the
// address they want to whitelist; we don't need to negotiate for it.
// ─────────────────────────────────────────────────────────────────────
function WalletForCode({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const trimmed = value.trim()
  const isAddrValid = /^0x[a-fA-F0-9]{40}$/.test(trimmed)
  const showError = trimmed.length > 0 && !isAddrValid

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.6, 1], delay: 0.18 }}
      className="mt-9"
    >
      <div className="font-mono text-[12px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
        Wallet to whitelist this code for
      </div>
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder="0x…"
        className="mt-3 w-full bg-transparent pb-3 font-mono leading-[1.25] focus:outline-none"
        style={{
          color: FG,
          fontSize: 'clamp(15px, 1.6vw, 17px)',
          letterSpacing: '-0.005em',
          borderBottom: `1.5px solid ${showError ? '#DC2626' : RULE}`,
          transition: 'border-color 180ms ease',
        }}
        onFocus={(e) => {
          if (!showError) e.currentTarget.style.borderBottomColor = ACCENT
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = showError ? '#DC2626' : RULE
        }}
      />
      {showError && (
        <p className="mt-2 text-[12px]" style={{ color: '#DC2626' }}>
          That doesn’t look like an Ethereum address.
        </p>
      )}
      {isAddrValid && (
        <p className="mt-2 text-[12px]" style={{ color: ACCENT }}>
          On submit, this wallet gets whitelisted.
        </p>
      )}
    </motion.div>
  )
}


// ─────────────────────────────────────────────────────────────────────
// Verdict — end screen. Big avatar, @handle, Caveat "You" arrow.
// ─────────────────────────────────────────────────────────────────────
function Verdict({
  handle,
  pfpUrl,
  whitelisted,
  hasCode,
}: {
  handle: string
  pfpUrl: string | null
  whitelisted?: boolean
  hasCode?: boolean
}) {
  const [pfpLoaded, setPfpLoaded] = useState(false)
  const [pfpFailed, setPfpFailed] = useState(false)
  const [armed, setArmed] = useState(false)

  // When whitelisted, hold the "verifying" beat for ~1.6s before
  // flipping to "you're in" — gives the user a moment to feel the
  // gate open instead of a teleport.
  useEffect(() => {
    if (!whitelisted) return
    const t = setTimeout(() => setArmed(true), 1600)
    return () => clearTimeout(t)
  }, [whitelisted])

  // Only show the avatar circle when the image actually loaded.
  // If unavatar can't resolve a real PFP and the image errors, we
  // collapse the whole disc — the @handle below carries the identity.
  const avatarReady = Boolean(pfpUrl) && !pfpFailed && pfpLoaded

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 py-24" style={{ color: FG }}>
      <DotGridBg />
      <main className="flex w-full max-w-[734px] flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.6, 1] }}
          className="font-mono text-[12px] uppercase tracking-[0.18em]"
          style={{ color: ACCENT }}
        >
          {whitelisted
            ? armed ? 'Whitelisted' : 'Verifying…'
            : hasCode ? 'Code on file' : 'Verdict'}
        </motion.div>

        {pfpUrl && !pfpFailed && (
          <img
            src={pfpUrl}
            alt={handle ? `@${handle}` : ''}
            width={144}
            height={144}
            referrerPolicy="no-referrer"
            onLoad={() => setPfpLoaded(true)}
            onError={() => setPfpFailed(true)}
            className="hidden"
          />
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.6, 1], delay: 0.15 }}
          className="relative mt-9"
        >
          {avatarReady && pfpUrl && (
            <div
              className="overflow-hidden rounded-full"
              style={{
                width: 144,
                height: 144,
                border: `1px solid ${RULE}`,
                background: '#E6E8EC',
                boxShadow:
                  '0 1px 2px rgba(10,10,12,0.05), 0 22px 50px -16px rgba(10,10,12,0.18)',
              }}
            >
              <img
                src={pfpUrl}
                alt={handle ? `@${handle}` : ''}
                width={144}
                height={144}
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Caveat "You" — points UP-RIGHT at the avatar from below-left.
              When no avatar loaded, the arrow targets the @handle below
              instead. */}
          {avatarReady && (
            <CaveatArrow
              text="You"
              direction="right-up"
              delay={0.65}
              width={150}
              height={100}
              fontSize={26}
              className="pointer-events-none absolute -bottom-[68px] -left-[150px]"
            />
          )}
        </motion.div>

        {handle && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.6, 1], delay: 0.35 }}
            className="relative mt-9 font-mono"
            style={{
              color: FG,
              fontSize: 'clamp(22px, 2.4vw, 28px)',
              letterSpacing: '-0.014em',
            }}
          >
            @{handle}
            {!avatarReady && (
              <CaveatArrow
                text="You"
                direction="right-down"
                delay={0.55}
                width={150}
                height={100}
                fontSize={24}
                className="pointer-events-none absolute -top-[100px] -left-[170px] hidden sm:block"
              />
            )}
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.6, 1], delay: 0.5 }}
          className="mt-7 font-semibold leading-[1.06]"
          style={{
            color: FG,
            fontSize: 'clamp(36px, 5.6vw, 68px)',
            letterSpacing: '-0.028em',
          }}
        >
          {whitelisted
            ? armed ? 'You’re in.' : 'Almost there…'
            : hasCode ? 'You jumped the line.' : 'You’re on the list'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.6, 1], delay: 0.7 }}
          className="mx-auto mt-5 max-w-[520px] leading-[1.4]"
          style={{
            color: FG_SOFT,
            fontSize: 'clamp(17px, 1.8vw, 20px)',
            letterSpacing: '-0.011em',
          }}
        >
          {whitelisted
            ? armed
              ? 'Wallet whitelisted — the faucet is yours, and the rest of the site too'
              : 'Verifying your code — this takes a beat'
            : hasCode
              ? 'Code received — add a wallet later from any locked page and the gate opens for you immediately'
              : 'We’ll notify you the second we go live'}
        </motion.p>

        {whitelisted && armed && (
          <motion.a
            href="/"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.6, 1], delay: 0.2 }}
            className="mt-9 inline-flex h-12 items-center justify-center rounded-full px-7 font-medium"
            style={{
              background: '#0A0A0A',
              color: '#FFFFFF',
              fontSize: 15,
              letterSpacing: '-0.011em',
              boxShadow: '0 1px 0 rgba(255,255,255,0.10) inset, 0 10px 28px -10px rgba(10,10,12,0.45)',
            }}
          >
            Enter the site →
          </motion.a>
        )}
      </main>
    </div>
  )
}
