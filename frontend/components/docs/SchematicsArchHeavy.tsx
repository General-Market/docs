import * as React from 'react'

/* Apple-styled SVG schematics for architecture/overview.mdx and architecture/bridge.mdx.
   All components are parameterless — data is baked in. Server components only. */

const APPLE_BG = '#ffffff'
const APPLE_SURFACE = '#f5f5f7'
const APPLE_TEXT = '#1d1d1f'
const APPLE_TEXT_2 = '#6e6e73'
const APPLE_TEXT_3 = '#86868b'
const APPLE_BORDER = '#d2d2d7'
const APPLE_BLUE = '#0071e3'
const APPLE_GREEN = '#34c759'
const APPLE_ORANGE = '#ff9500'

const FONT_DISPLAY = '"SF Pro Display", "Helvetica Neue", sans-serif'
const FONT_TEXT = '"SF Pro Text", "Helvetica Neue", sans-serif'

type Accent = 'blue' | 'green' | 'orange' | 'gray'
const accentColor = (a: Accent) =>
  a === 'blue' ? APPLE_BLUE : a === 'green' ? APPLE_GREEN : a === 'orange' ? APPLE_ORANGE : APPLE_TEXT_3

/* Reusable card with title + sub + accent bar */
function Card({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent = 'gray',
  active,
}: {
  x: number
  y: number
  w: number
  h: number
  title: string
  sub?: string
  accent?: Accent
  active?: boolean
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill={active ? APPLE_BG : APPLE_SURFACE}
        stroke={APPLE_BORDER}
      />
      <rect x={x} y={y + 4} width={4} height={h - 8} rx={2} fill={accentColor(accent)} />
      <text
        x={x + 16}
        y={y + 26}
        fontFamily={FONT_DISPLAY}
        fontSize={14}
        fontWeight={600}
        letterSpacing="-0.005em"
        fill={APPLE_TEXT}
      >
        {title}
      </text>
      {sub ? (
        <text
          x={x + 16}
          y={y + 46}
          fontFamily={FONT_TEXT}
          fontSize={12}
          fill={APPLE_TEXT_2}
        >
          {sub}
        </text>
      ) : null}
    </g>
  )
}

function Marker({ id, color = APPLE_TEXT_3 }: { id: string; color?: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  )
}

/* ─────────────────────────────────────────────────────────────
   OVERVIEW.MDX components
   ─────────────────────────────────────────────────────────── */

/* 1. System Architecture Overview — hierarchical view */
export function OverviewSystemArch() {
  const width = 940
  const height = 580
  const colW = 200
  const rowH = 70

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="General Market system architecture">
        <defs>
          <Marker id="osa-arrow" />
        </defs>

        {/* BLS oracle ring */}
        <text x={width / 2} y={28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={12} fontWeight={600} letterSpacing="0.04em" fill={APPLE_TEXT_3}>
          BLS CONSENSUS RING · 1S CYCLES
        </text>
        <Card x={140} y={48} w={colW} h={rowH} title="Oracle #1" sub="Rust · BLS partial sig" accent="green" />
        <Card x={(width - colW) / 2} y={48} w={colW} h={rowH} title="Oracle #2" sub="Rust · BLS partial sig" accent="green" />
        <Card x={width - 140 - colW} y={48} w={colW} h={rowH} title="Oracle #3" sub="Rust · BLS partial sig" accent="green" />
        {/* Connecting curved arcs between oracles */}
        <path d={`M ${140 + colW} ${48 + rowH / 2} Q ${width / 2} ${20} ${width - 140 - colW} ${48 + rowH / 2}`} stroke={APPLE_BORDER} fill="none" />
        <path d={`M ${140 + colW} ${48 + rowH / 2} L ${(width - colW) / 2} ${48 + rowH / 2}`} stroke={APPLE_BORDER} />
        <path d={`M ${(width - colW) / 2 + colW} ${48 + rowH / 2} L ${width - 140 - colW} ${48 + rowH / 2}`} stroke={APPLE_BORDER} />

        {/* Layer 2: Data Node + Index L3 */}
        <Card x={60} y={170} w={colW + 40} h={rowH} title="Data Node" sub="90+ sources · Postgres · :8200" accent="gray" />
        <Card x={width - 60 - (colW + 40)} y={170} w={colW + 40} h={rowH} title="Index L3 (Orbit)" sub="Chain 111222333 · 18-dec USDC" accent="blue" />

        {/* arrows oracles -> chain */}
        <line x1={width / 2} y1={48 + rowH} x2={width - 60 - (colW + 40) / 2} y2={170} stroke={APPLE_BORDER} markerEnd="url(#osa-arrow)" />
        <text x={width / 2 + 130} y={140} fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>BLS-signed batches</text>
        {/* data node -> oracles */}
        <line x1={60 + (colW + 40) / 2} y1={170} x2={140 + colW / 2} y2={48 + rowH} stroke={APPLE_BORDER} markerEnd="url(#osa-arrow)" />
        <text x={120} y={140} fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>prices</text>

        {/* Layer 3: Contract row inside L3 */}
        <Card x={width - 60 - (colW + 40) - 220} y={270} w={210} h={rowH} title="Index.sol" sub="ITP core · order matching" accent="blue" />
        <Card x={width - 60 - (colW + 40)} y={270} w={210} h={rowH} title="Vision.sol" sub="Parimutuel batches" accent="blue" />
        <Card x={width - 60 - (colW + 40) + 220} y={270} w={210} h={rowH} title="OracleRegistry.sol" sub="BLS keys · + 26 more" accent="blue" />

        {/* AP / Settlement / Bridge */}
        <Card x={60} y={370} w={colW + 40} h={rowH} title="AP / Keeper" sub="Bitget exec · bridge relay" accent="green" />
        <Card x={(width - (colW + 40)) / 2} y={370} w={colW + 40} h={rowH} title="Curator" sub="Morpho allocation · NAV" accent="green" />
        <Card x={width - 60 - (colW + 40)} y={370} w={colW + 40} h={rowH} title="Settlement (Arbitrum)" sub="Bridge · Morpho · 6-dec USDC" accent="orange" />

        {/* arrows L3 -> AP and L3 -> Settlement */}
        <line x1={width - 60 - (colW + 40) / 2 - 60} y1={170 + rowH} x2={60 + (colW + 40) / 2 + 30} y2={370} stroke={APPLE_BORDER} markerEnd="url(#osa-arrow)" />
        <text x={250} y={340} fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>TradeRequest events</text>
        <line x1={width - 60 - (colW + 40) / 2 + 60} y1={270 + rowH} x2={width - 60 - (colW + 40) / 2 + 60} y2={370} stroke={APPLE_BORDER} markerEnd="url(#osa-arrow)" />
        <text x={width - 240} y={355} fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>bridge</text>

        {/* Frontend + bots */}
        <Card x={60} y={470} w={colW + 40} h={rowH} title="Next.js Frontend" sub="Trading · Vision · Explorer" accent="blue" />
        <Card x={(width - (colW + 40)) / 2} y={470} w={colW + 40} h={rowH} title="Vision Bot" sub="Python · automated betting" accent="gray" />
        <Card x={width - 60 - (colW + 40)} y={470} w={colW + 40} h={rowH} title="Social Bot" sub="98 sources · Twitter/X" accent="gray" />

        {/* Frontend -> Data Node */}
        <line x1={60 + (colW + 40) / 2} y1={470} x2={60 + (colW + 40) / 2} y2={170 + rowH} stroke={APPLE_BORDER} strokeDasharray="3 3" markerEnd="url(#osa-arrow)" />
        <text x={60 + (colW + 40) / 2 + 8} y={310} fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>SSE + REST</text>
      </svg>
      <figcaption>Eight services. Two chains. Twenty-nine contracts. The whole machine on one page.</figcaption>
    </figure>
  )
}

/* 2. Two Chains, One Protocol */
export function OverviewTwoChains() {
  const width = 920
  const colW = 420
  const rowsL3 = [
    'ITP creation, buying, selling',
    'Vision prediction batches and resolution',
    'Bot registration · automated trading',
    'Order batching · BLS-verified confirmation',
    'Fee collection · oracle key management',
  ]
  const rowsSettle = [
    'Bridge custody for cross-chain USDC',
    'Bridged ITP shares (ERC-20 on Arbitrum)',
    'ITP NAV oracle for DeFi composability',
    'Morpho lending · ITP-collateralized borrowing',
    'Order submission via BridgeProxy',
  ]
  const lineH = 22
  const headerH = 90
  const panelH = headerH + rowsL3.length * lineH + 20
  const height = panelH * 2 + 70

  function Panel({ x, y, accent, title, chainId, decimals, role, rows }: {
    x: number
    y: number
    accent: Accent
    title: string
    chainId: string
    decimals: string
    role: string
    rows: string[]
  }) {
    return (
      <g>
        <rect x={x} y={y} width={colW} height={panelH} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
        <rect x={x} y={y + 4} width={4} height={panelH - 8} rx={2} fill={accentColor(accent)} />
        <text x={x + 20} y={y + 28} fontFamily={FONT_DISPLAY} fontSize={16} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>{title}</text>
        <text x={x + 20} y={y + 48} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>{chainId} · {decimals}</text>
        <text x={x + 20} y={y + 72} fontFamily={FONT_TEXT} fontSize={12} fontWeight={500} fill={APPLE_TEXT_3} letterSpacing="0.04em">ROLE — {role.toUpperCase()}</text>
        <line x1={x + 20} y1={y + 84} x2={x + colW - 20} y2={y + 84} stroke={APPLE_BORDER} />
        {rows.map((r, i) => (
          <text key={i} x={x + 20} y={y + headerH + 12 + i * lineH} fontFamily={FONT_TEXT} fontSize={12.5} fill={APPLE_TEXT}>
            <tspan fill={APPLE_TEXT_3}>·  </tspan>{r}
          </text>
        ))}
      </g>
    )
  }

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two chains: Index L3 and Settlement">
        <defs><Marker id="otc-arrow" /></defs>
        <Panel x={20} y={10} accent="blue" title="Index L3 (Orbit)" chainId="Chain ID 111222333" decimals="USDC 18 decimals" role="Primary trading chain" rows={rowsL3} />
        {/* Bridge label */}
        <g>
          <line x1={width / 2} y1={panelH + 14} x2={width / 2} y2={panelH + 56} stroke={APPLE_BORDER} markerEnd="url(#otc-arrow)" />
          <line x1={width / 2 - 18} y1={panelH + 35} x2={width / 2 + 18} y2={panelH + 35} stroke={APPLE_BORDER} markerEnd="url(#otc-arrow)" />
          <rect x={width / 2 - 70} y={panelH + 16} width={140} height={28} rx={12} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
          <text x={width / 2} y={panelH + 35} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={12} fontWeight={500} fill={APPLE_TEXT}>Bridge</text>
        </g>
        <Panel x={20} y={panelH + 60} accent="orange" title="Settlement (Arbitrum)" chainId="Chain ID 14601" decimals="USDC 6 decimals" role="Settlement and composability" rows={rowsSettle} />
      </svg>
      <figcaption>Each chain has a role. Each chain has its own decimal convention. Mixing them up costs money.</figcaption>
    </figure>
  )
}

/* 3. Data Flow — sources → data node → consumers */
export function OverviewDataFlow() {
  const sources = [
    'CoinGecko',
    'Binance (WebSocket)',
    'Exchange APIs',
    '1inch DEX',
    'GitHub stars / commits',
    'Transport (RATP, TfL, MTA, DB)',
    'Weather / energy / outages',
  ]
  const consumers: { title: string; sub: string; accent: Accent }[] = [
    { title: 'Oracle Nodes', sub: 'price consensus for NAV', accent: 'green' },
    { title: 'Frontend', sub: 'dashboard · portfolio · backtest', accent: 'blue' },
    { title: 'Vision Bot', sub: 'strategy signals', accent: 'gray' },
    { title: 'Social Bot', sub: 'anomaly detection · Twitter/X', accent: 'gray' },
  ]
  const width = 940
  const sourceH = 38
  const sourcesGap = 8
  const sourcesTop = 50
  const sourcesHeight = sources.length * (sourceH + sourcesGap)
  const consumerH = 64
  const consumerGap = 14
  const consumersHeight = consumers.length * (consumerH + consumerGap)
  const height = Math.max(sourcesTop + sourcesHeight, sourcesTop + consumersHeight) + 60

  const dataNodeX = 320
  const dataNodeY = 80
  const dataNodeW = 280
  const dataNodeH = 320

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Data flow: external sources to data node to consumers">
        <defs><Marker id="odf-arrow" /></defs>

        {/* Column labels */}
        <text x={120} y={28} fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>EXTERNAL SOURCES</text>
        <text x={dataNodeX + dataNodeW / 2} y={28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>DATA NODE</text>
        <text x={width - 160} y={28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>CONSUMERS</text>

        {/* Sources */}
        {sources.map((s, i) => {
          const y = sourcesTop + i * (sourceH + sourcesGap)
          return (
            <g key={s}>
              <rect x={20} y={y} width={240} height={sourceH} rx={8} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
              <text x={36} y={y + 24} fontFamily={FONT_TEXT} fontSize={12.5} fill={APPLE_TEXT}>{s}</text>
              <line
                x1={260}
                y1={y + sourceH / 2}
                x2={dataNodeX}
                y2={dataNodeY + 80 + (i / (sources.length - 1)) * 100}
                stroke={APPLE_BORDER}
              />
            </g>
          )
        })}

        {/* Data Node panel */}
        <rect x={dataNodeX} y={dataNodeY} width={dataNodeW} height={dataNodeH} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
        <rect x={dataNodeX} y={dataNodeY + 4} width={4} height={dataNodeH - 8} rx={2} fill={APPLE_TEXT_3} />
        <text x={dataNodeX + 20} y={dataNodeY + 28} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>Data Node</text>
        <text x={dataNodeX + 20} y={dataNodeY + 48} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>Rust · Postgres · port 8200</text>

        {/* Sub-stages */}
        {[
          { label: 'Ingestion layer', sub: 'scheduled fetchers per asset' },
          { label: 'Validation', sub: 'outlier detect · staleness' },
          { label: 'PostgreSQL', sub: 'price history · snapshots' },
          { label: 'NAV engine', sub: 'qty × px / 1e18' },
          { label: 'REST + SSE', sub: 'streaming to consumers' },
        ].map((s, i) => {
          const y = dataNodeY + 70 + i * 50
          return (
            <g key={i}>
              <rect x={dataNodeX + 16} y={y} width={dataNodeW - 32} height={42} rx={8} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
              <text x={dataNodeX + 28} y={y + 18} fontFamily={FONT_TEXT} fontSize={12.5} fontWeight={600} fill={APPLE_TEXT}>{s.label}</text>
              <text x={dataNodeX + 28} y={y + 33} fontFamily={FONT_TEXT} fontSize={11.5} fill={APPLE_TEXT_3}>{s.sub}</text>
            </g>
          )
        })}

        {/* Consumers */}
        {consumers.map((c, i) => {
          const y = sourcesTop + 30 + i * (consumerH + consumerGap)
          const x = width - 260
          return (
            <g key={c.title}>
              <Card x={x} y={y} w={240} h={consumerH} title={c.title} sub={c.sub} accent={c.accent} />
              <line
                x1={dataNodeX + dataNodeW}
                y1={dataNodeY + 80 + (i / (consumers.length - 1)) * 160}
                x2={x}
                y2={y + consumerH / 2}
                stroke={APPLE_BORDER}
                markerEnd="url(#odf-arrow)"
              />
            </g>
          )
        })}
      </svg>
      <figcaption>The world generates data. The protocol consumes it. What remains is a price.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   Sequence diagram helper — multi-lane
   ─────────────────────────────────────────────────────────── */

type SeqStep = {
  from: number
  to: number
  label: string
  detail?: string
  highlight?: 'blue' | 'green' | 'orange' | 'red'
  divider?: boolean
}

function SequenceDiagram({
  lanes,
  steps,
  caption,
  ariaLabel,
  laneAccents,
  width = 880,
  laneTop = 70,
  stepGap = 46,
}: {
  lanes: string[]
  steps: SeqStep[]
  caption?: string
  ariaLabel: string
  laneAccents?: Accent[]
  width?: number
  laneTop?: number
  stepGap?: number
}) {
  const margin = 80
  const innerW = width - margin * 2
  const laneX = lanes.map((_, i) => margin + (innerW * i) / Math.max(1, lanes.length - 1))
  const totalSteps = steps.length
  const height = laneTop + totalSteps * stepGap + 40

  const colorOf = (h?: SeqStep['highlight']) =>
    h === 'green' ? APPLE_GREEN
    : h === 'orange' ? APPLE_ORANGE
    : h === 'red' ? '#ff3b30'
    : h === 'blue' ? APPLE_BLUE
    : APPLE_TEXT_2

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel}>
        <defs>
          <marker id="seq-arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_TEXT_2} />
          </marker>
          <marker id="seq-arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_BLUE} />
          </marker>
          <marker id="seq-arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_GREEN} />
          </marker>
          <marker id="seq-arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_ORANGE} />
          </marker>
          <marker id="seq-arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#ff3b30" />
          </marker>
        </defs>

        {/* Lane headers */}
        {lanes.map((l, i) => {
          const accent = laneAccents?.[i]
          return (
            <g key={l}>
              <rect x={laneX[i] - 78} y={20} width={156} height={32} rx={16} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
              {accent ? <rect x={laneX[i] - 78} y={24} width={4} height={24} rx={2} fill={accentColor(accent)} /> : null}
              <text
                x={laneX[i]}
                y={40}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize={13}
                fontWeight={600}
                letterSpacing="-0.005em"
                fill={APPLE_TEXT}
              >
                {l}
              </text>
            </g>
          )
        })}

        {/* Lane verticals */}
        {laneX.map((x, i) => (
          <line key={i} x1={x} y1={56} x2={x} y2={height - 16} stroke={APPLE_BORDER} strokeDasharray="2 5" />
        ))}

        {/* Steps */}
        {steps.map((s, i) => {
          const y = laneTop + i * stepGap
          const color = colorOf(s.highlight)
          const arrow =
            s.highlight === 'blue' ? 'url(#seq-arrow-blue)'
            : s.highlight === 'green' ? 'url(#seq-arrow-green)'
            : s.highlight === 'orange' ? 'url(#seq-arrow-orange)'
            : s.highlight === 'red' ? 'url(#seq-arrow-red)'
            : 'url(#seq-arrow-default)'

          if (s.divider) {
            return (
              <g key={i}>
                <line x1={margin / 2} y1={y - stepGap / 2 + 6} x2={width - margin / 2} y2={y - stepGap / 2 + 6} stroke={APPLE_BORDER} strokeDasharray="4 4" />
                <rect x={width / 2 - 110} y={y - 14} width={220} height={26} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
                <text x={width / 2} y={y + 3} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11.5} fontWeight={600} letterSpacing="0.04em" fill={APPLE_TEXT_2}>{s.label.toUpperCase()}</text>
                {s.detail ? <text x={width / 2} y={y + 18} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>{s.detail}</text> : null}
              </g>
            )
          }

          if (s.from === s.to) {
            const x = laneX[s.from]
            return (
              <g key={i}>
                <rect x={x - 100} y={y - 14} width={200} height={28} rx={6} fill={APPLE_BG} stroke={color} strokeOpacity={0.35} />
                <text x={x} y={y + 1} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={12} fontWeight={500} fill={APPLE_TEXT}>{s.label}</text>
                {s.detail ? <text x={x} y={y + 14} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={10.5} fill={APPLE_TEXT_3}>{s.detail}</text> : null}
              </g>
            )
          }

          const x1 = laneX[s.from]
          const x2 = laneX[s.to]
          const midX = (x1 + x2) / 2
          const labelW = Math.min(Math.abs(x2 - x1) - 16, 280)
          return (
            <g key={i}>
              <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={1.5} markerEnd={arrow} />
              <rect x={midX - labelW / 2} y={y - 12} width={labelW} height={20} rx={4} fill={APPLE_BG} />
              <text x={midX} y={y - 1} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={12} fontWeight={500} letterSpacing="-0.005em" fill={APPLE_TEXT}>{s.label}</text>
              {s.detail ? <text x={midX} y={y + 13} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={10.5} fill={APPLE_TEXT_3}>{s.detail}</text> : null}
            </g>
          )
        })}
      </svg>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}

/* 4. Order Lifecycle */
export function OverviewOrderLifecycle() {
  return (
    <SequenceDiagram
      ariaLabel="Order lifecycle from user submit to shares minted"
      lanes={['User', 'L3 Chain', 'Oracles', 'AP / Keeper', 'Bitget']}
      laneAccents={['gray', 'blue', 'green', 'green', 'orange']}
      steps={[
        { from: 0, to: 1, label: 'submitOrder(buy)', highlight: 'blue' },
        { from: 1, to: 2, label: 'OrderSubmitted event' },
        { from: 2, to: 2, label: 'Consensus cycle (1s)', detail: 'collect → propose → sign → confirm', highlight: 'green' },
        { from: 2, to: 1, label: 'confirmBatch(orders, blsSig)', highlight: 'green' },
        { from: 1, to: 1, label: 'BLSLib.verify() ✓', highlight: 'blue' },
        { from: 1, to: 3, label: 'TradeRequest event' },
        { from: 3, to: 4, label: 'market buy', highlight: 'orange' },
        { from: 4, to: 3, label: 'fill confirmed' },
        { from: 3, to: 1, label: 'confirmFills(fills, blsSig)', highlight: 'green' },
        { from: 1, to: 1, label: 'shares minted · USDC settled', highlight: 'blue' },
        { from: 1, to: 0, label: 'shares in wallet' },
      ]}
      caption="Five hands. Each verifies the one before it."
    />
  )
}

/* 5. Bridge Order Flow */
export function OverviewBridgeOrderFlow() {
  return (
    <SequenceDiagram
      ariaLabel="Bridge order flow from Settlement to L3 and back"
      lanes={['User (Arbitrum)', 'Settlement', 'L3']}
      laneAccents={['gray', 'orange', 'blue']}
      steps={[
        { from: 0, to: 1, label: 'submitOrder(buy)', highlight: 'orange' },
        { from: 1, to: 1, label: 'BridgeProxy.sol relays order', highlight: 'orange' },
        { from: 1, to: 2, label: 'cross-chain message' },
        { from: 2, to: 2, label: 'Order enters same lifecycle', detail: 'oracles · AP · Bitget · BLS rounds', highlight: 'blue' },
        { from: 2, to: 2, label: 'shares minted on L3', highlight: 'blue' },
        { from: 2, to: 1, label: 'bridge shares back' },
        { from: 1, to: 0, label: 'BridgedITP (ERC-20 on Arbitrum)', highlight: 'orange' },
      ]}
      caption="Geography, even digital, is a constraint you work around."
    />
  )
}

/* 6. Vision Market Lifecycle */
export function OverviewVisionLifecycle() {
  return (
    <SequenceDiagram
      ariaLabel="Vision market lifecycle from real-world data to payout"
      lanes={['Data Node', 'L3 Chain', 'Oracles', 'Social Bot']}
      laneAccents={['gray', 'blue', 'green', 'gray']}
      steps={[
        { from: 0, to: 0, label: 'Real-world data ingested', detail: 'transport · weather · energy · sports' },
        { from: 0, to: 3, label: 'anomaly detection feeds bot' },
        { from: 3, to: 3, label: 'Posts to Twitter/X' },
        { from: 2, to: 1, label: 'createBatch()', highlight: 'green' },
        { from: 1, to: 1, label: 'Batch active — users + bots bet', highlight: 'blue' },
        { from: 0, to: 1, label: 'Tick data: actual outcomes' },
        { from: 2, to: 1, label: 'resolveTick(blsSig)', highlight: 'green' },
        { from: 1, to: 1, label: 'Payouts distributed to winners', highlight: 'blue' },
      ]}
      caption="Users stake opinions. The world resolves them."
    />
  )
}

/* 7. Service Connectivity Map */
export function OverviewConnectivityMap() {
  const width = 940
  const height = 540

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Service connectivity map">
        <defs><Marker id="ocm-arrow" /></defs>

        {/* Frontend */}
        <Card x={width / 2 - 130} y={20} w={260} h={66} title="Frontend" sub="Next.js · the surface" accent="blue" />

        {/* Layer 2 */}
        <Card x={140} y={140} w={260} h={66} title="Data Node" sub="port 8200 · REST + SSE" accent="gray" />
        <Card x={width - 400} y={140} w={260} h={66} title="L3 Chain" sub="RPC · 159.195.79.153" accent="blue" />

        {/* Layer 3 */}
        <Card x={20} y={280} w={220} h={66} title="Vision Bot" sub="Python · strategy" accent="gray" />
        <Card x={260} y={280} w={220} h={66} title="Oracle Nodes ×3" sub="Rust · BLS consensus" accent="green" />
        <Card x={500} y={280} w={220} h={66} title="Curator" sub="Rust · NAV + Morpho" accent="green" />
        <Card x={740} y={280} w={180} h={66} title="AP / Keeper" sub="Rust · trade exec" accent="green" />

        {/* Layer 4 */}
        <Card x={width / 2 - 130} y={420} w={260} h={66} title="Bitget" sub="Exchange · market orders" accent="orange" />

        {/* Edges */}
        {/* Frontend → Data Node */}
        <line x1={width / 2 - 80} y1={86} x2={270} y2={140} stroke={APPLE_BORDER} markerEnd="url(#ocm-arrow)" />
        <text x={300} y={120} fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>SSE + REST</text>
        {/* Frontend → L3 */}
        <line x1={width / 2 + 80} y1={86} x2={width - 270} y2={140} stroke={APPLE_BORDER} markerEnd="url(#ocm-arrow)" />
        <text x={width - 380} y={120} fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>RPC</text>

        {/* Data Node → Vision Bot */}
        <line x1={200} y1={206} x2={130} y2={280} stroke={APPLE_BORDER} markerEnd="url(#ocm-arrow)" />
        {/* Data Node → Oracles */}
        <line x1={300} y1={206} x2={370} y2={280} stroke={APPLE_BORDER} markerEnd="url(#ocm-arrow)" />
        {/* L3 → Oracles */}
        <line x1={width - 320} y1={206} x2={400} y2={280} stroke={APPLE_BORDER} markerEnd="url(#ocm-arrow)" />
        {/* L3 → Curator */}
        <line x1={width - 280} y1={206} x2={610} y2={280} stroke={APPLE_BORDER} markerEnd="url(#ocm-arrow)" />
        {/* L3 → AP */}
        <line x1={width - 200} y1={206} x2={830} y2={280} stroke={APPLE_BORDER} markerEnd="url(#ocm-arrow)" />
        <text x={width - 220} y={250} fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>events</text>

        {/* AP → Bitget */}
        <line x1={830} y1={346} x2={width / 2 + 50} y2={420} stroke={APPLE_BORDER} markerEnd="url(#ocm-arrow)" />
        <text x={width / 2 + 60} y={400} fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>API</text>

        {/* Social bot strip */}
        <rect x={20} y={height - 70} width={width - 40} height={50} rx={8} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
        <text x={40} y={height - 42} fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>Social Bot</text>
        <text x={130} y={height - 42} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>Data Node — REST → anomaly engine — API → Twitter/X</text>
      </svg>
      <figcaption>Every arrow is a protocol. Every protocol is a boundary.</figcaption>
    </figure>
  )
}

/* 8. Infrastructure Layout — VPS / Vercel / Mintlify */
export function OverviewInfrastructure() {
  const width = 920
  const vpsTiles = [
    { title: 'Oracle #1', sub: 'Docker', accent: 'green' as Accent },
    { title: 'Oracle #2', sub: 'Docker', accent: 'green' as Accent },
    { title: 'Oracle #3', sub: 'Docker', accent: 'green' as Accent },
    { title: 'AP / Keeper', sub: 'binary', accent: 'green' as Accent },
    { title: 'Curator', sub: 'binary', accent: 'green' as Accent },
    { title: 'Data Node', sub: 'binary', accent: 'gray' as Accent },
    { title: 'Vision Bot', sub: 'Python', accent: 'gray' as Accent },
    { title: 'Social Bot', sub: 'Python', accent: 'gray' as Accent },
    { title: 'PostgreSQL', sub: 'Docker', accent: 'gray' as Accent },
  ]
  const tileW = 200
  const tileH = 64
  const tileGap = 16
  const cols = 3
  const vpsGridH = Math.ceil(vpsTiles.length / cols) * (tileH + tileGap)
  const vpsPanelH = vpsGridH + 110
  const otherPanelH = 100
  const height = vpsPanelH + otherPanelH * 2 + 60

  function HostPanel({ y, title, sub, h, accent, children }: { y: number; title: string; sub: string; h: number; accent: Accent; children?: React.ReactNode }) {
    return (
      <g>
        <rect x={20} y={y} width={width - 40} height={h} rx={16} fill={APPLE_BG} stroke={APPLE_BORDER} />
        <rect x={20} y={y + 6} width={4} height={h - 12} rx={2} fill={accentColor(accent)} />
        <text x={36} y={y + 30} fontFamily={FONT_DISPLAY} fontSize={15} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>{title}</text>
        <text x={36} y={y + 50} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>{sub}</text>
        {children}
      </g>
    )
  }

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Infrastructure layout: VPS, Vercel, Mintlify">
        <HostPanel y={10} title="VPS 1 — Backend" sub="One machine. Eight services. nginx in front." h={vpsPanelH} accent="green">
          {vpsTiles.map((t, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const offset = ((width - 40) - cols * tileW - (cols - 1) * tileGap) / 2
            const x = 20 + offset + col * (tileW + tileGap)
            const y = 10 + 70 + row * (tileH + tileGap)
            return <Card key={t.title} x={x} y={y} w={tileW} h={tileH} title={t.title} sub={t.sub} accent={t.accent} />
          })}
        </HostPanel>
        <HostPanel y={10 + vpsPanelH + 16} title="Dokploy / VPS 3" sub="generalmarket.io · Next.js + /docs" h={otherPanelH} accent="blue" />
      </svg>
      <figcaption>One VPS runs everything that matters. The frontend ships from another.</figcaption>
    </figure>
  )
}

/* 9. Technology Stack */
export function OverviewTechStack() {
  const rows: { lang: string; service: string; deploy: string; accent: Accent }[] = [
    { lang: 'Rust', service: 'Oracle Nodes (3×)', deploy: 'Docker · VPS', accent: 'green' },
    { lang: 'Rust', service: 'AP / Keeper', deploy: 'binary · VPS', accent: 'green' },
    { lang: 'Rust', service: 'Data Node', deploy: 'binary · VPS', accent: 'green' },
    { lang: 'Rust', service: 'Curator', deploy: 'binary · VPS', accent: 'green' },
    { lang: 'Python', service: 'Vision Bot', deploy: 'VPS', accent: 'gray' },
    { lang: 'Python', service: 'Social Bot', deploy: 'VPS', accent: 'gray' },
    { lang: 'TypeScript', service: 'Frontend', deploy: 'Vercel', accent: 'blue' },
    { lang: 'Solidity', service: '29 contracts', deploy: 'L3 + Settlement', accent: 'blue' },
    { lang: 'PostgreSQL', service: 'Price DB', deploy: 'Docker · VPS', accent: 'orange' },
  ]

  const width = 880
  const rowH = 48
  const headerH = 50
  const height = headerH + rows.length * rowH + 30
  const colX = [40, 240, 520]

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Technology stack">
        {/* Header */}
        {['Language', 'Service', 'Deployment'].map((h, i) => (
          <text key={h} x={colX[i]} y={32} fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>{h.toUpperCase()}</text>
        ))}
        <line x1={20} y1={headerH - 6} x2={width - 20} y2={headerH - 6} stroke={APPLE_BORDER} />

        {rows.map((r, i) => {
          const y = headerH + i * rowH
          return (
            <g key={i}>
              {i % 2 === 1 ? <rect x={20} y={y} width={width - 40} height={rowH} rx={8} fill={APPLE_SURFACE} /> : null}
              <rect x={colX[0] - 12} y={y + 12} width={3} height={24} rx={1.5} fill={accentColor(r.accent)} />
              <text x={colX[0]} y={y + 30} fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>{r.lang}</text>
              <text x={colX[1]} y={y + 30} fontFamily={FONT_TEXT} fontSize={13} fill={APPLE_TEXT}>{r.service}</text>
              <text x={colX[2]} y={y + 30} fontFamily={FONT_TEXT} fontSize={13} fill={APPLE_TEXT_2}>{r.deploy}</text>
            </g>
          )
        })}
      </svg>
      <figcaption>Four languages. Each chosen for what it does well.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   BRIDGE.MDX components
   ─────────────────────────────────────────────────────────── */

/* 1. Chain Overview — two side-by-side panels */
export function BridgeChainOverview() {
  const width = 920
  const panelW = 430
  const panelH = 220
  const height = panelH + 40

  function ChainCard({ x, accent, title, chainId, decimals, lines }: {
    x: number
    accent: Accent
    title: string
    chainId: string
    decimals: string
    lines: string[]
  }) {
    return (
      <g>
        <rect x={x} y={20} width={panelW} height={panelH} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
        <rect x={x} y={24} width={4} height={panelH - 8} rx={2} fill={accentColor(accent)} />
        <text x={x + 20} y={48} fontFamily={FONT_DISPLAY} fontSize={16} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>{title}</text>
        <text x={x + 20} y={68} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>{chainId}</text>
        <text x={x + 20} y={86} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>{decimals}</text>
        <line x1={x + 20} y1={102} x2={x + panelW - 20} y2={102} stroke={APPLE_BORDER} />
        {lines.map((ln, i) => (
          <text key={i} x={x + 20} y={124 + i * 22} fontFamily={FONT_TEXT} fontSize={12.5} fill={APPLE_TEXT}>
            <tspan fill={APPLE_TEXT_3}>·  </tspan>{ln}
          </text>
        ))}
      </g>
    )
  }

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bridge chain overview">
        <ChainCard
          x={20}
          accent="orange"
          title="Settlement (Arbitrum)"
          chainId="Chain ID 14601"
          decimals="USDC 6 decimals"
          lines={[
            'Users deposit and withdraw here',
            'BridgedITP tokens (ERC-20 replicas)',
            'AP receives USDC for asset purchases',
          ]}
        />
        <ChainCard
          x={width - 20 - panelW}
          accent="blue"
          title="Index L3 (Orbit)"
          chainId="Chain ID 111222333"
          decimals="USDC 18 decimals"
          lines={[
            'Core protocol logic lives here',
            'ITP shares · NAV · order matching',
            'BLS consensus · batch and fill lifecycle',
          ]}
        />
      </svg>
      <figcaption>Two chains. Different trust models. Different decimal conventions.</figcaption>
    </figure>
  )
}

/* 2. Contract Layout — two columns of contract cards */
export function BridgeContractLayout() {
  const settle = [
    { title: 'SettlementBridgeCustody.sol', sub: 'Holds USDC for buys · escrows BridgedITP for sells · completeBuyOrder · completeSellOrder' },
    { title: 'BridgeProxy.sol', sub: 'mintBridgedShares (BLS-gated) · burnBridgedShares · ITP creation relay · replay protection' },
    { title: 'BridgedItpFactory.sol', sub: 'CREATE2 deploys BridgedITP · one BridgedITP per L3 ITP' },
    { title: 'BridgedITP.sol (one per ITP)', sub: 'ERC-20 replica of L3 ITP shares · 18 decimals · mint/burn only by BridgeProxy' },
  ]
  const l3 = [
    { title: 'Index.sol', sub: 'submitOrder · confirmBatch · confirmFills (mints/burns) · NAV computation' },
    { title: 'L3BridgeCustody.sol', sub: 'Locks L3 USDC for bridging · two-phase commit (lock/release) · 1-hour timeout' },
  ]

  const width = 920
  const cardH = 86
  const cardGap = 14
  const colW = 430
  const settleH = 60 + settle.length * (cardH + cardGap)
  const l3H = 60 + l3.length * (cardH + cardGap)
  const height = Math.max(settleH, l3H) + 40

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bridge contract layout">
        <text x={20 + colW / 2} y={28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>SETTLEMENT — CHAIN 14601</text>
        <text x={width - 20 - colW / 2} y={28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>INDEX L3 — CHAIN 111222333</text>

        {settle.map((c, i) => (
          <Card key={c.title} x={20} y={50 + i * (cardH + cardGap)} w={colW} h={cardH} title={c.title} sub={c.sub} accent="orange" />
        ))}
        {l3.map((c, i) => (
          <Card key={c.title} x={width - 20 - colW} y={50 + i * (cardH + cardGap)} w={colW} h={cardH} title={c.title} sub={c.sub} accent="blue" />
        ))}
      </svg>
      <figcaption>Five contracts. Three on Settlement, two on L3. Each holds custody of something the others need.</figcaption>
    </figure>
  )
}

/* 3. Decimal Conversion */
export function BridgeDecimalConversion() {
  const width = 920
  const height = 280

  function Conversion({ y, title, fromLabel, fromValue, fromAccent, fnName, toLabel, toValue, toAccent }: {
    y: number
    title: string
    fromLabel: string
    fromValue: string
    fromAccent: Accent
    fnName: string
    toLabel: string
    toValue: string
    toAccent: Accent
  }) {
    return (
      <g>
        <text x={40} y={y} fontFamily={FONT_DISPLAY} fontSize={12} fontWeight={600} letterSpacing="0.04em" fill={APPLE_TEXT_2}>{title.toUpperCase()}</text>
        <Card x={40} y={y + 14} w={260} h={70} title={fromLabel} sub={fromValue} accent={fromAccent} />
        <g>
          <line x1={310} y1={y + 49} x2={520} y2={y + 49} stroke={APPLE_BORDER} markerEnd="url(#bdc-arrow)" />
          <rect x={345} y={y + 32} width={150} height={30} rx={12} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
          <text x={420} y={y + 52} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={12} fontWeight={500} fill={APPLE_TEXT}>{fnName}</text>
        </g>
        <Card x={540} y={y + 14} w={340} h={70} title={toLabel} sub={toValue} accent={toAccent} />
      </g>
    )
  }

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Decimal conversion at the bridge">
        <defs><Marker id="bdc-arrow" /></defs>
        <Conversion
          y={36}
          title="User deposits 100 USDC on Settlement"
          fromLabel="Settlement (6 dec)"
          fromValue="100_000_000  ·  100 × 1e6"
          fromAccent="orange"
          fnName="DecimalLib.toInternal()"
          toLabel="L3 internal (18 dec)"
          toValue="100_000_000_000_000_000_000  ·  100 × 1e18"
          toAccent="blue"
        />
        <Conversion
          y={170}
          title="USDC released to AP on Settlement"
          fromLabel="L3 internal (18 dec)"
          fromValue="100_000_000_000_000_000_000  ·  100 × 1e18"
          fromAccent="blue"
          fnName="DecimalLib.toUsdc()"
          toLabel="Settlement (6 dec)"
          toValue="100_000_000  ·  100 × 1e6"
          toAccent="orange"
        />
      </svg>
      <figcaption>Six on one side. Eighteen on the other. Get this wrong and users receive 1e12× too much or too little.</figcaption>
    </figure>
  )
}

/* 4. Bridge Buy Flow */
export function BridgeBuyFlow() {
  return (
    <SequenceDiagram
      ariaLabel="Bridge buy flow from Settlement deposit to BridgedITP mint"
      lanes={['Settlement', 'Oracles', 'L3', 'AP']}
      laneAccents={['orange', 'green', 'blue', 'green']}
      width={920}
      stepGap={42}
      steps={[
        { from: 0, to: 0, label: '1. buyITPFromSettlement()', detail: 'USDC escrowed in SettlementBridgeCustody', highlight: 'orange' },
        { from: 0, to: 1, label: '2. CrossChainOrderCreated event' },
        { from: 1, to: 2, label: '3-4. Oracles submit order to Index.sol', detail: 'BLS consensus round #1', highlight: 'green' },
        { from: 1, to: 2, label: '5. Oracles batch the order', detail: 'BLS consensus round #2', highlight: 'green' },
        { from: 2, to: 3, label: '6. AP executes trade on Bitget' },
        { from: 1, to: 2, label: '7. Oracles confirm fill on L3 — ITP shares minted', detail: 'BLS consensus round #3', highlight: 'green' },
        { from: 0, to: 0, label: 'CRITICAL CHECKPOINT', detail: 'completeBuyOrder must succeed before mint', divider: true },
        { from: 1, to: 0, label: '8. completeBuyOrder() — releases USDC to AP', detail: 'BLS consensus round #4 · stores PendingMint', highlight: 'green' },
        { from: 1, to: 0, label: '9. mintBridgedShares() on BridgeProxy', detail: 'replay-protected · BLS-verified', highlight: 'green' },
        { from: 0, to: 0, label: '10. User holds L3 shares + BridgedITP on Settlement', highlight: 'orange' },
      ]}
      caption="Ten steps. Four BLS rounds. One invariant: USDC released before shares minted. Always."
    />
  )
}

/* 5. Crash Recovery — state machine */
export function BridgeCrashRecovery() {
  const width = 880
  const height = 360

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bridge crash recovery flow">
        <defs><Marker id="bcr-arrow" /></defs>

        {/* Step 1 */}
        <Card x={width / 2 - 200} y={20} w={400} h={66} title="completeBuyOrder succeeds" sub="pendingMints[orderId] = { itpId, user, amount }" accent="green" />
        <line x1={width / 2} y1={86} x2={width / 2} y2={130} stroke={APPLE_BORDER} markerEnd="url(#bcr-arrow)" />

        {/* Decision */}
        <g>
          <rect x={width / 2 - 160} y={130} width={320} height={56} rx={28} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
          <text x={width / 2} y={166} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>mintBridgedShares called?</text>
        </g>

        {/* YES branch */}
        <line x1={width / 2 - 80} y1={186} x2={200} y2={240} stroke={APPLE_BORDER} markerEnd="url(#bcr-arrow)" />
        <text x={140} y={215} fontFamily={FONT_TEXT} fontSize={12} fontWeight={600} fill={APPLE_GREEN}>YES</text>
        <Card x={40} y={240} w={300} h={90} title="clearPendingMint()" sub="Only after BridgeProxy confirms mint completed. Order considered done." accent="green" />

        {/* NO branch */}
        <line x1={width / 2 + 80} y1={186} x2={width - 200} y2={240} stroke={APPLE_BORDER} markerEnd="url(#bcr-arrow)" />
        <text x={width - 200} y={215} fontFamily={FONT_TEXT} fontSize={12} fontWeight={600} fill={APPLE_ORANGE}>NO — crash</text>
        <Card x={width - 340} y={240} w={300} h={90} title="Oracle restart" sub="Queries pendingMints, retries mintBridgedShares. The recovery anchor." accent="orange" />
      </svg>
      <figcaption>Machines crash. The question is when, not whether.</figcaption>
    </figure>
  )
}

/* 6. Bridge Sell Flow */
export function BridgeSellFlow() {
  return (
    <SequenceDiagram
      ariaLabel="Bridge sell flow from Settlement to USDC payout"
      lanes={['Settlement', 'Oracles', 'L3', 'AP']}
      laneAccents={['orange', 'green', 'blue', 'green']}
      width={920}
      stepGap={42}
      steps={[
        { from: 0, to: 0, label: '1. sellITPFromSettlement()', detail: 'BridgedITP escrowed in SettlementBridgeCustody', highlight: 'orange' },
        { from: 0, to: 1, label: '2. CrossChainSellOrderCreated event' },
        { from: 1, to: 2, label: '3-4. Submit sell order to Index.sol', detail: 'BLS consensus round #1', highlight: 'green' },
        { from: 1, to: 2, label: '5. Oracles batch the order', detail: 'BLS consensus round #2', highlight: 'green' },
        { from: 2, to: 3, label: '6. AP sells underlying assets on Bitget' },
        { from: 1, to: 2, label: '7. Confirm fill — L3 shares burned, USDC to L3BridgeCustody', detail: 'BLS consensus round #3', highlight: 'green' },
        { from: 1, to: 0, label: '8. burnSellOrderShares() — destroy BridgedITP', highlight: 'green' },
        { from: 1, to: 0, label: '9. completeSellOrder() — pays USDC to user', detail: 'BLS consensus round #4', highlight: 'green' },
        { from: 0, to: 0, label: '10. User receives USDC on Settlement', highlight: 'orange' },
      ]}
      caption="The reverse. Burn the tokens, return the USDC. Same refusal to compromise on backing."
    />
  )
}

/* 7. Failed Sell Recovery */
export function BridgeFailedSellRecovery() {
  const width = 880
  const height = 380

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Failed sell recovery flow">
        <defs><Marker id="bfsr-arrow" /></defs>

        <Card x={width / 2 - 200} y={20} w={400} h={66} title="burnSellOrderShares() succeeds" sub="BridgedITP is destroyed" accent="orange" />
        <line x1={width / 2} y1={86} x2={width / 2} y2={130} stroke={APPLE_BORDER} markerEnd="url(#bfsr-arrow)" />

        <g>
          <rect x={width / 2 - 180} y={130} width={360} height={56} rx={28} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
          <text x={width / 2} y={166} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>L3 fill fails or times out?</text>
        </g>

        <line x1={width / 2 - 80} y1={186} x2={200} y2={240} stroke={APPLE_BORDER} markerEnd="url(#bfsr-arrow)" />
        <text x={140} y={215} fontFamily={FONT_TEXT} fontSize={12} fontWeight={600} fill={APPLE_GREEN}>NO</text>
        <Card x={40} y={240} w={300} h={90} title="Normal completion" sub="USDC paid out to user. Sell order deleted." accent="green" />

        <line x1={width / 2 + 80} y1={186} x2={width - 200} y2={240} stroke={APPLE_BORDER} markerEnd="url(#bfsr-arrow)" />
        <text x={width - 200} y={215} fontFamily={FONT_TEXT} fontSize={12} fontWeight={600} fill="#ff3b30">YES</text>
        <Card x={width - 340} y={240} w={300} h={120} title="remintAndRefundFailedSell()" sub="BLS-gated. Only after MIN_REMINT_DELAY = 1 hour. BridgedITP re-minted to user." accent="orange" />
      </svg>
      <figcaption>If tokens burn but fill never lands, the safety valve opens after one hour.</figcaption>
    </figure>
  )
}

/* 8. The Backing Invariant */
export function BridgeBackingInvariant() {
  const width = 940
  const height = 460

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The backing invariant">
        <defs><Marker id="bbi-arrow" /></defs>

        {/* Statement banner */}
        <rect x={20} y={20} width={width - 40} height={86} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
        <rect x={20} y={26} width={4} height={74} rx={2} fill={APPLE_BLUE} />
        <text x={40} y={48} fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>THE BACKING INVARIANT</text>
        <text x={40} y={72} fontFamily={FONT_TEXT} fontSize={13} fill={APPLE_TEXT}>For every ITP share in existence, the underlying assets MUST have been purchased and confirmed on a real exchange.</text>
        <text x={40} y={92} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>Minting shares without backing = protocol insolvency. The single worst failure mode.</text>

        {/* HOW THE BRIDGE ENFORCES IT */}
        <text x={40} y={140} fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>HOW THE BRIDGE ENFORCES IT</text>

        {/* 4-stage pipeline */}
        {[
          { x: 40, title: 'User deposits USDC', sub: '', accent: 'gray' as Accent },
          { x: 40 + 220, title: 'USDC escrowed in custody', sub: 'SettlementBridgeCustody', accent: 'orange' as Accent },
          { x: 40 + 220 * 2, title: 'AP buys assets on Bitget', sub: 'real exchange execution', accent: 'green' as Accent },
          { x: 40 + 220 * 3, title: 'Shares minted on L3', sub: 'only after completeBuyOrder', accent: 'blue' as Accent },
        ].map((s, i) => (
          <g key={i}>
            <Card x={s.x} y={160} w={210} h={86} title={s.title} sub={s.sub} accent={s.accent} />
            {i < 3 ? <line x1={s.x + 210} y1={203} x2={s.x + 220} y2={203} stroke={APPLE_TEXT_2} strokeWidth={1.5} markerEnd="url(#bbi-arrow)" /> : null}
          </g>
        ))}
        <text x={width / 2} y={272} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={12} fontWeight={500} fill={APPLE_GREEN}>completeBuyOrder MUST PRECEDE mintBridgedShares</text>

        {/* WHAT CANNOT HAPPEN */}
        <text x={40} y={320} fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>WHAT CANNOT HAPPEN</text>

        <Card x={40} y={336} w={260} h={86} title="User deposits USDC" accent="gray" />
        <g>
          <line x1={300} y1={379} x2={width - 360} y2={379} stroke="#ff3b30" strokeWidth={1.5} strokeDasharray="6 4" />
          {/* Big red X */}
          <line x1={width / 2 - 30} y1={364} x2={width / 2 + 30} y2={394} stroke="#ff3b30" strokeWidth={2.5} />
          <line x1={width / 2 - 30} y1={394} x2={width / 2 + 30} y2={364} stroke="#ff3b30" strokeWidth={2.5} />
          <text x={width / 2} y={350} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fontWeight={600} fill="#ff3b30">"optimistic minting"</text>
          <text x={width / 2} y={418} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fill="#ff3b30">this path does not exist</text>
        </g>
        <Card x={width - 340} y={336} w={300} h={86} title="Shares without backing" sub="protocol insolvency" accent="gray" />
      </svg>
      <figcaption>The single most important property. Not the most clever — the most important.</figcaption>
    </figure>
  )
}

/* 9. Order Lifecycle states (buy + sell state machines) */
export function BridgeOrderStates() {
  const width = 920
  const stateW = 200
  const stateH = 78
  const rowGap = 90

  function StateRow({ y, header, states, refundLabel, refundDetail, refundFromIndex }: {
    y: number
    header: string
    states: { label: string; sub?: string; accent: Accent }[]
    refundLabel: string
    refundDetail?: string
    refundFromIndex: number
  }) {
    const startX = 40
    const gap = (width - 80 - states.length * stateW) / (states.length - 1)
    return (
      <g>
        <text x={40} y={y - 14} fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>{header}</text>
        {states.map((s, i) => {
          const x = startX + i * (stateW + gap)
          return (
            <g key={i}>
              <Card x={x} y={y} w={stateW} h={stateH} title={s.label} sub={s.sub} accent={s.accent} active />
              {i < states.length - 1 ? (
                <line x1={x + stateW} y1={y + stateH / 2} x2={x + stateW + gap} y2={y + stateH / 2} stroke={APPLE_TEXT_2} strokeWidth={1.5} markerEnd="url(#bos-arrow)" />
              ) : null}
            </g>
          )
        })}
        {/* Refund branch */}
        {(() => {
          const x = startX + refundFromIndex * (stateW + gap)
          return (
            <g>
              <line x1={x + stateW / 2} y1={y + stateH} x2={x + stateW / 2} y2={y + stateH + 28} stroke={APPLE_TEXT_2} strokeWidth={1.5} markerEnd="url(#bos-arrow)" />
              <Card x={x - stateW / 2 + stateW / 2} y={y + stateH + 28} w={stateW} h={56} title={refundLabel} sub={refundDetail} accent="orange" />
            </g>
          )
        })()}
      </g>
    )
  }

  const height = rowGap + stateH + 56 + rowGap + stateH + 56 + 60

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bridge order lifecycle states">
        <defs><Marker id="bos-arrow" color={APPLE_TEXT_2} /></defs>
        <StateRow
          y={50}
          header="BUY ORDER STATES"
          states={[
            { label: 'ESCROWED', sub: 'USDC in custody', accent: 'orange' },
            { label: 'COMPLETING', sub: 'USDC to AP · pending mint stored', accent: 'green' },
            { label: 'MINTED', sub: 'BridgedITP minted · done', accent: 'blue' },
          ]}
          refundLabel="REFUNDED"
          refundDetail="timeout / failure"
          refundFromIndex={0}
        />
        <StateRow
          y={50 + rowGap + stateH + 56}
          header="SELL ORDER STATES"
          states={[
            { label: 'ESCROWED', sub: 'BridgedITP in custody', accent: 'orange' },
            { label: 'BURNED', sub: 'BridgedITP destroyed', accent: 'green' },
            { label: 'SETTLED', sub: 'USDC paid to user', accent: 'blue' },
          ]}
          refundLabel="remintAndRefund"
          refundDetail="after 1h timeout"
          refundFromIndex={1}
        />
      </svg>
      <figcaption>Two state machines. Two escape hatches. No paths to insolvency.</figcaption>
    </figure>
  )
}

/* 10. Replay Protection — code-style key/value boxes */
export function BridgeReplayProtection() {
  const width = 880
  const sections = [
    {
      title: 'BridgeProxy',
      mappings: [
        { key: 'mintProcessed[orderId]', value: 'true', note: 'prevents double-mint of BridgedITP' },
        { key: 'burnProcessed[orderId]', value: 'true', note: 'prevents double-burn of BridgedITP' },
      ],
    },
    {
      title: 'SettlementBridgeCustody',
      mappings: [
        { key: 'bridgeCompleted[chainId][nonce]', value: '—', note: 'prevents double-release of USDC' },
        { key: 'crossChainOrders[orderId]', value: '—', note: 'deleted after completion (CEI pattern)' },
        { key: 'crossChainSellOrders[orderId]', value: '—', note: 'deleted after completion (CEI pattern)' },
      ],
    },
  ]

  const rowH = 36
  const headerH = 38
  const padding = 14
  const sectionH = (m: number) => headerH + m * rowH + padding * 2
  let cursor = 20
  const layout = sections.map(s => {
    const y = cursor
    cursor += sectionH(s.mappings.length) + 16
    return y
  })
  const height = cursor + 20

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Replay protection mappings">
        {sections.map((s, idx) => {
          const y = layout[idx]
          const h = sectionH(s.mappings.length)
          return (
            <g key={s.title}>
              <rect x={20} y={y} width={width - 40} height={h} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
              <rect x={20} y={y + 6} width={4} height={h - 12} rx={2} fill={APPLE_BLUE} />
              <text x={40} y={y + 26} fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>{s.title}</text>
              {s.mappings.map((m, i) => {
                const ry = y + headerH + padding + i * rowH
                return (
                  <g key={m.key}>
                    {i % 2 === 0 ? <rect x={36} y={ry - 14} width={width - 72} height={rowH - 4} rx={6} fill={APPLE_SURFACE} /> : null}
                    <text x={48} y={ry + 2} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={12.5} fill={APPLE_TEXT}>{m.key}</text>
                    {m.value !== '—' ? (
                      <text x={48 + 280} y={ry + 2} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={12.5} fill={APPLE_BLUE}>= {m.value}</text>
                    ) : null}
                    <text x={width - 48} y={ry + 2} textAnchor="end" fontFamily={FONT_TEXT} fontSize={11.5} fill={APPLE_TEXT_3}>{m.note}</text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      <figcaption>The mappings are the protocol's memory of what it has already done.</figcaption>
    </figure>
  )
}

/* 11. Timing — four rounds + total */
export function BridgeTiming() {
  const rounds = [
    { label: 'Round 1', what: 'Submit order to L3', detail: '~1s cycle + tx confirmation' },
    { label: 'Round 2', what: 'Batch the order', detail: '~1s cycle + tx confirmation' },
    { label: 'Round 3', what: 'Fill — AP executes trade', detail: '~1s cycle + exchange execution' },
    { label: 'Round 4', what: 'completeBuyOrder + mintBridgedShares', detail: '~1s cycle + tx confirmation' },
  ]
  const width = 880
  const rowH = 60
  const headerH = 40
  const totalH = 70
  const height = headerH + rounds.length * (rowH + 8) + totalH + 40

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bridge timing per consensus round">
        <text x={40} y={28} fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>FOUR CONSENSUS ROUNDS</text>

        {rounds.map((r, i) => {
          const y = headerH + i * (rowH + 8)
          return (
            <g key={i}>
              <rect x={20} y={y} width={width - 40} height={rowH} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
              <rect x={20} y={y + 6} width={4} height={rowH - 12} rx={2} fill={APPLE_GREEN} />
              <text x={44} y={y + 24} fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>{r.label.toUpperCase()}</text>
              <text x={44} y={y + 44} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>{r.what}</text>
              <text x={width - 40} y={y + 38} textAnchor="end" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={12.5} fill={APPLE_TEXT_2}>{r.detail}</text>
            </g>
          )
        })}

        {/* Total */}
        {(() => {
          const y = headerH + rounds.length * (rowH + 8) + 14
          return (
            <g>
              <rect x={20} y={y} width={width - 40} height={totalH - 14} rx={12} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
              <text x={44} y={y + 26} fontFamily={FONT_DISPLAY} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={APPLE_TEXT_3}>TOTAL</text>
              <text x={44} y={y + 46} fontFamily={FONT_DISPLAY} fontSize={15} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>~1–2 minutes — dominated by exchange execution</text>
            </g>
          )
        })()}
      </svg>
      <figcaption>Not fast. But correct — and correctness is not negotiable here.</figcaption>
    </figure>
  )
}
