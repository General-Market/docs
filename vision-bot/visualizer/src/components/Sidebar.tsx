import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { clsx } from 'clsx'
import type { Bet, IndexItem } from '@/lib/types'

const ROW_HEIGHT = 56

interface Props {
  items: IndexItem[]
  selected: IndexItem | null
  onSelect: (item: IndexItem) => void
  loading: boolean
}

type Filters = {
  last_bet: Bet | null
  has_settled: boolean
}

export function Sidebar({ items, selected, onSelect, loading }: Props) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>({ last_bet: null, has_settled: false })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (filters.last_bet && it.last_bet !== filters.last_bet) return false
      if (filters.has_settled && it.settled_pnl_usdc == null) return false
      if (q) {
        const hay = `${it.asset_id} ${it.asset_name} ${it.source_name}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, query, filters])

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  return (
    <aside className="row-start-2 col-start-1 grid grid-rows-[auto_1fr_auto] border-r border-line bg-panel min-h-0">
      <div className="grid gap-2 border-b border-line p-3">
        <input
          type="search"
          placeholder="search asset name or source"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-text outline-none focus:border-blue"
        />
        <div className="flex flex-wrap gap-1.5">
          <Chip
            on={filters.last_bet === 'UP'}
            tone="up"
            onClick={() =>
              setFilters((f) => ({ ...f, last_bet: f.last_bet === 'UP' ? null : 'UP' }))
            }
          >
            last UP
          </Chip>
          <Chip
            on={filters.last_bet === 'DOWN'}
            tone="down"
            onClick={() =>
              setFilters((f) => ({ ...f, last_bet: f.last_bet === 'DOWN' ? null : 'DOWN' }))
            }
          >
            last DOWN
          </Chip>
          <Chip
            on={filters.has_settled}
            onClick={() => setFilters((f) => ({ ...f, has_settled: !f.has_settled }))}
          >
            has settled
          </Chip>
        </div>
      </div>

      <div ref={scrollerRef} className="relative overflow-y-auto">
        {loading && <div className="px-4 py-3 text-xs text-muted">loading…</div>}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((row) => {
            const it = filtered[row.index]
            return (
              <Row
                key={it.asset_id}
                item={it}
                active={selected?.asset_id === it.asset_id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                  transform: `translateY(${row.start}px)`,
                }}
                onClick={() => onSelect(it)}
              />
            )
          })}
        </div>
      </div>

      <div className="flex justify-between border-t border-line px-3.5 py-2 text-[11px] text-muted">
        <span>{filtered.length} shown</span>
        <span>{items.length} total</span>
      </div>
    </aside>
  )
}

function Row({
  item,
  active,
  style,
  onClick,
}: {
  item: IndexItem
  active: boolean
  style: React.CSSProperties
  onClick: () => void
}) {
  const last = item.last_bet
  const pnl = item.settled_pnl_usdc
  const pnlText = pnl == null ? '' : (pnl > 0 ? '+' : '') + pnl.toFixed(2)
  return (
    <div
      style={style}
      onClick={onClick}
      className={clsx(
        'grid cursor-pointer grid-cols-[1fr_auto] items-center gap-1 overflow-hidden border-b border-[#15181d] px-3.5 py-2 hover:bg-panel-2',
        active && 'bg-[#1a1f27]',
      )}
    >
      <div className="overflow-hidden">
        <div className="truncate font-medium">{item.asset_name}</div>
        <div className="truncate text-[11px] text-muted">
          {item.source_name || '?'} · {item.trade_count} {item.trade_count === 1 ? 'trade' : 'trades'}
        </div>
      </div>
      <div className="text-right">
        <div>
          <span
            className={clsx(
              'inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
              last === 'UP' && 'bg-up/10 text-up',
              last === 'DOWN' && 'bg-down/10 text-down',
              !last && 'text-muted',
            )}
          >
            {last || '—'}
          </span>
        </div>
        <div
          className={clsx(
            'num text-[11px]',
            pnl == null ? 'text-muted' : pnl > 0 ? 'text-up' : pnl < 0 ? 'text-down' : 'text-muted',
          )}
        >
          {pnlText}
        </div>
      </div>
    </div>
  )
}

function Chip({
  on,
  tone,
  onClick,
  children,
}: {
  on: boolean
  tone?: 'up' | 'down'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'cursor-pointer select-none rounded-full border px-2 py-0.5 text-[11px] transition',
        !on && 'border-line text-muted hover:text-text',
        on && !tone && 'border-text bg-panel-2 text-text',
        on && tone === 'up' && 'border-up text-up',
        on && tone === 'down' && 'border-down text-down',
      )}
    >
      {children}
    </button>
  )
}
