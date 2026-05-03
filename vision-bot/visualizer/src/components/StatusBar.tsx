import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { IndexStats } from '@/lib/types'
import { fmtUsd, fmtSignedInt, shortAddr } from '@/lib/format'
import { clsx } from 'clsx'

interface Props {
  player: string | undefined
  stats: IndexStats | undefined
  generatedAt: number | undefined
  loading: boolean
  error: string | undefined
}

export function StatusBar({ player, stats, generatedAt, loading, error }: Props) {
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
    <header className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-panel px-5 py-2.5">
      <div className="font-semibold tracking-tight">Vision bot</div>
      <div className="font-mono text-xs text-muted">{shortAddr(player)}</div>

      <Stat label="active" value={stats?.active_batches} loading={loading} />
      <Stat label="settled" value={stats?.settled_batches} loading={loading} />
      <Stat label="deposited" value={fmtUsd(stats?.total_deposited_usdc)} loading={loading} />
      <Stat
        label="settled pnl"
        value={fmtUsd(stats?.total_settled_pnl_usdc)}
        loading={loading}
        signed={stats?.total_settled_pnl_usdc}
      />
      <Stat label="assets" value={fmtSignedInt(stats?.asset_count)} loading={loading} />
      <Stat label="trades" value={fmtSignedInt(stats?.trade_count)} loading={loading} />

      <div className="flex flex-wrap gap-1.5">
        {stats?.sources?.map((src) => (
          <span
            key={src}
            className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[11px] text-muted"
          >
            {src}
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {generatedAt && (
          <span className="text-[11px] text-muted">
            data {ageString(generatedAt)}
          </span>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="cursor-pointer rounded-md border border-line bg-panel-2 px-2.5 py-1 text-[11px] text-muted hover:border-text hover:text-text disabled:cursor-wait disabled:opacity-60"
          title="Re-fetch index.json + selected asset (after re-running build_from_db.py)"
        >
          {refreshing ? 'refreshing…' : 'refresh'}
        </button>
        {error && <span className="text-xs text-down">{error}</span>}
      </div>
    </header>
  )
}

function ageString(unixSeconds: number): string {
  const ageMs = Date.now() - unixSeconds * 1000
  if (ageMs < 60_000) return 'just now'
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m old`
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h old`
  return `${Math.floor(ageMs / 86_400_000)}d old`
}

function Stat({
  label,
  value,
  loading,
  signed,
}: {
  label: string
  value: string | number | undefined
  loading: boolean
  signed?: number | null | undefined
}) {
  const display = loading ? '…' : value == null ? '—' : String(value)
  const colorClass =
    signed == null ? 'text-text' : signed > 0 ? 'text-up' : signed < 0 ? 'text-down' : 'text-text'
  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <span className={clsx('num text-sm font-semibold', colorClass)}>{display}</span>
    </div>
  )
}
