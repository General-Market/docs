'use client'

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from '@/i18n/routing'

/* ─────────────────────────────────────────────
   Tunable constants — drop a real video here.
   Set VIDEO_SRC to a path under /public when
   the file is ready (e.g. '/build-bot.mp4').
   ───────────────────────────────────────────── */

const VIDEO_SRC: string | null = null
const VIDEO_POSTER: string | null = null
const REPO_URL = 'https://github.com/General-Market/vision-bot-examples'
const COMMAND = `claude "clone ${REPO_URL} and deploy a Vision trading bot"`

const LONG_WAY = `git clone ${REPO_URL}
cd vision-bot-examples/twitch
./setup.sh --auto-fund
.venv/bin/python live_trader.py --strategy momentum --deposit 0.1 --max-joins 1`

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

/* ─────────────────────────────────────────────
   Copy button — the only stateful piece
   ───────────────────────────────────────────── */

interface CopyButtonProps {
  text: string
  variant?: 'light' | 'dark'
  className?: string
}

function CopyButton({ text, variant = 'light', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard rejected — silent */
    }
  }, [text])

  const base =
    'inline-flex items-center gap-2 px-4 py-2 text-[11px] font-black tracking-[0.12em] uppercase transition-colors'
  const palette =
    variant === 'dark'
      ? copied
        ? 'bg-brand text-white'
        : 'bg-white text-text-primary hover:bg-white/90'
      : copied
        ? 'bg-brand text-white border border-brand'
        : 'bg-text-primary text-white border border-text-primary hover:bg-black'

  return (
    <button type="button" onClick={handleCopy} className={`${base} ${palette} ${className}`}>
      {copied ? (
        <>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="1" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

/* ─────────────────────────────────────────────
   Eyebrow with pulse — tiny status row
   ───────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <span className="relative flex w-1.5 h-1.5">
        <span className="absolute inline-flex w-full h-full rounded-full bg-brand opacity-75 animate-ping" />
        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-brand" />
      </span>
      <span className="text-[10px] font-black tracking-[0.18em] uppercase text-text-secondary">
        {children}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Section heading — small label, big spacing
   ───────────────────────────────────────────── */

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-6">
      <span className="font-mono text-[10px] text-text-muted tracking-[0.1em]">{index}</span>
      <span className="h-px flex-1 bg-border-light" />
      <span className="text-[10px] font-black tracking-[0.18em] uppercase text-text-secondary">
        {label}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Video — real <video> when src is set,
   otherwise an honest placeholder.
   ───────────────────────────────────────────── */

function VideoFrame() {
  if (VIDEO_SRC) {
    return (
      <video
        controls
        playsInline
        preload="metadata"
        poster={VIDEO_POSTER ?? undefined}
        className="w-full aspect-video bg-black"
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
    )
  }

  return (
    <div className="relative w-full aspect-video bg-surface-dark overflow-hidden">
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 border border-white/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-white/70 ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/40">
            Two minutes
          </span>
        </div>
      </div>

      {/* corner stamps */}
      <div className="absolute top-4 left-4 text-[9px] font-mono text-white/30 tracking-wider">
        REC · 00:00
      </div>
      <div className="absolute top-4 right-4 text-[9px] font-mono text-white/30 tracking-wider">
        VISION / BOT
      </div>
      <div className="absolute bottom-4 left-4 text-[9px] font-mono text-white/30 tracking-wider">
        CLAUDE-CODE
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-[9px] font-mono text-white/30 tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
        LIVE
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   What happens — three steps, no card grid
   ───────────────────────────────────────────── */

const STEPS = [
  {
    n: '01',
    title: 'It clones.',
    body: 'The repository lands on disk. You did not type git clone. You did not type cd. The only thing you typed was a sentence.',
  },
  {
    n: '02',
    title: 'It configures.',
    body: 'Keys placed. Dependencies installed. Defaults chosen. The .env file you would have forgotten to fill out — already filled.',
  },
  {
    n: '03',
    title: 'It trades.',
    body: 'The first order goes out. A number becomes another number. The bot does not check Twitter. The bot does not have feelings about the trade.',
  },
] as const

/* ─────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────── */

export function BuildBotVSL() {
  return (
    <div className="bg-page text-text-primary">
      {/* ───── HERO ───── */}
      <section className="px-6 lg:px-12 pt-16 lg:pt-24 pb-12">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
          >
            <Eyebrow>Build a Vision Bot</Eyebrow>

            <h1 className="mt-6 font-black leading-[0.92] tracking-[-0.035em] text-[clamp(2.5rem,8vw,6rem)]">
              Paste a sentence.
              <br />
              <span className="text-text-muted">A bot appears.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-[15px] lg:text-[17px] leading-[1.6] text-text-secondary">
              Claude Code reads the repository, configures your keys, picks markets, places trades.
              The whole ceremony takes longer to describe than to perform.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ───── THE COMMAND ───── */}
      <section className="px-6 lg:px-12 pb-20 lg:pb-28">
        <div className="max-w-5xl mx-auto">
          <SectionLabel index="01" label="The Incantation" />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
            className="border-2 border-text-primary bg-white"
          >
            {/* command body */}
            <div className="px-6 lg:px-10 pt-8 lg:pt-10 pb-6 lg:pb-8">
              <div className="flex items-start gap-4">
                <span className="font-mono text-text-muted text-sm lg:text-base mt-1 select-none">$</span>
                <code className="flex-1 font-mono text-[15px] lg:text-[20px] leading-[1.5] text-text-primary break-words">
                  {COMMAND}
                </code>
              </div>
            </div>

            {/* footer strip */}
            <div className="border-t border-border-light px-6 lg:px-10 py-4 flex items-center justify-between gap-4 bg-surface">
              <span className="text-[11px] tracking-[0.04em] text-text-secondary">
                One sentence. One paste. One bot.
              </span>
              <CopyButton text={COMMAND} />
            </div>
          </motion.div>

          <p className="mt-5 text-[12px] text-text-muted">
            Requires{' '}
            <a
              href="https://docs.claude.com/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary underline underline-offset-4 hover:no-underline"
            >
              Claude Code
            </a>
            {' '}— a free CLI from Anthropic. <code className="font-mono">npm i -g @anthropic-ai/claude-code</code>
          </p>
        </div>
      </section>

      {/* ───── VIDEO ───── */}
      <section className="px-6 lg:px-12 pb-24 lg:pb-32">
        <div className="max-w-5xl mx-auto">
          <SectionLabel index="02" label="Watch It Happen" />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
            className="border border-border-light overflow-hidden"
          >
            <VideoFrame />
          </motion.div>

          <p className="mt-5 text-[12px] text-text-muted max-w-md">
            Less time than it takes to write a config file you would later regret.
          </p>
        </div>
      </section>

      {/* ───── WHAT HAPPENS ───── */}
      <section className="px-6 lg:px-12 pb-24 lg:pb-32">
        <div className="max-w-5xl mx-auto">
          <SectionLabel index="03" label="What It Does, While You Watch" />

          <div className="border-t border-text-primary">
            {STEPS.map((step) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
                className="grid grid-cols-[3rem_1fr] lg:grid-cols-[6rem_1fr_2fr] gap-4 lg:gap-10 py-8 lg:py-10 border-b border-border-light"
              >
                <div className="font-mono text-[11px] text-text-muted pt-2">{step.n}</div>
                <h3 className="text-[22px] lg:text-[28px] font-black leading-[1.05] tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="col-span-2 lg:col-span-1 text-[14px] lg:text-[15px] leading-[1.65] text-text-secondary lg:pt-2">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>

          <p className="mt-12 max-w-xl text-[16px] lg:text-[18px] leading-[1.55] text-text-primary font-medium">
            It will lose money in your absence. So would you. The difference is sleep.
          </p>
        </div>
      </section>

      {/* ───── THE LONG WAY ───── */}
      <section className="px-6 lg:px-12 pb-24 lg:pb-28">
        <div className="max-w-5xl mx-auto">
          <SectionLabel index="04" label="The Long Way" />

          <p className="text-[14px] text-text-secondary max-w-xl mb-6">
            For those who insist on suffering. The same outcome, more typing, no advantage.
          </p>

          <div className="bg-surface-dark border border-surface-dark">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white/15" />
                <span className="w-2 h-2 rounded-full bg-white/15" />
                <span className="w-2 h-2 rounded-full bg-white/15" />
                <span className="ml-3 font-mono text-[10px] text-white/30 tracking-[0.1em]">terminal</span>
              </div>
              <CopyButton text={LONG_WAY} variant="dark" />
            </div>
            <pre className="px-5 lg:px-7 py-6 lg:py-8 font-mono text-[12px] lg:text-[13px] leading-[1.7] text-white/80 whitespace-pre-wrap overflow-x-auto">
              {LONG_WAY}
            </pre>
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="px-6 lg:px-12 pb-24 lg:pb-32">
        <div className="max-w-5xl mx-auto">
          <div className="border-t border-text-primary pt-10">
            <p className="text-[clamp(1.5rem,3.5vw,2.5rem)] font-black leading-[1.05] tracking-[-0.025em] max-w-3xl">
              The repo is open. The strategies are forks.
              <br />
              <span className="text-text-muted">Your bot is yours.</span>
            </p>

            <div className="mt-12 flex flex-col sm:flex-row gap-6 sm:gap-10 sm:items-center">
              <a
                href="https://github.com/General-Market/vision-bot-examples/blob/main/AGENTS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 text-[13px] font-black tracking-[0.06em] uppercase text-text-primary"
              >
                <span className="border-b border-text-primary pb-0.5">Read the docs</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </a>

              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 text-[13px] font-black tracking-[0.06em] uppercase text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="border-b border-current pb-0.5">Open the repository</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </a>

              <Link
                href="/source/steam"
                className="group inline-flex items-center gap-3 text-[13px] font-black tracking-[0.06em] uppercase text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="border-b border-current pb-0.5">Browse markets first</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
