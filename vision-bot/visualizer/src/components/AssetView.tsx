import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { useAsset } from '@/lib/queries'
import type { IndexItem } from '@/lib/types'
import { PriceChart } from './PriceChart'
import { PnLChart } from './PnLChart'

type OverlayKey = 'ai' | 'actual' | 'none'

interface Props {
  item: IndexItem | null
}

export function AssetView({ item }: Props) {
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
    <main className="row-start-2 col-start-2 grid min-h-0 min-w-0 grid-rows-[auto_1fr_280px]">
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line bg-panel px-5 py-3.5">
        <div>
          <div className="text-base font-semibold tracking-tight">
            {empty ? 'Pick an asset.' : (data?.asset_name ?? item.asset_name)}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {empty
              ? "A market is a bet about a number that hasn't settled yet."
              : `${data?.source_name ?? item.source_name} · asset id ${item.asset_id}`}
          </div>
        </div>
        {stats && (
          <div className="flex gap-4 text-xs text-muted">
            <span>
              <b className="text-text num">{stats.trades}</b> trades
            </span>
            <span className="rounded bg-up/10 px-1.5 py-0.5 text-up">{stats.ups} UP</span>
            <span className="rounded bg-down/10 px-1.5 py-0.5 text-down">{stats.downs} DOWN</span>
            {stats.settled > 0 ? (
              <>
                <span>
                  settled pnl{' '}
                  <b className={clsx('num', stats.totalPnl >= 0 ? 'text-up' : 'text-down')}>
                    {stats.totalPnl >= 0 ? '+' : ''}
                    {stats.totalPnl.toFixed(2)}
                  </b>
                </span>
                <span>
                  <b className="text-up">{stats.wins}W</b> /{' '}
                  <b className="text-down">{stats.losses}L</b>
                </span>
              </>
            ) : (
              <span className="text-warn">{stats.trades} open</span>
            )}
          </div>
        )}
      </div>

      <section className="relative flex min-h-0 min-w-0 flex-col px-5 pt-3.5 pb-1">
        <div className="flex flex-wrap items-center gap-1.5 pb-2 text-[11px] text-muted">
          <span>overlay:</span>
          {(['ai', 'actual', 'none'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setOverlay(k)}
              className={clsx(
                'cursor-pointer rounded-full border px-2 py-0.5 transition',
                overlay === k ? 'border-text bg-panel-2 text-text' : 'border-line text-muted hover:text-text',
              )}
            >
              {k === 'ai' ? 'AI' : k === 'actual' ? "bot's actual" : 'none'}
            </button>
          ))}
          {isFetching && <span className="ml-auto text-muted">loading…</span>}
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

      <section className="grid min-h-0 grid-rows-[auto_1fr] border-t border-line bg-panel px-5 pt-2.5 pb-3.5">
        <div className="flex items-center justify-between pb-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">AI backtest</h3>
          <div className="flex gap-3 text-[11px]">
            {(['ai', 'actual'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setStratOn((s) => ({ ...s, [k]: !s[k] }))}
                className={clsx(
                  'flex cursor-pointer items-center gap-1.5',
                  !stratOn[k] && 'opacity-40 line-through',
                )}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: k === 'ai' ? '#f7a35c' : '#e7eaef' }}
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
    <div className="absolute inset-0 grid place-items-center bg-bg pointer-events-none">
      <div className="text-center">
        <div className={tone === 'error' ? 'text-down' : 'text-text'}>{title}</div>
        {hint && <div className="mt-1.5 text-[11px] text-muted">{hint}</div>}
      </div>
    </div>
  )
}
