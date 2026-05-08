import * as React from 'react'

/* Apple-style SVG schematics — final residual sweep.
   Replacements for the ASCII diagrams in:
     - architecture/curator.mdx (13)
     - architecture/data-node.mdx (5)
     - architecture/l3-chain.mdx (1)
     - reference/contract-addresses.mdx (1)
   Server components only. No imports beyond React. */

const FONT_DISPLAY = '"SF Pro Display","Helvetica Neue",sans-serif'
const FONT_TEXT = '"SF Pro Text","Helvetica Neue",sans-serif'

const T1 = '#1d1d1f'
const T2 = '#6e6e73'
const T3 = '#86868b'
const BD = '#d2d2d7'
const BG = '#ffffff'
const SF = '#f5f5f7'

const BLUE = '#0071e3'
const GREEN = '#34c759'
const ORANGE = '#ff9500'
const RED = '#ff3b30'

/* ──────────────────────────── shared atoms ──────────────────────────── */

type AccentColor = string

function ServiceCard({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent,
}: {
  x: number
  y: number
  w: number
  h: number
  title: string
  sub?: string
  accent?: AccentColor
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={BG} stroke={BD} />
      {accent ? <rect x={x} y={y + 8} width={4} height={h - 16} rx={2} fill={accent} /> : null}
      <text
        x={x + (accent ? 18 : 14)}
        y={y + 24}
        fontFamily={FONT_DISPLAY}
        fontSize="13"
        fontWeight="600"
        letterSpacing="-0.005em"
        fill={T1}
      >
        {title}
      </text>
      {sub
        ? sub.split('\n').map((line, i) => (
            <text
              key={i}
              x={x + (accent ? 18 : 14)}
              y={y + 42 + i * 14}
              fontFamily={FONT_TEXT}
              fontSize="11"
              fill={T2}
            >
              {line}
            </text>
          ))
        : null}
    </g>
  )
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  label,
  color = T3,
  marker = 'resid-arrow',
  dashed,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  label?: string
  color?: string
  marker?: string
  dashed?: boolean
}) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={1}
        strokeDasharray={dashed ? '3 3' : undefined}
        markerEnd={`url(#${marker})`}
      />
      {label ? (
        <g>
          <rect x={mx - label.length * 3.4 - 4} y={my - 8} width={label.length * 6.8 + 8} height={14} rx={3} fill={BG} />
          <text
            x={mx}
            y={my + 2}
            textAnchor="middle"
            fontFamily={FONT_TEXT}
            fontSize="10.5"
            fill={T3}
          >
            {label}
          </text>
        </g>
      ) : null}
    </g>
  )
}

function Defs() {
  return (
    <defs>
      <marker
        id="resid-arrow"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L10,5 L0,10 z" fill={T3} />
      </marker>
      <marker
        id="resid-arrow-blue"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L10,5 L0,10 z" fill={BLUE} />
      </marker>
      <marker
        id="resid-arrow-green"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L10,5 L0,10 z" fill={GREEN} />
      </marker>
      <marker
        id="resid-arrow-orange"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L10,5 L0,10 z" fill={ORANGE} />
      </marker>
    </defs>
  )
}

/* ──────────────────────────── curator.mdx ──────────────────────────── */

/* 1. Curator service map — 4 sub-services in one frame, each pointing
      to an external destination. */
export function CuratorServiceMap() {
  const W = 880
  const H = 360
  const cardW = 184
  const cardH = 100
  const gap = 24
  const total = 4 * cardW + 3 * gap
  const startX = (W - total) / 2
  const yTop = 64
  const dests = [
    { title: 'ITPNAVOracle', sub: 'Settlement', accent: BLUE },
    { title: 'MetaMorpho Vault', sub: 'Settlement', accent: GREEN },
    { title: 'Telegram Bot', sub: 'Alerts', accent: ORANGE },
    { title: 'CuratorRateIRM', sub: 'Settlement', accent: BLUE },
  ]
  const services = [
    {
      title: 'Oracle Collector',
      sub: 'Collect NAV from oracles\nBLS aggregate',
      accent: BLUE,
    },
    {
      title: 'Allocation Bot',
      sub: 'Rebalance vault USDC\nacross markets',
      accent: GREEN,
    },
    {
      title: 'Health Monitor',
      sub: 'Scan HF, oracles,\npositions',
      accent: ORANGE,
    },
    {
      title: 'Quote API',
      sub: 'POST /quote\nSERM rates · Bundler',
      accent: BLUE,
    },
  ]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        <rect x={20} y={20} width={W - 40} height={cardH + 40} rx={16} fill={SF} stroke={BD} />
        <text
          x={36}
          y={44}
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={T1}
        >
          Curator Service
        </text>
        {services.map((s, i) => {
          const x = startX + i * (cardW + gap)
          return <ServiceCard key={i} x={x} y={yTop} w={cardW} h={cardH} title={s.title} sub={s.sub} accent={s.accent} />
        })}
        {dests.map((d, i) => {
          const x = startX + i * (cardW + gap)
          const cx = x + cardW / 2
          return (
            <g key={i}>
              <line x1={cx} y1={yTop + cardH} x2={cx} y2={yTop + cardH + 50} stroke={BD} markerEnd="url(#resid-arrow)" />
              <rect x={x + 8} y={yTop + cardH + 60} width={cardW - 16} height={56} rx={12} fill={BG} stroke={BD} />
              <text
                x={cx}
                y={yTop + cardH + 84}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {d.title}
              </text>
              <text
                x={cx}
                y={yTop + cardH + 102}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="11"
                fill={T2}
              >
                {d.sub}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>One process. Four jobs. Silent until something goes wrong.</figcaption>
    </figure>
  )
}

/* 2. Three oracles converge → NavCollector → OraclePusher → ITPNAVOracle */
export function CuratorOracleConsensus() {
  const W = 880
  const H = 560
  const oracleY = 30
  const oracleH = 90
  const oracleW = 180
  const oracleGap = 40
  const totalOracles = 3 * oracleW + 2 * oracleGap
  const startX = (W - totalOracles) / 2
  const stages = [
    {
      y: 170,
      title: 'NavCollector',
      lines: [
        'HTTP GET to each oracle (parallel)',
        'Parse NavSignResponse (price, sig, id)',
        'Validate consensus: prices + cycles agree',
        'Threshold: ceil(2n/3) responses',
        'Aggregate BLS signatures · build bitmask',
      ],
    },
    {
      y: 310,
      title: 'OraclePusher',
      lines: [
        'Read lastCycleNumber from chain',
        'Skip if cycle ≤ on-chain cycle',
        'pushPrice(price, ts, cycle, sig, bitmask)',
        'Wait for tx confirmation',
      ],
    },
    {
      y: 440,
      title: 'ITPNAVOracle.sol — Settlement',
      lines: [
        'Verifies BLS signature on-chain',
        'Stores latest price + timestamp',
        'Morpho reads price via oracle interface',
      ],
    },
  ]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {[0, 1, 2].map(i => {
          const x = startX + i * (oracleW + oracleGap)
          return (
            <g key={i}>
              <rect x={x} y={oracleY} width={oracleW} height={oracleH} rx={12} fill={BG} stroke={BD} />
              <rect x={x} y={oracleY + 8} width={4} height={oracleH - 16} rx={2} fill={GREEN} />
              <text
                x={x + 18}
                y={oracleY + 26}
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                Oracle {i + 1}
              </text>
              <text x={x + 18} y={oracleY + 46} fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
                Compute NAV
              </text>
              <text x={x + 18} y={oracleY + 62} fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
                BLS-sign (price, cycle, time)
              </text>
              <text x={x + 18} y={oracleY + 78} fontFamily={FONT_TEXT} fontSize="10.5" fill={T3}>
                GET /api/nav-sign?itp=0x…
              </text>
            </g>
          )
        })}
        {/* arrows from each oracle to NavCollector top */}
        {[0, 1, 2].map(i => {
          const x = startX + i * (oracleW + oracleGap) + oracleW / 2
          return (
            <line
              key={i}
              x1={x}
              y1={oracleY + oracleH}
              x2={W / 2}
              y2={stages[0].y}
              stroke={BD}
              markerEnd="url(#resid-arrow)"
            />
          )
        })}
        {stages.map((s, i) => {
          const x = 60
          const w = W - 120
          const h = i === 0 ? 110 : i === 1 ? 100 : 90
          return (
            <g key={i}>
              <rect x={x} y={s.y} width={w} height={h} rx={12} fill={BG} stroke={BD} />
              <rect x={x} y={s.y + 8} width={4} height={h - 16} rx={2} fill={i === 2 ? ORANGE : BLUE} />
              <text
                x={x + 18}
                y={s.y + 26}
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {s.title}
              </text>
              {s.lines.map((ln, j) => (
                <text
                  key={j}
                  x={x + 18}
                  y={s.y + 46 + j * 14}
                  fontFamily={FONT_TEXT}
                  fontSize="11"
                  fill={T2}
                >
                  {`${j + 1}. ${ln}`}
                </text>
              ))}
            </g>
          )
        })}
        <line x1={W / 2} y1={170 + 110} x2={W / 2} y2={310} stroke={BD} markerEnd="url(#resid-arrow)" />
        <text x={W / 2 + 8} y={170 + 110 + 18} fontFamily={FONT_TEXT} fontSize="10.5" fill={T3}>
          aggregated sig + price + cycle + bitmask
        </text>
        <line x1={W / 2} y1={310 + 100} x2={W / 2} y2={440} stroke={BD} markerEnd="url(#resid-arrow)" />
      </svg>
      <figcaption>No price reaches the oracle without unanimous agreement from a quorum.</figcaption>
    </figure>
  )
}

/* 3. Collection loop — 4 boxes in a circle */
export function CuratorCollectionLoop() {
  const W = 880
  const H = 220
  const boxW = 180
  const boxH = 80
  const gap = 24
  const total = 4 * boxW + 3 * gap
  const startX = (W - total) / 2
  const y = 60
  const steps = [
    { title: 'Collect', sub: 'from all oracles' },
    { title: 'Validate', sub: 'consensus + agg' },
    { title: 'Push', sub: 'to chain (if new)' },
    { title: 'Sleep', sub: 'interval (config)' },
  ]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {steps.map((s, i) => {
          const x = startX + i * (boxW + gap)
          return (
            <g key={i}>
              <rect x={x} y={y} width={boxW} height={boxH} rx={12} fill={BG} stroke={BD} />
              <text
                x={x + boxW / 2}
                y={y + 34}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="14"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {s.title}
              </text>
              <text
                x={x + boxW / 2}
                y={y + 56}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="11"
                fill={T2}
              >
                {s.sub}
              </text>
              {i < 3 ? (
                <line
                  x1={x + boxW}
                  y1={y + boxH / 2}
                  x2={x + boxW + gap}
                  y2={y + boxH / 2}
                  stroke={BD}
                  markerEnd="url(#resid-arrow)"
                />
              ) : null}
            </g>
          )
        })}
        {/* loop arrow back */}
        <path
          d={`M ${startX + total - boxW / 2} ${y + boxH} V ${y + boxH + 30} H ${startX + boxW / 2} V ${y}`}
          fill="none"
          stroke={BD}
          markerEnd="url(#resid-arrow)"
        />
        <text
          x={W / 2}
          y={y + boxH + 50}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="11"
          fill={T3}
        >
          repeat until shutdown
        </text>
      </svg>
      <figcaption>The oracle is only as fresh as the last push.</figcaption>
    </figure>
  )
}

/* 4. Utilization scale */
export function CuratorUtilizationScale() {
  const W = 880
  const H = 200
  const padX = 60
  const usable = W - 2 * padX
  const stops = [
    { pct: 0, label: '0%' },
    { pct: 50, label: '50%' },
    { pct: 70, label: '70%' },
    { pct: 85, label: '85%' },
    { pct: 90, label: '90%' },
    { pct: 100, label: '100%' },
  ]
  const bands = [
    { from: 0, to: 50, color: '#fdecec', label: 'Critical low', sub: 'Strong pull candidate', textColor: RED },
    { from: 50, to: 70, color: '#fff4e1', label: 'Below target', sub: '', textColor: ORANGE },
    { from: 70, to: 85, color: '#e6f6ea', label: 'Target zone', sub: '', textColor: GREEN },
    { from: 85, to: 90, color: '#fff4e1', label: 'Above target', sub: '', textColor: ORANGE },
    { from: 90, to: 100, color: '#fdecec', label: 'Critical high', sub: 'Priority supply', textColor: RED },
  ]
  const yBar = 70
  const barH = 36
  const x = (p: number) => padX + (p / 100) * usable
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {bands.map((b, i) => (
          <rect
            key={i}
            x={x(b.from)}
            y={yBar}
            width={x(b.to) - x(b.from)}
            height={barH}
            fill={b.color}
            stroke={BD}
          />
        ))}
        {stops.map((s, i) => (
          <g key={i}>
            <line x1={x(s.pct)} y1={yBar - 8} x2={x(s.pct)} y2={yBar + barH + 8} stroke={BD} />
            <text
              x={x(s.pct)}
              y={yBar - 14}
              textAnchor="middle"
              fontFamily={FONT_TEXT}
              fontSize="11"
              fontWeight="500"
              fill={T1}
            >
              {s.label}
            </text>
          </g>
        ))}
        {bands.map((b, i) => {
          const cx = (x(b.from) + x(b.to)) / 2
          return (
            <g key={i}>
              <text
                x={cx}
                y={yBar + barH + 28}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="11"
                fontWeight="600"
                fill={b.textColor}
              >
                {b.label}
              </text>
              {b.sub ? (
                <text
                  x={cx}
                  y={yBar + barH + 44}
                  textAnchor="middle"
                  fontFamily={FONT_TEXT}
                  fontSize="10.5"
                  fill={T3}
                >
                  {b.sub}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <figcaption>Capital must go where it is needed. The bot reads the bar and acts.</figcaption>
    </figure>
  )
}

/* 5. Risk tiers — horizontal bars */
export function CuratorRiskTiers() {
  const W = 880
  const H = 280
  const tiers = [
    { tier: 'Tier A', cap: 30, desc: 'Blue-chip, diversified ITPs', accent: BLUE },
    { tier: 'Tier B', cap: 20, desc: 'Medium risk ITPs', accent: GREEN },
    { tier: 'Tier C', cap: 10, desc: 'Higher risk ITPs', accent: ORANGE },
    { tier: 'Tier D', cap: 5, desc: 'Watch list, new ITPs (default)', accent: RED },
  ]
  const padX = 40
  const labelW = 110
  const maxCap = 30
  const usable = W - 2 * padX - labelW - 80
  const barH = 32
  const gap = 22
  const yStart = 32
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        <text
          x={padX}
          y={20}
          fontFamily={FONT_DISPLAY}
          fontSize="12"
          fontWeight="600"
          letterSpacing="0.04em"
          fill={T2}
        >
          RISK TIERS — MAX CONCENTRATION
        </text>
        {tiers.map((t, i) => {
          const y = yStart + i * (barH + gap) + 18
          const w = (t.cap / maxCap) * usable
          return (
            <g key={i}>
              <text
                x={padX}
                y={y + barH / 2 + 4}
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {t.tier}
              </text>
              <rect
                x={padX + labelW}
                y={y}
                width={usable}
                height={barH}
                rx={6}
                fill={SF}
                stroke={BD}
              />
              <rect x={padX + labelW} y={y} width={w} height={barH} rx={6} fill={t.accent} fillOpacity={0.85} />
              <text
                x={padX + labelW + w + 12}
                y={y + barH / 2 + 4}
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                fill={T1}
              >
                {t.cap}% max
              </text>
              <text
                x={padX + labelW}
                y={y + barH + 14}
                fontFamily={FONT_TEXT}
                fontSize="11"
                fill={T2}
              >
                {t.desc}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>New markets default to Tier D. Trust is earned, not granted.</figcaption>
    </figure>
  )
}

/* 6. Allocation cycle — 5 steps with a branch at the end */
export function CuratorAllocationCycle() {
  const W = 880
  const H = 580
  const stepX = W / 2 - 130
  const stepW = 260
  const stepH = 70
  const gap = 34
  const steps = [
    { title: 'Detect new markets from supply queue', sub: 'Read vault.supplyQueue() · diff against known set' },
    { title: 'Read market state from Morpho Blue', sub: 'morpho.market(id) · morpho.position(id, vault) · util%' },
    { title: 'Compute reallocation decisions', sub: 'Over/under-utilized · respect tier caps · min 1 USDC' },
  ]
  const branchY = 24 + 3 * (stepH + gap) + 30
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {steps.map((s, i) => {
          const y = 24 + i * (stepH + gap)
          return (
            <g key={i}>
              <rect x={stepX} y={y} width={stepW} height={stepH} rx={12} fill={BG} stroke={BD} />
              <rect x={stepX} y={y + 8} width={4} height={stepH - 16} rx={2} fill={BLUE} />
              <text
                x={stepX + 18}
                y={y + 26}
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {s.title}
              </text>
              <text x={stepX + 18} y={y + 46} fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
                {s.sub}
              </text>
              {i < 2 ? (
                <line
                  x1={W / 2}
                  y1={y + stepH}
                  x2={W / 2}
                  y2={y + stepH + gap}
                  stroke={BD}
                  markerEnd="url(#resid-arrow)"
                />
              ) : null}
            </g>
          )
        })}
        {/* arrow from last step to diamond */}
        <line
          x1={W / 2}
          y1={24 + 3 * (stepH + gap) - gap}
          x2={W / 2}
          y2={branchY - 6}
          stroke={BD}
          markerEnd="url(#resid-arrow)"
        />
        {/* diamond */}
        <g>
          <polygon
            points={`${W / 2},${branchY} ${W / 2 + 70},${branchY + 28} ${W / 2},${branchY + 56} ${W / 2 - 70},${branchY + 28}`}
            fill={BG}
            stroke={BD}
          />
          <text
            x={W / 2}
            y={branchY + 32}
            textAnchor="middle"
            fontFamily={FONT_DISPLAY}
            fontSize="13"
            fontWeight="600"
            fill={T1}
          >
            Needed?
          </text>
        </g>
        {/* No branch — left */}
        <line x1={W / 2 - 70} y1={branchY + 28} x2={W / 2 - 200} y2={branchY + 28} stroke={BD} markerEnd="url(#resid-arrow)" />
        <text x={W / 2 - 130} y={branchY + 22} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>
          No
        </text>
        <rect x={W / 2 - 320} y={branchY + 14} width={120} height={32} rx={12} fill={SF} stroke={BD} />
        <text
          x={W / 2 - 260}
          y={branchY + 35}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          fill={T2}
        >
          Skip
        </text>
        {/* Yes branch — right */}
        <line x1={W / 2 + 70} y1={branchY + 28} x2={W / 2 + 130} y2={branchY + 28} stroke={BD} markerEnd="url(#resid-arrow)" />
        <text x={W / 2 + 100} y={branchY + 22} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>
          Yes
        </text>
        <rect x={W / 2 + 130} y={branchY} width={240} height={70} rx={12} fill={BG} stroke={BD} />
        <rect x={W / 2 + 130} y={branchY + 8} width={4} height={54} rx={2} fill={GREEN} />
        <text
          x={W / 2 + 148}
          y={branchY + 26}
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={T1}
        >
          vault.reallocate
        </text>
        <text x={W / 2 + 148} y={branchY + 46} fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
          Submit MarketAllocation[] to MetaMorpho
        </text>
      </svg>
      <figcaption>Each cycle: detect, read, decide, act. Or do nothing — also a decision.</figcaption>
    </figure>
  )
}

/* 7. Health monitor scan cycle */
export function CuratorHealthMonitor() {
  const W = 920
  const H = 620
  const cardW = 170
  const cardH = 96
  const gapX = 28
  const gapY = 30
  const totalRow = 3 * cardW + 2 * gapX
  const startX = (W - totalRow) / 2
  const rows = [
    [
      { title: 'Position Health Factors', sub: 'collateral / debt = HF', accent: BLUE },
      { title: 'Oracle Freshness', sub: 'lastUpdated vs cadence', accent: BLUE },
      { title: 'Mirror Registry Sync', sub: 'L3 nonce vs Settlement', accent: BLUE },
    ],
    [
      { title: 'Vault Metrics', sub: 'totalAssets · idle · utilization', accent: GREEN },
      { title: 'Crisis Levels', sub: 'Normal · Elevated · Stress · Emergency', accent: ORANGE },
      { title: 'SERM Stress Scoring', sub: 'Per-asset volatility scoring', accent: ORANGE },
    ],
  ]
  const yRow1 = 60
  const yRow2 = yRow1 + cardH + gapY
  const reportY = yRow2 + cardH + 60
  const sinkY = reportY + 110
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        <rect x={20} y={20} width={W - 40} height={yRow2 + cardH + 30 - 20} rx={16} fill={SF} stroke={BD} />
        <text
          x={36}
          y={42}
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.04em"
          fill={T2}
        >
          HEALTH MONITOR — SCAN CYCLE
        </text>
        {rows.map((row, ri) =>
          row.map((c, ci) => {
            const x = startX + ci * (cardW + gapX)
            const y = ri === 0 ? yRow1 : yRow2
            return (
              <ServiceCard key={`${ri}-${ci}`} x={x} y={y} w={cardW} h={cardH} title={c.title} sub={c.sub} accent={c.accent} />
            )
          })
        )}
        {/* arrows from each row 2 card down to report */}
        {rows[1].map((_, ci) => {
          const x = startX + ci * (cardW + gapX) + cardW / 2
          return <line key={ci} x1={x} y1={yRow2 + cardH} x2={W / 2} y2={reportY} stroke={BD} markerEnd="url(#resid-arrow)" />
        })}
        {/* Health report */}
        <rect x={W / 2 - 140} y={reportY} width={280} height={90} rx={12} fill={BG} stroke={BD} />
        <text
          x={W / 2}
          y={reportY + 24}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={T1}
        >
          HealthReport
        </text>
        {['positions[] · oracles[] · alerts[]', 'vault_metrics · mirror_sync · crisis_levels'].map((ln, i) => (
          <text
            key={i}
            x={W / 2}
            y={reportY + 46 + i * 16}
            textAnchor="middle"
            fontFamily={FONT_TEXT}
            fontSize="11"
            fill={T2}
          >
            {ln}
          </text>
        ))}
        {/* Sinks: Telegram, Log, SharedState */}
        {[
          { x: W / 2 - 290, title: 'Telegram Alerts', sub: 'Crisis transitions · critical warnings' },
          { x: W / 2 - 100, title: 'Log File (JSON)', sub: 'Full report dump' },
          { x: W / 2 + 90, title: 'SharedState', sub: 'crisis_levels · asset_stress → Quote API + Alloc Bot' },
        ].map((s, i) => (
          <g key={i}>
            <line x1={W / 2} y1={reportY + 90} x2={s.x + 100} y2={sinkY} stroke={BD} markerEnd="url(#resid-arrow)" />
            <rect x={s.x} y={sinkY} width={200} height={72} rx={12} fill={BG} stroke={BD} />
            <text
              x={s.x + 14}
              y={sinkY + 24}
              fontFamily={FONT_DISPLAY}
              fontSize="13"
              fontWeight="600"
              letterSpacing="-0.005em"
              fill={T1}
            >
              {s.title}
            </text>
            {s.sub.split(' · ').map((line, j) => (
              <text
                key={j}
                x={s.x + 14}
                y={sinkY + 44 + j * 14}
                fontFamily={FONT_TEXT}
                fontSize="11"
                fill={T2}
              >
                {line}
              </text>
            ))}
          </g>
        ))}
      </svg>
      <figcaption>Vigilance is the only strategy against entropy.</figcaption>
    </figure>
  )
}

/* 8. Health factor scale */
export function CuratorHealthFactorScale() {
  const W = 880
  const H = 200
  const padX = 60
  const usable = W - 2 * padX
  const yBar = 80
  const barH = 36
  const stops = [
    { x: 0, label: '1.0' },
    { x: 0.2, label: '1.05' },
    { x: 0.55, label: '1.2' },
    { x: 1.0, label: '∞' },
  ]
  const bands = [
    { from: 0, to: 0.2, color: '#fdecec', label: 'Liquidatable', sub: 'HF < 1.0', textColor: RED },
    { from: 0.2, to: 0.55, color: '#fff4e1', label: 'Critical', sub: '1.0 ≤ HF < 1.2 · alert', textColor: ORANGE },
    { from: 0.55, to: 1.0, color: '#e6f6ea', label: 'Healthy', sub: 'HF ≥ 1.2 · no action', textColor: GREEN },
  ]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {bands.map((b, i) => (
          <rect
            key={i}
            x={padX + b.from * usable}
            y={yBar}
            width={(b.to - b.from) * usable}
            height={barH}
            fill={b.color}
            stroke={BD}
          />
        ))}
        {stops.map((s, i) => (
          <g key={i}>
            <line x1={padX + s.x * usable} y1={yBar - 8} x2={padX + s.x * usable} y2={yBar + barH + 8} stroke={BD} />
            <text
              x={padX + s.x * usable}
              y={yBar - 14}
              textAnchor="middle"
              fontFamily={FONT_DISPLAY}
              fontSize="11"
              fontWeight="500"
              fill={T1}
            >
              {s.label}
            </text>
          </g>
        ))}
        {bands.map((b, i) => {
          const cx = padX + ((b.from + b.to) / 2) * usable
          return (
            <g key={i}>
              <text
                x={cx}
                y={yBar + barH + 28}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="12"
                fontWeight="600"
                fill={b.textColor}
              >
                {b.label}
              </text>
              <text
                x={cx}
                y={yBar + barH + 44}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="10.5"
                fill={T3}
              >
                {b.sub}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>Below 1.0 the loan dies. Above 1.2 it forgets it was ever in danger.</figcaption>
    </figure>
  )
}

/* 9. Crisis levels — 4 horizontal stages */
export function CuratorCrisisLevels() {
  const W = 880
  const H = 280
  const states = [
    { name: 'NORMAL', accent: GREEN, util: 'Utilization in range, oracles fresh', api: 'Quote API: normal HF requirements' },
    { name: 'ELEVATED', accent: BLUE, util: 'HF warnings or oracle approaching staleness', api: 'Quote API: higher min HF enforced' },
    { name: 'STRESS', accent: ORANGE, util: 'Critical HF or stale oracle', api: 'Quote API: much higher min HF' },
    { name: 'EMERGENCY', accent: RED, util: 'Oracle past max cadence', api: 'Quote API: reject quote' },
  ]
  const cardW = 190
  const cardH = 200
  const gap = 24
  const total = 4 * cardW + 3 * gap
  const startX = (W - total) / 2
  const yTop = 30
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {states.map((s, i) => {
          const x = startX + i * (cardW + gap)
          return (
            <g key={i}>
              <rect x={x} y={yTop} width={cardW} height={cardH} rx={12} fill={BG} stroke={BD} />
              <rect x={x} y={yTop + 8} width={4} height={cardH - 16} rx={2} fill={s.accent} />
              <text
                x={x + 18}
                y={yTop + 30}
                fontFamily={FONT_DISPLAY}
                fontSize="14"
                fontWeight="600"
                letterSpacing="0.04em"
                fill={s.accent}
              >
                {s.name}
              </text>
              {s.util.split(' ').reduce<string[]>((acc, w) => {
                const last = acc[acc.length - 1] ?? ''
                if ((last + ' ' + w).trim().length > 24) acc.push(w)
                else acc[acc.length - 1] = (last + ' ' + w).trim()
                return acc
              }, [''])
                .slice(0, 4)
                .map((line, j) => (
                  <text
                    key={j}
                    x={x + 18}
                    y={yTop + 56 + j * 14}
                    fontFamily={FONT_TEXT}
                    fontSize="11"
                    fill={T2}
                  >
                    {line}
                  </text>
                ))}
              <line x1={x + 14} y1={yTop + 130} x2={x + cardW - 14} y2={yTop + 130} stroke={BD} />
              {s.api.split(' ').reduce<string[]>((acc, w) => {
                const last = acc[acc.length - 1] ?? ''
                if ((last + ' ' + w).trim().length > 24) acc.push(w)
                else acc[acc.length - 1] = (last + ' ' + w).trim()
                return acc
              }, [''])
                .slice(0, 3)
                .map((line, j) => (
                  <text
                    key={j}
                    x={x + 18}
                    y={yTop + 150 + j * 14}
                    fontFamily={FONT_TEXT}
                    fontSize="11"
                    fill={T1}
                  >
                    {line}
                  </text>
                ))}
              {i < 3 ? (
                <line
                  x1={x + cardW}
                  y1={yTop + cardH / 2}
                  x2={x + cardW + gap}
                  y2={yTop + cardH / 2}
                  stroke={BD}
                  markerEnd="url(#resid-arrow)"
                />
              ) : null}
            </g>
          )
        })}
      </svg>
      <figcaption>Four states. Each worse than the last. A market in EMERGENCY does not receive new capital.</figcaption>
    </figure>
  )
}

/* 10. Quote flow — 3 swim lanes */
export function CuratorQuoteFlow() {
  const W = 880
  const H = 540
  const lanes = [
    { x: 130, label: 'Frontend' },
    { x: 440, label: 'Curator Quote API' },
    { x: 750, label: 'Settlement Chain' },
  ]
  const steps = [
    { from: 0, to: 1, label: 'POST /quote' },
    { from: 1, to: 1, label: '1. Authenticate (X-API-Key)' },
    { from: 1, to: 1, label: '2. Look up market config for ITP' },
    { from: 1, to: 1, label: '3. Get BLS data (shared state cache)' },
    { from: 1, to: 2, label: '4. Read on-chain state', detail: 'Oracle price · Market state' },
    { from: 2, to: 1, label: 'state read' },
    { from: 1, to: 1, label: '5. SERM: compute borrow rate' },
    { from: 1, to: 2, label: '6. Push rate to CuratorRateIRM.setRate()' },
    { from: 1, to: 1, label: '7. Build Morpho Bundler calldata' },
    { from: 1, to: 0, label: 'QuoteResponse: terms, rate, calldata' },
  ]
  const top = 80
  const stepGap = 38
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {lanes.map(l => (
          <g key={l.label}>
            <rect x={l.x - 90} y={28} width={180} height={32} rx={16} fill={SF} stroke={BD} />
            <text
              x={l.x}
              y={48}
              textAnchor="middle"
              fontFamily={FONT_DISPLAY}
              fontSize="13"
              fontWeight="600"
              letterSpacing="-0.005em"
              fill={T1}
            >
              {l.label}
            </text>
            <line x1={l.x} y1={64} x2={l.x} y2={H - 20} stroke={BD} strokeDasharray="2 4" />
          </g>
        ))}
        {steps.map((s, i) => {
          const y = top + i * stepGap
          const x1 = lanes[s.from].x
          const x2 = lanes[s.to].x
          if (s.from === s.to) {
            return (
              <g key={i}>
                <rect x={x1 - 110} y={y - 13} width={220} height={26} rx={6} fill={BG} stroke={BLUE} strokeOpacity={0.3} />
                <text
                  x={x1}
                  y={y + 4}
                  textAnchor="middle"
                  fontFamily={FONT_TEXT}
                  fontSize="11"
                  fontWeight="500"
                  fill={T1}
                >
                  {s.label}
                </text>
              </g>
            )
          }
          return (
            <g key={i}>
              <line x1={x1} y1={y} x2={x2} y2={y} stroke={BLUE} strokeWidth={1.3} markerEnd="url(#resid-arrow-blue)" />
              <rect x={(x1 + x2) / 2 - 110} y={y - 12} width={220} height={20} rx={4} fill={BG} />
              <text
                x={(x1 + x2) / 2}
                y={y - 1}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="11"
                fontWeight="500"
                fill={T1}
              >
                {s.label}
              </text>
              {s.detail ? (
                <text
                  x={(x1 + x2) / 2}
                  y={y + 14}
                  textAnchor="middle"
                  fontFamily={FONT_TEXT}
                  fontSize="10.5"
                  fill={T3}
                >
                  {s.detail}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <figcaption>A lending quote is a promise with conditions.</figcaption>
    </figure>
  )
}

/* 11. Shared state — three writers, two readers */
export function CuratorSharedState() {
  const W = 920
  const H = 380
  const writerW = 200
  const readerW = 200
  const stateW = 280
  const stateH = 220
  const stateX = (W - stateW) / 2
  const stateY = (H - stateH) / 2
  const writerX = 30
  const readerX = W - readerW - 30
  const writers = [
    { y: 40, title: 'Health Monitor', sub: 'run_scan()', writes: 'crisis_levels · asset_stress' },
    { y: 220, title: 'Oracle Collector', sub: 'collect_all()', writes: 'cached_bls' },
  ]
  const readers = [
    { y: 40, title: 'Quote API', sub: 'Enforce min HF per level', reads: 'crisis_levels · asset_stress · cached_bls' },
    { y: 220, title: 'Allocation Bot', sub: 'Stress-aware rebalancing', reads: 'crisis_levels · asset_stress' },
  ]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {/* central state box */}
        <rect x={stateX} y={stateY} width={stateW} height={stateH} rx={12} fill={SF} stroke={BD} />
        <text
          x={stateX + stateW / 2}
          y={stateY + 26}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={T1}
        >
          SharedCuratorState
        </text>
        {[
          'crisis_levels: { mkt_id: Level }',
          'asset_stress: { addr: score }',
          'cached_bls: { price, sig,',
          '  cycle, bitmask, cached_at }',
        ].map((line, i) => (
          <text
            key={i}
            x={stateX + 18}
            y={stateY + 56 + i * 18}
            fontFamily={FONT_TEXT}
            fontSize="12"
            fill={T2}
          >
            {line}
          </text>
        ))}
        {writers.map((w, i) => (
          <g key={i}>
            <ServiceCard x={writerX} y={w.y} w={writerW} h={86} title={w.title} sub={w.sub} accent={ORANGE} />
            <line
              x1={writerX + writerW}
              y1={w.y + 43}
              x2={stateX}
              y2={w.y + 43}
              stroke={ORANGE}
              markerEnd="url(#resid-arrow-orange)"
            />
            <text
              x={(writerX + writerW + stateX) / 2}
              y={w.y + 38}
              textAnchor="middle"
              fontFamily={FONT_TEXT}
              fontSize="10.5"
              fill={T3}
            >
              write
            </text>
          </g>
        ))}
        {readers.map((r, i) => (
          <g key={i}>
            <ServiceCard x={readerX} y={r.y} w={readerW} h={86} title={r.title} sub={r.sub} accent={BLUE} />
            <line
              x1={stateX + stateW}
              y1={r.y + 43}
              x2={readerX}
              y2={r.y + 43}
              stroke={BLUE}
              markerEnd="url(#resid-arrow-blue)"
            />
            <text
              x={(stateX + stateW + readerX) / 2}
              y={r.y + 38}
              textAnchor="middle"
              fontFamily={FONT_TEXT}
              fontSize="10.5"
              fill={T3}
            >
              read
            </text>
          </g>
        ))}
      </svg>
      <figcaption>Writers produce. Readers consume. The lock mediates.</figcaption>
    </figure>
  )
}

/* 12. Alert dispatcher */
export function CuratorAlertDispatcher() {
  const W = 880
  const H = 360
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        <ServiceCard x={40} y={H / 2 - 50} w={200} h={100} title="HealthReport" sub={'alerts[]\ncrisis_levels'} accent={ORANGE} />
        <line x1={240} y1={H / 2} x2={300} y2={H / 2} stroke={BD} markerEnd="url(#resid-arrow)" />
        <ServiceCard
          x={300}
          y={H / 2 - 60}
          w={240}
          h={120}
          title="AlertDispatcher"
          sub={'Tracks previous crisis levels\nFires only on transitions\n(not every scan)'}
          accent={BLUE}
        />
        <line x1={540} y1={H / 2 - 24} x2={620} y2={H / 2 - 24} stroke={BD} markerEnd="url(#resid-arrow)" />
        <line x1={540} y1={H / 2 + 24} x2={620} y2={H / 2 + 24} stroke={BD} markerEnd="url(#resid-arrow)" />
        <ServiceCard
          x={620}
          y={50}
          w={220}
          h={110}
          title="TelegramAlerter"
          sub={'POST api.telegram.org\nbot_token + chat_id'}
          accent={GREEN}
        />
        <ServiceCard
          x={620}
          y={H - 160}
          w={220}
          h={110}
          title="LogAlerter (fallback)"
          sub={'tracing::warn\ntracing::error'}
          accent={T3}
        />
      </svg>
      <figcaption>Alerts fire on transitions, not on every scan. The dispatcher remembers what it already said.</figcaption>
    </figure>
  )
}

/* 13. Curator end-to-end data flow */
export function CuratorEndToEndFlow() {
  const W = 1000
  const H = 660
  const oracleW = 180
  const oracleH = 80
  const oracleY = 30
  const oracleGap = 40
  const totalOracles = 3 * oracleW + 2 * oracleGap
  const oraclesX = (W - totalOracles) / 2
  const curatorBoxX = 80
  const curatorBoxY = 170
  const curatorBoxW = 480
  const curatorBoxH = 460
  const externalX = curatorBoxX + curatorBoxW + 60
  const internals = [
    { y: 200, title: 'NavCollector', accent: BLUE },
    { y: 254, title: 'OraclePusher', accent: BLUE },
    { y: 308, title: 'SharedState', accent: ORANGE },
    { y: 372, title: 'QuoteAPI · SERM · QuoteResponse', accent: BLUE },
    { y: 460, title: 'HealthMonitor · Alerts', accent: ORANGE },
    { y: 540, title: 'AllocBot · reallocate', accent: GREEN },
  ]
  const externals = [
    { y: 254, title: 'ITPNAVOracle.sol' },
    { y: 372, title: 'CuratorRateIRM.sol' },
    { y: 460, title: 'Telegram' },
    { y: 540, title: 'MetaMorpho Vault' },
  ]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {[0, 1, 2].map(i => {
          const x = oraclesX + i * (oracleW + oracleGap)
          return (
            <g key={i}>
              <rect x={x} y={oracleY} width={oracleW} height={oracleH} rx={12} fill={BG} stroke={BD} />
              <rect x={x} y={oracleY + 8} width={4} height={oracleH - 16} rx={2} fill={GREEN} />
              <text
                x={x + 18}
                y={oracleY + 26}
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                fill={T1}
              >
                Oracle {i + 1}
              </text>
              <text x={x + 18} y={oracleY + 46} fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
                Compute NAV
              </text>
              <text x={x + 18} y={oracleY + 62} fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
                BLS sign
              </text>
              <line
                x1={x + oracleW / 2}
                y1={oracleY + oracleH}
                x2={curatorBoxX + curatorBoxW / 2}
                y2={curatorBoxY}
                stroke={BD}
                markerEnd="url(#resid-arrow)"
              />
            </g>
          )
        })}
        {/* curator box */}
        <rect x={curatorBoxX} y={curatorBoxY} width={curatorBoxW} height={curatorBoxH} rx={16} fill={SF} stroke={BD} />
        <text
          x={curatorBoxX + 18}
          y={curatorBoxY + 24}
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.04em"
          fill={T2}
        >
          CURATOR (UNIFIED)
        </text>
        {internals.map((it, i) => (
          <g key={i}>
            <rect x={curatorBoxX + 18} y={it.y} width={curatorBoxW - 36} height={36} rx={8} fill={BG} stroke={BD} />
            <rect x={curatorBoxX + 18} y={it.y + 6} width={3} height={24} rx={1.5} fill={it.accent} />
            <text
              x={curatorBoxX + 32}
              y={it.y + 22}
              fontFamily={FONT_DISPLAY}
              fontSize="13"
              fontWeight="600"
              fill={T1}
            >
              {it.title}
            </text>
          </g>
        ))}
        {externals.map((e, i) => (
          <g key={i}>
            <rect x={externalX} y={e.y} width={240} height={48} rx={12} fill={BG} stroke={BD} />
            <text
              x={externalX + 16}
              y={e.y + 30}
              fontFamily={FONT_DISPLAY}
              fontSize="13"
              fontWeight="600"
              fill={T1}
            >
              {e.title}
            </text>
          </g>
        ))}
        {/* arrows from internals to externals */}
        {[
          { from: 254, to: 0 },
          { from: 372, to: 1 },
          { from: 460, to: 2 },
          { from: 540, to: 3 },
        ].map((m, i) => (
          <line
            key={i}
            x1={curatorBoxX + curatorBoxW - 18}
            y1={m.from + 18}
            x2={externalX}
            y2={externals[m.to].y + 24}
            stroke={BD}
            markerEnd="url(#resid-arrow)"
          />
        ))}
      </svg>
      <figcaption>From oracle NAV to lending quote. Every arrow is a dependency. Every dependency a risk.</figcaption>
    </figure>
  )
}

/* ──────────────────────────── data-node.mdx ──────────────────────────── */

/* 14. Collector architecture — sources → engines → batch writer → pg */
export function DataNodeCollectorArchitecture() {
  const W = 980
  const H = 440
  const colW = 200
  const colGap = 36
  const c1X = 40
  const c2X = c1X + colW + colGap
  const c3X = c2X + colW + colGap
  const c4X = c3X + colW + colGap
  const sourceList = ['finnhub', 'earthquake', 'twitch', 'volcano', 'reddit', 'steam', '+85 more']
  const enginesList = ['SyncEngine', 'SyncEngine', 'SyncEngine', 'SyncEngine', 'SyncEngine', 'SyncEngine', '…']
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {[
          { x: c1X, label: 'Source APIs' },
          { x: c2X, label: 'spawn_resilient' },
          { x: c3X, label: 'BatchWriter' },
          { x: c4X, label: 'PostgreSQL' },
        ].map(c => (
          <text
            key={c.label}
            x={c.x + colW / 2}
            y={28}
            textAnchor="middle"
            fontFamily={FONT_DISPLAY}
            fontSize="12"
            fontWeight="600"
            letterSpacing="0.04em"
            fill={T2}
          >
            {c.label.toUpperCase()}
          </text>
        ))}
        {/* Sources column */}
        <rect x={c1X} y={50} width={colW} height={300} rx={12} fill={BG} stroke={BD} />
        {sourceList.map((s, i) => (
          <text
            key={s}
            x={c1X + 16}
            y={78 + i * 36}
            fontFamily={FONT_TEXT}
            fontSize="13"
            fill={i === 6 ? T3 : T1}
          >
            {s}
          </text>
        ))}
        {/* Engines column */}
        <rect x={c2X} y={50} width={colW} height={300} rx={12} fill={BG} stroke={BD} />
        {enginesList.map((s, i) => (
          <text
            key={i}
            x={c2X + 16}
            y={78 + i * 36}
            fontFamily={FONT_TEXT}
            fontSize="13"
            fill={i === 6 ? T3 : T1}
          >
            {s}
          </text>
        ))}
        {/* arrows source -> engine */}
        {sourceList.slice(0, 6).map((_, i) => (
          <line
            key={i}
            x1={c1X + colW}
            y1={74 + i * 36}
            x2={c2X}
            y2={74 + i * 36}
            stroke={BD}
            markerEnd="url(#resid-arrow)"
          />
        ))}
        {/* BatchWriter */}
        <rect x={c3X} y={120} width={colW} height={140} rx={12} fill={SF} stroke={BD} />
        <text
          x={c3X + colW / 2}
          y={150}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={T1}
        >
          Batched INSERT Channel
        </text>
        <text x={c3X + colW / 2} y={172} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
          mpsc + coalesce
        </text>
        <text x={c3X + colW / 2} y={196} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
          coalesces inserts —
        </text>
        <text x={c3X + colW / 2} y={210} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
          PostgreSQL has limits
        </text>
        <text x={c3X + colW / 2} y={224} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>
          even if the world does not
        </text>
        {/* arrows engines -> batchwriter */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <line
            key={i}
            x1={c2X + colW}
            y1={74 + i * 36}
            x2={c3X}
            y2={190}
            stroke={BD}
            markerEnd="url(#resid-arrow)"
          />
        ))}
        {/* PostgreSQL column */}
        <rect x={c4X} y={120} width={colW} height={140} rx={12} fill={BG} stroke={BD} />
        <rect x={c4X} y={128} width={4} height={124} rx={2} fill={BLUE} />
        <text
          x={c4X + 18}
          y={150}
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          fill={T1}
        >
          market_prices
        </text>
        <text x={c4X + 18} y={172} fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
          full history per source
        </text>
        <text
          x={c4X + 18}
          y={206}
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          fill={T1}
        >
          market_prices_latest
        </text>
        <text x={c4X + 18} y={228} fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
          materialized snapshot
        </text>
        <line x1={c3X + colW} y1={190} x2={c4X} y2={190} stroke={BD} markerEnd="url(#resid-arrow)" />
        {/* Broadcast hub branch */}
        <rect x={c3X} y={290} width={colW} height={70} rx={12} fill={BG} stroke={BD} />
        <rect x={c3X} y={298} width={4} height={54} rx={2} fill={GREEN} />
        <text
          x={c3X + 18}
          y={316}
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          fill={T1}
        >
          Broadcast Hub (WS)
        </text>
        <text x={c3X + 18} y={336} fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
          live streams to subscribers
        </text>
        <line
          x1={c2X + colW / 2}
          y1={340}
          x2={c3X}
          y2={325}
          stroke={BD}
          markerEnd="url(#resid-arrow)"
        />
      </svg>
      <figcaption>Every source is an independent task. When one panics, the supervisor restarts it. The source does not know it died.</figcaption>
    </figure>
  )
}

/* 15. Chain pollers — L3 + Settlement → ChainCache → REST */
export function DataNodeChainPollers() {
  const W = 920
  const H = 480
  const l3X = 60
  const settleX = 540
  const cacheY = 280
  const apiY = 400
  const l3Items = [
    'Index.sol',
    '  ├─ getITPState()',
    '  ├─ getUserShares()',
    '  ├─ getOrder()',
    '  ├─ nextOrderId()',
    '  └─ FillConfirmed events',
    'Oracle.sol',
    '  ├─ currentPrice()',
    '  └─ lastCycleNumber()',
    'OracleRegistry',
    '  └─ oracle status',
  ]
  const settleItems = ['USDC balances', 'Allowances', 'Morpho positions', 'Bridge proxy']
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        <rect x={l3X} y={20} width={400} height={240} rx={12} fill={BG} stroke={BD} />
        <rect x={l3X} y={28} width={4} height={224} rx={2} fill={BLUE} />
        <text
          x={l3X + 18}
          y={44}
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.04em"
          fill={T2}
        >
          L3 ORBIT CHAIN (111222333)
        </text>
        {l3Items.map((line, i) => (
          <text
            key={i}
            x={l3X + 18}
            y={70 + i * 17}
            fontFamily={FONT_TEXT}
            fontSize="12"
            fill={line.startsWith('  ') ? T2 : T1}
            fontWeight={line.startsWith('  ') ? '400' : '600'}
          >
            {line}
          </text>
        ))}
        <rect x={settleX} y={20} width={320} height={140} rx={12} fill={BG} stroke={BD} />
        <rect x={settleX} y={28} width={4} height={124} rx={2} fill={ORANGE} />
        <text
          x={settleX + 18}
          y={44}
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.04em"
          fill={T2}
        >
          SETTLEMENT CHAIN
        </text>
        {settleItems.map((line, i) => (
          <text
            key={i}
            x={settleX + 18}
            y={72 + i * 18}
            fontFamily={FONT_TEXT}
            fontSize="13"
            fill={T1}
          >
            {line}
          </text>
        ))}
        {/* ChainCache */}
        <rect x={l3X} y={cacheY} width={W - 2 * l3X} height={80} rx={12} fill={SF} stroke={BD} />
        <text
          x={W / 2}
          y={cacheY + 26}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={T1}
        >
          ChainCache (in-memory)
        </text>
        <text
          x={W / 2}
          y={cacheY + 50}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="12"
          fill={T2}
        >
          NavSnapshot · UserBalances · UserOrders · MorphoPositions · FillRecords · Oracles
        </text>
        <line x1={l3X + 200} y1={260} x2={l3X + 200} y2={cacheY} stroke={BD} markerEnd="url(#resid-arrow)" />
        <line x1={settleX + 160} y1={160} x2={settleX + 160} y2={cacheY} stroke={BD} markerEnd="url(#resid-arrow)" />
        {/* REST API */}
        <rect x={W / 2 - 160} y={apiY} width={320} height={56} rx={12} fill={BG} stroke={BD} />
        <rect x={W / 2 - 160} y={apiY + 8} width={4} height={40} rx={2} fill={GREEN} />
        <text
          x={W / 2}
          y={apiY + 30}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={T1}
        >
          REST API
        </text>
        <text
          x={W / 2}
          y={apiY + 46}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="11"
          fill={T2}
        >
          serves cached chain state
        </text>
        <line x1={W / 2} y1={cacheY + 80} x2={W / 2} y2={apiY} stroke={BD} markerEnd="url(#resid-arrow)" />
      </svg>
      <figcaption>The chain is the source of truth; the cache is the speed.</figcaption>
    </figure>
  )
}

/* 16. PostgreSQL schema — five groups in a frame */
export function DataNodeSchema() {
  const W = 980
  const H = 580
  const groups = [
    {
      x: 40,
      y: 60,
      title: 'MARKET DATA (Vision sources)',
      accent: BLUE,
      tables: [
        { name: 'market_prices', sub: 'source · asset_id · value · change_pct · volume · fetched_at' },
        { name: 'market_prices_latest', sub: 'materialized latest per asset' },
        { name: 'market_assets', sub: 'source registry' },
      ],
    },
    {
      x: 510,
      y: 60,
      title: 'ITP / PORTFOLIO',
      accent: GREEN,
      tables: [
        { name: 'itp_snapshots', sub: 'itp_id · nav · supply · weights' },
        { name: 'trades', sub: 'order fills · prices · amounts' },
        { name: 'klines', sub: 'OHLCV candles' },
        { name: 'liquidity', sub: 'orderbook depth' },
      ],
    },
    {
      x: 40,
      y: 280,
      title: 'COINGECKO',
      accent: ORANGE,
      tables: [
        { name: 'coingecko_market_caps', sub: 'monthly cap snapshots' },
        { name: 'coingecko_categories', sub: 'category membership' },
        { name: 'bitget_listings', sub: 'listing/delisting dates' },
      ],
    },
    {
      x: 510,
      y: 280,
      title: 'DEFI LLAMA',
      accent: ORANGE,
      tables: [
        { name: 'defillama_protocols', sub: 'protocol metadata' },
        { name: 'defillama_metrics', sub: 'TVL · fees · volume' },
        { name: 'defillama_raises', sub: 'fundraising rounds' },
      ],
    },
    {
      x: 40,
      y: 440,
      title: 'SIMULATION & MISC',
      accent: T3,
      tables: [
        { name: 'simulations', sub: 'cached backtester results' },
        { name: 'fng_index · github_metrics', sub: 'index + repo data' },
        { name: 'batch_tables', sub: 'Vision batch state' },
      ],
    },
    {
      x: 510,
      y: 440,
      title: 'SYSTEM',
      accent: T3,
      tables: [
        { name: 'collector_cursors', sub: 'last block per collector' },
        { name: 'oracle_health_snaps', sub: 'oracle node status' },
      ],
    },
  ]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        <rect x={20} y={20} width={W - 40} height={H - 40} rx={16} fill={SF} stroke={BD} />
        <text
          x={W / 2}
          y={44}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.04em"
          fill={T2}
        >
          POSTGRESQL SCHEMA — 25 MIGRATIONS, 15 TABLES
        </text>
        {groups.map((g, i) => (
          <g key={i}>
            <text
              x={g.x}
              y={g.y - 10}
              fontFamily={FONT_DISPLAY}
              fontSize="12"
              fontWeight="600"
              letterSpacing="0.04em"
              fill={T2}
            >
              {g.title}
            </text>
            <rect x={g.x} y={g.y} width={420} height={28 + g.tables.length * 32} rx={12} fill={BG} stroke={BD} />
            <rect x={g.x} y={g.y + 8} width={4} height={28 + g.tables.length * 32 - 16} rx={2} fill={g.accent} />
            {g.tables.map((t, j) => (
              <g key={j}>
                <text
                  x={g.x + 18}
                  y={g.y + 28 + j * 32}
                  fontFamily={FONT_DISPLAY}
                  fontSize="13"
                  fontWeight="600"
                  fill={T1}
                >
                  {t.name}
                </text>
                <text
                  x={g.x + 18}
                  y={g.y + 44 + j * 32}
                  fontFamily={FONT_TEXT}
                  fontSize="11"
                  fill={T2}
                >
                  {t.sub}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
      <figcaption>The schema is a fossil record of every feature that survived.</figcaption>
    </figure>
  )
}

/* 17. WebSocket flow */
export function DataNodeWebSocketFlow() {
  const W = 880
  const H = 320
  const lanes = [
    { x: 140, label: 'Client' },
    { x: 440, label: 'Data Node · WS Handler' },
    { x: 740, label: 'SyncEngine ×91' },
  ]
  const messages = [
    { y: 90, from: 0, to: 1, label: 'subscribe [42, 77]' },
    { y: 130, from: 2, to: 1, label: 'broadcast PriceBatch', dashed: true },
    { y: 180, from: 1, to: 0, label: 'prices { batchId: 42, markets: [..] }' },
    { y: 240, from: 0, to: 1, label: 'unsubscribe [42]' },
  ]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {lanes.map(l => (
          <g key={l.label}>
            <rect x={l.x - 110} y={28} width={220} height={32} rx={16} fill={SF} stroke={BD} />
            <text
              x={l.x}
              y={48}
              textAnchor="middle"
              fontFamily={FONT_DISPLAY}
              fontSize="13"
              fontWeight="600"
              letterSpacing="-0.005em"
              fill={T1}
            >
              {l.label}
            </text>
            <line x1={l.x} y1={64} x2={l.x} y2={H - 20} stroke={BD} strokeDasharray="2 4" />
          </g>
        ))}
        {messages.map((m, i) => {
          const x1 = lanes[m.from].x
          const x2 = lanes[m.to].x
          return (
            <g key={i}>
              <line
                x1={x1}
                y1={m.y}
                x2={x2}
                y2={m.y}
                stroke={BLUE}
                strokeWidth={1.3}
                strokeDasharray={m.dashed ? '4 3' : undefined}
                markerEnd="url(#resid-arrow-blue)"
              />
              <rect
                x={(x1 + x2) / 2 - 130}
                y={m.y - 12}
                width={260}
                height={20}
                rx={4}
                fill={BG}
              />
              <text
                x={(x1 + x2) / 2}
                y={m.y - 1}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="11"
                fontWeight="500"
                fill={T1}
              >
                {m.label}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>Subscribe to batch IDs. Receive prices as they arrive. Unsubscribe when you have had enough.</figcaption>
    </figure>
  )
}

/* 18. SimDataCache — labeled list */
export function DataNodeSimDataCache() {
  const W = 760
  const H = 460
  const fields = [
    { k: 'all_dates', v: 'Vec<NaiveDate>' },
    { k: 'category_coins', v: 'HashMap<cat, coins>' },
    { k: 'coin_symbol_map', v: 'HashMap<id, symbol>' },
    { k: 'bitget_lookup', v: 'HashMap<symbol, pair>' },
    { k: 'prices', v: 'HashMap<(coin, date), f>' },
    { k: 'mcap_rankings', v: 'HashMap<date, ranks>' },
    { k: 'categories', v: 'Vec<Category>' },
    { k: 'defi_metrics', v: 'HashMap<proto, tvl>' },
    { k: 'defi_history', v: 'HashMap<proto, ts>' },
    { k: 'fng_index', v: 'HashMap<date, score>' },
    { k: 'btc_dominance', v: 'HashMap<date, pct>' },
    { k: 'eth_dominance', v: 'HashMap<date, pct>' },
  ]
  const rowH = 28
  const startY = 70
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        <rect x={40} y={30} width={W - 80} height={H - 60} rx={12} fill={SF} stroke={BD} />
        <text
          x={W / 2}
          y={56}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.04em"
          fill={T2}
        >
          SimDataCache (in-memory)
        </text>
        {fields.map((f, i) => (
          <g key={i}>
            <text
              x={70}
              y={startY + i * rowH}
              fontFamily="SF Mono, Menlo, monospace"
              fontSize="12.5"
              fontWeight="600"
              fill={T1}
            >
              {f.k}
            </text>
            <text
              x={290}
              y={startY + i * rowH}
              fontFamily="SF Mono, Menlo, monospace"
              fontSize="12.5"
              fill={T2}
            >
              {f.v}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>Loaded at startup. Reloaded every 24 hours. Always warm.</figcaption>
    </figure>
  )
}

/* ──────────────────────────── l3-chain.mdx ──────────────────────────── */

/* 19. L3 chain topology — one frame, 5 categories */
export function L3ChainTopology() {
  const W = 940
  const H = 520
  const groups = [
    {
      x: 40,
      y: 60,
      w: W - 80,
      h: 80,
      title: 'CORE PROTOCOL',
      accent: BLUE,
      items: ['Index.sol', 'Governance.sol', 'OracleRegistry.sol'],
    },
    {
      x: 40,
      y: 160,
      w: W - 80,
      h: 80,
      title: 'ITP ECOSYSTEM',
      accent: BLUE,
      items: ['ITP Vaults (ERC-4626)', 'Bridged ITP Factory'],
    },
    {
      x: 40,
      y: 260,
      w: W - 80,
      h: 80,
      title: 'PREDICTION MARKETS',
      accent: GREEN,
      items: ['Vision (batches · bitmaps · ticks · bot registry)'],
    },
    {
      x: 40,
      y: 360,
      w: W - 80,
      h: 80,
      title: 'LENDING',
      accent: ORANGE,
      items: ['Morpho (core)', 'ITP NAV Oracle (collateral pricing)'],
    },
    {
      x: 40,
      y: 460,
      w: W - 80,
      h: 50,
      title: 'BRIDGE',
      accent: T3,
      items: ['L3BridgeCustody', 'L3BridgeProxy'],
    },
  ]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        <rect x={20} y={20} width={W - 40} height={20} rx={6} fill={SF} stroke={BD} />
        <text
          x={W / 2}
          y={34}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="12"
          fontWeight="600"
          letterSpacing="0.04em"
          fill={T2}
        >
          INDEX L3 — CHAIN 111222333
        </text>
        {groups.map((g, i) => {
          const itemW = (g.w - 32 - (g.items.length - 1) * 16) / g.items.length
          return (
            <g key={i}>
              <text
                x={g.x}
                y={g.y - 10}
                fontFamily={FONT_DISPLAY}
                fontSize="12"
                fontWeight="600"
                letterSpacing="0.04em"
                fill={T2}
              >
                {g.title}
              </text>
              {g.items.map((item, j) => {
                const x = g.x + 16 + j * (itemW + 16)
                const h = g.h - 16
                return (
                  <g key={j}>
                    <rect x={x} y={g.y} width={itemW} height={h} rx={12} fill={BG} stroke={BD} />
                    <rect x={x} y={g.y + 8} width={4} height={h - 16} rx={2} fill={g.accent} />
                    <text
                      x={x + 18}
                      y={g.y + h / 2 + 5}
                      fontFamily={FONT_DISPLAY}
                      fontSize="13"
                      fontWeight="600"
                      letterSpacing="-0.005em"
                      fill={T1}
                    >
                      {item}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      <figcaption>Everything that matters to the protocol runs here.</figcaption>
    </figure>
  )
}

/* ──────────────────────────── contract-addresses.mdx ──────────────────────────── */

/* 20. Contract addresses registry — L3 above, Settlement below, bridge in between */
export function ContractAddressesRegistry() {
  const W = 940
  const H = 580
  const l3 = [
    ['Index', 'Governance', 'OracleRegistry'],
    ['CollateralRegistry', 'BLSCustody'],
    ['L3BridgeCustody', 'L3BridgeProxy'],
    ['L3BridgedItpFactory', 'Vision'],
    ['ITP Vault #1', 'ITP Vault #2'],
    ['L3 WUSDC (18 dec)'],
  ]
  const settlement = [
    ['SettlementBridgeProxy', 'SettlementBridgeCustody'],
    ['SettlementBridgedItpFactory', 'SettlementOracleRegistry'],
    ['Settlement USDC (6 dec)'],
  ]
  const padX = 40
  const usable = W - 2 * padX
  const cardH = 50
  const cardGap = 12
  const rowGap = 14
  const headerH = 32
  let y = 30
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
        <Defs />
        {/* L3 group */}
        <rect x={padX - 14} y={y} width={usable + 28} height={l3.length * (cardH + rowGap) + headerH + 12} rx={16} fill={SF} stroke={BD} />
        <text
          x={W / 2}
          y={y + 22}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.04em"
          fill={T2}
        >
          INDEX L3 — CHAIN 111222333
        </text>
        {(() => {
          let yy = y + headerH
          return l3.map((row, ri) => {
            const itemW = (usable - (row.length - 1) * cardGap) / row.length
            const node = (
              <g key={ri}>
                {row.map((name, ci) => {
                  const x = padX + ci * (itemW + cardGap)
                  return (
                    <g key={ci}>
                      <rect x={x} y={yy} width={itemW} height={cardH} rx={12} fill={BG} stroke={BD} />
                      <rect x={x} y={yy + 8} width={4} height={cardH - 16} rx={2} fill={BLUE} />
                      <text
                        x={x + 18}
                        y={yy + cardH / 2 + 5}
                        fontFamily={FONT_DISPLAY}
                        fontSize="13"
                        fontWeight="600"
                        letterSpacing="-0.005em"
                        fill={T1}
                      >
                        {name}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
            yy += cardH + rowGap
            return node
          })
        })()}
        {/* bridge separator */}
        {(() => {
          const yBridge = y + headerH + l3.length * (cardH + rowGap) + 14
          y = yBridge
          return (
            <g>
              <line x1={padX} y1={yBridge + 14} x2={W - padX} y2={yBridge + 14} stroke={BD} strokeDasharray="4 4" />
              <rect x={W / 2 - 60} y={yBridge} width={120} height={28} rx={12} fill={BG} stroke={BD} />
              <text
                x={W / 2}
                y={yBridge + 19}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="12"
                fontWeight="600"
                letterSpacing="0.04em"
                fill={T2}
              >
                BRIDGE
              </text>
            </g>
          )
        })()}
        {/* Settlement group */}
        {(() => {
          const ySettle = y + 50
          const settleH = settlement.length * (cardH + rowGap) + headerH + 12
          return (
            <g>
              <rect x={padX - 14} y={ySettle} width={usable + 28} height={settleH} rx={16} fill={SF} stroke={BD} />
              <text
                x={W / 2}
                y={ySettle + 22}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                letterSpacing="0.04em"
                fill={T2}
              >
                SETTLEMENT — CHAIN 14601
              </text>
              {(() => {
                let yy = ySettle + headerH
                return settlement.map((row, ri) => {
                  const itemW = (usable - (row.length - 1) * cardGap) / row.length
                  const node = (
                    <g key={ri}>
                      {row.map((name, ci) => {
                        const x = padX + ci * (itemW + cardGap)
                        return (
                          <g key={ci}>
                            <rect x={x} y={yy} width={itemW} height={cardH} rx={12} fill={BG} stroke={BD} />
                            <rect x={x} y={yy + 8} width={4} height={cardH - 16} rx={2} fill={ORANGE} />
                            <text
                              x={x + 18}
                              y={yy + cardH / 2 + 5}
                              fontFamily={FONT_DISPLAY}
                              fontSize="13"
                              fontWeight="600"
                              letterSpacing="-0.005em"
                              fill={T1}
                            >
                              {name}
                            </text>
                          </g>
                        )
                      })}
                    </g>
                  )
                  yy += cardH + rowGap
                  return node
                })
              })()}
            </g>
          )
        })()}
      </svg>
      <figcaption>The addresses are the protocol. Everything else is explanation.</figcaption>
    </figure>
  )
}
