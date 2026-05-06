'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { springs } from '@/components/ui/spring'
import { ShineOverlay } from '@/components/domain/home/ShineOverlay'

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
    title: 'Be the first to have your pnl shielded from insider trading.',
    body: 'Join the waitlist — early access, lower fees, and referral rewards. Takes ~45 seconds.',
    cta: 'Start',
    takes: 'Takes ~45 seconds',
  },
  {
    type: 'text',
    id: 'twitter',
    label: 'What’s your Twitter / X handle?',
    description: 'We’ll use it to connect and give you priority access.',
    placeholder: 'Type your answer here...',
    required: true,
  },
  {
    type: 'text',
    id: 'telegram',
    label: 'What’s your Telegram handle?',
    placeholder: 'Type your answer here...',
    required: true,
  },
  {
    type: 'email',
    id: 'email',
    label: 'What’s the best email to reach you?',
    placeholder: 'Type your answer here...',
    required: true,
  },
  {
    type: 'choice',
    id: 'protection_from',
    label: 'Against who your pnl need protection from',
    multiple: true,
    options: [
      { value: 'insider', label: 'Insider Traders' },
      { value: 'frontrun', label: 'Front Runners' },
      { value: 'manip', label: 'Market Manipulators' },
      { value: 'orderflow', label: 'Orderflow Buyers' },
    ],
  },
  {
    type: 'text',
    id: 'invite',
    label: 'Do you have an invite code?',
    description:
      'Entering a code gives you access to trading fee rakeback. Don’t worry — if you don’t have one, you can add it later.',
    placeholder: 'Type your answer here...',
  },
  {
    type: 'text',
    id: 'volume',
    label: 'Roughly how much do you trade per month on volume?',
    description: 'Example: $5k - $10k',
    placeholder: 'Type your answer here...',
  },
  {
    type: 'choice',
    id: 'affiliate',
    label: 'Do you want to become an affiliate?',
    description: 'Becoming an affiliate lets you earn by referring other traders and projects.',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    type: 'text',
    id: 'reach',
    label: 'Awesome! How big is your reach?',
    description: 'e.g. “5K Twitter followers”, “500 newsletter subs”, “active in 3 Discord communities”, etc.',
    placeholder: 'Type your answer here...',
  },
  {
    type: 'text',
    id: 'notes',
    label: 'Is there anything you’d like us to know?',
    placeholder: 'Type your answer here...',
  },
]

type AnswerValue = string | string[]
type Answers = Record<string, AnswerValue>

function shouldSkip(step: Step, answers: Answers): boolean {
  if (step.type === 'text' && step.id === 'reach' && answers.affiliate !== 'yes') return true
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
        if (!Array.isArray(value) || value.length === 0) return { ok: false, reason: 'Pick at least one.' }
      } else if (typeof value !== 'string' || !value) {
        return { ok: false, reason: 'Pick one.' }
      }
    }
    return { ok: true }
  }
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (step.required && !trimmed) return { ok: false, reason: 'Required.' }
  if (step.type === 'email' && trimmed) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!ok) return { ok: false, reason: 'That doesn’t look like an email.' }
  }
  return { ok: true }
}

// ── Aurora — five drifting blobs, big blur, hue creep ─────
type Blob = {
  size: number
  color: string
  top: string
  left: string
  duration: number
  path: { x: number[]; y: number[]; scale: number[] }
}

const BLOBS: Blob[] = [
  {
    size: 720,
    color: 'rgba(99,102,241,0.55)', // indigo
    top: '-12%',
    left: '-8%',
    duration: 26,
    path: { x: [0, 220, 80, -60, 0], y: [0, 120, 240, 80, 0], scale: [1, 1.18, 0.92, 1.08, 1] },
  },
  {
    size: 640,
    color: 'rgba(236,72,153,0.45)', // pink
    top: '8%',
    left: '62%',
    duration: 32,
    path: { x: [0, -180, -60, 100, 0], y: [0, 80, 200, 100, 0], scale: [1, 0.95, 1.2, 1, 1] },
  },
  {
    size: 820,
    color: 'rgba(34,211,238,0.42)', // cyan
    top: '55%',
    left: '12%',
    duration: 38,
    path: { x: [0, 160, 60, -120, 0], y: [0, -100, -220, -60, 0], scale: [1, 1.1, 0.88, 1.15, 1] },
  },
  {
    size: 560,
    color: 'rgba(167,139,250,0.50)', // violet
    top: '32%',
    left: '40%',
    duration: 22,
    path: { x: [0, -120, 140, 60, 0], y: [0, 140, -80, -40, 0], scale: [1, 1.25, 0.9, 1.05, 1] },
  },
  {
    size: 480,
    color: 'rgba(56,189,248,0.38)', // sky
    top: '70%',
    left: '70%',
    duration: 30,
    path: { x: [0, -200, 40, 120, 0], y: [0, -160, -60, 80, 0], scale: [1, 1.08, 1.22, 0.95, 1] },
  },
]

function Aurora() {
  const reduced = useReducedMotion()
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-30"
        style={{
          background: 'linear-gradient(180deg, #F5F5F7 0%, #ECECF1 100%)',
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 overflow-hidden"
        animate={reduced ? undefined : { filter: ['hue-rotate(0deg) blur(70px)', 'hue-rotate(18deg) blur(70px)', 'hue-rotate(-12deg) blur(70px)', 'hue-rotate(0deg) blur(70px)'] }}
        transition={{ duration: 48, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: 'blur(70px)' }}
      >
        {BLOBS.map((b, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              background: `radial-gradient(circle at 50% 50%, ${b.color} 0%, transparent 65%)`,
              willChange: 'transform',
            }}
            initial={{ x: 0, y: 0, scale: 1 }}
            animate={
              reduced
                ? undefined
                : { x: b.path.x, y: b.path.y, scale: b.path.scale }
            }
            transition={{
              duration: b.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.25, 0.5, 0.75, 1],
            }}
          />
        ))}
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        animate={reduced ? undefined : { opacity: [0.6, 1, 0.7, 1, 0.6] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background:
            'radial-gradient(1400px 900px at 50% -10%, rgba(255,255,255,0.45), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.5) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
          mixBlendMode: 'overlay',
        }}
      />
    </>
  )
}

// ── Tilt — subtle parallax, matches the homepage shine pattern ──
function Tilt({
  children,
  max = 4,
  className,
}: {
  children: ReactNode
  max?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const sx = useSpring(mx, { stiffness: 140, damping: 22, mass: 0.9 })
  const sy = useSpring(my, { stiffness: 140, damping: 22, mass: 0.9 })
  const ry = useTransform(sx, [0, 1], [-max, max])
  const rx = useTransform(sy, [0, 1], [max * 0.7, -max * 0.7])

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      mx.set((e.clientX - r.left) / r.width)
      my.set((e.clientY - r.top) / r.height)
    }
    const onLeave = () => {
      mx.set(0.5)
      my.set(0.5)
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [mx, my, reduced])

  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        perspective: 1400,
        transformStyle: 'preserve-3d',
        rotateX: rx,
        rotateY: ry,
      }}
    >
      {children}
    </motion.div>
  )
}

// ── Step transitions — spring slide ───────────────────────
const stepVariants = {
  enter: (dir: 1 | -1) => ({ opacity: 0, x: dir * 28, filter: 'blur(6px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: (dir: 1 | -1) => ({ opacity: 0, x: -dir * 28, filter: 'blur(6px)' }),
}

const NumberBadge = ({ n }: { n: number }) => (
  <motion.span
    key={n}
    initial={{ scale: 0.6, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={springs.indicator}
    aria-hidden
    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[#1D4ED8] text-[14px] font-semibold tabular-nums text-white shadow-[0_6px_18px_rgba(29,78,216,0.45)]"
    style={{ marginTop: 6 }}
  >
    {n}
  </motion.span>
)

const LetterChip = ({ ch, selected }: { ch: string; selected?: boolean }) => (
  <motion.span
    aria-hidden
    animate={selected ? { scale: 1.05 } : { scale: 1 }}
    transition={springs.hover}
    className={[
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border text-[13px] font-semibold uppercase',
      selected
        ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white shadow-[0_4px_12px_rgba(29,78,216,0.4)]'
        : 'border-[#C7D2FE] bg-white/80 text-[#1D4ED8] backdrop-blur',
    ].join(' ')}
  >
    {ch}
  </motion.span>
)

export default function WaitlistForm() {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const step = STEPS[idx]
  const total = STEPS.length - 1 // exclude welcome
  const visibleQuestionIndex = useMemo(() => {
    let n = 0
    for (let i = 1; i < idx; i++) {
      const s = STEPS[i]
      if (shouldSkip(s, answers)) continue
      n++
    }
    return n + 1
  }, [idx, answers])

  useEffect(() => {
    if (step.type === 'text' || step.type === 'email') {
      const t = setTimeout(() => inputRef.current?.focus(), 320)
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
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(finalAnswers),
      })
    } catch {
      // user shouldn't pay for our backend
    } finally {
      setSubmitting(false)
      setSubmitted(true)
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
      void advance()
    }
  }

  const onSelectSingle = (v: string) => {
    const newAnswers = { ...answers, [step.id]: v }
    setAnswers(newAnswers)
    setError(null)
    setTimeout(() => void advance(newAnswers), 240)
  }

  const onToggleMulti = (v: string) => {
    const current = answers[step.id]
    const arr = Array.isArray(current) ? current.slice() : []
    const i = arr.indexOf(v)
    if (i >= 0) arr.splice(i, 1)
    else arr.push(v)
    setAnswer(step.id, arr)
  }

  const progress = step.type === 'welcome' ? 0 : visibleQuestionIndex / total

  if (submitted) {
    return (
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-center text-[#1D1D1F]">
        <Aurora />
        <main className="flex w-full max-w-2xl items-center px-6 py-24 sm:px-10">
          <Tilt max={3} className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)', scale: 0.97 }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
              transition={springs.entrance}
              className="glass-panel relative overflow-hidden rounded-[28px] p-10 text-center sm:p-14"
            >
              <ShineOverlay intensity={0.1} size={520} color="255, 255, 255" />
              <motion.h1
                initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ ...springs.entrance, delay: 0.1 }}
                className="text-[clamp(28px,4.2vw,44px)] font-semibold leading-[1.15] tracking-[-0.022em]"
              >
                Thanks! You’re now on the waitlist 🔥
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ ...springs.entrance, delay: 0.2 }}
                className="mx-auto mt-6 max-w-[680px] text-[clamp(20px,2.6vw,28px)] leading-[1.35] tracking-[-0.01em] text-[#1D1D1F]"
              >
                We’ll notify you the second we go live.
              </motion.p>
            </motion.div>
          </Tilt>
        </main>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center text-[#1D1D1F]">
      <Aurora />

      <div className="fixed left-0 right-0 top-0 z-30 h-[3px]" aria-hidden>
        <motion.div
          className="h-full origin-left bg-gradient-to-r from-[#1D4ED8] via-[#6366F1] to-[#A855F7]"
          animate={{ scaleX: progress }}
          initial={false}
          transition={springs.expand}
          style={{ transformOrigin: 'left' }}
        />
      </div>

      <main className="flex w-full max-w-2xl flex-1 items-center px-6 py-20 sm:px-10">
        <Tilt max={4} className="w-full">
          <div className="glass-panel relative overflow-hidden rounded-[28px] p-7 sm:p-10">
            <ShineOverlay intensity={0.08} size={560} color="255, 255, 255" />

            <AnimatePresence initial={false} mode="wait" custom={direction}>
              <motion.div
                key={step.id}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springs.entrance}
                className="relative"
              >
                {step.type === 'welcome' && <Welcome step={step} onStart={() => void advance()} />}
                {(step.type === 'text' || step.type === 'email') && (
                  <TextQuestion
                    step={step}
                    index={visibleQuestionIndex}
                    value={typeof answers[step.id] === 'string' ? (answers[step.id] as string) : ''}
                    onChange={(v) => setAnswer(step.id, v)}
                    onKeyDown={onKeyDown}
                    inputRef={inputRef}
                  />
                )}
                {step.type === 'choice' && (
                  <ChoiceQuestion
                    step={step}
                    index={visibleQuestionIndex}
                    value={answers[step.id]}
                    onSelectSingle={onSelectSingle}
                    onToggleMulti={onToggleMulti}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </Tilt>
      </main>

      {step.type !== 'welcome' && (
        <motion.footer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.entrance, delay: 0.15 }}
          className="sticky bottom-0 z-20 w-full px-4 pb-4 sm:px-6"
        >
          <div className="glass-popover mx-auto flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl px-4 py-3 sm:px-5">
            <div className="text-[13px] text-[#6E6E73]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={error ?? 'hint'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="inline-block"
                >
                  {error ? (
                    <span className="text-[#DC2626]">{error}</span>
                  ) : (
                    <>
                      Press{' '}
                      <kbd className="mx-1 rounded border border-[#D2D2D7] bg-white/70 px-1.5 py-0.5 text-[11px] font-medium">
                        Enter
                      </kbd>{' '}
                      to continue
                    </>
                  )}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.94 }}
                transition={springs.press}
                onClick={back}
                className="rounded-full border border-black/10 bg-white/60 px-4 py-2 text-[13px] font-medium text-[#1D1D1F] backdrop-blur transition hover:bg-white/80"
                type="button"
              >
                Back
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                whileHover={{ y: -1 }}
                transition={springs.press}
                onClick={() => void advance()}
                disabled={submitting}
                className="rounded-full bg-[#1D4ED8] px-5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(29,78,216,0.35)] transition hover:bg-[#1E40AF] disabled:opacity-60"
                type="button"
              >
                {submitting ? 'Sending…' : 'OK'}
              </motion.button>
            </div>
          </div>
        </motion.footer>
      )}
    </div>
  )
}

function Welcome({ step, onStart }: { step: WelcomeStep; onStart: () => void }) {
  return (
    <div className="text-center">
      <motion.h1
        initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ ...springs.entrance, delay: 0.05 }}
        className="mx-auto max-w-[820px] text-[clamp(28px,4.2vw,44px)] font-semibold leading-[1.12] tracking-[-0.022em]"
      >
        {step.title}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ ...springs.entrance, delay: 0.18 }}
        className="mx-auto mt-7 max-w-[760px] text-[clamp(18px,2.4vw,24px)] leading-[1.35] tracking-[-0.01em] text-[#1D1D1F]"
      >
        {step.body}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.entrance, delay: 0.32 }}
        className="mt-10 flex flex-col items-center gap-3"
      >
        <motion.button
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={springs.press}
          onClick={onStart}
          autoFocus
          className="rounded-[12px] bg-[#1D4ED8] px-7 py-3 text-[20px] font-medium text-white shadow-[0_12px_36px_rgba(29,78,216,0.45)] focus:outline-none focus:ring-4 focus:ring-[#1D4ED8]/20"
          type="button"
        >
          {step.cta}
        </motion.button>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-[#6E6E73]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          {step.takes}
        </span>
      </motion.div>
    </div>
  )
}

function TextQuestion({
  step,
  index,
  value,
  onChange,
  onKeyDown,
  inputRef,
}: {
  step: TextStep
  index: number
  value: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.MutableRefObject<HTMLInputElement | null>
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <NumberBadge n={index} />
        <div className="flex-1">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.entrance, delay: 0.05 }}
            className="text-[clamp(24px,3.2vw,34px)] font-semibold leading-[1.2] tracking-[-0.02em]"
          >
            {step.label}
            {step.required && <span aria-hidden className="ml-1 align-baseline text-[#1D1D1F]">*</span>}
          </motion.h2>
          {step.description && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.entrance, delay: 0.12 }}
              className="mt-2 text-[17px] leading-[1.5] text-[#1D1D1F]/85"
            >
              {step.description}
            </motion.p>
          )}
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.entrance, delay: 0.2 }}
        className="mt-10 pl-0 sm:pl-10"
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
          className="w-full border-b border-black/15 bg-transparent pb-2 text-[clamp(22px,2.8vw,30px)] font-light leading-[1.3] tracking-[-0.01em] text-[#1D1D1F] placeholder:text-[#A5B4FC] focus:border-[#1D4ED8] focus:outline-none"
        />
      </motion.div>
    </div>
  )
}

function ChoiceQuestion({
  step,
  index,
  value,
  onSelectSingle,
  onToggleMulti,
}: {
  step: ChoiceStep
  index: number
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
      <div className="flex items-start gap-3">
        <NumberBadge n={index} />
        <div className="flex-1">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.entrance, delay: 0.05 }}
            className="text-[clamp(24px,3.2vw,34px)] font-semibold leading-[1.2] tracking-[-0.02em]"
          >
            {step.label}
          </motion.h2>
          {step.description && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.entrance, delay: 0.12 }}
              className="mt-2 text-[17px] leading-[1.5] text-[#1D1D1F]/85"
            >
              {step.description}
            </motion.p>
          )}
          {step.multiple && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...springs.entrance, delay: 0.2 }}
              className="mt-1 text-[13px] text-[#86868B]"
            >
              Choose as many as you like.
            </motion.p>
          )}
        </div>
      </div>
      <ul className="mt-8 flex flex-col gap-2 pl-0 sm:pl-10">
        {step.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i)
          const selected = selectedSet.has(opt.value)
          return (
            <motion.li
              key={opt.value}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ ...springs.entrance, delay: 0.18 + i * 0.06 }}
            >
              <motion.button
                type="button"
                whileHover={{ y: -2, scale: 1.012 }}
                whileTap={{ scale: 0.985 }}
                transition={springs.hover}
                onClick={() => (step.multiple ? onToggleMulti(opt.value) : onSelectSingle(opt.value))}
                className={[
                  'group relative w-full overflow-hidden rounded-2xl border px-3 py-3 text-left',
                  selected
                    ? 'border-[#1D4ED8] bg-[#EEF2FF]/80 shadow-[0_10px_30px_rgba(29,78,216,0.18)] backdrop-blur'
                    : 'border-white/60 bg-white/55 shadow-[0_4px_18px_rgba(15,23,42,0.06)] backdrop-blur hover:border-[#C7D2FE] hover:bg-white/70',
                ].join(' ')}
              >
                <ShineOverlay
                  intensity={0.22}
                  size={320}
                  color={selected ? '99, 102, 241' : '148, 163, 255'}
                />
                <span className="relative z-[1] flex items-center gap-3">
                  <LetterChip ch={letter} selected={selected} />
                  <span className="text-[clamp(18px,2vw,22px)] font-normal text-[#1D4ED8]">
                    {opt.label}
                  </span>
                  {step.multiple && selected && (
                    <motion.span
                      aria-hidden
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={springs.indicator}
                      className="ml-auto text-[#1D4ED8]"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </motion.span>
                  )}
                </span>
              </motion.button>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
