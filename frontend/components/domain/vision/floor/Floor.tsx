'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { FloorProvider, useFloorDebug } from '@/hooks/vision/useFloorStream'
import { SourceBatchGrid } from './SourceBatchGrid'
import { PulseFeed } from './PulseFeed'
import { FlowStream } from './FlowStream'
import { FloorBackground } from './FloorBackground'

type Tab = 'sources' | 'pulse' | 'flow'

function StatChip({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      <span className="text-[13px] font-medium text-[#1d1d1f]">{value}</span>
      <span className="text-[11px] text-[#86868b]">{label}</span>
    </span>
  )
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src="/logo.svg"
        alt="General"
        width={26}
        height={26}
        style={{ borderRadius: 6 }}
        priority
      />
      <span
        className="hidden font-semibold sm:inline"
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 19,
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text)',
        }}
      >
        General
      </span>
      <span
        className="hidden items-center gap-1 rounded-full px-2 py-0.5 font-semibold sm:inline-flex"
        style={{
          fontSize: 10,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: '#0071e3',
          color: '#ffffff',
        }}
      >
        Vision · Floor
      </span>
    </Link>
  )
}

function FloorTopBar() {
  const { sseConnected, batches, visibleTape, visibleFlow } = useFloorDebug()
  return (
    <header
      className="apple-glass relative z-20 flex h-14 items-center justify-between gap-3 px-4 md:px-6"
      style={{ borderBottom: '1px solid var(--apple-border)' }}
    >
      <Brand />
      <div className="flex items-center gap-3 md:gap-6">
        <div className="hidden items-center gap-6 md:flex">
          <StatChip label="sources" value={batches} />
          <StatChip label="tape" value={visibleTape} />
          <StatChip label="flow" value={visibleFlow} />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-[980px] border border-black/[0.06] bg-white/60 px-2.5 py-1 text-[11px] tracking-[0.011em] text-[#6e6e73]">
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

function FloorPanes({ tab }: { tab: Tab }) {
  return (
    <main className="relative z-10 flex-1 overflow-hidden md:grid md:grid-cols-[280px_1fr_320px]">
      <aside
        className={`overflow-hidden md:block ${tab === 'sources' ? 'block' : 'hidden'}`}
        style={{
          background: 'var(--apple-panel-2)',
          borderRight: '1px solid var(--apple-border)',
        }}
      >
        <SourceBatchGrid />
      </aside>
      <section
        className={`overflow-hidden md:block ${tab === 'pulse' ? 'block' : 'hidden'}`}
        style={{ background: 'var(--apple-page-bg)' }}
      >
        <PulseFeed />
      </section>
      <aside
        className={`overflow-hidden md:block ${tab === 'flow' ? 'block' : 'hidden'}`}
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

function FloorTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { key: Tab; label: string }[] = [
    { key: 'sources', label: 'Sources' },
    { key: 'pulse', label: 'Pulse' },
    { key: 'flow', label: 'Flow' },
  ]
  return (
    <nav
      className="relative z-20 grid h-14 grid-cols-3 md:hidden"
      style={{
        background: 'var(--apple-glass-bg-light)',
        backdropFilter: 'var(--apple-glass-filter)',
        WebkitBackdropFilter: 'var(--apple-glass-filter)',
        borderTop: '1px solid var(--apple-border)',
      }}
    >
      {items.map(it => {
        const active = tab === it.key
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => setTab(it.key)}
            className="flex items-center justify-center text-[13px] font-medium"
            style={{
              color: active ? '#0071e3' : '#6e6e73',
              fontFamily: 'var(--apple-font-text)',
              letterSpacing: '-0.014em',
            }}
          >
            {it.label}
          </button>
        )
      })}
    </nav>
  )
}

export function Floor() {
  const [tab, setTab] = useState<Tab>('pulse')
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
        <FloorPanes tab={tab} />
        <FloorTabs tab={tab} setTab={setTab} />
      </div>
    </FloorProvider>
  )
}
