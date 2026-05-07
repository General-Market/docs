import * as React from 'react'

/* ─────────────────────────────────────────────────────────────
   Apple-style SVG schematics — replacements for ASCII diagrams.
   All diagrams live here. Each is a self-contained <figure>.
   No external CSS needed beyond .docs-schematic in docs.css.
   ─────────────────────────────────────────────────────────── */

const APPLE_BG = '#ffffff'
const APPLE_SURFACE = '#f5f5f7'
const APPLE_TEXT = '#1d1d1f'
const APPLE_TEXT_2 = '#6e6e73'
const APPLE_TEXT_3 = '#86868b'
const APPLE_BORDER = '#d2d2d7'
const APPLE_BLUE = '#0071e3'
const APPLE_GREEN = '#34c759'
const APPLE_ORANGE = '#ff9500'

export function GeneralMarketWordmark({
  height = 28,
  className = '',
  color = APPLE_TEXT,
}: {
  height?: number
  className?: string
  color?: string
}) {
  return (
    <svg
      width={(180 / 32) * height}
      height={height}
      viewBox="0 0 180 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="General Market"
    >
      <text
        x="0"
        y="24"
        fontFamily='"SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.022em"
        fill={color}
      >
        General Market.
      </text>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   ThreePillars — Index · Vision · Lending. Three cards, each with
   header, description, and a mini-panel example.
   Built in HTML/CSS — pure layout, not a connected diagram.
   ─────────────────────────────────────────────────────────── */

export function ThreePillars() {
  return (
    <figure className="docs-schematic schematic-pillars">
      <div className="schematic-pillars-grid">
        <Pillar
          accent={APPLE_BLUE}
          eyebrow="Index"
          title="On-chain ETFs"
          body="Up to 100 assets per basket. Real exchange execution via Bitget. BLS consensus on prices."
        >
          <div className="pillar-panel">
            <PanelRow label="BTC" value="12.5%" />
            <PanelRow label="ETH" value="10.0%" />
            <PanelRow label="SOL" value="8.0%" />
            <PanelRow label="…" value="69.5%" muted />
            <div className="panel-divider" />
            <PanelRow label="NAV" value="$1.34" emphasis />
          </div>
        </Pillar>

        <Pillar
          accent={APPLE_GREEN}
          eyebrow="Vision"
          title="Prediction markets"
          body="Across 90+ real-world data sources. Sealed bets, parimutuel payouts, BLS-verified resolution."
        >
          <div className="pillar-panel">
            <div className="pillar-question">Will the Paris Metro be late today?</div>
            <div className="pillar-tick">
              <span className="pillar-tick-dot" /> sealed · resolves at 18:00
            </div>
          </div>
        </Pillar>

        <Pillar
          accent={APPLE_ORANGE}
          eyebrow="Lending"
          title="Morpho-powered"
          body="Supply USDC for yield. Borrow USDC against ITP shares. On-chain NAV oracle pricing."
        >
          <div className="pillar-panel">
            <div className="pillar-action">
              <span className="pillar-action-icon">+</span>Supply USDC · earn yield
            </div>
            <div className="panel-divider" />
            <div className="pillar-action">
              <span className="pillar-action-icon">−</span>Borrow against ITP collateral
            </div>
          </div>
        </Pillar>
      </div>
    </figure>
  )
}

function Pillar({
  accent,
  eyebrow,
  title,
  body,
  children,
}: {
  accent: string
  eyebrow: string
  title: string
  body: string
  children?: React.ReactNode
}) {
  return (
    <div className="schematic-pillar" style={{ ['--accent' as string]: accent }}>
      <div className="schematic-pillar-eyebrow">{eyebrow}</div>
      <div className="schematic-pillar-title">{title}</div>
      <div className="schematic-pillar-body">{body}</div>
      {children}
    </div>
  )
}

function PanelRow({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string
  value: string
  muted?: boolean
  emphasis?: boolean
}) {
  return (
    <div className={`panel-row${muted ? ' muted' : ''}${emphasis ? ' emphasis' : ''}`}>
      <span>{label}</span>
      <span className="panel-num">{value}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MoneyFlow — sequence diagram with three lanes:
   YOU · GENERAL MARKET · REAL WORLD.
   Real SVG. Apple-styled lanes, arrows, labels.
   ─────────────────────────────────────────────────────────── */

type Step = {
  from: 0 | 1 | 2
  to: 0 | 1 | 2
  label: string
  detail?: string
  highlight?: 'blue' | 'green' | 'orange'
}

const FLOW_STEPS: Step[] = [
  { from: 0, to: 1, label: 'Buy the Top-100 ITP', highlight: 'blue' },
  { from: 1, to: 1, label: 'Oracle consensus', detail: '3 BLS nodes agree on price', highlight: 'blue' },
  { from: 1, to: 2, label: 'Execute on Bitget', highlight: 'blue' },
  { from: 2, to: 1, label: 'Fill confirmed' },
  { from: 1, to: 0, label: 'ITP shares in your wallet' },

  { from: 0, to: 1, label: 'Bet: RATP Line 13 late', highlight: 'green' },
  { from: 1, to: 1, label: 'Sealed bet (nobody sees it)', detail: 'BLS-encrypted', highlight: 'green' },
  { from: 2, to: 1, label: 'Actual delay data arrives' },
  { from: 1, to: 0, label: 'Payout if you were right' },

  { from: 0, to: 1, label: 'Supply USDC', highlight: 'orange' },
  { from: 1, to: 0, label: 'Earn yield from borrowers' },
]

export function MoneyFlow() {
  const lanes = ['You', 'General Market', 'Real world']
  const laneX = [120, 360, 600]
  const stepGap = 44
  const top = 70
  const height = top + FLOW_STEPS.length * stepGap + 30
  const width = 720

  const colorFor = (h?: Step['highlight']) =>
    h === 'green' ? APPLE_GREEN : h === 'orange' ? APPLE_ORANGE : h === 'blue' ? APPLE_BLUE : APPLE_TEXT_2

  return (
    <figure className="docs-schematic schematic-flow">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Sequence: how money flows between you, General Market, and the real world"
      >
        <defs>
          <marker
            id="flow-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        </defs>

        {/* Lane labels */}
        {lanes.map((l, i) => (
          <g key={l}>
            <rect
              x={laneX[i] - 88}
              y={20}
              width={176}
              height={32}
              rx={16}
              fill={APPLE_SURFACE}
              stroke={APPLE_BORDER}
            />
            <text
              x={laneX[i]}
              y={40}
              textAnchor="middle"
              fontFamily="SF Pro Display, Helvetica Neue, sans-serif"
              fontSize="13"
              fontWeight="600"
              letterSpacing="-0.005em"
              fill={APPLE_TEXT}
            >
              {l}
            </text>
          </g>
        ))}

        {/* Lane verticals */}
        {laneX.map((x, i) => (
          <line key={i} x1={x} y1={56} x2={x} y2={height - 12} stroke={APPLE_BORDER} strokeDasharray="2 4" />
        ))}

        {/* Steps */}
        {FLOW_STEPS.map((s, i) => {
          const y = top + i * stepGap
          const color = colorFor(s.highlight)
          if (s.from === s.to) {
            // Self-loop
            const x = laneX[s.from]
            return (
              <g key={i} color={color}>
                <rect
                  x={x - 90}
                  y={y - 14}
                  width={180}
                  height={28}
                  rx={6}
                  fill="#fff"
                  stroke={color}
                  strokeOpacity="0.3"
                />
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  fontFamily="SF Pro Text, Helvetica Neue, sans-serif"
                  fontSize="12"
                  fontWeight="500"
                  fill={APPLE_TEXT}
                >
                  {s.label}
                </text>
                {s.detail ? (
                  <text
                    x={x}
                    y={y + 14}
                    textAnchor="middle"
                    fontFamily="SF Pro Text, Helvetica Neue, sans-serif"
                    fontSize="10.5"
                    fill={APPLE_TEXT_3}
                  >
                    {s.detail}
                  </text>
                ) : null}
              </g>
            )
          }
          const x1 = laneX[s.from]
          const x2 = laneX[s.to]
          const midX = (x1 + x2) / 2
          return (
            <g key={i} color={color}>
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={color}
                strokeWidth={1.5}
                markerEnd="url(#flow-arrow)"
              />
              <rect
                x={midX - 110}
                y={y - 12}
                width={220}
                height={20}
                rx={4}
                fill="#ffffff"
              />
              <text
                x={midX}
                y={y - 1}
                textAnchor="middle"
                fontFamily="SF Pro Text, Helvetica Neue, sans-serif"
                fontSize="12"
                fontWeight="500"
                letterSpacing="-0.005em"
                fill={APPLE_TEXT}
              >
                {s.label}
              </text>
              {s.detail ? (
                <text
                  x={midX}
                  y={y + 13}
                  textAnchor="middle"
                  fontFamily="SF Pro Text, Helvetica Neue, sans-serif"
                  fontSize="10.5"
                  fill={APPLE_TEXT_3}
                >
                  {s.detail}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <figcaption>Money in. Risk out. Real-world data closes the loop.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   Schematic — generic Apple-styled box for any "diagram"
   stack (used to wrap an architecture sketch). Accepts JSON
   structure and renders boxes + arrows.
   ─────────────────────────────────────────────────────────── */

type Node = { id: string; label: string; sub?: string; accent?: 'blue' | 'green' | 'orange' | 'gray' }
type Edge = { from: string; to: string; label?: string }

export function GeneralMarketArchitecture() {
  return (
    <ArchSchematic
      caption="The full machine. 8 services, 29 contracts, 2 chains."
      nodes={[
        [{ id: 'fe', label: 'Frontend', sub: 'Next.js · Vercel', accent: 'blue' }],
        [
          { id: 'dn', label: 'Data Node', sub: '90+ sources · NAV · Postgres', accent: 'gray' },
          { id: 'l3', label: 'Index L3 (Orbit)', sub: 'Chain 111222333 · 29 contracts', accent: 'blue' },
        ],
        [
          { id: 'or', label: 'Oracle Nodes', sub: '3× Rust · BLS · 1s cycles', accent: 'green' },
          { id: 'ap', label: 'AP / Keeper', sub: 'Bitget exec · Bridge relay', accent: 'green' },
          { id: 'st', label: 'Settlement', sub: 'Arbitrum · Morpho · NAV oracle', accent: 'orange' },
        ],
        [
          { id: 'vb', label: 'Vision Bot', sub: 'Python · automated betting', accent: 'gray' },
          { id: 'sb', label: 'Social Bot', sub: 'Anomaly detect · 98 sources', accent: 'gray' },
          { id: 'cu', label: 'Curator', sub: 'NAV updates · allocation', accent: 'gray' },
        ],
      ]}
      edges={[
        { from: 'fe', to: 'dn', label: 'SSE + REST' },
        { from: 'fe', to: 'l3', label: 'RPC' },
        { from: 'l3', to: 'or', label: 'BLS' },
        { from: 'l3', to: 'ap', label: 'exec' },
        { from: 'l3', to: 'st', label: 'bridge' },
      ]}
    />
  )
}

export function ArchSchematic({
  nodes,
  edges,
  caption,
}: {
  nodes?: Node[][]
  edges?: Edge[]
  caption?: string
}) {
  if (!nodes || nodes.length === 0) return null
  const colW = 200
  const rowH = 80
  const gap = 24
  const cols = Math.max(...nodes.map(r => r.length))
  const width = cols * colW + (cols - 1) * gap + 48
  const height = nodes.length * rowH + (nodes.length - 1) * gap + 48

  const positions = new Map<string, { x: number; y: number; w: number; h: number }>()
  nodes.forEach((row, ri) => {
    const offset = (cols - row.length) * (colW + gap) / 2
    row.forEach((n, ci) => {
      const x = 24 + offset + ci * (colW + gap)
      const y = 24 + ri * (rowH + gap)
      positions.set(n.id, { x, y, w: colW, h: rowH })
    })
  })

  const accentOf = (a?: Node['accent']) =>
    a === 'blue' ? APPLE_BLUE
    : a === 'green' ? APPLE_GREEN
    : a === 'orange' ? APPLE_ORANGE
    : APPLE_TEXT_3

  return (
    <figure className="docs-schematic schematic-arch">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_TEXT_3} />
          </marker>
        </defs>

        {nodes.flat().map(n => {
          const p = positions.get(n.id)!
          const c = accentOf(n.accent)
          return (
            <g key={n.id}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
              <rect x={p.x} y={p.y} width={4} height={p.h} fill={c} rx={2} />
              <text
                x={p.x + 16}
                y={p.y + 30}
                fontFamily="SF Pro Display, Helvetica Neue, sans-serif"
                fontSize="14"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={APPLE_TEXT}
              >{n.label}</text>
              {n.sub ? (
                <text
                  x={p.x + 16}
                  y={p.y + 50}
                  fontFamily="SF Pro Text, Helvetica Neue, sans-serif"
                  fontSize="12"
                  fill={APPLE_TEXT_2}
                >{n.sub}</text>
              ) : null}
            </g>
          )
        })}

        {(edges ?? []).map((e, i) => {
          const a = positions.get(e.from)
          const b = positions.get(e.to)
          if (!a || !b) return null
          const x1 = a.x + a.w / 2
          const y1 = a.y + a.h
          const x2 = b.x + b.w / 2
          const y2 = b.y
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          return (
            <g key={i}>
              <path
                d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
                fill="none"
                stroke={APPLE_BORDER}
                markerEnd="url(#arch-arrow)"
              />
              {e.label ? (
                <text
                  x={mx}
                  y={my}
                  textAnchor="middle"
                  fontFamily="SF Pro Text, Helvetica Neue, sans-serif"
                  fontSize="11"
                  fill={APPLE_TEXT_3}
                >{e.label}</text>
              ) : null}
            </g>
          )
        })}
      </svg>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}
