import React, { memo } from 'react'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

export interface EnrichedMarket {
  collateralToken: string
  name: string
  symbol: string
  itpId: string
  settlementAddress: string
  nav: number
  borrowApy: number
  available: number
  lltv: number
  collateral: number
  debt: number
  userBalance: number
  market: MorphoMarketEntry
}

export interface MarketsTableProps {
  rows: EnrichedMarket[]
  selectedCollateralToken: string | null
  onSelectRow: (row: EnrichedMarket) => void
  isLoading: boolean
}

function Bone({ w = 80, h = 14 }: { w?: number; h?: number }) {
  return (
    <div
      className="animate-pulse rounded"
      style={{ width: w, height: h, background: 'var(--apple-line)' }}
    />
  )
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

const HEADERS = [
  { label: 'Market',      align: 'left'  as const, width: '',          hide: '' },
  { label: 'NAV',         align: 'right' as const, width: 'w-[80px]',  hide: 'hidden sm:table-cell' },
  { label: 'Borrow APY',  align: 'right' as const, width: 'w-[90px]',  hide: '' },
  { label: 'Balance',     align: 'right' as const, width: 'w-[100px]', hide: 'hidden sm:table-cell' },
  { label: 'Liquidity',   align: 'right' as const, width: 'w-[100px]', hide: 'hidden md:table-cell' },
  { label: 'LLTV',        align: 'right' as const, width: 'w-[70px]',  hide: 'hidden lg:table-cell' },
] as const

const headCellStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
  color: 'var(--apple-text-tertiary)',
  padding: '10px 16px',
  background: 'var(--apple-panel)',
}

const cellStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 13,
  letterSpacing: 'var(--apple-track-tight)',
  color: 'var(--apple-text)',
  padding: '12px 16px',
  fontVariantNumeric: 'tabular-nums',
}

function TableHead() {
  return (
    <thead className="sticky top-0 z-10">
      <tr style={{ borderBottom: '1px solid var(--apple-line)' }}>
        {HEADERS.map(col => (
          <th
            key={col.label}
            className={`${col.width} ${col.hide} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
            style={headCellStyle}
          >
            {col.label}
          </th>
        ))}
        <th className="w-8 sm:hidden" style={{ ...headCellStyle, padding: '10px 8px' }} />
      </tr>
    </thead>
  )
}

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
  const rowStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--apple-line)',
    background: isSelected ? 'rgba(0,113,227,0.06)' : 'transparent',
    boxShadow: isSelected ? 'inset 2px 0 0 0 #0071e3' : 'inset 2px 0 0 0 transparent',
    cursor: 'pointer',
    transition: 'background 180ms var(--apple-ease-default)',
  }

  return (
    <tr
      onClick={() => onSelect(row)}
      style={rowStyle}
      onMouseEnter={e => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
    >
      <td style={cellStyle}>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: 'var(--apple-surface)',
              color: 'var(--apple-text)',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 'var(--apple-track-loose)',
            }}
          >
            {row.symbol.slice(0, 3)}
          </div>
          <div className="min-w-0">
            <span
              className="block truncate"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text)',
              }}
            >
              {row.name}
            </span>
            <span
              className="block"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 11,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-tertiary)',
              }}
            >
              / USDC
            </span>
          </div>
        </div>
      </td>

      <td style={cellStyle} className="text-right hidden sm:table-cell">
        {formatDollar(row.nav, 2)}
      </td>

      <td style={cellStyle} className="text-right">
        {formatPct(row.borrowApy)}
      </td>

      <td style={cellStyle} className="text-right hidden sm:table-cell">
        {row.userBalance > 0 ? (
          formatDollar(row.userBalance)
        ) : active ? (
          <span style={{ color: '#16a34a', fontSize: 11 }}>active</span>
        ) : (
          <span style={{ color: 'var(--apple-text-tertiary)' }}>—</span>
        )}
      </td>

      <td style={cellStyle} className="text-right hidden md:table-cell">
        {formatDollar(row.available)}
      </td>

      <td style={cellStyle} className="text-right hidden lg:table-cell">
        {formatPct(row.lltv, 0)}
      </td>

      <td className="text-center sm:hidden" style={{ ...cellStyle, padding: '12px 8px' }}>
        {(active || row.userBalance > 0) && (
          <span
            className="inline-block"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: '#16a34a',
            }}
          />
        )}
      </td>
    </tr>
  )
})

function LoadingSkeleton() {
  return (
    <div className="w-full">
      <table className="w-full">
        <TableHead />
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--apple-line)' }}>
              <td style={cellStyle}>
                <div className="flex items-center gap-3">
                  <div
                    className="animate-pulse shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--apple-line)' }}
                  />
                  <div className="space-y-1.5">
                    <Bone w={96} h={12} />
                    <Bone w={40} h={10} />
                  </div>
                </div>
              </td>
              <td style={cellStyle} className="text-right hidden sm:table-cell"><div className="ml-auto"><Bone w={48} h={12} /></div></td>
              <td style={cellStyle} className="text-right"><div className="ml-auto"><Bone w={56} h={12} /></div></td>
              <td style={cellStyle} className="text-right hidden sm:table-cell"><div className="ml-auto"><Bone w={64} h={12} /></div></td>
              <td style={cellStyle} className="text-right hidden md:table-cell"><div className="ml-auto"><Bone w={64} h={12} /></div></td>
              <td style={cellStyle} className="text-right hidden lg:table-cell"><div className="ml-auto"><Bone w={40} h={12} /></div></td>
              <td className="sm:hidden" style={{ ...cellStyle, padding: '12px 8px' }} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <TableHead />
        <tbody>
          {rows.map(row => (
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
