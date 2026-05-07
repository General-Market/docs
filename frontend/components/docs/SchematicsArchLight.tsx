import * as React from 'react'

/* ─────────────────────────────────────────────────────────────
   Apple-style SVG schematics — replacements for ASCII diagrams
   in architecture/contracts.mdx, architecture/data-node.mdx,
   architecture/oracle-nodes.mdx, concepts/order-lifecycle.mdx.
   Each export is a parameterless server component.
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
const APPLE_GRAY = '#86868b'

const FONT_DISPLAY = '"SF Pro Display", "Helvetica Neue", sans-serif'
const FONT_TEXT = '"SF Pro Text", "Helvetica Neue", sans-serif'

type Accent = 'blue' | 'green' | 'orange' | 'gray'

const accentOf = (a?: Accent) =>
  a === 'blue' ? APPLE_BLUE
  : a === 'green' ? APPLE_GREEN
  : a === 'orange' ? APPLE_ORANGE
  : APPLE_GRAY

/* ─────────────────────────────────────────────────────────────
   ContractsOrderLifecycle — vertical pipeline. Replaces the
   ASCII flow in contracts.mdx (DTF Order Lifecycle).
   ─────────────────────────────────────────────────────────── */

export function ContractsOrderLifecycle() {
  const steps: { title: string; sub: string; accent: Accent }[] = [
    { title: 'User submits order', sub: 'L3 directly, or via BridgeProxy', accent: 'blue' },
    { title: 'Index.sol stores pending order', sub: 'Escrowed, awaiting consensus', accent: 'blue' },
    { title: 'Oracle nodes batch off-chain', sub: 'Round-robin leader, 1s cycles', accent: 'green' },
    { title: 'confirmBatch() with BLS signature', sub: 'Aggregated partials from peers', accent: 'green' },
    { title: 'BLSLib verifies aggregated signature', sub: 'BN254 precompiles · ceil(2n/3) threshold', accent: 'green' },
    { title: 'Batch confirmed → TradeRequest events', sub: 'AP discovers fills via on-chain logs', accent: 'orange' },
    { title: 'AP executes → confirmFills() with BLS', sub: 'Real exchange fills, signed reports', accent: 'orange' },
    { title: 'ITP shares minted or burned', sub: 'Collateral settled · backing 1:1', accent: 'blue' },
  ]

  const boxW = 460
  const boxH = 64
  const gap = 22
  const padX = 40
  const padY = 32
  const width = boxW + padX * 2
  const height = padY * 2 + steps.length * boxH + (steps.length - 1) * gap

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DTF order lifecycle">
        <defs>
          <marker id="lifecycle-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_TEXT_3} />
          </marker>
        </defs>

        {steps.map((s, i) => {
          const x = padX
          const y = padY + i * (boxH + gap)
          const c = accentOf(s.accent)
          return (
            <g key={i}>
              {i < steps.length - 1 ? (
                <line
                  x1={x + boxW / 2}
                  y1={y + boxH}
                  x2={x + boxW / 2}
                  y2={y + boxH + gap}
                  stroke={APPLE_BORDER}
                  strokeWidth={1}
                  markerEnd="url(#lifecycle-arrow)"
                />
              ) : null}
              <rect x={x} y={y} width={boxW} height={boxH} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
              <rect x={x} y={y + boxH / 2 - boxH * 2} width={4} height={boxH * 4} fill={c} rx={2} />
              <rect x={x} y={y} width={4} height={boxH} fill={c} rx={2} />
              <text
                x={x + 22}
                y={y + 26}
                fontFamily={FONT_DISPLAY}
                fontSize={14}
                fontWeight={600}
                letterSpacing="-0.005em"
                fill={APPLE_TEXT}
              >
                {s.title}
              </text>
              <text
                x={x + 22}
                y={y + 46}
                fontFamily={FONT_TEXT}
                fontSize={12}
                fill={APPLE_TEXT_2}
              >
                {s.sub}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>Eight steps. One unbroken chain. BLS at every gate.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   DataNodeOverview — replaces the big "DATA NODE" ASCII in
   data-node.mdx. Three columns: sources → collectors → storage,
   then consumers fed from a REST/WS/SSE bus underneath.
   ─────────────────────────────────────────────────────────── */

export function DataNodeOverview() {
  const sources = [
    'Earthquakes', 'Weather', 'Trains', 'Flights', 'Crypto',
    'Stocks', 'DeFi', 'Esports', 'Reddit', 'Steam',
    'Twitch', 'Nuclear', 'Volcanoes', 'Space', '… 77 more',
  ]
  const collectors: { label: string; sub: string }[] = [
    { label: 'Market Data', sub: '91 source engines' },
    { label: 'CoinGecko', sub: 'mcap · categories' },
    { label: 'DeFi Llama', sub: 'TVL · fees · raises' },
    { label: 'Klines / Trades', sub: 'OHLCV · fills' },
    { label: 'Liquidity', sub: 'orderbook depth' },
    { label: 'Chain Pollers', sub: 'L3 + Settlement' },
    { label: 'FNG · Oracle Health', sub: 'system telemetry' },
  ]
  const tables: { label: string; sub: string }[] = [
    { label: 'market_prices', sub: 'full history' },
    { label: 'market_prices_latest', sub: 'materialized' },
    { label: 'coingecko_*', sub: 'mcaps · categories' },
    { label: 'dl_*', sub: 'protocols · metrics' },
    { label: 'klines · trades · liquidity', sub: 'exchange + fills' },
    { label: 'itp_snapshots', sub: 'NAV · supply' },
    { label: 'oracle_health · fng_index', sub: 'system state' },
  ]
  const consumers: { label: string; sub: string; accent: Accent }[] = [
    { label: 'Frontend', sub: 'Next.js · /price · /portfolio · /vision/ws', accent: 'blue' },
    { label: 'Oracle nodes', sub: 'Rust · /fast-prices for consensus', accent: 'green' },
    { label: 'Explorer', sub: '/explorer/* · health dashboards', accent: 'orange' },
  ]

  // Layout
  const padX = 32
  const padY = 36
  const colW = 220
  const colGap = 36
  const colH = 360
  const headerH = 28
  const rowH = 36
  const rowGap = 6

  const totalCols = 3
  const width = padX * 2 + colW * totalCols + colGap * (totalCols - 1)

  // Storage column will use rowH for tables
  const collectorsH = headerH + 12 + collectors.length * (rowH + rowGap)
  const tablesH = headerH + 12 + tables.length * (rowH + rowGap)
  const sourcesH = headerH + 12 + Math.ceil(sources.length / 2) * 22 + 16
  const topRowH = Math.max(sourcesH, collectorsH, tablesH)

  const busY = padY + topRowH + 28
  const busH = 56
  const consumersY = busY + busH + 36
  const consumerH = 76
  const height = consumersY + consumerH + padY

  const xSources = padX
  const xCollectors = padX + colW + colGap
  const xStorage = padX + (colW + colGap) * 2

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Data Node architecture">
        <defs>
          <marker id="dn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_TEXT_3} />
          </marker>
        </defs>

        {/* Outer wrapper */}
        <rect x={padX - 12} y={padY - 12} width={width - (padX - 12) * 2} height={height - (padY - 12) * 2} rx={16} fill={APPLE_BG} stroke={APPLE_BORDER} />

        {/* Column headers */}
        {[
          { x: xSources, label: 'External data', sub: '91 sources' },
          { x: xCollectors, label: 'Collectors', sub: 'Tokio tasks · resilient' },
          { x: xStorage, label: 'Storage', sub: 'PostgreSQL · 15+ tables' },
        ].map((h, i) => (
          <g key={i}>
            <text
              x={h.x}
              y={padY + 14}
              fontFamily={FONT_DISPLAY}
              fontSize={13}
              fontWeight={600}
              letterSpacing="-0.005em"
              fill={APPLE_TEXT}
            >
              {h.label}
            </text>
            <text
              x={h.x}
              y={padY + 30}
              fontFamily={FONT_TEXT}
              fontSize={11}
              fill={APPLE_TEXT_3}
            >
              {h.sub}
            </text>
          </g>
        ))}

        {/* Sources column — chip grid */}
        <g>
          {sources.map((s, i) => {
            const col = i % 2
            const row = Math.floor(i / 2)
            const cw = (colW - 8) / 2
            const cx = xSources + col * (cw + 8)
            const cy = padY + 44 + row * 22
            return (
              <g key={i}>
                <rect x={cx} y={cy} width={cw} height={18} rx={9} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
                <text
                  x={cx + cw / 2}
                  y={cy + 13}
                  textAnchor="middle"
                  fontFamily={FONT_TEXT}
                  fontSize={10.5}
                  fill={APPLE_TEXT_2}
                >
                  {s}
                </text>
              </g>
            )
          })}
        </g>

        {/* Collectors column */}
        {collectors.map((c, i) => {
          const y = padY + 44 + i * (rowH + rowGap)
          return (
            <g key={i}>
              <rect x={xCollectors} y={y} width={colW} height={rowH} rx={10} fill={APPLE_BG} stroke={APPLE_BORDER} />
              <rect x={xCollectors} y={y} width={3} height={rowH} fill={APPLE_GRAY} rx={1.5} />
              <text
                x={xCollectors + 14}
                y={y + 16}
                fontFamily={FONT_DISPLAY}
                fontSize={12.5}
                fontWeight={600}
                letterSpacing="-0.005em"
                fill={APPLE_TEXT}
              >
                {c.label}
              </text>
              <text
                x={xCollectors + 14}
                y={y + 30}
                fontFamily={FONT_TEXT}
                fontSize={11}
                fill={APPLE_TEXT_3}
              >
                {c.sub}
              </text>
            </g>
          )
        })}

        {/* Storage column */}
        {tables.map((t, i) => {
          const y = padY + 44 + i * (rowH + rowGap)
          return (
            <g key={i}>
              <rect x={xStorage} y={y} width={colW} height={rowH} rx={10} fill={APPLE_BG} stroke={APPLE_BORDER} />
              <rect x={xStorage} y={y} width={3} height={rowH} fill={APPLE_BLUE} rx={1.5} />
              <text
                x={xStorage + 14}
                y={y + 16}
                fontFamily="SF Mono, Menlo, monospace"
                fontSize={11.5}
                fontWeight={600}
                fill={APPLE_TEXT}
              >
                {t.label}
              </text>
              <text
                x={xStorage + 14}
                y={y + 30}
                fontFamily={FONT_TEXT}
                fontSize={11}
                fill={APPLE_TEXT_3}
              >
                {t.sub}
              </text>
            </g>
          )
        })}

        {/* Connector arrows: sources → collectors, collectors → storage */}
        <line x1={xSources + colW + 4} y1={padY + topRowH / 2} x2={xCollectors - 4} y2={padY + topRowH / 2} stroke={APPLE_BORDER} markerEnd="url(#dn-arrow)" />
        <line x1={xCollectors + colW + 4} y1={padY + topRowH / 2} x2={xStorage - 4} y2={padY + topRowH / 2} stroke={APPLE_BORDER} markerEnd="url(#dn-arrow)" />

        {/* API bus */}
        <rect x={padX} y={busY} width={width - padX * 2} height={busH} rx={12} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
        <text
          x={padX + 18}
          y={busY + 22}
          fontFamily={FONT_DISPLAY}
          fontSize={13}
          fontWeight={600}
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          REST · WebSocket · SSE
        </text>
        <text
          x={padX + 18}
          y={busY + 40}
          fontFamily={FONT_TEXT}
          fontSize={11.5}
          fill={APPLE_TEXT_2}
        >
          Axum + Tower · 50+ endpoints · gzip · CORS · explorer-token gate
        </text>

        {/* Storage → bus */}
        <line
          x1={xStorage + colW / 2}
          y1={padY + topRowH + 4}
          x2={xStorage + colW / 2}
          y2={busY - 2}
          stroke={APPLE_BORDER}
          markerEnd="url(#dn-arrow)"
        />

        {/* Consumers */}
        {consumers.map((c, i) => {
          const cw = (width - padX * 2 - 24) / 3
          const cx = padX + i * (cw + 12)
          const acc = accentOf(c.accent)
          return (
            <g key={i}>
              <line
                x1={cx + cw / 2}
                y1={busY + busH + 2}
                x2={cx + cw / 2}
                y2={consumersY - 2}
                stroke={APPLE_BORDER}
                markerEnd="url(#dn-arrow)"
              />
              <rect x={cx} y={consumersY} width={cw} height={consumerH} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
              <rect x={cx} y={consumersY} width={4} height={consumerH} fill={acc} rx={2} />
              <text
                x={cx + 18}
                y={consumersY + 26}
                fontFamily={FONT_DISPLAY}
                fontSize={14}
                fontWeight={600}
                letterSpacing="-0.005em"
                fill={APPLE_TEXT}
              >
                {c.label}
              </text>
              <text
                x={cx + 18}
                y={consumersY + 48}
                fontFamily={FONT_TEXT}
                fontSize={11.5}
                fill={APPLE_TEXT_2}
              >
                {c.sub}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>Ninety-one sources. One database. Three transports. The world reduced to rows.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   OracleApIsolation — three boxes (Oracles, L3 Chain, AP) with
   the explicit broken direct link. From oracle-nodes.mdx FR13.
   ─────────────────────────────────────────────────────────── */

export function OracleApIsolation() {
  const width = 760
  const height = 320
  const boxW = 200
  const boxH = 110
  const y = 80
  const xL = 40
  const xM = (width - boxW) / 2
  const xR = width - boxW - 40

  const cx = (x: number) => x + boxW / 2
  const midY = y + boxH / 2

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Oracle and AP isolation by design">
        <defs>
          <marker id="iso-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_TEXT_3} />
          </marker>
        </defs>

        {/* Oracle Nodes */}
        <g>
          <rect x={xL} y={y} width={boxW} height={boxH} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
          <rect x={xL} y={y} width={4} height={boxH} fill={APPLE_GREEN} rx={2} />
          <text x={xL + 18} y={y + 30} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>
            Oracle nodes
          </text>
          <text x={xL + 18} y={y + 52} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>
            Consensus + BLS
          </text>
          <text x={xL + 18} y={y + 70} fontFamily={FONT_TEXT} fontSize={11.5} fill={APPLE_TEXT_3}>
            Rust · 1s cycles
          </text>
          <text x={xL + 18} y={y + 88} fontFamily={FONT_TEXT} fontSize={11.5} fill={APPLE_TEXT_3}>
            ceil(2n/3) threshold
          </text>
        </g>

        {/* L3 chain */}
        <g>
          <rect x={xM} y={y} width={boxW} height={boxH} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
          <rect x={xM} y={y} width={4} height={boxH} fill={APPLE_BLUE} rx={2} />
          <text x={xM + 18} y={y + 30} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>
            L3 chain
          </text>
          <text x={xM + 18} y={y + 52} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>
            Index.sol
          </text>
          <text x={xM + 18} y={y + 70} fontFamily={FONT_TEXT} fontSize={11.5} fill={APPLE_TEXT_3}>
            confirmBatch()
          </text>
          <text x={xM + 18} y={y + 88} fontFamily={FONT_TEXT} fontSize={11.5} fill={APPLE_TEXT_3}>
            emits TradeRequest
          </text>
        </g>

        {/* AP */}
        <g>
          <rect x={xR} y={y} width={boxW} height={boxH} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
          <rect x={xR} y={y} width={4} height={boxH} fill={APPLE_ORANGE} rx={2} />
          <text x={xR + 18} y={y + 30} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={APPLE_TEXT}>
            Authorized Participant
          </text>
          <text x={xR + 18} y={y + 52} fontFamily={FONT_TEXT} fontSize={12} fill={APPLE_TEXT_2}>
            Executes fills
          </text>
          <text x={xR + 18} y={y + 70} fontFamily={FONT_TEXT} fontSize={11.5} fill={APPLE_TEXT_3}>
            Reads on-chain events
          </text>
          <text x={xR + 18} y={y + 88} fontFamily={FONT_TEXT} fontSize={11.5} fill={APPLE_TEXT_3}>
            Reports via confirmFills()
          </text>
        </g>

        {/* Allowed flow: oracles → L3 → AP */}
        <line x1={xL + boxW + 4} y1={midY} x2={xM - 4} y2={midY} stroke={APPLE_TEXT_3} markerEnd="url(#iso-arrow)" />
        <text x={(xL + boxW + xM) / 2} y={midY - 8} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>
          tx · BLS-signed
        </text>

        <line x1={xM + boxW + 4} y1={midY} x2={xR - 4} y2={midY} stroke={APPLE_TEXT_3} markerEnd="url(#iso-arrow)" />
        <text x={(xM + boxW + xR) / 2} y={midY - 8} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fill={APPLE_TEXT_3}>
          event · TradeRequest
        </text>

        {/* Forbidden direct link */}
        <path
          d={`M${cx(xL)},${y + boxH + 10} C${cx(xL)},${y + boxH + 80} ${cx(xR)},${y + boxH + 80} ${cx(xR)},${y + boxH + 10}`}
          fill="none"
          stroke="#ff3b30"
          strokeOpacity="0.5"
          strokeDasharray="4 4"
        />
        {/* Strike-through circle marking the forbidden path */}
        <g transform={`translate(${width / 2}, ${y + boxH + 70})`}>
          <circle r={14} fill={APPLE_BG} stroke="#ff3b30" />
          <line x1={-7} y1={-7} x2={7} y2={7} stroke="#ff3b30" strokeWidth={2} />
          <line x1={-7} y1={7} x2={7} y2={-7} stroke="#ff3b30" strokeWidth={2} />
        </g>
        <text
          x={width / 2}
          y={y + boxH + 102}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize={12}
          fontWeight={500}
          fill={APPLE_TEXT_2}
        >
          No direct channel — by design
        </text>
      </svg>
      <figcaption>The signers and the executor never speak. Collusion needs a phone line.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   OrderStateMachine — state diagram for order-lifecycle.mdx.
   PENDING → BATCHED → FILLED, with TIMEOUT branch + retries.
   ─────────────────────────────────────────────────────────── */

export function OrderStateMachine() {
  const width = 780
  const height = 360

  // Node positions (centers)
  const nodes: { id: string; cx: number; cy: number; w: number; h: number; label: string; sub: string; accent: Accent }[] = [
    { id: 'start', cx: 80, cy: 60, w: 16, h: 16, label: '', sub: '', accent: 'gray' },
    { id: 'pending', cx: 230, cy: 60, w: 180, h: 76, label: 'PENDING', sub: 'Submitted · escrowed', accent: 'blue' },
    { id: 'batched', cx: 480, cy: 60, w: 180, h: 76, label: 'BATCHED', sub: 'BLS-signed · executing', accent: 'green' },
    { id: 'filled', cx: 700, cy: 60, w: 60, h: 76, label: 'FILLED', sub: '', accent: 'green' },
    { id: 'timeout', cx: 230, cy: 220, w: 180, h: 76, label: 'TIMEOUT', sub: '60s · retry up to 3×', accent: 'orange' },
    { id: 'end', cx: 480, cy: 220, w: 180, h: 76, label: 'CANCELLED', sub: 'Funds returned', accent: 'gray' },
  ]

  const get = (id: string) => nodes.find(n => n.id === id)!

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Order state machine">
        <defs>
          <marker id="state-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_TEXT_3} />
          </marker>
        </defs>

        {/* Edges */}
        <Edge label="submitOrder()" from={get('start')} to={get('pending')} side="right" />
        <Edge label="BLS consensus" from={get('pending')} to={get('batched')} side="right" />
        <Edge label="confirmFills()" from={get('batched')} to={get('filled')} side="right" />
        <Edge label="60s elapsed" from={get('pending')} to={get('timeout')} side="bottom" />
        <Edge label="retry (≤3×)" from={get('timeout')} to={get('pending')} side="top-loop" />
        <Edge label="3 retries · refund" from={get('timeout')} to={get('end')} side="right" />

        {/* Start dot */}
        <circle cx={get('start').cx} cy={get('start').cy} r={6} fill={APPLE_TEXT} />

        {/* Filled terminal — small pill */}
        {(() => {
          const f = get('filled')
          return (
            <g>
              <rect x={f.cx - f.w / 2} y={f.cy - f.h / 2} width={f.w} height={f.h} rx={12} fill={APPLE_BG} stroke={APPLE_GREEN} />
              <rect x={f.cx - f.w / 2} y={f.cy - f.h / 2} width={4} height={f.h} fill={APPLE_GREEN} rx={2} />
              <text
                x={f.cx + 8}
                y={f.cy + 4}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize={13}
                fontWeight={600}
                letterSpacing="-0.005em"
                fill={APPLE_TEXT}
              >
                FILLED
              </text>
            </g>
          )
        })()}

        {/* State boxes */}
        {nodes
          .filter(n => n.id !== 'start' && n.id !== 'filled')
          .map(n => {
            const acc = accentOf(n.accent)
            const x = n.cx - n.w / 2
            const y = n.cy - n.h / 2
            return (
              <g key={n.id}>
                <rect x={x} y={y} width={n.w} height={n.h} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
                <rect x={x} y={y} width={4} height={n.h} fill={acc} rx={2} />
                <text
                  x={x + 18}
                  y={y + 28}
                  fontFamily={FONT_DISPLAY}
                  fontSize={14}
                  fontWeight={600}
                  letterSpacing="-0.005em"
                  fill={APPLE_TEXT}
                >
                  {n.label}
                </text>
                {n.sub ? (
                  <text
                    x={x + 18}
                    y={y + 50}
                    fontFamily={FONT_TEXT}
                    fontSize={12}
                    fill={APPLE_TEXT_2}
                  >
                    {n.sub}
                  </text>
                ) : null}
              </g>
            )
          })}
      </svg>
      <figcaption>Four states. Three retries. No fifth state, no ambiguity.</figcaption>
    </figure>
  )
}

function Edge({
  label,
  from,
  to,
  side,
}: {
  label: string
  from: { cx: number; cy: number; w: number; h: number }
  to: { cx: number; cy: number; w: number; h: number }
  side: 'right' | 'bottom' | 'top-loop'
}) {
  if (side === 'right') {
    const x1 = from.cx + from.w / 2
    const y1 = from.cy
    const x2 = to.cx - to.w / 2
    const y2 = to.cy
    const mx = (x1 + x2) / 2
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={APPLE_TEXT_3} markerEnd="url(#state-arrow)" />
        <rect x={mx - 60} y={y1 - 11} width={120} height={16} rx={4} fill={APPLE_BG} />
        <text
          x={mx}
          y={y1 - 2}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize={11}
          fill={APPLE_TEXT_3}
        >
          {label}
        </text>
      </g>
    )
  }
  if (side === 'bottom') {
    const x1 = from.cx
    const y1 = from.cy + from.h / 2
    const x2 = to.cx
    const y2 = to.cy - to.h / 2
    const my = (y1 + y2) / 2
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={APPLE_TEXT_3} markerEnd="url(#state-arrow)" />
        <rect x={x1 - 50} y={my - 8} width={100} height={16} rx={4} fill={APPLE_BG} />
        <text
          x={x1}
          y={my + 3}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize={11}
          fill={APPLE_TEXT_3}
        >
          {label}
        </text>
      </g>
    )
  }
  // top-loop: from TIMEOUT (220) up to PENDING (60) on the left side
  const x1 = from.cx - from.w / 2 - 8
  const y1 = from.cy
  const x2 = to.cx - to.w / 2 - 8
  const y2 = to.cy
  const ctrlX = Math.min(x1, x2) - 40
  return (
    <g>
      <path
        d={`M${x1},${y1} C${ctrlX},${y1} ${ctrlX},${y2} ${x2},${y2}`}
        fill="none"
        stroke={APPLE_TEXT_3}
        strokeDasharray="3 4"
        markerEnd="url(#state-arrow)"
      />
      <text
        x={ctrlX - 4}
        y={(y1 + y2) / 2 + 4}
        textAnchor="end"
        fontFamily={FONT_TEXT}
        fontSize={11}
        fill={APPLE_TEXT_3}
      >
        {label}
      </text>
    </g>
  )
}
