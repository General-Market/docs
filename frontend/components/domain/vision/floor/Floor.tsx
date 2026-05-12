'use client'

import Link from 'next/link'
import { FloorProvider, useFloorDebug } from '@/hooks/vision/useFloorStream'
import { SourceBatchGrid } from './SourceBatchGrid'
import { PulseFeed } from './PulseFeed'
import { FlowStream } from './FlowStream'
import { FloorBackground } from './FloorBackground'

function StatChip({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      <span className="text-[13px] font-medium text-[#1d1d1f]">{value}</span>
      <span className="text-[11px] text-[#86868b]">{label}</span>
    </span>
  )
}

function FloorTopBar() {
  const { sseConnected, batches, visibleTape, visibleFlow } = useFloorDebug()
  return (
    <header
      className="apple-glass relative z-10 flex h-14 items-center justify-between px-6"
      style={{ borderBottom: '1px solid var(--apple-border)' }}
    >
      <Link href="/" className="group flex items-baseline gap-3">
        <span
          className="text-[19px] font-semibold tracking-[-0.022em] text-[#1d1d1f] transition-opacity group-hover:opacity-70"
          style={{ fontFamily: 'var(--apple-font-display)' }}
        >
          The Floor
        </span>
        <span
          className="text-[13px] text-[#6e6e73]"
          style={{ fontFamily: 'var(--apple-font-text)' }}
        >
          Vision
        </span>
      </Link>
      <div className="flex items-center gap-6">
        <StatChip label="sources" value={batches} />
        <StatChip label="tape" value={visibleTape} />
        <StatChip label="flow" value={visibleFlow} />
        <span
          className="inline-flex items-center gap-1.5 rounded-[980px] border border-black/[0.06] bg-white/60 px-2.5 py-1 text-[11px] tracking-[0.011em] text-[#6e6e73]"
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: sseConnected ? '#0071e3' : '#86868b',
              boxShadow: sseConnected ? '0 0 0 3px rgba(0,113,227,0.18)' : 'none',
            }}
          />
          {sseConnected ? 'Live' : 'Idle'}
        </span>
      </div>
    </header>
  )
}

function FloorPanes() {
  return (
    <main className="relative z-10 grid flex-1 grid-cols-[300px_1fr_340px] overflow-hidden">
      <aside
        className="overflow-hidden"
        style={{
          background: 'var(--apple-panel-2)',
          borderRight: '1px solid var(--apple-border)',
        }}
      >
        <SourceBatchGrid />
      </aside>
      <section style={{ background: 'var(--apple-page-bg)' }}>
        <PulseFeed />
      </section>
      <aside
        className="overflow-hidden"
        style={{
          background: 'var(--apple-panel-2)',
          borderLeft: '1px solid var(--apple-border)',
        }}
      >
        <FlowStream />
      </aside>
    </main>
  )
}

export function Floor() {
  return (
    <FloorProvider>
      <style>{`
        @keyframes floorScan {
          0%   { transform: translateY(-2px); }
          100% { transform: translateY(100vh); }
        }
        @keyframes floorCardPulse {
          0%, 100% { box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 0 0 0 rgba(0,113,227,0.0); }
          50%      { box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 0 0 6px rgba(0,113,227,0.10); }
        }
        @keyframes floorBreathe {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%      { opacity: 0.9; transform: scale(1.25); }
        }
        @keyframes floorShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .floor-breathe {
          display: inline-block;
          animation: floorBreathe 2.4s ease-in-out infinite;
          color: var(--apple-accent);
        }
        .floor-empty-shimmer {
          position: relative;
          overflow: hidden;
        }
        .floor-empty-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 35%,
            rgba(0,113,227,0.05) 50%,
            transparent 65%
          );
          animation: floorShimmer 6s ease-in-out infinite;
        }
        .floor-pane-header {
          font-family: var(--apple-font-text);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--apple-text-tertiary);
        }
      `}</style>
      <div
        className="relative flex h-screen w-screen flex-col overflow-hidden"
        style={{
          background: 'var(--apple-page-bg)',
          fontFamily: 'var(--apple-font-text)',
          letterSpacing: '-0.022em',
          color: 'var(--apple-text)',
        }}
      >
        <FloorBackground />
        <FloorTopBar />
        <FloorPanes />
      </div>
    </FloorProvider>
  )
}
