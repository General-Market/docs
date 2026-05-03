import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { shortAddr } from '@/lib/format'

interface Props {
  player: string | undefined
  generatedAt: number | undefined
  loading: boolean
  error: string | undefined
  query: string
  onQueryChange: (q: string) => void
}

export function TopBar({ player, generatedAt, loading, error, query, onQueryChange }: Props) {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  async function refresh() {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries()
      await queryClient.refetchQueries()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <header className="col-span-2 grid grid-cols-[auto_1fr_auto] items-center gap-6 border-b border-line bg-panel px-6 py-3">
      <Brand />
      <Search value={query} onChange={onQueryChange} />
      <Actions
        player={player}
        generatedAt={generatedAt}
        refreshing={refreshing || loading}
        onRefresh={refresh}
        error={error}
      />
    </header>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <AppleMark />
      <span
        className="font-display font-semibold tracking-tight text-text"
        style={{ fontSize: 19, letterSpacing: '-0.022em' }}
      >
        Vision bot
      </span>
      <span
        className="rounded-full px-1.5 py-0.5 font-medium text-muted"
        style={{
          fontSize: 10,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: 'rgba(0,0,0,0.05)',
        }}
      >
        Beta
      </span>
    </div>
  )
}

function Search({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <label className="relative block">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input
          type="search"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search asset name or source"
          className="h-9 w-full rounded-full border-0 bg-[rgba(0,0,0,0.04)] pl-10 pr-4 text-text placeholder:text-faint focus:bg-[rgba(0,0,0,0.06)] focus:outline-none"
          style={{ fontSize: 15, letterSpacing: '-0.016em' }}
        />
      </label>
    </div>
  )
}

function Actions({
  player,
  generatedAt,
  refreshing,
  onRefresh,
  error,
}: {
  player: string | undefined
  generatedAt: number | undefined
  refreshing: boolean
  onRefresh: () => void
  error: string | undefined
}) {
  const addr = shortAddr(player)
  return (
    <div className="flex items-center gap-3">
      {error && (
        <span className="text-xs text-down" style={{ fontSize: 12 }}>
          {error}
        </span>
      )}
      {generatedAt && (
        <span className="text-faint" style={{ fontSize: 12 }}>
          {ageString(generatedAt)}
        </span>
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        title="Re-fetch index + asset"
        className={clsx(
          'grid h-9 w-9 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-[rgba(0,0,0,0.05)] hover:text-text',
          refreshing && 'cursor-wait opacity-60',
        )}
      >
        <RefreshIcon spinning={refreshing} />
      </button>
      <Identicon addr={player} title={addr} />
    </div>
  )
}

function AppleMark() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="currentColor" aria-hidden>
      <path d="M14.59 11.49c-.02-2.39 1.95-3.54 2.04-3.6-1.11-1.62-2.84-1.85-3.46-1.87-1.47-.15-2.87.86-3.62.86-.75 0-1.91-.84-3.14-.82-1.62.02-3.11.94-3.94 2.39-1.68 2.92-.43 7.23 1.21 9.6.8 1.16 1.76 2.46 3.01 2.41 1.21-.05 1.67-.78 3.13-.78 1.46 0 1.87.78 3.15.76 1.3-.02 2.13-1.18 2.92-2.34.92-1.34 1.3-2.65 1.32-2.72-.03-.01-2.53-.97-2.62-3.89zM12.06 4.78c.66-.81 1.11-1.93.99-3.04-.96.04-2.12.64-2.81 1.45-.62.71-1.16 1.85-1.02 2.94 1.07.08 2.17-.55 2.84-1.35z" />
    </svg>
  )
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        animation: spinning ? 'spin 0.9s linear infinite' : undefined,
        transformOrigin: 'center',
      }}
      aria-hidden
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </svg>
  )
}

function Identicon({ addr, title }: { addr: string | undefined; title: string }) {
  const seed = addr ?? '00'
  const hue = (parseInt(seed.slice(2, 6), 16) || 200) % 360
  const initial = seed.slice(2, 3).toUpperCase()
  return (
    <div
      title={title}
      className="grid h-8 w-8 place-items-center rounded-full font-medium text-white"
      style={{
        fontSize: 12,
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))`,
      }}
    >
      {initial}
    </div>
  )
}

function ageString(unixSeconds: number): string {
  const ageMs = Date.now() - unixSeconds * 1000
  if (ageMs < 60_000) return 'just now'
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m old`
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h old`
  return `${Math.floor(ageMs / 86_400_000)}d old`
}
