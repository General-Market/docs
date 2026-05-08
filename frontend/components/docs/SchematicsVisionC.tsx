import * as React from 'react'

/* Apple-style SVG schematics for Vision + Index API docs.
   Self-contained server components — no imports beyond React. */

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

type Accent = 'blue' | 'green' | 'orange' | 'red' | 'gray'

const accentColor = (a?: Accent): string =>
  a === 'blue' ? BLUE
  : a === 'green' ? GREEN
  : a === 'orange' ? ORANGE
  : a === 'red' ? RED
  : T3

/* ─── shared building blocks ──────────────────────────────────── */

function Arrow({ id = 'svc-arrow', color = T3 }: { id?: string; color?: string }) {
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

function TitleBox({
  x, y, w, h, title, sub, accent, dim,
}: {
  x: number; y: number; w: number; h: number
  title: string; sub?: string
  accent?: Accent
  dim?: boolean
}) {
  const c = accentColor(accent)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={dim ? SF : BG} stroke={BD} />
      {accent ? <rect x={x} y={y} width={4} height={h} fill={c} rx={2} /> : null}
      <text
        x={x + 14}
        y={y + 24}
        fontFamily={FONT_DISPLAY}
        fontSize="13"
        fontWeight="600"
        letterSpacing="-0.005em"
        fill={T1}
      >
        {title}
      </text>
      {sub ? (
        <text
          x={x + 14}
          y={y + 42}
          fontFamily={FONT_TEXT}
          fontSize="11.5"
          fill={T2}
        >
          {sub}
        </text>
      ) : null}
    </g>
  )
}

/* ─── Batch lifecycle pipeline (DATA NODE → ORACLE → L3) ──────── */

export function BlockPipelineSchematic() {
  const w = 760
  const colW = 720
  const colX = 20
  const dataH = 150
  const oracleH = 230
  const l3H = 240
  const gap = 24
  const top = 20
  const oracleY = top + dataH + gap
  const l3Y = oracleY + oracleH + gap
  const h = l3Y + l3H + 20

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Batch lifecycle pipeline">
        <defs><Arrow /></defs>

        {/* Data node section */}
        <g>
          <rect x={colX} y={top} width={colW} height={dataH} rx={14} fill={SF} stroke={BD} />
          <rect x={colX} y={top} width={4} height={dataH} fill={BLUE} rx={2} />
          <text x={colX + 18} y={top + 24} fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>Data Node</text>
          <g fontFamily={FONT_TEXT} fontSize="12" fill={T2}>
            <text x={colX + 18} y={top + 50}>100 Sources → SyncEngine → market_prices_latest</text>
            <text x={colX + 18} y={top + 72}>BlockEngine (60s)</text>
            <text x={colX + 18} y={top + 94}>batch_configs (DB + memory)</text>
            <text x={colX + 18} y={top + 116} fill={T1} fontWeight="500">GET /batches/recommended</text>
          </g>
        </g>

        <line x1={w / 2} y1={top + dataH} x2={w / 2} y2={oracleY} stroke={T3} markerEnd="url(#svc-arrow)" />

        {/* Oracle section */}
        <g>
          <rect x={colX} y={oracleY} width={colW} height={oracleH} rx={14} fill={BG} stroke={BD} />
          <rect x={colX} y={oracleY} width={4} height={oracleH} fill={GREEN} rx={2} />
          <text x={colX + 18} y={oracleY + 24} fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>Oracle (×3)</text>
          <text x={colX + 18} y={oracleY + 44} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>Lifecycle Manager — heartbeat per source</text>

          <g fontFamily={FONT_TEXT} fontSize="11.5" fill={T1}>
            <text x={colX + 30} y={oracleY + 72} fontWeight="500">Create new batch</text>
            <text x={colX + 200} y={oracleY + 72} fill={T2}>BLS consensus → createBlock on-chain</text>

            <text x={colX + 30} y={oracleY + 96} fontWeight="500">Resolve previous batch</text>
            <text x={colX + 48} y={oracleY + 116} fill={T2}>1. Fetch config + prices from data-node</text>
            <text x={colX + 48} y={oracleY + 134} fill={T2}>2. Flip bitmaps (pending → active)</text>
            <text x={colX + 48} y={oracleY + 152} fill={T2}>3. Per-market resolution (prices → outcome → matching)</text>
            <text x={colX + 48} y={oracleY + 170} fill={T2}>4. Compute settlement (deterministic payouts)</text>
            <text x={colX + 48} y={oracleY + 188} fill={T2}>5. BLS sign → aggregate in Postgres</text>
            <text x={colX + 48} y={oracleY + 206} fill={T2}>6. Submit settleBlock when quorum reached</text>
          </g>
        </g>

        <line x1={w / 2} y1={oracleY + oracleH} x2={w / 2} y2={l3Y} stroke={T3} markerEnd="url(#svc-arrow)" />

        {/* L3 section */}
        <g>
          <rect x={colX} y={l3Y} width={colW} height={l3H} rx={14} fill={SF} stroke={BD} />
          <rect x={colX} y={l3Y} width={4} height={l3H} fill={ORANGE} rx={2} />
          <text x={colX + 18} y={l3Y + 24} fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>L3 Blockchain</text>

          <g fontFamily={FONT_TEXT} fontSize="12">
            <text x={colX + 18} y={l3Y + 50} fontWeight="600" fill={T1}>Vision.sol</text>
            <text x={colX + 30} y={l3Y + 70} fill={T2}>createBlock() → BlockCreated</text>
            <text x={colX + 30} y={l3Y + 88} fill={T2}>joinBlockDirect() → PlayerJoined</text>
            <text x={colX + 30} y={l3Y + 106} fill={T2}>updateBitmap() → BitmapUpdated</text>
            <text x={colX + 30} y={l3Y + 124} fill={T2}>settleBlock() → PlayerSettled + BlockSettled</text>
            <text x={colX + 30} y={l3Y + 142} fill={T2}>pause() / unpause()</text>

            <text x={colX + 18} y={l3Y + 170} fontWeight="600" fill={T1}>VisionReserve.sol</text>
            <text x={colX + 30} y={l3Y + 190} fill={T2}>USDC custody — deposits, withdrawals, rewards</text>

            <text x={colX + 18} y={l3Y + 215} fontWeight="600" fill={T1}>OracleRegistry.sol</text>
            <text x={colX + 30} y={l3Y + 233} fill={T2}>BLS public keys, aggregated pubkey, threshold</text>
          </g>
        </g>
      </svg>
    </figure>
  )
}

/* ─── Bitmap byte layout — bit cells as SVG rects ─────────────── */

export function BitmapByteLayout() {
  const cellW = 36
  const cellH = 36
  const byteGap = 24
  const cols = 8
  const bytes: { label: string; cells: { idx: string; used: boolean }[] }[] = [
    {
      label: 'Byte 0',
      cells: [0,1,2,3,4,5,6,7].map(i => ({ idx: String(i), used: true })),
    },
    {
      label: 'Byte 1',
      cells: [8,9,10,11,12,13,14,15].map(i => ({
        idx: i < 10 ? String(i) : String.fromCharCode('A'.charCodeAt(0) + (i - 10)),
        used: true,
      })),
    },
    {
      label: 'Byte 2',
      cells: [
        { idx: 'G', used: true }, { idx: 'H', used: true }, { idx: 'I', used: true }, { idx: 'J', used: true },
        { idx: '', used: false }, { idx: '', used: false }, { idx: '', used: false }, { idx: '', used: false },
      ],
    },
  ]

  const groupW = cols * cellW
  const w = bytes.length * groupW + (bytes.length - 1) * byteGap + 40
  const h = 150

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bitmap byte layout">
        {bytes.map((b, bi) => {
          const xOff = 20 + bi * (groupW + byteGap)
          return (
            <g key={bi}>
              <text
                x={xOff + groupW / 2}
                y={28}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                fill={T1}
              >
                {b.label}
              </text>
              {b.cells.map((c, ci) => {
                const x = xOff + ci * cellW
                const y = 44
                return (
                  <g key={ci}>
                    <rect
                      x={x}
                      y={y}
                      width={cellW}
                      height={cellH}
                      fill={c.used ? BG : SF}
                      stroke={BD}
                    />
                    <text
                      x={x + cellW / 2}
                      y={y + cellH / 2 + 4}
                      textAnchor="middle"
                      fontFamily={FONT_TEXT}
                      fontSize="12"
                      fontWeight="500"
                      fill={c.used ? T1 : T3}
                    >
                      {c.idx}
                    </text>
                  </g>
                )
              })}
              <text
                x={xOff}
                y={44 + cellH + 18}
                fontFamily={FONT_TEXT}
                fontSize="10.5"
                fill={T3}
              >
                MSB
              </text>
              <text
                x={xOff + groupW}
                y={44 + cellH + 18}
                textAnchor="end"
                fontFamily={FONT_TEXT}
                fontSize="10.5"
                fill={T3}
              >
                LSB
              </text>
            </g>
          )
        })}
        <text
          x={w - 20}
          y={h - 8}
          textAnchor="end"
          fontFamily={FONT_TEXT}
          fontSize="11"
          fill={T2}
        >
          Numbers are market indices. Trailing bits = 0.
        </text>
      </svg>
    </figure>
  )
}

/* ─── Points: overview pools ──────────────────────────────────── */

export function PointsOverview() {
  const rows = [
    { name: 'Vision', budget: '5,000/day', mech: 'Deposit share in settled rounds', accent: 'blue' as Accent },
    { name: 'Index Creator', budget: '2,500/day', mech: 'NAV growth of your ITP', accent: 'green' as Accent },
    { name: 'Index Holder', budget: '2,500/day', mech: 'Weighted portfolio performance', accent: 'orange' as Accent },
  ]
  const w = 720
  const rowH = 56
  const top = 56
  const h = top + rows.length * rowH + 80

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Unified points system">
        <text x={w / 2} y={28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Unified Points System
        </text>

        {/* header */}
        <g fontFamily={FONT_TEXT} fontSize="11" fill={T3}>
          <text x={32} y={top - 8}>POOL</text>
          <text x={260} y={top - 8}>BUDGET</text>
          <text x={420} y={top - 8}>MECHANIC</text>
        </g>
        <line x1={20} y1={top - 2} x2={w - 20} y2={top - 2} stroke={BD} />

        {rows.map((r, i) => {
          const y = top + i * rowH
          return (
            <g key={r.name}>
              <rect x={32} y={y + 18} width={4} height={20} fill={accentColor(r.accent)} rx={2} />
              <text x={48} y={y + 34} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>{r.name}</text>
              <text x={260} y={y + 34} fontFamily={FONT_TEXT} fontSize="13" fontWeight="500" fill={T1}>{r.budget}</text>
              <text x={420} y={y + 34} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>{r.mech}</text>
              {i < rows.length - 1 ? (
                <line x1={20} y1={y + rowH - 2} x2={w - 20} y2={y + rowH - 2} stroke={BD} strokeOpacity={0.5} />
              ) : null}
            </g>
          )
        })}

        <line x1={20} y1={top + rows.length * rowH + 8} x2={w - 20} y2={top + rows.length * rowH + 8} stroke={BD} />
        <text x={48} y={top + rows.length * rowH + 36} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>Total</text>
        <text x={260} y={top + rows.length * rowH + 36} fontFamily={FONT_TEXT} fontSize="13" fontWeight="600" fill={T1}>10,000/day</text>
      </svg>
    </figure>
  )
}

/* ─── Points: round formula card ──────────────────────────────── */

export function PointsRoundFormula() {
  const w = 720
  const h = 200

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Round budget formula">
        <rect x={20} y={20} width={w - 40} height={h - 40} rx={14} fill={SF} stroke={BD} />
        <rect x={20} y={20} width={4} height={h - 40} fill={BLUE} rx={2} />

        <text x={40} y={48} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>
          Round #42 settles
        </text>

        <g fontFamily={FONT_TEXT} fontSize="12.5" fill={T2}>
          <text x={40} y={78}>Per-round budget depends on how many rounds settle per day.</text>
          <text x={40} y={98}>More rounds → smaller per-round allocation. Clamped to [10, 500] pts/round.</text>
        </g>

        <g fontFamily={FONT_TEXT} fontSize="13" fill={T1}>
          <text x={40} y={132}>
            <tspan fill={T3}>your_share = </tspan>
            <tspan fontWeight="500">your_deposit / total_deposited</tspan>
          </text>
          <text x={40} y={156}>
            <tspan fill={T3}>your_points = </tspan>
            <tspan fontWeight="500">round_budget × your_share</tspan>
          </text>
        </g>
      </svg>
    </figure>
  )
}

/* ─── Points: round example ───────────────────────────────────── */

export function PointsRoundExample() {
  const w = 720
  const h = 220

  const rows: [string, string][] = [
    ['round_budget', '5,000 / 100 = 50 pts'],
    ['your_deposit', '$50'],
    ['your_share', '$50 / $200 = 0.25  (25%)'],
    ['your_points', '50 × 0.25 = 12.5 pts'],
  ]

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Round example">
        <rect x={20} y={20} width={w - 40} height={h - 40} rx={14} fill={BG} stroke={BD} />
        <rect x={20} y={20} width={4} height={h - 40} fill={BLUE} rx={2} />

        <text x={40} y={48} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>
          Scenario: round settles with $200 total deposits, ~100 rounds/day
        </text>

        {rows.map(([k, v], i) => (
          <g key={k}>
            <text x={40} y={84 + i * 28} fontFamily={FONT_TEXT} fontSize="12.5" fill={T3}>{k}</text>
            <text x={220} y={84 + i * 28} fontFamily={FONT_TEXT} fontSize="13" fontWeight="500" fill={T1}>{v}</text>
          </g>
        ))}
      </svg>
    </figure>
  )
}

/* ─── Points: creator decay (0.7^x) ───────────────────────────── */

export function PointsCreatorDecay() {
  const ranks = [
    { rank: 1, weight: 1.0, share: 36.1, pts: 37.6 },
    { rank: 2, weight: 0.7, share: 25.2, pts: 26.3 },
    { rank: 3, weight: 0.49, share: 17.7, pts: 18.4 },
    { rank: 4, weight: 0.343, share: 12.4, pts: 12.9 },
    { rank: 5, weight: 0.24, share: 8.7, pts: 9.0 },
  ]
  const w = 720
  const top = 64
  const rowH = 38
  const barX = 360
  const barMax = 320
  const h = top + ranks.length * rowH + 70

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Exponential decay distribution">
        <text x={w / 2} y={26} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Exponential decay distribution (0.7×)
        </text>
        <text x={w / 2} y={46} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="12" fill={T2}>
          weight = 0.7 ^ (rank − 1) — only positive NAV growth qualifies
        </text>

        <g fontFamily={FONT_TEXT} fontSize="11" fill={T3}>
          <text x={32} y={top - 8}>RANK</text>
          <text x={108} y={top - 8}>WEIGHT</text>
          <text x={196} y={top - 8}>SHARE</text>
          <text x={276} y={top - 8}>PTS/HR</text>
        </g>
        <line x1={20} y1={top - 2} x2={w - 20} y2={top - 2} stroke={BD} />

        {ranks.map((r, i) => {
          const y = top + i * rowH
          const barW = (r.share / 36.1) * barMax
          return (
            <g key={r.rank}>
              <text x={32} y={y + 24} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>#{r.rank}</text>
              <text x={108} y={y + 24} fontFamily={FONT_TEXT} fontSize="12.5" fill={T1}>{r.weight.toFixed(3)}</text>
              <text x={196} y={y + 24} fontFamily={FONT_TEXT} fontSize="12.5" fill={T1}>{r.share.toFixed(1)}%</text>
              <text x={276} y={y + 24} fontFamily={FONT_TEXT} fontSize="12.5" fill={T1}>{r.pts.toFixed(1)}</text>
              <rect x={barX} y={y + 12} width={barW} height={16} rx={3} fill={GREEN} fillOpacity={0.85} />
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─── Points: leaderboard sample ──────────────────────────────── */

export function PointsLeaderboard() {
  const rows = [
    { rank: '1st', player: '0xA1b2…c3d4', vision: '5,200', creator: '2,400', holder: '1,800', total: '9,400' },
    { rank: '2nd', player: '0xE5f6…g7h8', vision: '4,100', creator: '1,600', holder: '900',   total: '6,600' },
    { rank: '3rd', player: '0xI9j0…k1l2', vision: '2,800', creator: '0',     holder: '1,200', total: '4,000' },
  ]
  const w = 760
  const top = 60
  const rowH = 42
  const cols = [
    { label: 'RANK', x: 32 },
    { label: 'PLAYER', x: 92 },
    { label: 'VISION', x: 296 },
    { label: 'CREATOR', x: 396 },
    { label: 'HOLDER', x: 504 },
    { label: 'TOTAL', x: 612 },
  ]
  const h = top + rows.length * rowH + 24

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Leaderboard">
        <text x={w / 2} y={26} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Leaderboard
        </text>

        <g fontFamily={FONT_TEXT} fontSize="11" fill={T3}>
          {cols.map(c => <text key={c.label} x={c.x} y={top - 8}>{c.label}</text>)}
        </g>
        <line x1={20} y1={top - 2} x2={w - 20} y2={top - 2} stroke={BD} />

        {rows.map((r, i) => {
          const y = top + i * rowH
          return (
            <g key={r.rank}>
              <text x={32} y={y + 26} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>{r.rank}</text>
              <text x={92} y={y + 26} fontFamily={FONT_TEXT} fontSize="12.5" fill={T1}>{r.player}</text>
              <text x={296} y={y + 26} fontFamily={FONT_TEXT} fontSize="12.5" fill={T1}>{r.vision}</text>
              <text x={396} y={y + 26} fontFamily={FONT_TEXT} fontSize="12.5" fill={T1}>{r.creator}</text>
              <text x={504} y={y + 26} fontFamily={FONT_TEXT} fontSize="12.5" fill={T1}>{r.holder}</text>
              <text x={612} y={y + 26} fontFamily={FONT_TEXT} fontSize="13" fontWeight="600" fill={T1}>{r.total}</text>
              {i < rows.length - 1 ? (
                <line x1={20} y1={y + rowH - 2} x2={w - 20} y2={y + rowH - 2} stroke={BD} strokeOpacity={0.4} />
              ) : null}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─── Points: data flow ───────────────────────────────────────── */

export function PointsDataFlow() {
  const w = 760
  const stages: { title: string; sub: string; accent: Accent }[] = [
    { title: 'Oracle API', sub: 'settled rounds + player deposits', accent: 'green' },
    { title: 'data-node (points.rs)', sub: 'Vision poll 30s · Index cron hourly · CSV backup 4h', accent: 'blue' },
    { title: 'Postgres', sub: 'points_ledger + points_totals', accent: 'gray' },
    { title: 'API endpoints', sub: 'GET /points · GET /points/leaderboard', accent: 'gray' },
    { title: 'Frontend', sub: 'usePoints → /points page', accent: 'orange' },
  ]
  const boxW = 540
  const boxH = 60
  const gap = 18
  const x = (w - boxW) / 2
  const top = 24
  const h = top + stages.length * (boxH + gap) - gap + 24

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Points data flow">
        <defs><Arrow /></defs>
        {stages.map((s, i) => {
          const y = top + i * (boxH + gap)
          return (
            <g key={s.title}>
              <TitleBox x={x} y={y} w={boxW} h={boxH} title={s.title} sub={s.sub} accent={s.accent} />
              {i < stages.length - 1 ? (
                <line x1={w / 2} y1={y + boxH} x2={w / 2} y2={y + boxH + gap} stroke={T3} markerEnd="url(#svc-arrow)" />
              ) : null}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─── Contract addresses topology ─────────────────────────────── */

export function ContractAddressTopology() {
  const w = 720
  const outerH = 320

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${outerH}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vision contract topology on Index L3">
        <defs><Arrow /></defs>

        <rect x={20} y={20} width={w - 40} height={outerH - 40} rx={14} fill={SF} stroke={BD} />
        <text x={w / 2} y={46} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>
          Index L3 — Chain 111222333
        </text>

        {/* Vision contract block */}
        <rect x={120} y={70} width={w - 240} height={120} rx={12} fill={BG} stroke={BD} />
        <rect x={120} y={70} width={4} height={120} fill={BLUE} rx={2} />
        <text x={140} y={94} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>Vision contract</text>
        <text x={140} y={114} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11.5" fill={T2}>
          0x4F1BDD073932828bf2822F6dCAD1121Da41ED1Ef
        </text>

        {/* Inner sub-modules */}
        {[
          { label: 'Batches', x: 140 },
          { label: 'Players', x: 260 },
          { label: 'Bot registry', x: 380 },
        ].map(m => (
          <g key={m.label}>
            <rect x={m.x} y={138} width={110} height={36} rx={8} fill={SF} stroke={BD} />
            <text x={m.x + 55} y={161} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="12" fontWeight="500" fill={T1}>{m.label}</text>
          </g>
        ))}

        {/* Arrows down to deps */}
        <line x1={w / 2 - 100} y1={190} x2={220} y2={220} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={w / 2 + 100} y1={190} x2={500} y2={220} stroke={T3} markerEnd="url(#svc-arrow)" />

        {/* L3 WUSDC */}
        <rect x={80} y={220} width={240} height={70} rx={12} fill={BG} stroke={BD} />
        <rect x={80} y={220} width={4} height={70} fill={ORANGE} rx={2} />
        <text x={100} y={244} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>L3 WUSDC</text>
        <text x={100} y={264} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>18 decimals · settlement currency</text>

        {/* OracleRegistry */}
        <rect x={400} y={220} width={240} height={70} rx={12} fill={BG} stroke={BD} />
        <rect x={400} y={220} width={4} height={70} fill={GREEN} rx={2} />
        <text x={420} y={244} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>OracleRegistry</text>
        <text x={420} y={264} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>BLS verification keys</text>
      </svg>
    </figure>
  )
}

/* ─── Bot lifecycle steps ─────────────────────────────────────── */

export function BotLifecycleSteps() {
  const steps: { n: number; title: string; tag?: string; accent?: Accent }[] = [
    { n: 1, title: 'Register bot', tag: 'one-time setup', accent: 'gray' },
    { n: 2, title: 'Poll batches', tag: 'every 30s', accent: 'blue' },
    { n: 3, title: 'Generate predictions' },
    { n: 4, title: 'Encode bitmap' },
    { n: 5, title: 'Approve USDC' },
    { n: 6, title: 'Join batch', tag: 'on-chain · joinBatch()', accent: 'blue' },
    { n: 7, title: 'Wait 6s', tag: 'chain indexer lag' },
    { n: 8, title: 'Submit bitmap', tag: 'POST /vision/bitmap', accent: 'green' },
    { n: 9, title: 'Update bitmap (optional)', tag: 'updateBitmap() + resubmit' },
    { n: 10, title: 'Claim rewards', tag: 'claimRewards() with BLS proof', accent: 'orange' },
    { n: 11, title: 'Withdraw', tag: 'withdraw() with BLS proof', accent: 'orange' },
  ]
  const w = 720
  const boxW = 440
  const boxH = 56
  const gap = 12
  const x = (w - boxW) / 2
  const top = 24
  const h = top + steps.length * (boxH + gap) - gap + 16

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bot lifecycle steps">
        <defs><Arrow /></defs>
        {steps.map((s, i) => {
          const y = top + i * (boxH + gap)
          const c = accentColor(s.accent)
          return (
            <g key={s.n}>
              <rect x={x} y={y} width={boxW} height={boxH} rx={12} fill={BG} stroke={BD} />
              {s.accent ? <rect x={x} y={y} width={4} height={boxH} fill={c} rx={2} /> : null}
              {/* circle with step number */}
              <circle cx={x + 32} cy={y + boxH / 2} r={14} fill={SF} stroke={BD} />
              <text
                x={x + 32}
                y={y + boxH / 2 + 4}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="12"
                fontWeight="600"
                fill={T1}
              >
                {s.n}
              </text>
              <text x={x + 60} y={y + 24} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>
                {s.title}
              </text>
              {s.tag ? (
                <text x={x + 60} y={y + 42} fontFamily={FONT_TEXT} fontSize="11.5" fill={T2}>
                  {s.tag}
                </text>
              ) : null}
              {i < steps.length - 1 ? (
                <line x1={x + boxW / 2} y1={y + boxH} x2={x + boxW / 2} y2={y + boxH + gap} stroke={T3} markerEnd="url(#svc-arrow)" />
              ) : null}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─── Morpho API overview ─────────────────────────────────────── */

export function MorphoApiOverview() {
  const restRows: [string, string][] = [
    ['/morpho-position?user=0x…', 'Position + market state'],
    ['/morpho-history?address=0x…', 'Transaction history'],
    ['/user-state?address=0x…', 'Balances + allowances'],
  ]
  const sseRows: [string, string][] = [
    ['user-positions', 'collateral, borrow_shares'],
    ['oracle-prices', 'NAV price, borrow_rate'],
  ]
  const w = 760
  const h = 280

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Morpho API overview">
        <text x={w / 2} y={26} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Morpho API surface
        </text>

        {/* REST card */}
        <g>
          <rect x={20} y={50} width={(w - 60) / 2} height={210} rx={14} fill={BG} stroke={BD} />
          <rect x={20} y={50} width={4} height={210} fill={BLUE} rx={2} />
          <text x={40} y={74} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>REST endpoints</text>
          <text x={40} y={92} fontFamily={FONT_TEXT} fontSize="11.5" fill={T3}>snapshot · pull on demand</text>
          {restRows.map(([k, v], i) => (
            <g key={k}>
              <text x={40} y={120 + i * 38} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11.5" fill={T1}>{k}</text>
              <text x={40} y={138 + i * 38} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>{v}</text>
            </g>
          ))}
        </g>

        {/* SSE card */}
        <g>
          <rect x={40 + (w - 60) / 2} y={50} width={(w - 60) / 2} height={210} rx={14} fill={BG} stroke={BD} />
          <rect x={40 + (w - 60) / 2} y={50} width={4} height={210} fill={GREEN} rx={2} />
          <text x={60 + (w - 60) / 2} y={74} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>SSE streams</text>
          <text x={60 + (w - 60) / 2} y={92} fontFamily={FONT_TEXT} fontSize="11.5" fill={T3}>real-time push · server-sent</text>
          {sseRows.map(([k, v], i) => (
            <g key={k}>
              <text x={60 + (w - 60) / 2} y={120 + i * 38} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11.5" fill={T1}>{k}</text>
              <text x={60 + (w - 60) / 2} y={138 + i * 38} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>{v}</text>
            </g>
          ))}
        </g>
      </svg>
    </figure>
  )
}

/* ─── Morpho architecture (frontend → REST/SSE → data node → on-chain) */

export function MorphoArchitecture() {
  const w = 760
  const h = 380

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Morpho architecture">
        <defs><Arrow /></defs>

        {/* Frontend */}
        <TitleBox x={(w - 240) / 2} y={20} w={240} h={56} title="Frontend" sub="React hooks" accent="blue" />

        {/* REST + SSE */}
        <TitleBox x={120} y={120} w={220} h={68} title="REST API" sub="/morpho-* · /user-state" accent="blue" />
        <TitleBox x={420} y={120} w={220} h={68} title="SSE streams" sub="user-positions · oracle-prices" accent="green" />

        {/* Data Node */}
        <TitleBox x={(w - 240) / 2} y={228} w={240} h={56} title="Data Node" sub="Rust · Axum" accent="gray" dim />

        {/* On-chain */}
        <TitleBox x={120} y={316} w={220} h={56} title="Morpho Blue" sub="L3 Orbit" accent="orange" />
        <TitleBox x={420} y={316} w={220} h={56} title="ITPNAVOracle" sub="L3 Orbit" accent="orange" />

        {/* arrows */}
        <line x1={w / 2} y1={76} x2={230} y2={120} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={w / 2} y1={76} x2={530} y2={120} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={230} y1={188} x2={w / 2 - 30} y2={228} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={530} y1={188} x2={w / 2 + 30} y2={228} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={w / 2 - 30} y1={284} x2={230} y2={316} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={w / 2 + 30} y1={284} x2={530} y2={316} stroke={T3} markerEnd="url(#svc-arrow)" />
      </svg>
    </figure>
  )
}

/* ─── Morpho vault deposit + withdraw flow ────────────────────── */

export function MorphoVaultFlow() {
  const w = 800
  const h = 460
  const markets = ['ITP-A / USDC', 'ITP-B / USDC', 'ITP-C / USDC']

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vault deposit and withdraw">
        <defs><Arrow /></defs>

        <text x={w / 2} y={24} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Deposit flow
        </text>

        <TitleBox x={40} y={50} w={160} h={64} title="Lender wallet" sub="approves USDC" accent="gray" />
        <TitleBox x={260} y={50} w={160} h={64} title="USDC (L3)" sub="18 decimals" accent="orange" />
        <TitleBox x={480} y={50} w={240} h={64} title="MetaMorpho Vault" sub="ERC-4626 · totalAssets++" accent="blue" />

        <line x1={200} y1={82} x2={260} y2={82} stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={228} y={74} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>approve()</text>

        <line x1={420} y1={82} x2={480} y2={82} stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={448} y={74} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>deposit()</text>

        {/* Reallocation arrow */}
        <line x1={600} y1={114} x2={600} y2={170} stroke={T3} strokeDasharray="3 3" markerEnd="url(#svc-arrow)" />
        <text x={612} y={144} fontFamily={FONT_TEXT} fontSize="11" fill={T3}>reallocate()</text>

        {/* Markets row */}
        {markets.map((m, i) => {
          const x = 80 + i * 240
          return (
            <TitleBox key={m} x={x} y={170} w={200} h={56} title="Morpho market" sub={m} accent="orange" />
          )
        })}

        {/* connector from vault down to markets */}
        <path
          d={`M600,114 V150 H180 V170 M600,150 H400 V170 M600,150 H620 V170`}
          fill="none"
          stroke={T3}
          strokeOpacity={0}
        />

        {/* Withdraw section */}
        <text x={w / 2} y={272} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Withdraw flow
        </text>

        <TitleBox x={40} y={300} w={160} h={64} title="Lender wallet" sub="receives USDC" accent="gray" />
        <TitleBox x={260} y={300} w={240} h={64} title="MetaMorpho Vault" sub="totalAssets−−" accent="blue" />
        <TitleBox x={560} y={300} w={200} h={64} title="Morpho market" sub="available liquidity" accent="orange" />

        <line x1={200} y1={332} x2={260} y2={332} stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={230} y={324} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>redeem()</text>

        <line x1={500} y1={332} x2={560} y2={332} stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={530} y={324} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>withdraw</text>

        <text x={w / 2} y={400} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="12" fill={T2}>
          Standard ERC-4626. The interface is familiar. The risk is your own.
        </text>
      </svg>
    </figure>
  )
}

/* ─── Curator allocation bot ──────────────────────────────────── */

export function MorphoCuratorBot() {
  const w = 800
  const h = 480

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Curator allocation bot">
        <defs><Arrow /></defs>

        <TitleBox x={(w - 280) / 2} y={20} w={280} h={64} title="Curator bot" sub="Rust daemon · ~5 min cadence" accent="blue" />

        <TitleBox x={140} y={120} w={240} h={70} title="Read metrics" sub="morpho.market() · vault.totalAssets" accent="gray" />
        <TitleBox x={420} y={120} w={240} h={70} title="Set rates" sub="CuratorRateIRM.setRates()" accent="green" />

        <line x1={w / 2 - 70} y1={84} x2={260} y2={120} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={w / 2 + 70} y1={84} x2={540} y2={120} stroke={T3} markerEnd="url(#svc-arrow)" />

        <TitleBox x={140} y={222} w={240} h={70} title="Allocation decisions" sub="supply high-util · withdraw low" accent="gray" />
        <TitleBox x={420} y={222} w={240} h={70} title="SERM algorithm" sub="kink + stress + concentration + tier" accent="green" />

        <line x1={260} y1={190} x2={260} y2={222} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={540} y1={190} x2={540} y2={222} stroke={T3} markerEnd="url(#svc-arrow)" />

        <TitleBox x={(w - 280) / 2} y={324} w={280} h={56} title="vault.reallocate(MarketAlloc[])" accent="orange" />
        <line x1={260} y1={292} x2={w / 2 - 70} y2={324} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={540} y1={292} x2={w / 2 + 70} y2={324} stroke={T3} markerEnd="url(#svc-arrow)" />

        {/* Target band visualization */}
        <text x={w / 2} y={416} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>
          Utilization target band
        </text>

        <line x1={80} y1={446} x2={720} y2={446} stroke={BD} />
        {/* tick marks for 0/50/70/85/90/100 */}
        {[
          { p: 0, label: '0%', tone: 'crit' },
          { p: 50, label: '50%', tone: 'low' },
          { p: 70, label: '70%', tone: 'target' },
          { p: 85, label: '85%', tone: 'target' },
          { p: 90, label: '90%', tone: 'high' },
          { p: 100, label: '100%', tone: 'crit' },
        ].map(t => {
          const x = 80 + (t.p / 100) * 640
          return (
            <g key={t.label}>
              <line x1={x} y1={440} x2={x} y2={452} stroke={T3} />
              <text x={x} y={468} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T2}>{t.label}</text>
            </g>
          )
        })}
        {/* target band fill */}
        <rect x={80 + 0.7 * 640} y={440} width={0.15 * 640} height={12} fill={GREEN} fillOpacity={0.3} />
        <text x={80 + 0.775 * 640} y={434} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fontWeight="500" fill={GREEN}>target</text>
      </svg>
    </figure>
  )
}

/* ─── Tier example: vault with $100k allocation ───────────────── */

export function MorphoTierExample() {
  const rows: { market: string; tier: string; cap: string; max: string; accent: Accent }[] = [
    { market: 'Top 100 Crypto', tier: 'A', cap: '30%', max: '$30,000', accent: 'green' },
    { market: 'DeFi Blue Chips', tier: 'B', cap: '20%', max: '$20,000', accent: 'blue' },
    { market: 'AI Tokens', tier: 'C', cap: '10%', max: '$10,000', accent: 'orange' },
    { market: 'Meme Index', tier: 'D', cap: '5%', max: '$5,000', accent: 'red' },
  ]
  const w = 720
  const top = 60
  const rowH = 44
  const h = top + rows.length * rowH + 24

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tier concentration example">
        <text x={w / 2} y={26} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Vault with $100,000 USDC
        </text>

        <g fontFamily={FONT_TEXT} fontSize="11" fill={T3}>
          <text x={32} y={top - 8}>MARKET</text>
          <text x={300} y={top - 8}>TIER</text>
          <text x={400} y={top - 8}>CAP</text>
          <text x={520} y={top - 8}>MAX ALLOC</text>
        </g>
        <line x1={20} y1={top - 2} x2={w - 20} y2={top - 2} stroke={BD} />

        {rows.map((r, i) => {
          const y = top + i * rowH
          const c = accentColor(r.accent)
          return (
            <g key={r.market}>
              <rect x={32} y={y + 14} width={4} height={20} fill={c} rx={2} />
              <text x={48} y={y + 30} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="500" fill={T1}>{r.market}</text>
              <text x={300} y={y + 30} fontFamily={FONT_TEXT} fontSize="13" fontWeight="600" fill={c}>{r.tier}</text>
              <text x={400} y={y + 30} fontFamily={FONT_TEXT} fontSize="12.5" fill={T1}>{r.cap}</text>
              <text x={520} y={y + 30} fontFamily={FONT_TEXT} fontSize="12.5" fill={T1}>{r.max}</text>
              {i < rows.length - 1 ? (
                <line x1={20} y1={y + rowH - 2} x2={w - 20} y2={y + rowH - 2} stroke={BD} strokeOpacity={0.4} />
              ) : null}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─── CuratorRateIRM mechanics + kink curve ───────────────────── */

export function MorphoCuratorRateIRM() {
  const w = 800
  const h = 460

  // Kink curve: gentle to 80%, then steep to 100%
  // (utilization%, APR%)
  const points: [number, number][] = [
    [0, 2], [10, 2.4], [20, 2.8], [30, 3.2], [40, 3.6],
    [50, 4.0], [60, 4.4], [70, 4.7], [80, 5.0],
    [85, 12], [90, 35], [95, 70], [100, 100],
  ]

  // chart axes
  const axL = 460, axR = 760, axT = 260, axB = 420
  const sx = (u: number) => axL + (u / 100) * (axR - axL)
  const sy = (apr: number) => axB - (apr / 100) * (axB - axT)
  const path = points.map(([u, a], i) => `${i === 0 ? 'M' : 'L'}${sx(u)},${sy(a)}`).join(' ')

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CuratorRateIRM and kink curve">
        <defs><Arrow /></defs>

        {/* Top row: curator → IRM → morpho */}
        <TitleBox x={20} y={20} w={220} h={70} title="Curator bot" sub="off-chain · runs SERM" accent="blue" />
        <TitleBox x={290} y={20} w={220} h={70} title="CuratorRateIRM" sub="on-chain · stores rates" accent="green" />
        <TitleBox x={560} y={20} w={220} h={70} title="Morpho Blue" sub="reads borrowRate()" accent="orange" />

        <line x1={240} y1={55} x2={290} y2={55} stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={265} y={48} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>setRates()</text>
        <line x1={510} y1={55} x2={560} y2={55} stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={535} y={48} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>borrowRate()</text>

        {/* SERM formula */}
        <rect x={20} y={120} width={400} height={120} rx={12} fill={SF} stroke={BD} />
        <text x={36} y={144} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>SERM rate formula</text>
        <text x={36} y={166} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11.5" fill={T1}>
          rate = kink(util) × (1 + stress×0.5)
        </text>
        <text x={36} y={184} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11.5" fill={T1}>
          × (1 + concentration) × liquidity_mult
        </text>
        <text x={36} y={202} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11.5" fill={T1}>
          + tier_premium
        </text>
        <text x={36} y={228} fontFamily={FONT_TEXT} fontSize="11.5" fill={T2}>
          stress capped at 5×; tier C/D pays a premium.
        </text>

        {/* Inputs list */}
        <rect x={20} y={260} width={400} height={170} rx={12} fill={BG} stroke={BD} />
        <text x={36} y={284} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>Inputs</text>
        {[
          ['kink(util)', 'piecewise — gentle 0–80%, steep 80–100%'],
          ['stress', '24h price moves across ITP assets'],
          ['concentration', 'penalty for single-asset dominance'],
          ['liquidity_mult', 'illiquid assets pay more'],
          ['tier_premium', 'extra cost for tiers C, D'],
        ].map(([k, v], i) => (
          <g key={k}>
            <text x={36} y={310 + i * 22} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11.5" fontWeight="500" fill={T1}>{k}</text>
            <text x={170} y={310 + i * 22} fontFamily={FONT_TEXT} fontSize="11.5" fill={T2}>{v}</text>
          </g>
        ))}

        {/* Kink curve chart */}
        <text x={(axL + axR) / 2} y={axT - 20} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>
          Kink curve (base APR)
        </text>
        <line x1={axL} y1={axB} x2={axR} y2={axB} stroke={BD} />
        <line x1={axL} y1={axT} x2={axL} y2={axB} stroke={BD} />
        {/* Y axis labels */}
        {[0, 50, 100].map(v => (
          <g key={v}>
            <text x={axL - 8} y={sy(v) + 4} textAnchor="end" fontFamily={FONT_TEXT} fontSize="10.5" fill={T3}>{v}%</text>
            <line x1={axL - 4} y1={sy(v)} x2={axL} y2={sy(v)} stroke={BD} />
          </g>
        ))}
        {/* X axis labels */}
        {[0, 80, 100].map(v => (
          <g key={v}>
            <text x={sx(v)} y={axB + 16} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="10.5" fill={T3}>{v}%</text>
            <line x1={sx(v)} y1={axB} x2={sx(v)} y2={axB + 4} stroke={BD} />
          </g>
        ))}
        {/* Kink mark at 80% */}
        <line x1={sx(80)} y1={axT} x2={sx(80)} y2={axB} stroke={BD} strokeDasharray="3 3" />
        <text x={sx(80)} y={axT - 6} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="10.5" fill={T3}>kink</text>

        <path d={path} fill="none" stroke={BLUE} strokeWidth={2} />
        <text x={axR - 8} y={axT - 6} textAnchor="end" fontFamily={FONT_TEXT} fontSize="11" fill={T2}>APR</text>
        <text x={axR - 8} y={axB + 32} textAnchor="end" fontFamily={FONT_TEXT} fontSize="11" fill={T2}>utilization →</text>
      </svg>
    </figure>
  )
}

/* ─── Morpho liquidation flow + partial example ───────────────── */

export function MorphoLiquidationFlow() {
  const w = 820
  const h = 460

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Liquidation flow">
        <defs><Arrow /></defs>

        <text x={w / 2} y={24} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Liquidation flow
        </text>
        <text x={w / 2} y={44} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="12" fill={T2}>
          When health factor drops below 1.0
        </text>

        <TitleBox x={40} y={70} w={220} h={70} title="Liquidator" sub="repays X USDC of debt" accent="red" />
        <TitleBox x={300} y={70} w={220} h={70} title="Morpho Blue" sub="validates HF < 1, transfers" accent="orange" />
        <TitleBox x={560} y={70} w={220} h={70} title="Borrower position" sub="HF improves, debt reduced" accent="gray" />

        <line x1={260} y1={105} x2={300} y2={105} stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={280} y={98} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>liquidate()</text>
        <line x1={520} y1={105} x2={560} y2={105} stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={540} y={98} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>updates state</text>
        {/* return arrow with bonus */}
        <path d="M520 130 C 480 170, 320 170, 280 140" fill="none" stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={400} y={170} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T3}>ITP collateral + 5% bonus</text>

        {/* Example panel — three states */}
        <text x={w / 2} y={216} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>
          Partial liquidation example
        </text>

        {[
          {
            title: 'Before',
            tone: RED,
            rows: [['Collateral', '10,000 ITP ($10k)'], ['Debt', '$8,000 USDC'], ['LLTV', '77%'], ['HF', '0.96 — exposed']],
            x: 40,
          },
          {
            title: 'Liquidator action',
            tone: ORANGE,
            rows: [['Pays', '$2,000 USDC'], ['Receives', '2,100 ITP'], ['Bonus', '5%'], ['', '']],
            x: 300,
          },
          {
            title: 'After',
            tone: GREEN,
            rows: [['Collateral', '7,900 ITP ($7.9k)'], ['Debt', '$6,000 USDC'], ['LLTV', '77%'], ['HF', '1.01 — solvent']],
            x: 560,
          },
        ].map(card => (
          <g key={card.title}>
            <rect x={card.x} y={236} width={220} height={200} rx={12} fill={BG} stroke={BD} />
            <rect x={card.x} y={236} width={4} height={200} fill={card.tone} rx={2} />
            <text x={card.x + 16} y={258} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>{card.title}</text>
            {card.rows.map(([k, v], i) => (
              k ? (
                <g key={k + i}>
                  <text x={card.x + 16} y={286 + i * 28} fontFamily={FONT_TEXT} fontSize="11.5" fill={T3}>{k}</text>
                  <text x={card.x + 204} y={286 + i * 28} textAnchor="end" fontFamily={FONT_TEXT} fontSize="12" fontWeight="500" fill={T1}>{v}</text>
                </g>
              ) : null
            ))}
          </g>
        ))}
      </svg>
    </figure>
  )
}

/* ─── NAV Oracle pipeline + computation table ─────────────────── */

export function MorphoNAVOracle() {
  const w = 800
  const h = 480

  const navRows: [string, string, string, string][] = [
    ['BTC', '0.00015', '$67,000', '$10.05'],
    ['ETH', '0.0028', '$3,400', '$9.52'],
    ['SOL', '0.053', '$180', '$9.54'],
    ['…', '…', '…', '…'],
  ]

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NAV oracle pipeline and computation">
        <defs><Arrow /></defs>

        <text x={w / 2} y={24} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          NAV oracle pipeline
        </text>

        <TitleBox x={20} y={50} w={240} h={68} title="Oracle network" sub="3 oracles compute NAV" accent="green" />
        <TitleBox x={290} y={50} w={220} h={68} title="BLS aggregation" sub="2/3 threshold" accent="blue" />
        <TitleBox x={540} y={50} w={240} h={68} title="ITPNAVOracle" sub="updatePrice — verify · cap · store" accent="orange" />

        <line x1={260} y1={84} x2={290} y2={84} stroke={T3} markerEnd="url(#svc-arrow)" />
        <line x1={510} y1={84} x2={540} y2={84} stroke={T3} markerEnd="url(#svc-arrow)" />

        {/* Down to morpho */}
        <line x1={660} y1={118} x2={660} y2={156} stroke={T3} markerEnd="url(#svc-arrow)" />
        <text x={700} y={140} fontFamily={FONT_TEXT} fontSize="11" fill={T3}>price() called</text>
        <TitleBox x={540} y={156} w={240} h={56} title="Morpho Blue" sub="HF · max-borrow · liquidation" accent="orange" dim />

        {/* NAV computation */}
        <text x={20} y={270} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>NAV computation</text>
        <text x={20} y={290} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="12" fill={T2}>
          NAV = Σ ( qty[i] × price[i] ) / 1e18
        </text>

        {/* example table */}
        <rect x={20} y={300} width={760} height={170} rx={12} fill={BG} stroke={BD} />

        <g fontFamily={FONT_TEXT} fontSize="11" fill={T3}>
          <text x={40} y={324}>ASSET</text>
          <text x={220} y={324}>QTY/SHARE</text>
          <text x={400} y={324}>PRICE</text>
          <text x={580} y={324}>VALUE</text>
        </g>
        <line x1={32} y1={332} x2={768} y2={332} stroke={BD} />
        {navRows.map((r, i) => (
          <g key={i}>
            <text x={40} y={356 + i * 22} fontFamily={FONT_TEXT} fontSize="12" fontWeight="500" fill={T1}>{r[0]}</text>
            <text x={220} y={356 + i * 22} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>{r[1]}</text>
            <text x={400} y={356 + i * 22} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>{r[2]}</text>
            <text x={580} y={356 + i * 22} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>{r[3]}</text>
          </g>
        ))}
        <line x1={32} y1={448} x2={768} y2={448} stroke={BD} />
        <text x={40} y={464} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>NAV per share</text>
        <text x={580} y={464} fontFamily={FONT_TEXT} fontSize="13" fontWeight="600" fill={T1}>$1.0450</text>
      </svg>
    </figure>
  )
}

/* ─── Health factor zones + liquidation price ─────────────────── */

export function MorphoHealthFactor() {
  const w = 800
  const h = 360

  const axL = 60, axR = 760
  const zones = [
    { from: 0, to: 1.0, color: RED, label: 'liquidatable' },
    { from: 1.0, to: 1.5, color: ORANGE, label: 'caution' },
    { from: 1.5, to: 2.0, color: '#f5c518', label: 'moderate' },
    { from: 2.0, to: 2.5, color: GREEN, label: 'safe' },
    { from: 2.5, to: 3.0, color: BLUE, label: 'very safe' },
  ]
  const max = 3.0
  const sx = (v: number) => axL + (v / max) * (axR - axL)
  const yBar = 110

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Health factor zones">
        <text x={w / 2} y={28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Health factor zones
        </text>
        <text x={w / 2} y={48} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="12" fill={T2}>
          HF = (collateral × oraclePrice / 1e36 × LLTV / 1e18) / debt
        </text>

        {/* zone rectangles */}
        {zones.map(z => (
          <g key={z.label}>
            <rect
              x={sx(z.from)}
              y={yBar}
              width={sx(z.to) - sx(z.from)}
              height={36}
              fill={z.color}
              fillOpacity={0.18}
              stroke={z.color}
              strokeOpacity={0.5}
            />
            <text
              x={(sx(z.from) + sx(z.to)) / 2}
              y={yBar + 22}
              textAnchor="middle"
              fontFamily={FONT_TEXT}
              fontSize="11.5"
              fontWeight="500"
              fill={z.color}
            >
              {z.label}
            </text>
          </g>
        ))}
        {/* axis ticks */}
        {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map(v => (
          <g key={v}>
            <line x1={sx(v)} y1={yBar + 36} x2={sx(v)} y2={yBar + 42} stroke={T3} />
            <text x={sx(v)} y={yBar + 58} textAnchor="middle" fontFamily={FONT_TEXT} fontSize="11" fill={T2}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Liquidation price example */}
        <rect x={20} y={210} width={w - 40} height={130} rx={12} fill={SF} stroke={BD} />
        <rect x={20} y={210} width={4} height={130} fill={ORANGE} rx={2} />
        <text x={40} y={234} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>
          Liquidation price
        </text>
        <text x={40} y={258} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="12" fill={T1}>
          liq_price = debt × 1e36 × 1e18 / (collateral × LLTV)
        </text>
        <g fontFamily={FONT_TEXT} fontSize="12" fill={T2}>
          <text x={40} y={286}>collateral = 10,000 ITP · debt = $5,000 · LLTV = 77%</text>
          <text x={40} y={306}>
            liq_price = 5000 / (10000 × 0.77) = <tspan fill={T1} fontWeight="600">$0.6494 per ITP</tspan>
          </text>
          <text x={40} y={326}>If NAV drops to $0.6494, the position is liquidatable.</text>
        </g>
      </svg>
    </figure>
  )
}

/* ─── SSE > REST > on-chain priority ──────────────────────────── */

export function MorphoDataPriority() {
  const w = 760
  const h = 240
  const cardW = 220
  const gap = 28
  const total = cardW * 3 + gap * 2
  const startX = (w - total) / 2

  const cards = [
    { title: 'SSE stream', sub: 'instant push', items: ['collateral', 'borrow_shares', 'oracle_price', 'borrow_rate'], accent: 'green' as Accent },
    { title: 'REST endpoint', sub: '30s poll', items: ['debt_amount', 'max_borrow', 'max_withdraw', 'market state'], accent: 'blue' as Accent },
    { title: 'On-chain read', sub: 'wagmi fallback', items: ['vault.totalAssets', 'vault.balanceOf', 'IRM.rates()'], accent: 'gray' as Accent },
  ]

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Data priority: SSE then REST then on-chain">
        <defs><Arrow /></defs>
        <text x={w / 2} y={26} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={T1}>
          Priority: SSE &gt; REST &gt; on-chain
        </text>

        {cards.map((c, i) => {
          const x = startX + i * (cardW + gap)
          const y = 56
          const cardH = 156
          return (
            <g key={c.title}>
              <rect x={x} y={y} width={cardW} height={cardH} rx={12} fill={BG} stroke={BD} />
              <rect x={x} y={y} width={4} height={cardH} fill={accentColor(c.accent)} rx={2} />
              <text x={x + 16} y={y + 24} fontFamily={FONT_DISPLAY} fontSize="13" fontWeight="600" fill={T1}>{c.title}</text>
              <text x={x + 16} y={y + 42} fontFamily={FONT_TEXT} fontSize="11.5" fill={T3}>{c.sub}</text>
              {c.items.map((it, j) => (
                <text key={it} x={x + 16} y={y + 68 + j * 20} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="11.5" fill={T2}>
                  {it}
                </text>
              ))}
              {i < cards.length - 1 ? (
                <line x1={x + cardW + 4} y1={y + cardH / 2} x2={x + cardW + gap - 4} y2={y + cardH / 2} stroke={T3} markerEnd="url(#svc-arrow)" />
              ) : null}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
