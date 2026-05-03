import { clsx } from 'clsx'
import type { IndexItem } from '@/lib/types'
import { useAsset } from '@/lib/queries'
import { sourceHue } from '@/lib/view'
import { Sparkline } from './Sparkline'

interface Props {
  featured: IndexItem
  side: IndexItem[]
  onOpen: (item: IndexItem) => void
}

export function HeroCard({ featured, side, onOpen }: Props) {
  const { data } = useAsset(featured.file)
  const hue = sourceHue(featured.source_name)
  const pnl = featured.settled_pnl_usdc
  const pnlText = pnl == null ? '—' : (pnl > 0 ? '+' : '') + '$' + pnl.toFixed(2)

  return (
    <div
      className="grid gap-0 overflow-hidden border border-line bg-panel"
      style={{
        borderRadius: 'var(--radius-xl)',
        gridTemplateColumns: 'minmax(260px, 320px) 1fr minmax(220px, 280px)',
      }}
    >
      <div className="flex flex-col justify-between p-7">
        <div>
          <div className="flex items-center gap-1.5 text-muted" style={{ fontSize: 12 }}>
            <AppleMark size={11} />
            <span style={{ letterSpacing: 0.2 }}>Featured backtest</span>
          </div>
          <h2
            className="mt-3 font-display font-semibold text-text"
            style={{ fontSize: 28, letterSpacing: '-0.022em', lineHeight: 1.07 }}
          >
            {featured.asset_name}
          </h2>
          <p className="mt-2 text-muted" style={{ fontSize: 14, lineHeight: 1.4 }}>
            {featured.source_name} · {featured.trade_count}{' '}
            {featured.trade_count === 1 ? 'trade' : 'trades'}
            {pnl != null && (
              <>
                {' · '}
                <span
                  className={clsx(
                    'num font-medium',
                    pnl > 0 && 'text-up',
                    pnl < 0 && 'text-down',
                  )}
                >
                  {pnlText}
                </span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpen(featured)}
          className="inline-flex w-fit items-center gap-2 cursor-pointer text-white transition hover:opacity-90"
          style={{
            background: '#1d1d1f',
            borderRadius: 'var(--radius-pill)',
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            marginTop: 24,
          }}
        >
          <PlayIcon />
          Open chart
        </button>
      </div>

      <div
        className="relative min-h-[260px]"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 80% 94%), hsl(${(hue + 40) % 360} 80% 88%))`,
        }}
      >
        <div className="absolute inset-0 flex items-end p-6">
          <Sparkline
            points={data?.history}
            width={800}
            height={260}
            stroke={`hsl(${hue} 60% 35%)`}
            strokeWidth={2}
            fill={`hsla(${hue}, 70%, 50%, 0.16)`}
          />
        </div>
      </div>

      <div className="flex flex-col border-l border-line">
        {side.slice(0, 4).map((it) => (
          <SideRow key={it.asset_id} item={it} onOpen={() => onOpen(it)} />
        ))}
      </div>
    </div>
  )
}

function SideRow({ item, onOpen }: { item: IndexItem; onOpen: () => void }) {
  const { data } = useAsset(item.file)
  const hue = sourceHue(item.source_name)
  const pnl = item.settled_pnl_usdc
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-1 cursor-pointer items-center gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-[rgba(0,0,0,0.02)] last:border-b-0"
    >
      <div
        className="relative h-12 w-20 shrink-0 overflow-hidden"
        style={{
          borderRadius: 'var(--radius-sm)',
          background: `linear-gradient(135deg, hsl(${hue} 80% 94%), hsl(${(hue + 40) % 360} 80% 88%))`,
        }}
      >
        <div className="absolute inset-0">
          <Sparkline
            points={data?.history}
            width={160}
            height={60}
            stroke={`hsl(${hue} 60% 38%)`}
            strokeWidth={1.4}
            fill={`hsla(${hue}, 70%, 50%, 0.14)`}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate font-medium text-text"
          style={{ fontSize: 13, letterSpacing: '-0.016em' }}
        >
          {item.asset_name}
        </div>
        <div className="truncate text-muted" style={{ fontSize: 11 }}>
          {item.source_name}
        </div>
      </div>
      {pnl != null && (
        <div
          className={clsx(
            'num shrink-0 text-right',
            pnl > 0 ? 'text-up' : pnl < 0 ? 'text-down' : 'text-faint',
          )}
          style={{ fontSize: 12 }}
        >
          {(pnl > 0 ? '+' : '') + pnl.toFixed(0)}
        </div>
      )}
    </button>
  )
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function AppleMark({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.22} viewBox="0 0 18 22" fill="currentColor" aria-hidden>
      <path d="M14.59 11.49c-.02-2.39 1.95-3.54 2.04-3.6-1.11-1.62-2.84-1.85-3.46-1.87-1.47-.15-2.87.86-3.62.86-.75 0-1.91-.84-3.14-.82-1.62.02-3.11.94-3.94 2.39-1.68 2.92-.43 7.23 1.21 9.6.8 1.16 1.76 2.46 3.01 2.41 1.21-.05 1.67-.78 3.13-.78 1.46 0 1.87.78 3.15.76 1.3-.02 2.13-1.18 2.92-2.34.92-1.34 1.3-2.65 1.32-2.72-.03-.01-2.53-.97-2.62-3.89zM12.06 4.78c.66-.81 1.11-1.93.99-3.04-.96.04-2.12.64-2.81 1.45-.62.71-1.16 1.85-1.02 2.94 1.07.08 2.17-.55 2.84-1.35z" />
    </svg>
  )
}
