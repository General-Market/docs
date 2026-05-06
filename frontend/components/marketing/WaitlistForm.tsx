'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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
  multiline?: boolean
}
type ChoiceStep = {
  type: 'choice'
  id: string
  label: string
  description?: string
  options: Choice[]
  required?: boolean
}
type ThanksStep = {
  type: 'thanks'
  id: 'thanks'
  title: string
  body: string
}

type Step = WelcomeStep | TextStep | ChoiceStep | ThanksStep

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
    multiline: true,
  },
  {
    type: 'thanks',
    id: 'thanks',
    title: 'Thanks! You’re now on the waitlist 🔥',
    body: 'We’ll notify you the second we go live.',
  },
]

type Answers = Record<string, string>

function shouldSkip(step: Step, answers: Answers): boolean {
  if (step.id === 'reach' && answers.affiliate !== 'yes') return true
  return false
}

function isValid(step: Step, value: string): { ok: true } | { ok: false; reason: string } {
  if (step.type === 'welcome' || step.type === 'thanks' || step.type === 'choice') return { ok: true }
  const trimmed = value.trim()
  if (step.required && !trimmed) return { ok: false, reason: 'Required.' }
  if (step.type === 'email' && trimmed) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!ok) return { ok: false, reason: 'That doesn’t look like an email.' }
  }
  return { ok: true }
}

const NumberBadge = ({ n }: { n: number }) => (
  <span
    aria-hidden
    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[#1D4ED8] text-[14px] font-semibold tabular-nums text-white"
    style={{ marginTop: 6 }}
  >
    {n}
  </span>
)

const LetterChip = ({ ch, selected }: { ch: string; selected?: boolean }) => (
  <span
    aria-hidden
    className={[
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border text-[13px] font-semibold uppercase',
      selected
        ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
        : 'border-[#C7D2FE] bg-white text-[#1D4ED8]',
    ].join(' ')}
  >
    {ch}
  </span>
)

export default function WaitlistForm() {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const step = STEPS[idx]
  const total = STEPS.length - 2 // exclude welcome + thanks
  const visibleQuestionIndex = useMemo(() => {
    let n = 0
    for (let i = 1; i < idx; i++) {
      const s = STEPS[i]
      if (s.type === 'welcome' || s.type === 'thanks') continue
      if (shouldSkip(s, answers)) continue
      n++
    }
    return n + 1
  }, [idx, answers])

  useEffect(() => {
    if (step.type === 'text' || step.type === 'email') {
      const t = setTimeout(() => inputRef.current?.focus(), 250)
      return () => clearTimeout(t)
    }
  }, [step])

  function findNext(from: number, dir: 1 | -1): number {
    let i = from + dir
    while (i > 0 && i < STEPS.length - 1 && shouldSkip(STEPS[i], answers)) {
      i += dir
    }
    return Math.max(0, Math.min(STEPS.length - 1, i))
  }

  async function advance() {
    if (step.type === 'welcome') {
      setDirection(1)
      setIdx(findNext(idx, 1))
      return
    }
    if (step.type === 'thanks') return
    const value = answers[(step as TextStep | ChoiceStep).id] ?? ''
    const v = isValid(step, value)
    if (!v.ok) {
      setError(v.reason)
      return
    }
    setError(null)
    const next = findNext(idx, 1)
    if (next === STEPS.length - 1) {
      setSubmitting(true)
      try {
        await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(answers),
        })
      } catch {
        // silently swallow — the user shouldn't pay for our backend
      } finally {
        setSubmitting(false)
      }
    }
    setDirection(1)
    setIdx(next)
  }

  function back() {
    if (idx === 0) return
    setError(null)
    setDirection(-1)
    setIdx(findNext(idx, -1))
  }

  function setAnswer(id: string, value: string) {
    setAnswers((a) => ({ ...a, [id]: value }))
    setError(null)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (step.type === 'text' && (step as TextStep).multiline) return
      e.preventDefault()
      void advance()
    }
  }

  const progress = step.type === 'welcome' ? 0 : step.type === 'thanks' ? 1 : visibleQuestionIndex / total

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-white text-[#1D1D1F]">
      <div
        className="fixed left-0 right-0 top-0 z-30 h-[3px] bg-transparent"
        aria-hidden
      >
        <div
          className="h-full bg-[#1D4ED8] transition-[width] duration-500 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <main className="mx-auto flex w-full max-w-apple flex-1 items-center px-6 py-24 sm:px-10">
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={step.id}
            custom={direction}
            initial={{ opacity: 0, y: direction === 1 ? 24 : -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction === 1 ? -24 : 24 }}
            transition={{ duration: 0.32, ease: [0.25, 1, 0.3, 1] }}
            className="w-full"
          >
            {step.type === 'welcome' && <Welcome step={step} onStart={advance} />}
            {(step.type === 'text' || step.type === 'email') && (
              <TextQuestion
                step={step as TextStep}
                index={visibleQuestionIndex}
                value={answers[(step as TextStep).id] ?? ''}
                onChange={(v) => setAnswer((step as TextStep).id, v)}
                onKeyDown={onKeyDown}
                inputRef={inputRef}
              />
            )}
            {step.type === 'choice' && (
              <ChoiceQuestion
                step={step}
                index={visibleQuestionIndex}
                value={answers[step.id] ?? ''}
                onSelect={(v) => {
                  setAnswer(step.id, v)
                  setTimeout(() => void advance(), 220)
                }}
              />
            )}
            {step.type === 'thanks' && <Thanks step={step} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {step.type !== 'welcome' && step.type !== 'thanks' && (
        <footer className="sticky bottom-0 z-20 border-t border-[#E8E8ED] bg-white/90 px-6 py-4 backdrop-blur-xl sm:px-10">
          <div className="mx-auto flex w-full max-w-apple items-center justify-between gap-4">
            <div className="text-[13px] text-[#86868B]">
              {error ? <span className="text-[#DC2626]">{error}</span> : <>Press <kbd className="mx-1 rounded border border-[#D2D2D7] bg-[#F5F5F7] px-1.5 py-0.5 text-[11px] font-medium">Enter</kbd> to continue</>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={back}
                className="rounded-full border border-[#D2D2D7] px-4 py-2 text-[13px] font-medium text-[#1D1D1F] transition hover:bg-[#F5F5F7]"
                type="button"
              >
                Back
              </button>
              <button
                onClick={() => void advance()}
                disabled={submitting}
                className="rounded-full bg-[#1D4ED8] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#1E40AF] disabled:opacity-60"
                type="button"
              >
                {submitting ? 'Sending…' : 'OK'}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

function Welcome({ step, onStart }: { step: WelcomeStep; onStart: () => void }) {
  return (
    <div className="text-center">
      <h1 className="mx-auto max-w-[820px] text-[clamp(28px,4.2vw,44px)] font-semibold leading-[1.12] tracking-[-0.022em]">
        {step.title}
      </h1>
      <p className="mx-auto mt-7 max-w-[760px] text-[clamp(18px,2.4vw,24px)] leading-[1.35] tracking-[-0.01em] text-[#1D1D1F]">
        {step.body}
      </p>
      <p className="mt-3 text-[17px] italic text-[#86868B]">Description (optional)</p>
      <div className="mt-10 flex flex-col items-center gap-3">
        <button
          onClick={onStart}
          autoFocus
          className="rounded-[10px] bg-[#1D4ED8] px-7 py-3 text-[20px] font-medium text-white shadow-sm transition hover:bg-[#1E40AF] focus:outline-none focus:ring-4 focus:ring-[#1D4ED8]/20"
          type="button"
        >
          {step.cta}
        </button>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-[#6E6E73]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          {step.takes}
        </span>
      </div>
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
  inputRef: React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <NumberBadge n={index} />
        <div className="flex-1">
          <h2 className="text-[clamp(24px,3.2vw,34px)] font-semibold leading-[1.2] tracking-[-0.02em]">
            {step.label}
            {step.required && <span aria-hidden className="ml-1 align-baseline text-[#1D1D1F]">*</span>}
          </h2>
          {step.description ? (
            <p className="mt-2 text-[17px] leading-[1.5] text-[#1D1D1F]/85">{step.description}</p>
          ) : (
            <p className="mt-2 text-[17px] italic text-[#86868B]">Description (optional)</p>
          )}
        </div>
      </div>
      <div className="mt-10 pl-0 sm:pl-10">
        {step.multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder={step.placeholder}
            className="w-full resize-none border-b border-[#D2D2D7] bg-transparent pb-2 text-[clamp(22px,2.8vw,30px)] font-light leading-[1.3] tracking-[-0.01em] text-[#1D1D1F] placeholder:text-[#A5B4FC] focus:border-[#1D4ED8] focus:outline-none"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={step.type === 'email' ? 'email' : 'text'}
            inputMode={step.type === 'email' ? 'email' : 'text'}
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={step.placeholder}
            className="w-full border-b border-[#D2D2D7] bg-transparent pb-2 text-[clamp(22px,2.8vw,30px)] font-light leading-[1.3] tracking-[-0.01em] text-[#1D1D1F] placeholder:text-[#A5B4FC] focus:border-[#1D4ED8] focus:outline-none"
          />
        )}
      </div>
    </div>
  )
}

function ChoiceQuestion({
  step,
  index,
  value,
  onSelect,
}: {
  step: ChoiceStep
  index: number
  value: string
  onSelect: (v: string) => void
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <NumberBadge n={index} />
        <div className="flex-1">
          <h2 className="text-[clamp(24px,3.2vw,34px)] font-semibold leading-[1.2] tracking-[-0.02em]">
            {step.label}
          </h2>
          {step.description ? (
            <p className="mt-2 text-[17px] leading-[1.5] text-[#1D1D1F]/85">{step.description}</p>
          ) : (
            <p className="mt-2 text-[17px] italic text-[#86868B]">Description (optional)</p>
          )}
        </div>
      </div>
      <ul className="mt-8 flex flex-col gap-2 pl-0 sm:pl-10">
        {step.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i)
          const selected = value === opt.value
          return (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => onSelect(opt.value)}
                className={[
                  'group flex w-full items-center gap-3 rounded-[12px] border px-3 py-3 text-left transition',
                  selected
                    ? 'border-[#1D4ED8] bg-[#EEF2FF]'
                    : 'border-[#E0E7FF] bg-[#F5F7FE] hover:border-[#C7D2FE] hover:bg-[#EEF2FF]',
                ].join(' ')}
              >
                <LetterChip ch={letter} selected={selected} />
                <span className="text-[clamp(18px,2vw,22px)] font-normal text-[#1D4ED8]">
                  {opt.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Thanks({ step }: { step: ThanksStep }) {
  return (
    <div className="text-center">
      <h1 className="mx-auto max-w-[820px] text-[clamp(28px,4.2vw,44px)] font-semibold leading-[1.15] tracking-[-0.022em]">
        {step.title}
      </h1>
      <p className="mx-auto mt-6 max-w-[680px] text-[clamp(20px,2.6vw,28px)] leading-[1.35] tracking-[-0.01em] text-[#1D1D1F]">
        {step.body}
      </p>
      <p className="mt-3 text-[17px] italic text-[#86868B]">Description (optional)</p>
    </div>
  )
}
