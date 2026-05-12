'use client'

import Link from 'next/link'
import { FloorProvider, useFloorDebug } from '@/hooks/vision/useFloorStream'
import { SourceBatchGrid } from './SourceBatchGrid'
import { SettlementTape } from './SettlementTape'
import { FlowStream } from './FlowStream'
import { FloorBackground } from './FloorBackground'

function FloorTopBar() {
  const { sseConnected, batches, visibleTape, visibleFlow } = useFloorDebug()
  return (
    <header className="relative z-10 flex h-12 items-center justify-between border-b border-black/[0.06] bg-white/80 px-5 backdrop-blur-md">
      <Link href="/" className="flex items-baseline gap-3">
        <span
          className="text-[15px] font-semibold tracking-[-0.014em] text-[#1d1d1f]"
          style={{ fontFamily: 'var(--apple-font-display)' }}
        >
          The Floor
        </span>
        <span className="text-[11px] text-[#86868b]">Vision</span>
      </Link>
      <div className="flex items-center gap-4 text-[10px] tabular-nums text-[#86868b]">
        <span>{batches} sources</span>
        <span>{visibleTape} tape</span>
        <span>{visibleFlow} flow</span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: sseConnected ? '#0071e3' : '#86868b' }}
          />
          {sseConnected ? 'live' : 'offline'}
        </span>
      </div>
    </header>
  )
}

function FloorPanes() {
  return (
    <main className="relative z-10 grid flex-1 grid-cols-[280px_1fr_320px] overflow-hidden">
      <aside className="border-r border-black/[0.06] bg-[#fbfbfd]">
        <SourceBatchGrid />
      </aside>
      <section className="bg-[#f5f5f7]">
        <SettlementTape />
      </section>
      <aside className="border-l border-black/[0.06] bg-[#fbfbfd]">
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
        .floor-breathe {
          animation: floorBreathe 2.4s ease-in-out infinite;
          color: #0071e3;
        }
      `}</style>
      <div
        className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#f5f5f7]"
        style={{
          fontFamily: 'var(--apple-font-text)',
          letterSpacing: '-0.022em',
          color: '#1d1d1f',
        }}
      >
        <FloorBackground />
        <FloorTopBar />
        <FloorPanes />
      </div>
    </FloorProvider>
  )
}
