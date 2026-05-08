import * as React from 'react'

/* ─────────────────────────────────────────────────────────────
   Apple-style SVG replacements for mermaid fenced blocks in
   the docs MDX. One named export per diagram. All parameterless,
   all server-renderable. Self-contained — no cross-file imports.
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
const APPLE_RED = '#ff3b30'

const FONT_DISPLAY = '"SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
const FONT_TEXT = '"SF Pro Text", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif'

type Accent = 'blue' | 'green' | 'orange' | 'red' | 'gray'
const accentHex = (a: Accent): string =>
  a === 'blue' ? APPLE_BLUE
  : a === 'green' ? APPLE_GREEN
  : a === 'orange' ? APPLE_ORANGE
  : a === 'red' ? APPLE_RED
  : APPLE_TEXT_3

/* Reusable primitives ---------------------------------------------- */

type BoxProps = {
  x: number
  y: number
  w: number
  h: number
  title: string
  sub?: string
  accent?: Accent
  italic?: boolean
}

function Box({ x, y, w, h, title, sub, accent = 'gray', italic }: BoxProps) {
  const c = accentHex(accent)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={APPLE_BG} stroke={APPLE_BORDER} />
      <rect x={x} y={y} width={4} height={h} rx={2} fill={c} />
      <text
        x={x + 16}
        y={sub ? y + h / 2 - 2 : y + h / 2 + 5}
        fontFamily={FONT_DISPLAY}
        fontSize="13"
        fontWeight="600"
        fontStyle={italic ? 'italic' : 'normal'}
        letterSpacing="-0.005em"
        fill={APPLE_TEXT}
      >
        {title}
      </text>
      {sub ? (
        <text
          x={x + 16}
          y={y + h / 2 + 14}
          fontFamily={FONT_TEXT}
          fontSize="11.5"
          fill={APPLE_TEXT_2}
        >
          {sub}
        </text>
      ) : null}
    </g>
  )
}

type DiamondProps = {
  cx: number
  cy: number
  w: number
  h: number
  text: string
  accent?: Accent
}

function Diamond({ cx, cy, w, h, text, accent = 'gray' }: DiamondProps) {
  const c = accentHex(accent)
  const points = `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`
  return (
    <g>
      <polygon
        points={points}
        fill={APPLE_BG}
        stroke={c}
        strokeOpacity="0.35"
        strokeWidth={1.25}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontFamily={FONT_TEXT}
        fontSize="11.5"
        fontStyle="italic"
        fill={APPLE_TEXT}
      >
        {text}
      </text>
    </g>
  )
}

type ArrowProps = {
  x1: number
  y1: number
  x2: number
  y2: number
  label?: string
  accent?: Accent
  curve?: boolean
  labelBg?: boolean
  labelOffset?: number
  markerId: string
}

function Arrow({ x1, y1, x2, y2, label, accent = 'gray', curve = true, labelBg = true, labelOffset = -4, markerId }: ArrowProps) {
  const color = accentHex(accent)
  const my = (y1 + y2) / 2
  const d = curve
    ? `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`
    : `M${x1},${y1} L${x2},${y2}`
  const lx = (x1 + x2) / 2
  const ly = my + labelOffset
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} markerEnd={`url(#${markerId})`} />
      {label ? (
        <>
          {labelBg ? (
            <rect
              x={lx - label.length * 3.6 - 6}
              y={ly - 9}
              width={label.length * 7.2 + 12}
              height={16}
              rx={4}
              fill={APPLE_BG}
              opacity={0.96}
            />
          ) : null}
          <text
            x={lx}
            y={ly + 3}
            textAnchor="middle"
            fontFamily={FONT_TEXT}
            fontSize="11"
            fill={APPLE_TEXT_2}
          >
            {label}
          </text>
        </>
      ) : null}
    </g>
  )
}

function Marker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  )
}

function Subgraph({
  x,
  y,
  w,
  h,
  label,
  tone = 'surface',
}: {
  x: number
  y: number
  w: number
  h: number
  label: string
  tone?: 'surface' | 'tint-blue' | 'tint-green'
}) {
  const fill = tone === 'tint-blue' ? '#f2f7fe' : tone === 'tint-green' ? '#f1faf3' : APPLE_SURFACE
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={fill} stroke={APPLE_BORDER} />
      <text
        x={x + 16}
        y={y + 20}
        fontFamily={FONT_TEXT}
        fontSize="11"
        fontWeight="600"
        style={{ textTransform: 'uppercase' }}
        letterSpacing="0.08em"
        fill={APPLE_TEXT_3}
      >
        {label.toUpperCase()}
      </text>
    </g>
  )
}

/* ─────────────────────────────────────────────────────────────
   1. BotOverviewLifecycle
   File: vision/bots/overview.mdx
   Source: flowchart TD with three subgraphs (Bot, OnChain, OffChain)
   ─────────────────────────────────────────────────────────── */

export function BotOverviewLifecycle() {
  const W = 760
  const H = 540

  // Subgraph: Bot (left column, 4 boxes)
  const botX = 30
  const botY = 30
  const botW = 240
  const botH = 360
  const botBoxX = botX + 24
  const botBoxW = botW - 48

  // Subgraph: OnChain (top right)
  const ocX = 360
  const ocY = 30
  const ocW = 360
  const ocH = 130

  // Subgraph: OffChain (bottom right)
  const offX = 360
  const offY = 220
  const offW = 360
  const offH = 170

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vision bot lifecycle: poll, predict, sign, commit, claim">
        <defs>
          <Marker id="bot-arr-gray" color={APPLE_TEXT_3} />
          <Marker id="bot-arr-blue" color={APPLE_BLUE} />
          <Marker id="bot-arr-green" color={APPLE_GREEN} />
          <Marker id="bot-arr-orange" color={APPLE_ORANGE} />
        </defs>

        <Subgraph x={botX} y={botY} w={botW} h={botH} label="Vision Bot" tone="tint-blue" />
        <Box x={botBoxX} y={botY + 40} w={botBoxW} h={64} title="Poll /vision/blocks" sub="HTTP every 30s" accent="blue" />
        <Box x={botBoxX} y={botY + 124} w={botBoxW} h={64} title="Generate predictions" sub="UP / DOWN per market" accent="blue" />
        <Box x={botBoxX} y={botY + 208} w={botBoxW} h={64} title="Encode bitmap" sub="big-endian bit packing" accent="blue" />
        <Box x={botBoxX} y={botY + 292} w={botBoxW} h={64} title="keccak256 hash" sub="commitment seal" accent="blue" />

        <Arrow x1={botBoxX + botBoxW / 2} y1={botY + 104} x2={botBoxX + botBoxW / 2} y2={botY + 124} markerId="bot-arr-gray" />
        <Arrow x1={botBoxX + botBoxW / 2} y1={botY + 188} x2={botBoxX + botBoxW / 2} y2={botY + 208} markerId="bot-arr-gray" />
        <Arrow x1={botBoxX + botBoxW / 2} y1={botY + 272} x2={botBoxX + botBoxW / 2} y2={botY + 292} markerId="bot-arr-gray" />

        <Subgraph x={ocX} y={ocY} w={ocW} h={ocH} label="On-Chain  ·  Index L3" tone="tint-green" />
        <Box x={ocX + 60} y={ocY + 44} w={240} h={64} title="Vision contract" sub="joinBatch(bitmapHash)  ·  claimRewards" accent="green" />

        <Subgraph x={offX} y={offY} w={offW} h={offH} label="Off-Chain  ·  Oracles" tone="tint-blue" />
        <Box x={offX + 60} y={offY + 44} w={240} h={64} title="Oracle nodes" sub="3× BLS  ·  tick resolution" accent="blue" />

        {/* Arrows from bot to systems */}
        <Arrow
          x1={botBoxX + botBoxW}
          y1={botY + 324}
          x2={ocX + 60}
          y2={ocY + 76}
          label="joinBatch(bitmapHash)"
          accent="green"
          markerId="bot-arr-green"
        />
        <Arrow
          x1={botBoxX + botBoxW}
          y1={botY + 340}
          x2={offX + 60}
          y2={offY + 76}
          label="POST /vision/bitmap"
          accent="blue"
          markerId="bot-arr-blue"
        />

        {/* Oracle → Vision (BLS proofs) */}
        <Arrow
          x1={offX + 180}
          y1={offY + 44}
          x2={ocX + 180}
          y2={ocY + 108}
          label="BLS balance proofs"
          accent="green"
          markerId="bot-arr-green"
        />

        {/* Claim back to bot */}
        <Arrow
          x1={ocX + 60}
          y1={ocY + 76}
          x2={botBoxX + botBoxW + 4}
          y2={botY + 324}
          label="claimRewards()"
          accent="orange"
          markerId="bot-arr-orange"
        />

        {/* Footer hint */}
        <text x={W / 2} y={H - 18} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="12" fill={APPLE_TEXT_3}>
          poll · predict · seal · sign · commit · claim
        </text>
      </svg>
      <figcaption>The bot loop. Eight steps. Two networks. One opinion, sealed before it is judged.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   2. BlockLifecycleDiagram
   File: vision/architecture/batch-lifecycle.mdx
   Source: linear flowchart TD A→B→...→J→C (loop back)
   ─────────────────────────────────────────────────────────── */

export function BlockLifecycleDiagram() {
  const W = 760
  const stages = [
    { title: 'Data sources', sub: 'sync 60s – 7d', accent: 'gray' as Accent },
    { title: 'Market prices DB', sub: 'every 60s', accent: 'gray' as Accent },
    { title: 'Batch config generation', sub: 'thresholds, market hashes', accent: 'blue' as Accent },
    { title: 'Oracle discovery', sub: 'GET /batches/recommended', accent: 'blue' as Accent },
    { title: 'On-chain batch creation', sub: 'BLS consensus', accent: 'blue' as Accent },
    { title: 'Players join + bitmap commit', sub: 'PlayerJoined event', accent: 'green' as Accent },
    { title: 'Tick resolution', sub: 'deterministic per oracle', accent: 'green' as Accent },
    { title: 'BLS settlement signing', sub: 'aggregate in Postgres', accent: 'green' as Accent },
    { title: 'On-chain settlement', sub: 'quorum reached', accent: 'green' as Accent },
    { title: 'Threshold recalibration', sub: 'POST /batches/settlement', accent: 'orange' as Accent },
  ]
  const boxW = 320
  const boxH = 60
  const gap = 18
  const top = 30
  const H = top + stages.length * (boxH + gap) + 40
  const cx = W / 2
  const x = cx - boxW / 2

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Batch lifecycle: data ingestion → settlement → recalibration loop">
        <defs>
          <Marker id="bl-arr-gray" color={APPLE_TEXT_3} />
          <Marker id="bl-arr-orange" color={APPLE_ORANGE} />
        </defs>

        {stages.map((s, i) => {
          const y = top + i * (boxH + gap)
          return <Box key={i} x={x} y={y} w={boxW} h={boxH} title={s.title} sub={s.sub} accent={s.accent} />
        })}

        {stages.map((_, i) => {
          if (i === stages.length - 1) return null
          const y1 = top + i * (boxH + gap) + boxH
          const y2 = top + (i + 1) * (boxH + gap)
          return (
            <Arrow
              key={`arr-${i}`}
              x1={cx}
              y1={y1}
              x2={cx}
              y2={y2}
              labelBg={false}
              curve={false}
              markerId="bl-arr-gray"
            />
          )
        })}

        {/* Feedback loop from stage 9 (idx 9) → stage 2 (idx 2) */}
        <path
          d={`M ${x + boxW} ${top + 9 * (boxH + gap) + boxH / 2}
              C ${x + boxW + 90} ${top + 9 * (boxH + gap) + boxH / 2},
                ${x + boxW + 90} ${top + 2 * (boxH + gap) + boxH / 2},
                ${x + boxW + 4} ${top + 2 * (boxH + gap) + boxH / 2}`}
          fill="none"
          stroke={APPLE_ORANGE}
          strokeWidth={1.4}
          strokeDasharray="4 3"
          markerEnd="url(#bl-arr-orange)"
        />
        <text
          x={x + boxW + 96}
          y={top + 5.5 * (boxH + gap) + boxH / 2}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="11"
          fill={APPLE_ORANGE}
          transform={`rotate(90 ${x + boxW + 96} ${top + 5.5 * (boxH + gap) + boxH / 2})`}
        >
          feedback loop
        </text>
      </svg>
      <figcaption>Nine phases. The last one feeds the first. The system learns what fifty-fifty means.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   3. BalanceProofsFlow
   File: vision/concepts/balance-proofs.mdx
   Source: sequenceDiagram (Player ↔ Oracles ↔ Contract)
   ─────────────────────────────────────────────────────────── */

export function BalanceProofsFlow() {
  const W = 720
  const lanes = [
    { x: 130, label: 'Player', accent: 'blue' as Accent },
    { x: 360, label: 'Oracles', accent: 'green' as Accent },
    { x: 600, label: 'Contract', accent: 'orange' as Accent },
  ]
  type Step = { from: 0 | 1 | 2; to: 0 | 1 | 2; label: string; sub?: string; accent?: Accent }
  const steps: Step[] = [
    { from: 0, to: 1, label: 'GET /vision/balance/{batchId}/{player}', accent: 'blue' },
    { from: 1, to: 1, label: 'Compute balance from tick results', sub: 'three machines, same arithmetic', accent: 'green' },
    { from: 1, to: 1, label: 'BLS-sign the balance message', accent: 'green' },
    { from: 1, to: 0, label: 'Return balance + partial BLS sig' },
    { from: 0, to: 0, label: 'Aggregate 2/3+ partial signatures', accent: 'blue' },
    { from: 0, to: 2, label: 'claimRewards(batchId, fromTick, toTick, balance, sig)', accent: 'orange' },
    { from: 2, to: 2, label: 'Verify aggregated BLS signature', accent: 'orange' },
    { from: 2, to: 0, label: 'Transfer USDC payout' },
  ]
  const top = 76
  const stepGap = 50
  const H = top + steps.length * stepGap + 30

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Balance proofs: player asks oracles, oracles sign, contract verifies">
        <defs>
          <Marker id="bp-arr-gray" color={APPLE_TEXT_3} />
          <Marker id="bp-arr-blue" color={APPLE_BLUE} />
          <Marker id="bp-arr-green" color={APPLE_GREEN} />
          <Marker id="bp-arr-orange" color={APPLE_ORANGE} />
        </defs>

        {/* Lane heads */}
        {lanes.map((l) => (
          <g key={l.label}>
            <rect x={l.x - 80} y={26} width={160} height={32} rx={16} fill={APPLE_SURFACE} stroke={APPLE_BORDER} />
            <rect x={l.x - 80} y={26} width={4} height={32} fill={accentHex(l.accent)} rx={2} />
            <text
              x={l.x}
              y={47}
              textAnchor="middle"
              fontFamily={FONT_DISPLAY}
              fontSize="13"
              fontWeight="600"
              letterSpacing="-0.005em"
              fill={APPLE_TEXT}
            >
              {l.label}
            </text>
          </g>
        ))}

        {/* Lane lines */}
        {lanes.map((l) => (
          <line key={`v-${l.label}`} x1={l.x} y1={62} x2={l.x} y2={H - 16} stroke={APPLE_BORDER} strokeDasharray="2 4" />
        ))}

        {steps.map((s, i) => {
          const y = top + i * stepGap
          const color = accentHex(s.accent ?? 'gray')
          const markerId = s.accent === 'blue' ? 'bp-arr-blue'
            : s.accent === 'green' ? 'bp-arr-green'
            : s.accent === 'orange' ? 'bp-arr-orange'
            : 'bp-arr-gray'
          if (s.from === s.to) {
            const x = lanes[s.from].x
            return (
              <g key={i}>
                <path
                  d={`M ${x} ${y - 12} C ${x + 60} ${y - 18}, ${x + 60} ${y + 12}, ${x} ${y + 6}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.2}
                  markerEnd={`url(#${markerId})`}
                />
                <rect x={x - 105} y={y - 6} width={210} height={s.sub ? 32 : 20} rx={6} fill={APPLE_BG} stroke={color} strokeOpacity="0.25" />
                <text x={x} y={y + 6} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11.5" fontWeight="500" fill={APPLE_TEXT}>
                  {s.label}
                </text>
                {s.sub ? (
                  <text x={x} y={y + 19} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="10.5" fill={APPLE_TEXT_3}>
                    {s.sub}
                  </text>
                ) : null}
              </g>
            )
          }
          const x1 = lanes[s.from].x
          const x2 = lanes[s.to].x
          const midX = (x1 + x2) / 2
          return (
            <g key={i}>
              <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={1.4} markerEnd={`url(#${markerId})`} />
              <rect x={midX - s.label.length * 3.4 - 6} y={y - 11} width={s.label.length * 6.8 + 12} height={16} rx={4} fill={APPLE_BG} />
              <text x={midX} y={y - 1} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11.5" fontWeight="500" fill={APPLE_TEXT}>
                {s.label}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>Three machines sign. Two must agree. The contract believes only signatures.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   4. FeesBreakdown
   File: vision/concepts/fees.mdx
   Source: flowchart LR with decision diamond
   ─────────────────────────────────────────────────────────── */

export function FeesBreakdown() {
  const W = 760
  const H = 220

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fee flow: only winners pay 0.05% on profits">
        <defs>
          <Marker id="fee-arr-gray" color={APPLE_TEXT_3} />
          <Marker id="fee-arr-green" color={APPLE_GREEN} />
          <Marker id="fee-arr-red" color={APPLE_RED} />
        </defs>

        {/* Tick resolves */}
        <Box x={20} y={H / 2 - 32} w={140} h={64} title="Tick resolves" sub="prices fixed" accent="blue" />

        {/* Decision diamond */}
        <Diamond cx={250} cy={H / 2} w={120} h={84} text="Won?" accent="gray" />

        {/* Yes branch top */}
        <Box x={340} y={28} w={140} h={56} title="Gross profit" accent="green" />
        <Box x={500} y={28} w={120} h={56} title="− 0.05% fee" sub="on profit only" accent="orange" />
        <Box x={640} y={28} w={100} h={56} title="Net payout" accent="green" />

        {/* No branch bottom */}
        <Box x={340} y={H - 84} w={400} h={56} title="No fee  ·  loss only" sub="losers pay nothing" accent="red" />

        {/* Arrows */}
        <Arrow x1={160} y1={H / 2} x2={190} y2={H / 2} curve={false} markerId="fee-arr-gray" />
        <Arrow x1={310} y1={H / 2 - 22} x2={340} y2={56} accent="green" markerId="fee-arr-green" label="Yes" />
        <Arrow x1={310} y1={H / 2 + 22} x2={340} y2={H - 56} accent="red" markerId="fee-arr-red" label="No" />
        <Arrow x1={480} y1={56} x2={500} y2={56} curve={false} markerId="fee-arr-gray" />
        <Arrow x1={620} y1={56} x2={640} y2={56} curve={false} markerId="fee-arr-gray" />
      </svg>
      <figcaption>Five basis points on profit. The smallest tax that still counts as one.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   5. TickResolutionFlow
   File: vision/concepts/ticks.mdx
   Source: flowchart TD A → ... → K (linear pipeline)
   ─────────────────────────────────────────────────────────── */

export function TickResolutionFlow() {
  const W = 760
  const stages: Array<{ title: string; sub?: string; accent: Accent }> = [
    { title: 'Tick ends', accent: 'blue' },
    { title: 'Filter active players', sub: 'balance > 0', accent: 'gray' },
    { title: 'Check bitmap reveals', sub: 'unrevealed → voided', accent: 'gray' },
    { title: 'Compute multipliers', sub: 'early × commitment', accent: 'gray' },
    { title: 'For each market', sub: 'iterate marketIds', accent: 'gray' },
    { title: 'Fetch start + end prices', accent: 'gray' },
    { title: 'Determine outcome', sub: 'UP / DOWN / FLAT', accent: 'green' },
    { title: 'Parimutuel side matching', sub: 'min(UP total, DOWN total)', accent: 'green' },
    { title: 'Aggregate balance changes', sub: 'sum across markets', accent: 'green' },
    { title: 'BLS consensus', sub: 'quorum 2/3+', accent: 'orange' },
    { title: 'Submit on-chain', sub: 'settleBatch()', accent: 'orange' },
  ]
  const boxW = 320
  const boxH = 56
  const gap = 14
  const top = 24
  const H = top + stages.length * (boxH + gap) + 26
  const cx = W / 2
  const x = cx - boxW / 2

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tick resolution pipeline">
        <defs>
          <Marker id="tk-arr-gray" color={APPLE_TEXT_3} />
        </defs>

        {stages.map((s, i) => {
          const y = top + i * (boxH + gap)
          return <Box key={i} x={x} y={y} w={boxW} h={boxH} title={s.title} sub={s.sub} accent={s.accent} />
        })}
        {stages.slice(0, -1).map((_, i) => {
          const y1 = top + i * (boxH + gap) + boxH
          const y2 = top + (i + 1) * (boxH + gap)
          return <Arrow key={i} x1={cx} y1={y1} x2={cx} y2={y2} curve={false} markerId="tk-arr-gray" />
        })}
      </svg>
      <figcaption>The same eleven steps, every tick, forever — until you stop playing.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   6. ResolutionDecisionFlow  ← HIGH PRIORITY (currently 500ing)
   File: vision/concepts/resolution-types.mdx
   Source: flowchart TD with diamonds {Threshold Type}, {pct > 0?}, etc.
   ─────────────────────────────────────────────────────────── */

export function ResolutionDecisionFlow() {
  const W = 820
  const H = 480

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Resolution decision flow: threshold type splits into UP/DOWN/FLAT branches">
        <defs>
          <Marker id="rd-arr-gray" color={APPLE_TEXT_3} />
          <Marker id="rd-arr-green" color={APPLE_GREEN} />
          <Marker id="rd-arr-red" color={APPLE_RED} />
          <Marker id="rd-arr-orange" color={APPLE_ORANGE} />
        </defs>

        {/* Input */}
        <Box x={W / 2 - 110} y={20} w={220} h={56} title="Price change %" sub="(end − start) / start × 100" accent="blue" />

        {/* Root diamond */}
        <Diamond cx={W / 2} cy={140} w={170} h={80} text="Threshold type" accent="gray" />

        <Arrow x1={W / 2} y1={76} x2={W / 2} y2={102} curve={false} markerId="rd-arr-gray" />

        {/* Three branches: UP_0/DOWN_0 (left), UP_30/DOWN_30 (center), FLAT_X (right) */}

        {/* LEFT branch: UP_0 / DOWN_0 → diamond pct > 0? */}
        <Diamond cx={150} cy={260} w={150} h={70} text="pct > 0 ?" accent="gray" />
        <Arrow x1={W / 2 - 60} y1={150} x2={210} y2={245} accent="gray" label="UP_0 / DOWN_0" markerId="rd-arr-gray" />

        {/* CENTER branch: UP_30 / DOWN_30 */}
        <Diamond cx={W / 2} cy={260} w={170} h={70} text="|pct| > 0.3% ?" accent="gray" />
        <Arrow x1={W / 2} y1={180} x2={W / 2} y2={228} curve={false} accent="gray" label="UP_30 / DOWN_30" markerId="rd-arr-gray" />

        {/* RIGHT branch: FLAT_X */}
        <Diamond cx={W - 150} cy={260} w={170} h={70} text="|pct| < threshold ?" accent="gray" />
        <Arrow x1={W / 2 + 60} y1={150} x2={W - 210} y2={245} accent="gray" label="FLAT_X" markerId="rd-arr-gray" />

        {/* Outcomes */}
        <Box x={40} y={380} w={130} h={64} title="DOWN wins" sub="pct < 0" accent="red" />
        <Box x={200} y={380} w={130} h={64} title="UP wins" sub="pct > 0" accent="green" />
        <Box x={W / 2 - 65} y={380} w={130} h={64} title="FLAT" sub="full refund" accent="orange" />
        <Box x={W - 330} y={380} w={130} h={64} title="UP wins" sub="pct > +0.3%" accent="green" />
        <Box x={W - 170} y={380} w={130} h={64} title="DOWN wins" sub="pct < −0.3%" accent="red" />

        {/* LEFT branch outcomes */}
        <Arrow x1={120} y1={290} x2={105} y2={380} accent="red" label="No" markerId="rd-arr-red" />
        <Arrow x1={180} y1={290} x2={265} y2={380} accent="green" label="Yes" markerId="rd-arr-green" />

        {/* CENTER branch outcomes */}
        <Arrow x1={W / 2 - 30} y1={290} x2={W / 2 - 250} y2={378} accent="green" label="pct > +0.3%" markerId="rd-arr-green" />
        <Arrow x1={W / 2} y1={295} x2={W / 2} y2={378} curve={false} accent="orange" label="within band" markerId="rd-arr-orange" />
        <Arrow x1={W / 2 + 30} y1={290} x2={W / 2 + 235} y2={378} accent="red" label="pct < −0.3%" markerId="rd-arr-red" />

        {/* RIGHT branch outcomes */}
        <Arrow x1={W - 180} y1={290} x2={W - 105} y2={378} accent="red" label="No, pct < 0" markerId="rd-arr-red" />
        <Arrow x1={W - 220} y1={290} x2={W - 265} y2={378} accent="green" label="No, pct > 0" markerId="rd-arr-green" />
        <Arrow x1={W - 150} y1={295} x2={W / 2 + 5} y2={378} accent="orange" label="Yes" markerId="rd-arr-orange" />
      </svg>
      <figcaption>The threshold is the entire question. Cross it and the market speaks. Stay inside it and everyone goes home with what they brought.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   7. BitmapEncodingFlow
   File: vision/concepts/bitmaps.mdx
   Source: flowchart LR — Predict → Encode → Hash → Commit → Reveal → Resolve
   ─────────────────────────────────────────────────────────── */

export function BitmapEncodingFlow() {
  const W = 880
  const H = 200
  const stages: Array<{ title: string; sub?: string; accent: Accent }> = [
    { title: 'Predict UP/DOWN', sub: 'per market', accent: 'blue' },
    { title: 'Encode bitmap', sub: 'big-endian bits', accent: 'blue' },
    { title: 'keccak256 hash', sub: 'sealed commitment', accent: 'blue' },
    { title: 'Commit on-chain', sub: 'joinBatch / updateBitmap', accent: 'green' },
    { title: 'Reveal to oracles', sub: 'POST /vision/bitmap', accent: 'green' },
    { title: 'Tick resolves', sub: 'parimutuel matching', accent: 'orange' },
  ]
  const boxW = 130
  const boxH = 70
  const gap = 16
  const top = 70
  const left = (W - (stages.length * boxW + (stages.length - 1) * gap)) / 2

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bitmap commitment-and-reveal flow">
        <defs>
          <Marker id="bm-arr-gray" color={APPLE_TEXT_3} />
        </defs>
        {stages.map((s, i) => {
          const x = left + i * (boxW + gap)
          return <Box key={i} x={x} y={top} w={boxW} h={boxH} title={s.title} sub={s.sub} accent={s.accent} />
        })}
        {stages.slice(0, -1).map((_, i) => {
          const x1 = left + i * (boxW + gap) + boxW
          const x2 = left + (i + 1) * (boxW + gap)
          return (
            <line
              key={i}
              x1={x1}
              y1={top + boxH / 2}
              x2={x2 - 1}
              y2={top + boxH / 2}
              stroke={APPLE_TEXT_3}
              strokeWidth={1.4}
              markerEnd="url(#bm-arr-gray)"
            />
          )
        })}
        <text x={W / 2} y={36} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" letterSpacing="-0.005em" fill={APPLE_TEXT}>
          Sealed bet
        </text>
        <text x={W / 2} y={H - 18} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11.5" fill={APPLE_TEXT_3}>
          your opinion is private until the moment it is judged
        </text>
      </svg>
      <figcaption>Bits, then a hash, then commitment, then revelation. Each step is one less secret.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   8. BlockStateMachine
   File: vision/concepts/batches.mdx
   Source: flowchart LR with self-loop (More Ticks?), Paused branch
   ─────────────────────────────────────────────────────────── */

export function BlockStateMachine() {
  const W = 820
  const H = 280

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Batch lifecycle states: create, join, tick loop, paused, claim">
        <defs>
          <Marker id="bs-arr-gray" color={APPLE_TEXT_3} />
          <Marker id="bs-arr-green" color={APPLE_GREEN} />
          <Marker id="bs-arr-orange" color={APPLE_ORANGE} />
        </defs>

        <Box x={20} y={H / 2 - 30} w={130} h={60} title="Create batch" sub="creator chooses terms" accent="blue" />
        <Box x={180} y={H / 2 - 30} w={130} h={60} title="Players join" sub="commit + deposit" accent="blue" />
        <Box x={340} y={H / 2 - 30} w={150} h={60} title="Tick resolves" sub="parimutuel match" accent="green" />

        {/* Decision diamond */}
        <Diamond cx={560} cy={H / 2} w={130} h={70} text="more ticks?" accent="gray" />

        {/* Paused branch above the diamond */}
        <Box x={500} y={20} w={120} h={50} title="Paused" sub="oracle BLS pause" accent="orange" />

        {/* Claim/withdraw */}
        <Box x={680} y={H / 2 - 30} w={120} h={60} title="Claim / withdraw" sub="exit position" accent="orange" />

        {/* Arrows */}
        <Arrow x1={150} y1={H / 2} x2={180} y2={H / 2} curve={false} markerId="bs-arr-gray" />
        <Arrow x1={310} y1={H / 2} x2={340} y2={H / 2} curve={false} markerId="bs-arr-gray" />
        <Arrow x1={490} y1={H / 2} x2={500} y2={H / 2} curve={false} markerId="bs-arr-gray" />

        {/* Yes loop back to tick resolves */}
        <path
          d={`M ${555} ${H / 2 - 30} C ${500} ${H / 2 - 80}, ${440} ${H / 2 - 80}, ${415} ${H / 2 - 30}`}
          fill="none"
          stroke={APPLE_GREEN}
          strokeWidth={1.4}
          markerEnd="url(#bs-arr-green)"
        />
        <text x={485} y={H / 2 - 70} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={APPLE_GREEN}>
          Yes
        </text>

        {/* Pause branch */}
        <Arrow x1={560} y1={H / 2 - 35} x2={560} y2={70} curve={false} accent="orange" label="paused" markerId="bs-arr-orange" />
        <path
          d={`M ${500} ${50} C ${440} ${50}, ${410} ${H / 2 - 60}, ${415} ${H / 2 - 30}`}
          fill="none"
          stroke={APPLE_ORANGE}
          strokeWidth={1.4}
          strokeDasharray="3 3"
          markerEnd="url(#bs-arr-orange)"
        />
        <text x={420} y={70} fontFamily={FONT_TEXT} fontSize="11" fill={APPLE_ORANGE}>
          unpause
        </text>

        {/* No → claim */}
        <Arrow x1={625} y1={H / 2} x2={680} y2={H / 2} curve={false} accent="orange" label="claim" markerId="bs-arr-orange" />
      </svg>
      <figcaption>Created, running, paused, settled. Four states. The protocol does not improvise.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   9a. OracleConsensusFlow
   File: index/architecture/oracle-nodes.mdx (first mermaid)
   Source: flowchart TD with decision {2/3+ Threshold Met?}
   ─────────────────────────────────────────────────────────── */

export function OracleConsensusFlow() {
  const W = 760
  const H = 540

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Oracle BLS consensus flow with threshold gate">
        <defs>
          <Marker id="oc-arr-gray" color={APPLE_TEXT_3} />
          <Marker id="oc-arr-green" color={APPLE_GREEN} />
          <Marker id="oc-arr-orange" color={APPLE_ORANGE} />
        </defs>

        <Box x={W / 2 - 140} y={20} w={280} h={60} title="Leader proposes batch" sub="round-robin election" accent="blue" />
        <Box x={W / 2 - 140} y={100} w={280} h={60} title="Peers validate" sub="independent reconstruction" accent="blue" />
        <Box x={W / 2 - 140} y={180} w={280} h={60} title="Each peer BLS-signs" sub="partial signature returned" accent="blue" />
        <Box x={W / 2 - 140} y={260} w={280} h={60} title="Leader aggregates signatures" accent="blue" />

        <Diamond cx={W / 2} cy={370} w={210} h={84} text="2/3+ threshold met ?" accent="gray" />

        <Box x={120} y={460} w={220} h={60} title="confirmBatch on-chain" sub="TradeRequest events emitted" accent="green" />
        <Box x={420} y={460} w={220} h={60} title="Retry next cycle" sub="propose anew" accent="orange" />

        <Arrow x1={W / 2} y1={80} x2={W / 2} y2={100} curve={false} markerId="oc-arr-gray" />
        <Arrow x1={W / 2} y1={160} x2={W / 2} y2={180} curve={false} markerId="oc-arr-gray" />
        <Arrow x1={W / 2} y1={240} x2={W / 2} y2={260} curve={false} markerId="oc-arr-gray" />
        <Arrow x1={W / 2} y1={320} x2={W / 2} y2={328} curve={false} markerId="oc-arr-gray" />

        <Arrow x1={W / 2 - 40} y1={400} x2={230} y2={460} accent="green" label="Yes" markerId="oc-arr-green" />
        <Arrow x1={W / 2 + 40} y1={400} x2={530} y2={460} accent="orange" label="No" markerId="oc-arr-orange" />

        {/* Loop arrow from Retry back to leader proposes */}
        <path
          d={`M ${640} ${490} C ${720} ${490}, ${720} ${50}, ${W / 2 + 140} ${50}`}
          fill="none"
          stroke={APPLE_ORANGE}
          strokeWidth={1.3}
          strokeDasharray="3 3"
          markerEnd="url(#oc-arr-orange)"
        />
      </svg>
      <figcaption>Two of three. Or nothing. Consensus does not negotiate with itself.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   9b. OracleCycleGantt
   File: index/architecture/oracle-nodes.mdx (second mermaid — gantt)
   Used in BOTH oracle-nodes.mdx AND order-lifecycle.mdx (same diagram)
   Source: gantt 1-Second Consensus Cycle, 5×200ms phases
   ─────────────────────────────────────────────────────────── */

export function OracleCycleGantt() {
  return <CycleGanttImpl ariaLabel="One-second oracle consensus cycle gantt: COLLECT, PROPOSE, SIGN_SUBMIT, CONFIRM, REBALANCE" />
}

/* Same gantt, separate name so it can be referenced from order-lifecycle.mdx */

export function OrderCycleGantt() {
  return <CycleGanttImpl ariaLabel="One-second order consensus cycle gantt: COLLECT, PROPOSE, SIGN, CONFIRM, REBALANCE" signLabel="SIGN" />
}

function CycleGanttImpl({ ariaLabel, signLabel = 'SIGN_SUBMIT' }: { ariaLabel: string; signLabel?: string }) {
  const W = 780
  const H = 240
  const phases: Array<{ name: string; accent: Accent }> = [
    { name: 'COLLECT', accent: 'blue' },
    { name: 'PROPOSE', accent: 'blue' },
    { name: signLabel, accent: 'green' },
    { name: 'CONFIRM', accent: 'green' },
    { name: 'REBALANCE', accent: 'orange' },
  ]
  const trackX = 60
  const trackW = W - 120
  const barH = 36
  const barY = 90
  const barW = trackW / 5

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel}>
        <text x={W / 2} y={36} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" letterSpacing="-0.005em" fill={APPLE_TEXT}>
          1-Second Consensus Cycle
        </text>
        <text x={W / 2} y={56} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11.5" fill={APPLE_TEXT_3}>
          five phases · two hundred milliseconds each
        </text>

        {/* Time axis */}
        <line x1={trackX} y1={barY + barH + 18} x2={trackX + trackW} y2={barY + barH + 18} stroke={APPLE_BORDER} />
        {[0, 200, 400, 600, 800, 1000].map((ms, i) => {
          const x = trackX + (i * trackW) / 5
          return (
            <g key={ms}>
              <line x1={x} y1={barY + barH + 14} x2={x} y2={barY + barH + 22} stroke={APPLE_BORDER} />
              <text x={x} y={barY + barH + 38} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="10.5" fill={APPLE_TEXT_3}>
                {ms} ms
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {phases.map((p, i) => {
          const x = trackX + i * barW
          const c = accentHex(p.accent)
          return (
            <g key={p.name}>
              <rect x={x + 2} y={barY} width={barW - 4} height={barH} rx={8} fill={APPLE_BG} stroke={APPLE_BORDER} />
              <rect x={x + 2} y={barY} width={4} height={barH} fill={c} rx={2} />
              <text
                x={x + barW / 2}
                y={barY + barH / 2 + 4}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="12"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={APPLE_TEXT}
              >
                {p.name}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>One second. Five phases. The cycle does not pause for weekends.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   11. ItpLifecycleFlow
   File: index/concepts/itps.mdx
   Source: flowchart LR — Create → Live → Buy/Sell loop, Live → NAV float, Live → Rebalance
   ─────────────────────────────────────────────────────────── */

export function ItpLifecycleFlow() {
  const W = 800
  const H = 320

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ITP lifecycle: create, live, buy/sell, rebalance, NAV floats">
        <defs>
          <Marker id="itp-arr-gray" color={APPLE_TEXT_3} />
          <Marker id="itp-arr-blue" color={APPLE_BLUE} />
          <Marker id="itp-arr-green" color={APPLE_GREEN} />
          <Marker id="itp-arr-orange" color={APPLE_ORANGE} />
        </defs>

        <Box x={30} y={H / 2 - 30} w={150} h={60} title="Create ITP" sub="weights → quantities" accent="blue" />
        <Box x={W / 2 - 75} y={H / 2 - 30} w={150} h={60} title="ITP live" sub="quantities frozen" accent="green" />
        <Box x={W - 180} y={H / 2 - 30} w={150} h={60} title="Rebalance" sub="new quantities, same NAV" accent="orange" />

        <Box x={W / 2 - 75} y={20} w={150} h={56} title="Buy / sell" sub="mint / burn shares" accent="blue" />
        <Box x={W / 2 - 75} y={H - 80} w={150} h={56} title="NAV floats" sub="prices change" accent="green" />

        <Arrow x1={180} y1={H / 2} x2={W / 2 - 75} y2={H / 2} curve={false} accent="blue" label="weights → qty" markerId="itp-arr-blue" />

        {/* Live ↔ Buy/Sell */}
        <Arrow x1={W / 2} y1={H / 2 - 30} x2={W / 2} y2={76} curve={false} accent="blue" markerId="itp-arr-blue" />
        <path
          d={`M ${W / 2 + 24} ${76} C ${W / 2 + 60} ${110}, ${W / 2 + 60} ${H / 2 - 50}, ${W / 2 + 24} ${H / 2 - 30}`}
          fill="none"
          stroke={APPLE_BLUE}
          strokeWidth={1.3}
          strokeDasharray="3 3"
          markerEnd="url(#itp-arr-blue)"
        />
        <text x={W / 2 + 78} y={H / 2 - 50} fontFamily={FONT_TEXT} fontSize="10.5" fill={APPLE_TEXT_3}>
          mint / burn
        </text>

        {/* Live ↔ NAV floats */}
        <Arrow x1={W / 2} y1={H / 2 + 30} x2={W / 2} y2={H - 80} curve={false} accent="green" markerId="itp-arr-green" />
        <path
          d={`M ${W / 2 - 24} ${H - 80} C ${W / 2 - 60} ${H - 120}, ${W / 2 - 60} ${H / 2 + 50}, ${W / 2 - 24} ${H / 2 + 30}`}
          fill="none"
          stroke={APPLE_GREEN}
          strokeWidth={1.3}
          strokeDasharray="3 3"
          markerEnd="url(#itp-arr-green)"
        />
        <text x={W / 2 - 130} y={H / 2 + 65} fontFamily={FONT_TEXT} fontSize="10.5" fill={APPLE_TEXT_3}>
          prices drift
        </text>

        {/* Live → Rebalance */}
        <Arrow x1={W / 2 + 75} y1={H / 2} x2={W - 180} y2={H / 2} curve={false} accent="orange" label="updateWeights" markerId="itp-arr-orange" />
        <path
          d={`M ${W - 105} ${H / 2 - 30} C ${W - 105} ${H / 2 - 90}, ${W / 2 + 75} ${H / 2 - 90}, ${W / 2 + 75} ${H / 2 - 30}`}
          fill="none"
          stroke={APPLE_ORANGE}
          strokeWidth={1.3}
          strokeDasharray="3 3"
          markerEnd="url(#itp-arr-orange)"
        />
        <text x={(W / 2 + 75 + W - 105) / 2} y={H / 2 - 95} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="10.5" fill={APPLE_TEXT_3}>
          NAV preserved
        </text>
      </svg>
      <figcaption>The basket is born at one dollar. Then it moves. The math forgives nothing.</figcaption>
    </figure>
  )
}
