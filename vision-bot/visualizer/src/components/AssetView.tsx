import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { useAsset } from '@/lib/queries'
import type { IndexItem } from '@/lib/types'
import { PriceChart } from './PriceChart'
import { PnLChart } from './PnLChart'

type OverlayKey = 'ai' | 'actual' | 'none'

interface Props {
  item: IndexItem | null
  onBack?: () => void
}

export function AssetView({ item, onBack }: Props) {
  const { data, error, isFetching } = useAsset(item?.file ?? null)
  const [overlay, setOverlay] = useState<OverlayKey>('ai')
  const [stratOn, setStratOn] = useState({ ai: true, actual: true })

  const stats = useMemo(() => {
    if (!data) return null
    const trades = data.trades ?? []
    const settled = trades.filter((t) => t.settled)
    const totalPnl = settled.reduce((s, t) => s + (t.pnl_usdc || 0), 0)
    const wins = settled.filter((t) => (t.pnl_usdc || 0) > 0).length
    const losses = settled.filter((t) => (t.pnl_usdc || 0) < 0).length
    const ups = trades.filter((t) => t.bet === 'UP').length
    const downs = trades.length - ups
    return { trades: trades.length, settled: settled.length, totalPnl, wins, losses, ups, downs }
  }, [data])

  const empty = !item

  return (
    <main className="row-start-2 col-start-1 grid min-h-0 min-w-0 grid-rows-[auto_1fr_240px] md:col-start-2 md:grid-rows-[auto_1fr_280px]">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line bg-panel px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-[rgba(0,0,0,0.05)] hover:text-text"
            title="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
        )}
        <div>
          <div
            className="font-display font-semibold text-text"
            style={{ fontSize: 22, letterSpacing: '-0.022em', lineHeight: 1.1 }}
          >
            {empty ? 'Pick an asset.' : (data?.asset_name ?? item.asset_name)}
          </div>
          <div className="mt-0.5 text-muted" style={{ fontSize: 13 }}>
            {empty
              ? "A market is a bet about a number that hasn't settled yet."
              : `${data?.source_name ?? item.source_name} · asset id ${item.asset_id}`}
          </div>
        </div>
        {stats && (
          <div className="flex flex-wrap items-center gap-2" style={{ fontSize: 12 }}>
            <Pill>
              <span className="num text-text font-medium">{stats.trades}</span>
              <span className="text-muted">trades</span>
            </Pill>
            <Pill tone="up">
              <span className="num font-medium">{stats.ups}</span>
              UP
            </Pill>
            <Pill tone="down">
              <span className="num font-medium">{stats.downs}</span>
              DOWN
            </Pill>
            {stats.settled > 0 ? (
              <>
                <Pill>
                  <span className="text-muted">PnL</span>
                  <span
                    className={clsx(
                      'num font-medium',
                      stats.totalPnl >= 0 ? 'text-up' : 'text-down',
                    )}
                  >
                    {stats.totalPnl >= 0 ? '+' : ''}
                    {stats.totalPnl.toFixed(2)}
                  </span>
                </Pill>
                <Pill>
                  <span className="text-up num font-medium">{stats.wins}W</span>
                  <span className="text-faint">/</span>
                  <span className="text-down num font-medium">{stats.losses}L</span>
                </Pill>
              </>
            ) : (
              <Pill tone="warn">
                <span className="num font-medium">{stats.trades}</span>
                open
              </Pill>
            )}
          </div>
        )}
      </div>

      <section className="relative flex min-h-0 min-w-0 flex-col px-4 pt-3 pb-1 sm:px-6 sm:pt-4">
        <div className="flex flex-wrap items-center gap-1.5 pb-3" style={{ fontSize: 12 }}>
          <span className="text-muted pr-1">Overlay</span>
          {(['ai', 'actual', 'none'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setOverlay(k)}
              className={clsx(
                'cursor-pointer transition',
                overlay === k
                  ? 'bg-text text-white'
                  : 'border border-line text-muted hover:text-text hover:bg-[rgba(0,0,0,0.04)]',
              )}
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: overlay === k ? '5px 12px' : '4px 11px',
              }}
            >
              {k === 'ai' ? 'AI' : k === 'actual' ? "bot's actual" : 'none'}
            </button>
          ))}
          {isFetching && (
            <span className="ml-auto text-faint" style={{ fontSize: 11 }}>
              loading…
            </span>
          )}
        </div>
        <div className="relative min-h-0 flex-1">
          {empty ? (
            <EmptyState
              title="Nothing loaded."
              hint="Pick a row on the left."
            />
          ) : error ? (
            <EmptyState title={`load failed: ${error.message}`} hint="Reload, or rebuild data." tone="error" />
          ) : !data ? (
            <EmptyState title={`loading ${item.asset_name}…`} />
          ) : data.history.length === 0 ? (
            <EmptyState title="no price history available" />
          ) : (
            <PriceChart data={data} overlay={overlay} />
          )}
        </div>
      </section>

      <section className="grid min-h-0 grid-rows-[auto_1fr] border-t border-line bg-panel-2 px-4 pt-2 pb-3 sm:px-6 sm:pt-3 sm:pb-4">
        <div className="flex items-center justify-between pb-2">
          <h3
            className="font-display font-semibold text-text"
            style={{ fontSize: 14, letterSpacing: '-0.016em' }}
          >
            AI backtest
          </h3>
          <div className="flex gap-3" style={{ fontSize: 12 }}>
            {(['ai', 'actual'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setStratOn((s) => ({ ...s, [k]: !s[k] }))}
                className={clsx(
                  'flex cursor-pointer items-center gap-1.5 text-muted',
                  !stratOn[k] && 'opacity-40 line-through',
                )}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: k === 'ai' ? '#ff9500' : '#1d1d1f' }}
                />
                {k === 'ai' ? 'AI' : "bot's actual"}
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-h-0">
          {data && data.history.length > 10 ? (
            <PnLChart data={data} stratOn={stratOn} />
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted">
              {empty ? '' : 'not enough data for backtest'}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function EmptyState({
  title,
  hint,
  tone,
}: {
  title: string
  hint?: string
  tone?: 'error'
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-panel pointer-events-none">
      <div className="text-center">
        <div
          className={tone === 'error' ? 'text-down' : 'text-text'}
          style={{ fontSize: 15 }}
        >
          {title}
        </div>
        {hint && (
          <div className="mt-1.5 text-muted" style={{ fontSize: 12 }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  )
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: 'up' | 'down' | 'warn'
}) {
  const bg =
    tone === 'up'
      ? 'rgba(52,199,89,0.12)'
      : tone === 'down'
        ? 'rgba(255,59,48,0.12)'
        : tone === 'warn'
          ? 'rgba(255,149,0,0.14)'
          : 'rgba(0,0,0,0.05)'
  const fg =
    tone === 'up'
      ? '#0a8035'
      : tone === 'down'
        ? '#c41e15'
        : tone === 'warn'
          ? '#a85a00'
          : '#1d1d1f'
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        background: bg,
        color: fg,
        borderRadius: 'var(--radius-pill)',
        padding: '4px 10px',
        fontSize: 12,
      }}
    >
      {children}
    </span>
  )
}
