import React, { memo } from 'react'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

// ── Types ──────────────────────────────────────────────────────────

export interface EnrichedMarket {
  collateralToken: string
  name: string
  symbol: string
  itpId: string
  settlementAddress: string
  nav: number              // price per share (raw float, e.g. 1.0342)
  borrowApy: number        // percentage (e.g. 4.25 = 4.25%)
  available: number        // dollar amount of available liquidity
  lltv: number             // percentage (e.g. 77 = 77%)
  collateral: number       // user's collateral in dollar terms (0 if none)
  debt: number             // user's debt in dollar terms (0 if none)
  userBalance: number      // user's ITP token balance in dollar terms (0 if none)
  market: MorphoMarketEntry
}

export interface MarketsTableProps {
  rows: EnrichedMarket[]
  selectedCollateralToken: string | null
  onSelectRow: (row: EnrichedMarket) => void
  isLoading: boolean
}

// ── Helpers ────────────────────────────────────────────────────────

function Bone({ w = 'w-20', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-black/[0.06] rounded animate-pulse`} />
}

function formatDollar(n: number, decimals = 0): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function formatPct(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}%`
}

function hasPosition(row: EnrichedMarket): boolean {
  return row.collateral > 0 || row.debt > 0
}

// ── Column Headers ─────────────────────────────────────────────────

const HEADERS = [
  { label: 'Market',      align: 'left'  as const, width: '',       hide: '' },
  { label: 'NAV',         align: 'right' as const, width: 'w-[80px]',  hide: 'hidden sm:table-cell' },
  { label: 'Borrow APY',  align: 'right' as const, width: 'w-[90px]',  hide: '' },
  { label: 'Balance',     align: 'right' as const, width: 'w-[100px]', hide: 'hidden sm:table-cell' },
  { label: 'Liquidity',   align: 'right' as const, width: 'w-[100px]', hide: 'hidden md:table-cell' },
  { label: 'LLTV',        align: 'right' as const, width: 'w-[70px]',  hide: 'hidden lg:table-cell' },
] as const

function TableHead() {
  return (
    <thead className="sticky top-0 z-10 bg-white">
      <tr className="border-b border-black/[0.06]">
        {HEADERS.map((col) => (
          <th
            key={col.label}
            className={`type-table-header px-4 py-2 ${col.width} ${col.hide} ${
              col.align === 'right' ? 'text-right' : 'text-left'
            }`}
          >
            {col.label}
          </th>
        ))}
        {/* Mobile position dot column — visible only below sm */}
        <th className="w-8 px-2 py-2 sm:hidden" />
      </tr>
    </thead>
  )
}

// ── Row ────────────────────────────────────────────────────────────

interface MarketRowProps {
  row: EnrichedMarket
  isSelected: boolean
  onSelect: (row: EnrichedMarket) => void
}

const MarketRowComponent = memo(function MarketRowComponent({
  row,
  isSelected,
  onSelect,
}: MarketRowProps) {
  const active = hasPosition(row)

  return (
    <tr
      onClick={() => onSelect(row)}
      className={`h-12 border-b border-black/[0.04] last:border-0 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-black/[0.04] border-l-2 border-l-black'
          : 'border-l-2 border-l-transparent hover:bg-black/[0.02]'
      }`}
    >
      {/* Market — avatar + name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center shrink-0">
            <span className="text-text-primary text-[9px] font-bold leading-none">
              {row.symbol.slice(0, 3)}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-text-primary block truncate">
              {row.name}
            </span>
            <span className="text-[10px] text-text-muted block">/ USDC</span>
          </div>
        </div>
      </td>

      {/* NAV */}
      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-text-primary hidden sm:table-cell">
        {formatDollar(row.nav, 2)}
      </td>

      {/* Borrow APY */}
      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-text-primary">
        {formatPct(row.borrowApy)}
      </td>

      {/* Balance — visible at sm+ */}
      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-text-primary hidden sm:table-cell">
        {row.userBalance > 0 ? (
          <span className="text-text-primary">{formatDollar(row.userBalance)}</span>
        ) : active ? (
          <span className="text-color-up text-[10px]">active</span>
        ) : (
          <span className="text-text-muted">&mdash;</span>
        )}
      </td>

      {/* Liquidity (totalSupply - totalBorrow) */}
      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-text-primary hidden md:table-cell">
        {formatDollar(row.available)}
      </td>

      {/* LLTV */}
      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-text-primary hidden lg:table-cell">
        {formatPct(row.lltv, 0)}
      </td>

      {/* Balance — dot indicator (below sm) */}
      <td className="px-2 py-3 text-center sm:hidden">
        {(active || row.userBalance > 0) && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-color-up" />
        )}
      </td>
    </tr>
  )
})

// ── Loading Skeleton ───────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="w-full">
      <table className="w-full text-sm">
        <TableHead />
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="h-12 border-b border-black/[0.04] border-l-2 border-l-transparent">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-black/[0.06] rounded-full animate-pulse shrink-0" />
                    <div className="space-y-1">
                      <Bone w="w-24" h="h-3" />
                      <Bone w="w-10" h="h-2" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right hidden sm:table-cell"><Bone w="w-12" h="h-3" /></td>
                <td className="px-4 py-3 text-right"><Bone w="w-14" h="h-3" /></td>
                <td className="px-4 py-3 text-right hidden sm:table-cell"><Bone w="w-16" h="h-3" /></td>
                <td className="px-4 py-3 text-right hidden md:table-cell"><Bone w="w-16" h="h-3" /></td>
                <td className="px-4 py-3 text-right hidden lg:table-cell"><Bone w="w-10" h="h-3" /></td>
                <td className="px-2 py-3 sm:hidden" />
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export const MarketsTable = memo(function MarketsTable({
  rows,
  selectedCollateralToken,
  onSelectRow,
  isLoading,
}: MarketsTableProps) {
  if (isLoading) return <LoadingSkeleton />

  if (rows.length === 0) {
    return (
      <div
        className="w-full text-center"
        style={{
          padding: '64px 24px',
          fontFamily: 'var(--apple-font-text)',
          letterSpacing: 'var(--apple-track-tight)',
        }}
      >
        <p style={{ fontSize: 17, color: 'var(--apple-text)', margin: 0, fontWeight: 500 }}>
          No borrow markets yet.
        </p>
        <p
          style={{
            fontSize: 14,
            color: 'var(--apple-text-secondary)',
            margin: '6px auto 0',
            maxWidth: 460,
          }}
        >
          The vault still earns the moment a market opens. Markets surface once a DTF has been pledged as collateral on Morpho.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <table className="w-full text-sm">
        <TableHead />
        <tbody>
          {rows.map((row) => (
            <MarketRowComponent
              key={row.collateralToken}
              row={row}
              isSelected={
                selectedCollateralToken?.toLowerCase() === row.collateralToken.toLowerCase()
              }
              onSelect={onSelectRow}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
})
