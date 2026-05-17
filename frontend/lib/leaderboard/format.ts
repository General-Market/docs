import type { Tone } from './types'

export interface Formatted {
  text: string
  tone: Tone
}

export function truncAddr(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail + 2) return addr || '--'
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

function withSign(n: number, body: string): string {
  if (n > 0) return `+${body}`
  if (n < 0) return `-${body}`
  return body
}

function magnitude(abs: number): string {
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(2)}K`
  return `$${abs.toFixed(2)}`
}

export function fmtPnl(pnl: number): Formatted {
  if (!Number.isFinite(pnl) || Math.abs(pnl) < 0.005) {
    return { text: '$0.00', tone: 'neutral' }
  }
  return {
    text: withSign(pnl, magnitude(Math.abs(pnl))),
    tone: pnl > 0 ? 'pos' : 'neg',
  }
}

export function fmtVolume(vol: number): string {
  if (!Number.isFinite(vol) || vol <= 0) return '$0'
  if (vol < 1) return '<$1'
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(2)}M`
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`
  return `$${vol.toFixed(0)}`
}

export function fmtRoi(roi: number): Formatted {
  if (!Number.isFinite(roi)) return { text: '0%', tone: 'neutral' }
  const abs = Math.abs(roi)
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  const body = `${abs.toFixed(digits)}%`
  if (abs < 0.005) return { text: '0%', tone: 'neutral' }
  return { text: withSign(roi, body), tone: roi > 0 ? 'pos' : 'neg' }
}

export function fmtRounds(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  return n.toLocaleString('en-US')
}

const MEDALS = ['🥇', '🥈', '🥉'] as const

export function rankMedal(rank: number): string | null {
  if (rank >= 1 && rank <= 3) return MEDALS[rank - 1]
  return null
}
