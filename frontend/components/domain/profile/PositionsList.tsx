'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { springs } from '@/components/ui/spring'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { PositionCard } from './PositionCard'
import type { ProfileBatch } from '@/hooks/usePlayerProfile'

type Filter = 'active' | 'closed'
type SortKey = 'value' | 'pnl' | 'deposited'

const PAGE_SIZE = 20

interface PositionsListProps {
  batches: ProfileBatch[]
}

// A position the chain still backs but that the oracle never actually settled
// (its settlement deadline elapsed without resolution) arrives as status
// "exited" with zero ticks and balance == deposited. It is not closed — the
// funds are in, awaiting settlement — so it stays in the open view rather than
// being filed under Closed, where it looks like it vanished.
function isAwaitingSettlement(b: ProfileBatch): boolean {
  return b.status === 'exited' && b.tickCount === 0
}

function SegmentedToggle({ active, onChange }: { active: Filter; onChange: (f: Filter) => void }) {
  const reduced = useReducedMotion()
  const options: { id: Filter; label: string; count?: number }[] = [
    { id: 'active', label: 'Active' },
    { id: 'closed', label: 'Closed' },
  ]

  return (
    <div className="relative inline-flex bg-surface rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`relative z-10 px-4 py-1.5 text-caption font-semibold rounded-md transition-colors ${
            active === opt.id ? 'text-black' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {opt.label}
          {active === opt.id && (
            <motion.div
              className="absolute inset-0 bg-white rounded-md shadow-sm border border-border-light"
              layoutId="position-filter-indicator"
              transition={reduced ? { duration: 0 } : springs.indicator}
              style={{ zIndex: -1 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

export function PositionsList({ batches }: PositionsListProps) {
  const { sources } = useSourceRegistry()
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const showMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE)
  }, [])

  // Reset pagination when filter or search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filter, search])

  const activeBatches = useMemo(
    () => batches.filter(b => b.status === 'active' || isAwaitingSettlement(b)),
    [batches],
  )
  const closedBatches = useMemo(
    () => batches.filter(b => b.status === 'exited' && b.tickCount > 0),
    [batches],
  )

  const displayBatches = filter === 'active' ? activeBatches : closedBatches

  const filtered = useMemo(() => {
    if (!search.trim()) return displayBatches
    const q = search.toLowerCase()
    return displayBatches.filter(b => {
      const src = findSource(sources, b.sourceId)
      const name = src?.name?.toLowerCase() ?? b.sourceId.toLowerCase()
      return name.includes(q) || b.sourceId.toLowerCase().includes(q)
    })
  }, [displayBatches, search, sources])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sortKey) {
      case 'value':
        return arr.sort((a, b) => b.balance - a.balance)
      case 'pnl':
        return arr.sort((a, b) => (b.balance - b.deposited) - (a.balance - a.deposited))
      case 'deposited':
        return arr.sort((a, b) => b.deposited - a.deposited)
      default:
        return arr
    }
  }, [filtered, sortKey])

  const activeCount = activeBatches.length
  const closedCount = closedBatches.length

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <SegmentedToggle active={filter} onChange={setFilter} />
          <span className="text-micro text-text-muted font-mono tabular-nums">
            {filter === 'active' ? activeCount : closedCount}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-caption bg-surface border border-border-light rounded-lg focus:outline-none focus:border-black/20 w-[160px] placeholder:text-text-muted/60"
            />
          </div>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-caption bg-surface border border-border-light rounded-lg px-3 py-1.5 focus:outline-none focus:border-black/20 text-text-secondary cursor-pointer"
          >
            <option value="value">Sort: Value</option>
            <option value="pnl">Sort: P&L</option>
            <option value="deposited">Sort: Deposited</option>
          </select>
        </div>
      </div>

      {/* Position cards */}
      {sorted.length === 0 ? (
        <div className="py-12 text-center text-caption text-text-muted">
          {search ? 'No positions match your search.' : filter === 'active' ? 'No active positions.' : 'No closed positions.'}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {sorted.slice(0, visibleCount).map((batch, i) => {
              const src = findSource(sources, batch.sourceId)
              const sourceInfo = src ? {
                sourceId: src.sourceId,
                name: src.name,
                logo: src.logo,
                brandBg: src.brandBg,
              } : null

              return (
                <PositionCard
                  key={`${batch.sourceId}-${batch.batchId}`}
                  batch={batch}
                  source={sourceInfo}
                  index={i}
                />
              )
            })}
          </div>
          {visibleCount < sorted.length && (
            <button
              onClick={showMore}
              className="w-full mt-3 py-2.5 text-caption font-semibold text-text-muted hover:text-black bg-surface hover:bg-surface/80 border border-border-light rounded-lg transition-colors"
            >
              Show more ({sorted.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  )
}
