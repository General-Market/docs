import * as React from 'react'

/* Apple-style SVG schematics for Vision intro + sources docs. */

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

/* ─────────────────────────────────────────────────────────────
   VisionHero — wordmark + tagline + 3×5 grid of market categories
   ─────────────────────────────────────────────────────────── */

const HERO_CATEGORIES: Array<{ name: string; markets: string }> = [
  { name: 'Crypto', markets: '9,963' },
  { name: 'Weather', markets: '161,125' },
  { name: 'Trains', markets: '1,200' },
  { name: 'Quakes', markets: '300' },
  { name: 'GitHub', markets: '1,500' },
  { name: 'npm', markets: '9,183' },
  { name: 'Twitch', markets: '57,523' },
  { name: 'Movies', markets: '37,502' },
  { name: 'Steam', markets: '5,000' },
  { name: 'Flights', markets: '2,400' },
  { name: 'Stocks', markets: '3,200' },
  { name: 'Reddit', markets: '4,800' },
  { name: 'DeFi', markets: '2,100' },
  { name: 'Buoys', markets: '850' },
  { name: 'Nuclear', markets: '63' },
]

export function VisionHero() {
  const W = 880
  const PAD = 32
  const cardW = 152
  const cardH = 72
  const cols = 5
  const gapX = 12
  const gapY = 12
  const gridW = cols * cardW + (cols - 1) * gapX
  const gridX = (W - gridW) / 2
  const headerH = 100
  const gridY = PAD + headerH
  const rows = Math.ceil(HERO_CATEGORIES.length / cols)
  const gridH = rows * cardH + (rows - 1) * gapY
  const footerY = gridY + gridH + 26
  const H = footerY + 30

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vision: predict anything, win USDC">
        <text
          x={W / 2}
          y={PAD + 36}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="34"
          fontWeight="600"
          letterSpacing="0.32em"
          fill={T1}
        >
          VISION
        </text>
        <text
          x={W / 2}
          y={PAD + 70}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="14"
          fontWeight="400"
          fill={T2}
          letterSpacing="-0.005em"
        >
          Predict Anything. Win USDC.
        </text>

        {HERO_CATEGORIES.map((c, i) => {
          const r = Math.floor(i / cols)
          const col = i % cols
          const x = gridX + col * (cardW + gapX)
          const y = gridY + r * (cardH + gapY)
          return (
            <g key={c.name}>
              <rect x={x} y={y} width={cardW} height={cardH} rx={12} fill={BG} stroke={BD} />
              <text
                x={x + cardW / 2}
                y={y + 28}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {c.name}
              </text>
              <text
                x={x + cardW / 2}
                y={y + 48}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="14"
                fontWeight="500"
                fill={BLUE}
              >
                {c.markets}
              </text>
              <text
                x={x + cardW / 2}
                y={y + 62}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="10"
                fill={T3}
              >
                markets
              </text>
            </g>
          )
        })}

        <text
          x={W / 2}
          y={footerY + 6}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="12"
          fontWeight="500"
          fill={T2}
          letterSpacing="0.04em"
        >
          90+ SOURCES &nbsp;·&nbsp; 400,000+ MARKETS &nbsp;·&nbsp; SEALED BETS
        </text>
      </svg>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   FourStepsFlow — Browse · Seal · Resolve · Claim
   ─────────────────────────────────────────────────────────── */

const FOUR_STEPS: Array<{
  n: number
  title: string
  body: string
  caption: string
  accent: string
}> = [
  {
    n: 1,
    title: 'Browse',
    body: 'Pick a batch from 90+ source categories. Crypto, weather, trains, quakes — every measurable thing.',
    caption: 'Browse active batches across all categories',
    accent: BLUE,
  },
  {
    n: 2,
    title: 'Seal',
    body: 'Predict UP or DOWN per market. Sealed as keccak256(bitmap) on-chain. No one can see your bets.',
    caption: 'Encode into a compact bitmap, commit hash',
    accent: BLUE,
  },
  {
    n: 3,
    title: 'Resolve',
    body: 'Tick ends. Oracles fetch real data. 2/3+ consensus. Winners split the losers’ stakes.',
    caption: 'Real prices from external APIs determine UP/DOWN',
    accent: GREEN,
  },
  {
    n: 4,
    title: 'Claim',
    body: 'Withdraw winnings with BLS-verified balance proof. Claim any time. No lockup.',
    caption: 'BLS aggregate signature from oracle network',
    accent: GREEN,
  },
]

export function FourStepsFlow() {
  const W = 920
  const PAD = 28
  const colW = 200
  const gap = (W - PAD * 2 - colW * 4) / 3
  const titleY = 36
  const boxTop = 76
  const boxH = 220
  const captionY = boxTop + boxH + 30
  const H = captionY + 36

  return (
    <figure className="docs-schematic schematic-flow">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The four steps: browse, seal, resolve, claim">
        <defs>
          <marker id="four-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={T3} />
          </marker>
        </defs>

        <text
          x={W / 2}
          y={titleY}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.12em"
          fill={T2}
        >
          THE FOUR STEPS
        </text>

        {FOUR_STEPS.map((step, i) => {
          const x = PAD + i * (colW + gap)
          const next = i < FOUR_STEPS.length - 1
          return (
            <g key={step.n}>
              <rect x={x} y={boxTop} width={colW} height={boxH} rx={12} fill={BG} stroke={BD} />
              <rect x={x} y={boxTop} width={4} height={boxH} fill={step.accent} rx={2} />

              <circle cx={x + 32} cy={boxTop + 32} r={14} fill={step.accent} />
              <text
                x={x + 32}
                y={boxTop + 37}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                fill="#fff"
              >
                {step.n}
              </text>

              <text
                x={x + 56}
                y={boxTop + 38}
                fontFamily={FONT_DISPLAY}
                fontSize="16"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {step.title}
              </text>

              <foreignObject x={x + 18} y={boxTop + 60} width={colW - 36} height={boxH - 70}>
                <div
                  style={{
                    fontFamily: FONT_TEXT,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: T2,
                  }}
                >
                  {step.body}
                </div>
              </foreignObject>

              <text
                x={x + colW / 2}
                y={captionY}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="11"
                fill={T3}
              >
                {step.caption.length > 36 ? null : step.caption}
              </text>
              {step.caption.length > 36 ? (
                <foreignObject x={x} y={captionY - 14} width={colW} height={32}>
                  <div
                    style={{
                      fontFamily: FONT_TEXT,
                      fontSize: 11,
                      lineHeight: 1.4,
                      color: T3,
                      textAlign: 'center',
                    }}
                  >
                    {step.caption}
                  </div>
                </foreignObject>
              ) : null}

              {next ? (
                <line
                  x1={x + colW + 4}
                  y1={boxTop + boxH / 2}
                  x2={x + colW + gap - 4}
                  y2={boxTop + boxH / 2}
                  stroke={T3}
                  strokeWidth={1.25}
                  markerEnd="url(#four-arrow)"
                />
              ) : null}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   VisionVsTypical — side-by-side comparison
   ─────────────────────────────────────────────────────────── */

export function VisionVsTypical() {
  const W = 880
  const PAD = 28
  const colW = (W - PAD * 2 - 24) / 2
  const top = 28
  const headerH = 60
  const rowH = 30
  const typicalRows = [
    'Politics',
    'Sports',
    'Crypto (maybe)',
    '~500 markets',
    'Bets visible to all',
    'Manual only',
    'High fees',
  ]
  const visionRows = [
    'Finance · 14 sources',
    'Economic · 11 sources',
    'Regulatory · 4 sources',
    'Tech · 8 sources',
    'Entertainment · 14 sources',
    'Geophysical · 15 sources',
    'Transport · 16 sources',
    'Nature · 4 sources',
    'Academic · 3 sources',
    'Space · 3 sources',
    '400,000+ markets',
    'Sealed commitments',
    'Bot framework included',
    '0.05% fee on profits only',
  ]
  const maxRows = Math.max(typicalRows.length, visionRows.length)
  const bodyTop = top + headerH + 16
  const bodyH = maxRows * rowH + 16
  const H = bodyTop + bodyH + 24

  const Col = ({
    x,
    eyebrow,
    title,
    rows,
    accent,
    accentTone,
  }: {
    x: number
    eyebrow: string
    title: string
    rows: string[]
    accent: string
    accentTone: string
  }) => (
    <g>
      <rect x={x} y={top} width={colW} height={H - top - 24} rx={12} fill={BG} stroke={BD} />
      <rect x={x} y={top} width={4} height={H - top - 24} fill={accent} rx={2} />
      <text
        x={x + 20}
        y={top + 24}
        fontFamily={FONT_TEXT}
        fontSize="11"
        fontWeight="500"
        letterSpacing="0.08em"
        fill={accentTone}
      >
        {eyebrow}
      </text>
      <text
        x={x + 20}
        y={top + 48}
        fontFamily={FONT_DISPLAY}
        fontSize="16"
        fontWeight="600"
        letterSpacing="-0.005em"
        fill={T1}
      >
        {title}
      </text>
      {rows.map((r, i) => (
        <g key={r + i}>
          <circle cx={x + 26} cy={bodyTop + i * rowH + 14} r={2.5} fill={accent} />
          <text
            x={x + 38}
            y={bodyTop + i * rowH + 18}
            fontFamily={FONT_TEXT}
            fontSize="12"
            fill={T1}
          >
            {r}
          </text>
        </g>
      ))}
    </g>
  )

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Typical prediction market versus Vision">
        <Col
          x={PAD}
          eyebrow="TYPICAL PREDICTION MARKET"
          title="Politics, sports, sometimes crypto"
          rows={typicalRows}
          accent={T3}
          accentTone={T3}
        />
        <Col
          x={PAD + colW + 24}
          eyebrow="VISION"
          title="The measurable world"
          rows={visionRows}
          accent={BLUE}
          accentTone={BLUE}
        />
      </svg>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   MarketExamples — 12 example questions with their market IDs
   ─────────────────────────────────────────────────────────── */

const MARKET_EXAMPLES: Array<{ q: string; id: string }> = [
  { q: 'Will Bitcoin be higher in 5 minutes?', id: 'crypto_BTC-USD' },
  { q: 'Will it rain more in Tokyo tomorrow?', id: 'weather_tokyo' },
  { q: 'Will an earthquake hit California?', id: 'earthquake_calif' },
  { q: 'Will the Northern Line have disruptions?', id: 'tfl_tube_northern' },
  { q: 'Will Counter-Strike 2 gain players?', id: 'steam_cs2' },
  { q: 'Will npm react downloads increase?', id: 'npm_react' },
  { q: 'Will McDonald’s ice cream break in Chicago?', id: 'mcbroken_chicago' },
  { q: 'Will this GitHub repo get more stars?', id: 'github_rust-lang' },
  { q: 'Will Deutsche Bahn trains be late in Berlin?', id: 'db_trains_berlin' },
  { q: 'Will Palo Verde nuclear output change?', id: 'nrc_palo-verde-1' },
  { q: 'Will wave height increase at buoy 41002?', id: 'ndbc_41002' },
  { q: 'Will LA air quality worsen?', id: 'airnow_los-angeles' },
]

export function MarketExamples() {
  const W = 880
  const PAD = 28
  const rowH = 38
  const top = 24
  const H = top + MARKET_EXAMPLES.length * rowH + 24

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Example Vision markets">
        <rect x={PAD} y={top} width={W - PAD * 2} height={H - top - 24} rx={12} fill={BG} stroke={BD} />
        {MARKET_EXAMPLES.map((m, i) => {
          const y = top + i * rowH + rowH / 2 + 4
          return (
            <g key={m.id}>
              {i > 0 ? (
                <line
                  x1={PAD + 16}
                  y1={top + i * rowH}
                  x2={W - PAD - 16}
                  y2={top + i * rowH}
                  stroke={BD}
                  strokeOpacity="0.6"
                />
              ) : null}
              <text
                x={PAD + 24}
                y={y}
                fontFamily={FONT_TEXT}
                fontSize="13"
                fill={T1}
                letterSpacing="-0.005em"
              >
                {m.q}
              </text>
              <text
                x={W - PAD - 24}
                y={y}
                textAnchor="end"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="12"
                fill={BLUE}
              >
                {m.id}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   DataPipelineIntro — APIs → Data Node → Oracles → Contracts
   ─────────────────────────────────────────────────────────── */

export function DataPipelineIntro() {
  const W = 880
  const PAD = 28
  const top = 28
  const boxW = W - PAD * 2
  const apiH = 80
  const stageH = 110
  const gap = 36
  const stageTop = top + apiH + gap
  const H = stageTop + stageH * 3 + gap * 2 + 36

  const apis = ['USGS', 'CoinGecko', 'TFL', 'GitHub', 'NOAA', 'NRC', '+ 92 more']
  const stages: Array<{ title: string; sub: string; rows: string[]; accent: string }> = [
    {
      title: 'Data Node (Rust)',
      sub: 'Collect, validate, store',
      rows: ['HTTP collection · bounds checks · staleness checks', 'Postgres write-through'],
      accent: BLUE,
    },
    {
      title: 'Oracles (3×)',
      sub: 'Read, resolve, sign',
      rows: ['Read prices · resolve ticks', 'BLS signatures · 2/3+ consensus'],
      accent: GREEN,
    },
    {
      title: 'Smart Contracts',
      sub: 'Custody, claims, payouts',
      rows: ['VisionPool · sealed bitmaps', 'VisionClaim · BLS verification', 'VisionReserve · USDC custody'],
      accent: ORANGE,
    },
  ]

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vision data pipeline">
        <defs>
          <marker id="pipe-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={T3} />
          </marker>
        </defs>

        {/* APIs row */}
        <rect x={PAD} y={top} width={boxW} height={apiH} rx={12} fill={SF} stroke={BD} />
        <text
          x={PAD + 18}
          y={top + 24}
          fontFamily={FONT_TEXT}
          fontSize="11"
          fontWeight="500"
          letterSpacing="0.08em"
          fill={T2}
        >
          EXTERNAL APIs · 90+ SOURCES
        </text>
        {apis.map((a, i) => {
          const chipW = (boxW - 36 - (apis.length - 1) * 8) / apis.length
          const x = PAD + 18 + i * (chipW + 8)
          return (
            <g key={a}>
              <rect x={x} y={top + 38} width={chipW} height={26} rx={8} fill={BG} stroke={BD} />
              <text
                x={x + chipW / 2}
                y={top + 55}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="11.5"
                fill={T1}
              >
                {a}
              </text>
            </g>
          )
        })}

        {stages.map((s, i) => {
          const y = stageTop + i * (stageH + gap)
          const prevY = i === 0 ? top + apiH : stageTop + (i - 1) * (stageH + gap) + stageH
          return (
            <g key={s.title}>
              <line
                x1={W / 2}
                y1={prevY + 2}
                x2={W / 2}
                y2={y - 4}
                stroke={T3}
                strokeWidth={1.25}
                markerEnd="url(#pipe-arrow)"
              />
              <rect x={PAD} y={y} width={boxW} height={stageH} rx={12} fill={BG} stroke={BD} />
              <rect x={PAD} y={y} width={4} height={stageH} fill={s.accent} rx={2} />
              <text
                x={PAD + 20}
                y={y + 28}
                fontFamily={FONT_DISPLAY}
                fontSize="14"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {s.title}
              </text>
              <text
                x={PAD + 20}
                y={y + 46}
                fontFamily={FONT_TEXT}
                fontSize="12"
                fill={T2}
              >
                {s.sub}
              </text>
              {s.rows.map((r, j) => (
                <text
                  key={r}
                  x={PAD + 20}
                  y={y + 68 + j * 16}
                  fontFamily={FONT_TEXT}
                  fontSize="11.5"
                  fill={T3}
                >
                  · {r}
                </text>
              ))}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   AudienceTable — four audiences and their use cases
   ─────────────────────────────────────────────────────────── */

const AUDIENCE_ROWS: Array<{ audience: string; body: string; accent: string }> = [
  {
    audience: 'Bot developers',
    body: 'Build automated prediction strategies. Free registration, full API access, programmatic bitmap encoding. Python framework included.',
    accent: BLUE,
  },
  {
    audience: 'Manual traders',
    body: 'Browse batches in the web UI, pick UP/DOWN per market, deposit USDC. No coding required.',
    accent: GREEN,
  },
  {
    audience: 'Quant researchers',
    body: 'Backtest bitmap strategies against historical tick data across 90+ sources. Validate edge before deploying capital.',
    accent: ORANGE,
  },
  {
    audience: 'Data enthusiasts',
    body: 'Explore 400,000+ real-world data feeds. Discover obscure markets — ocean buoys, bird observations, nuclear output. Find alpha where nobody else is looking.',
    accent: RED,
  },
]

export function AudienceTable() {
  const W = 880
  const PAD = 28
  const top = 24
  const audW = 200
  const rowH = 92
  const H = top + AUDIENCE_ROWS.length * rowH + 24

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vision audiences and use cases">
        <rect x={PAD} y={top} width={W - PAD * 2} height={H - top - 24} rx={12} fill={BG} stroke={BD} />

        <line x1={PAD + audW} y1={top} x2={PAD + audW} y2={H - 24} stroke={BD} strokeOpacity="0.7" />

        {AUDIENCE_ROWS.map((row, i) => {
          const y = top + i * rowH
          const cy = y + rowH / 2
          return (
            <g key={row.audience}>
              {i > 0 ? (
                <line
                  x1={PAD + 16}
                  y1={y}
                  x2={W - PAD - 16}
                  y2={y}
                  stroke={BD}
                  strokeOpacity="0.6"
                />
              ) : null}
              <rect x={PAD + 18} y={cy - 14} width={3} height={28} fill={row.accent} rx={1.5} />
              <text
                x={PAD + 32}
                y={cy + 5}
                fontFamily={FONT_DISPLAY}
                fontSize="14"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {row.audience}
              </text>
              <foreignObject
                x={PAD + audW + 20}
                y={y + 18}
                width={W - PAD * 2 - audW - 40}
                height={rowH - 28}
              >
                <div
                  style={{
                    fontFamily: FONT_TEXT,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: T2,
                  }}
                >
                  {row.body}
                </div>
              </foreignObject>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   DataPipelineFull — full source→Postgres→API→Frontend pipeline
   ─────────────────────────────────────────────────────────── */

export function DataPipelineFull() {
  const W = 920
  const PAD = 28
  const top = 28
  const sourceY = top
  const sourceH = 70
  const sourceW = (W - PAD * 2 - 30) / 4
  const sources = [
    { name: 'USGS API', sub: 'Earthquakes' },
    { name: 'CoinGecko', sub: 'Crypto Prices' },
    { name: 'TFL API', sub: 'UK Trains' },
    { name: 'McBroken', sub: 'Ice Cream' },
  ]

  const stage = (yOff: number) => sourceY + sourceH + yOff
  const dataNodeY = stage(56)
  const dataNodeH = 130
  const pgY = dataNodeY + dataNodeH + 36
  const pgH = 88
  const apiY = pgY + pgH + 36
  const apiH = 88
  const feY = apiY + apiH + 36
  const feH = 80
  const H = feY + feH + 28

  const center = W / 2
  const stageW = 480
  const stageX = center - stageW / 2

  const Stage = ({
    y,
    h,
    title,
    sub,
    bullets,
    accent,
  }: {
    y: number
    h: number
    title: string
    sub: string
    bullets: string[]
    accent: string
  }) => (
    <g>
      <rect x={stageX} y={y} width={stageW} height={h} rx={12} fill={BG} stroke={BD} />
      <rect x={stageX} y={y} width={4} height={h} fill={accent} rx={2} />
      <text
        x={stageX + 20}
        y={y + 26}
        fontFamily={FONT_DISPLAY}
        fontSize="14"
        fontWeight="600"
        letterSpacing="-0.005em"
        fill={T1}
      >
        {title}
      </text>
      <text x={stageX + 20} y={y + 44} fontFamily={FONT_TEXT} fontSize="12" fill={T2}>
        {sub}
      </text>
      {bullets.map((b, i) => (
        <text
          key={b}
          x={stageX + 20}
          y={y + 66 + i * 16}
          fontFamily={FONT_TEXT}
          fontSize="11.5"
          fill={T3}
        >
          · {b}
        </text>
      ))}
    </g>
  )

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vision data pipeline: sources to frontend">
        <defs>
          <marker id="pf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={T3} />
          </marker>
        </defs>

        {sources.map((s, i) => {
          const x = PAD + i * (sourceW + 10)
          const cx = x + sourceW / 2
          return (
            <g key={s.name}>
              <rect x={x} y={sourceY} width={sourceW} height={sourceH} rx={12} fill={SF} stroke={BD} />
              <text
                x={cx}
                y={sourceY + 26}
                textAnchor="middle"
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {s.name}
              </text>
              <text
                x={cx}
                y={sourceY + 46}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="11.5"
                fill={T2}
              >
                {s.sub}
              </text>
              <path
                d={`M${cx},${sourceY + sourceH} C${cx},${dataNodeY - 20} ${center},${dataNodeY - 20} ${center},${dataNodeY - 4}`}
                fill="none"
                stroke={T3}
                strokeWidth={1.25}
                markerEnd="url(#pf-arrow)"
              />
            </g>
          )
        })}

        <Stage
          y={dataNodeY}
          h={dataNodeH}
          title="Data Node (Rust)"
          sub="Collect → Validate → Store → Serve"
          bullets={[
            'HTTP collection from 90+ sources',
            'Bounds + staleness validation',
            'Postgres write-through, REST API',
          ]}
          accent={BLUE}
        />
        <line
          x1={center}
          y1={dataNodeY + dataNodeH + 2}
          x2={center}
          y2={pgY - 4}
          stroke={T3}
          strokeWidth={1.25}
          markerEnd="url(#pf-arrow)"
        />

        <Stage
          y={pgY}
          h={pgH}
          title="PostgreSQL"
          sub="Hot store"
          bullets={['market_prices · market_prices_latest · source_meta']}
          accent={GREEN}
        />
        <line
          x1={center}
          y1={pgY + pgH + 2}
          x2={center}
          y2={apiY - 4}
          stroke={T3}
          strokeWidth={1.25}
          markerEnd="url(#pf-arrow)"
        />

        <Stage
          y={apiY}
          h={apiH}
          title="Vision API"
          sub="REST endpoints"
          bullets={['/api/vision/batches · /ticks · /state · /history']}
          accent={ORANGE}
        />
        <line
          x1={center}
          y1={apiY + apiH + 2}
          x2={center}
          y2={feY - 4}
          stroke={T3}
          strokeWidth={1.25}
          markerEnd="url(#pf-arrow)"
        />

        <Stage
          y={feY}
          h={feH}
          title="Frontend"
          sub="What you see"
          bullets={['Live prices, charts · batch creation · market explorer']}
          accent={RED}
        />
      </svg>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   SourceCategoryMap — 16-category grid
   ─────────────────────────────────────────────────────────── */

const CATEGORY_GROUPS: Array<{
  title: string
  count: number
  members: string[]
  accent: string
}> = [
  {
    title: 'Finance',
    count: 14,
    accent: BLUE,
    members: [
      'CoinGecko',
      'Pump.fun',
      'DefiLlama',
      'Finnhub Stocks',
      'Nasdaq',
      'Zillow',
      'Polymarket',
      'FINRA (×2)',
      'Futures',
      'Bitcoin On-Chain',
      'Yahoo Drinks',
      'TWSE',
      'Best Buy',
    ],
  },
  {
    title: 'Economic',
    count: 11,
    accent: BLUE,
    members: [
      'FRED Rates',
      'EIA Energy',
      'US Treasury',
      'ECB Rates',
      'World Bank',
      'BLS',
      'Adzuna Jobs',
      'USA Spending',
      'IMF',
      'OPEC',
      'CFTC',
    ],
  },
  {
    title: 'Regulatory',
    count: 4,
    accent: BLUE,
    members: ['SEC Filings', 'Congress Votes', 'Federal Courts', 'NYC 311'],
  },
  {
    title: 'Tech',
    count: 8,
    accent: GREEN,
    members: [
      'GitHub',
      'npm',
      'PyPI',
      'Crates.io',
      'StackOverflow',
      'Hacker News',
      'Cloudflare',
      'IODA Outages',
    ],
  },
  {
    title: 'Entertainment',
    count: 14,
    accent: GREEN,
    members: [
      'Twitch',
      'Movies / TV (TMDB)',
      'Last.fm',
      'Steam',
      'AniList',
      'Reddit',
      'Chaturbate',
      'Board Games',
      'Backpack.tf',
      '4chan',
      'Sports',
      'Esports',
      'Theme Parks',
      'McBroken',
    ],
  },
  {
    title: 'Geophysical',
    count: 15,
    accent: GREEN,
    members: [
      'USGS Earthquakes',
      'Volcanoes',
      'NOAA Weather',
      'Weather Alerts',
      'Open-Meteo',
      'AirNow',
      'USGS Water',
      'NOAA Ocean Met',
      'NOAA Tides',
      'NDBC Buoys',
      'River Gauges',
      'NRC Nuclear',
      'Wildfires',
      'Disease Tracking',
      'Power Outages',
    ],
  },
  {
    title: 'Transport',
    count: 16,
    accent: ORANGE,
    members: [
      'Global Flights',
      'Transit GTFS',
      'CityBikes',
      'Parking',
      'TomTom Traffic',
      'EV Charging',
      'Border Waits',
      'Airport Delays',
      'Deutsche Bahn',
      'NYC Subway',
      'Paris Metro',
      'Ryanair',
      'London Tube',
      'Ship Tracking',
      'Port Data',
    ],
  },
  {
    title: 'Nature',
    count: 4,
    accent: ORANGE,
    members: ['eBird', 'Wildlife (iNat)', 'Animal Migration', 'Animal Shelters'],
  },
  {
    title: 'Academic',
    count: 3,
    accent: ORANGE,
    members: ['OpenAlex', 'Crossref', 'PubMed'],
  },
  {
    title: 'Space',
    count: 3,
    accent: RED,
    members: ['Space Weather', 'ISS Tracker', 'Mil Aircraft'],
  },
]

export function SourceCategoryMap() {
  const W = 920
  const PAD = 24
  const cols = 3
  const gap = 16
  const cardW = (W - PAD * 2 - gap * (cols - 1)) / cols
  const lineH = 16
  const padInner = 16
  const headerSpace = 60
  const top = 28

  const cardHeights = CATEGORY_GROUPS.map(g => headerSpace + g.members.length * lineH + padInner)

  const colHeights = [0, 0, 0]
  const positions: Array<{ x: number; y: number; h: number }> = []
  CATEGORY_GROUPS.forEach((_g, i) => {
    let minCol = 0
    for (let c = 1; c < cols; c++) if (colHeights[c] < colHeights[minCol]) minCol = c
    const x = PAD + minCol * (cardW + gap)
    const y = top + colHeights[minCol]
    positions.push({ x, y, h: cardHeights[i] })
    colHeights[minCol] += cardHeights[i] + gap
  })
  const H = top + Math.max(...colHeights) + 16

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vision data source category map">
        {CATEGORY_GROUPS.map((g, i) => {
          const p = positions[i]
          return (
            <g key={g.title}>
              <rect x={p.x} y={p.y} width={cardW} height={p.h} rx={12} fill={BG} stroke={BD} />
              <rect x={p.x} y={p.y} width={4} height={p.h} fill={g.accent} rx={2} />
              <text
                x={p.x + 18}
                y={p.y + 26}
                fontFamily={FONT_DISPLAY}
                fontSize="14"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {g.title}
              </text>
              <text
                x={p.x + cardW - 14}
                y={p.y + 26}
                textAnchor="end"
                fontFamily={FONT_TEXT}
                fontSize="12"
                fontWeight="500"
                fill={g.accent}
              >
                {g.count}
              </text>
              <line
                x1={p.x + 18}
                y1={p.y + 38}
                x2={p.x + cardW - 14}
                y2={p.y + 38}
                stroke={BD}
                strokeOpacity="0.6"
              />
              {g.members.map((m, j) => (
                <text
                  key={m}
                  x={p.x + 18}
                  y={p.y + 58 + j * lineH}
                  fontFamily={FONT_TEXT}
                  fontSize="11.5"
                  fill={T2}
                >
                  {m}
                </text>
              ))}
            </g>
          )
        })}
      </svg>
      <figcaption>Sixteen categories. The crypto column is the smallest interesting one.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   SourceToMarketFlow — CoinGecko → Validate → Tick → BLS
   ─────────────────────────────────────────────────────────── */

export function SourceToMarketFlow() {
  const W = 880
  const PAD = 28
  const top = 28
  const titleH = 30
  const colH = 24
  const colY = top + titleH + 16
  const cardW = 280
  const cardX = (W - cardW) / 2
  const stageH = 100
  const gap = 36
  const stages: Array<{ title: string; lines: string[]; accent: string }> = [
    {
      title: 'CoinGecko · GET /price',
      lines: ['?ids=btc', 'BTC = $67,432.10'],
      accent: BLUE,
    },
    {
      title: 'Validate & Store',
      lines: ['asset_id: BTC-USD', 'price: 67432.10', 'ts: 1710403200'],
      accent: BLUE,
    },
    {
      title: 'Tick N resolves',
      lines: [
        'Start: $67,432.10',
        'End:   $67,891.55',
        'Delta: +$459.45 → UP',
      ],
      accent: GREEN,
    },
    {
      title: 'BLS-signed price on-chain',
      lines: ['2/3+ oracles must agree', 'before the tick resolves'],
      accent: ORANGE,
    },
  ]

  const total = stages.length * stageH + (stages.length - 1) * gap
  const baseY = colY + colH + 16
  const H = baseY + total + 36

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Source to market flow">
        <defs>
          <marker id="s2m-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={T3} />
          </marker>
        </defs>

        <text
          x={W / 2}
          y={top + 18}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.12em"
          fill={T2}
        >
          SOURCE TO MARKET FLOW
        </text>

        <g>
          <text
            x={PAD + 60}
            y={colY + 16}
            textAnchor="middle"
            fontFamily={FONT_TEXT}
            fontSize="11"
            fontWeight="500"
            letterSpacing="0.08em"
            fill={T3}
          >
            SOURCE API
          </text>
          <text
            x={W / 2}
            y={colY + 16}
            textAnchor="middle"
            fontFamily={FONT_TEXT}
            fontSize="11"
            fontWeight="500"
            letterSpacing="0.08em"
            fill={T3}
          >
            DATA NODE
          </text>
          <text
            x={W - PAD - 60}
            y={colY + 16}
            textAnchor="middle"
            fontFamily={FONT_TEXT}
            fontSize="11"
            fontWeight="500"
            letterSpacing="0.08em"
            fill={T3}
          >
            ON-CHAIN
          </text>
        </g>

        {stages.map((s, i) => {
          const y = baseY + i * (stageH + gap)
          return (
            <g key={s.title}>
              <rect x={cardX} y={y} width={cardW} height={stageH} rx={12} fill={BG} stroke={BD} />
              <rect x={cardX} y={y} width={4} height={stageH} fill={s.accent} rx={2} />
              <text
                x={cardX + 20}
                y={y + 28}
                fontFamily={FONT_DISPLAY}
                fontSize="14"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={T1}
              >
                {s.title}
              </text>
              {s.lines.map((line, j) => (
                <text
                  key={line}
                  x={cardX + 20}
                  y={y + 50 + j * 16}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="11.5"
                  fill={T2}
                >
                  {line}
                </text>
              ))}

              {i < stages.length - 1 ? (
                <line
                  x1={W / 2}
                  y1={y + stageH + 2}
                  x2={W / 2}
                  y2={y + stageH + gap - 4}
                  stroke={T3}
                  strokeWidth={1.25}
                  markerEnd="url(#s2m-arrow)"
                />
              ) : null}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   MarketIdConvention — prefix · asset · full ID table
   ─────────────────────────────────────────────────────────── */

const MARKET_ID_ROWS: Array<{ prefix: string; asset: string; full: string }> = [
  { prefix: 'crypto_', asset: 'BTC-USD', full: 'crypto_BTC-USD' },
  { prefix: 'earthquake_', asset: 'california', full: 'earthquake_california' },
  { prefix: 'tfl_tube_', asset: 'northern', full: 'tfl_tube_northern' },
  { prefix: 'mcbroken_', asset: 'chicago', full: 'mcbroken_chicago' },
  { prefix: 'steam_', asset: 'counter-strike-2', full: 'steam_counter-strike-2' },
  { prefix: 'defi_', asset: 'aave', full: 'defi_aave' },
  { prefix: 'db_trains_', asset: 'berlin_hbf', full: 'db_trains_berlin_hbf' },
  { prefix: 'nrc_', asset: 'palo-verde-1', full: 'nrc_palo-verde-1' },
  { prefix: 'ndbc_', asset: '41002', full: 'ndbc_41002' },
  { prefix: 'airnow_', asset: 'los-angeles', full: 'airnow_los-angeles' },
]

export function MarketIdConvention() {
  const W = 880
  const PAD = 28
  const top = 24
  const headerH = 36
  const rowH = 32
  const H = top + headerH + MARKET_ID_ROWS.length * rowH + 28

  const colXPrefix = PAD + 24
  const colXAsset = PAD + 230
  const colXFull = PAD + 470

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vision market ID convention">
        <rect x={PAD} y={top} width={W - PAD * 2} height={H - top - 24} rx={12} fill={BG} stroke={BD} />

        <rect x={PAD} y={top} width={W - PAD * 2} height={headerH} rx={12} fill={SF} />
        <rect x={PAD} y={top + headerH - 1} width={W - PAD * 2} height={1} fill={BD} />
        <text x={colXPrefix} y={top + 23} fontFamily={FONT_TEXT} fontSize="11" fontWeight="600" letterSpacing="0.08em" fill={T2}>
          PREFIX
        </text>
        <text x={colXAsset} y={top + 23} fontFamily={FONT_TEXT} fontSize="11" fontWeight="600" letterSpacing="0.08em" fill={T2}>
          ASSET
        </text>
        <text x={colXFull} y={top + 23} fontFamily={FONT_TEXT} fontSize="11" fontWeight="600" letterSpacing="0.08em" fill={T2}>
          FULL MARKET ID
        </text>

        {MARKET_ID_ROWS.map((row, i) => {
          const y = top + headerH + i * rowH
          const ty = y + rowH / 2 + 5
          return (
            <g key={row.full}>
              {i > 0 ? (
                <line x1={PAD + 14} y1={y} x2={W - PAD - 14} y2={y} stroke={BD} strokeOpacity="0.5" />
              ) : null}
              <text
                x={colXPrefix}
                y={ty}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="12"
                fill={BLUE}
              >
                {row.prefix}
              </text>
              <text
                x={colXAsset}
                y={ty}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="12"
                fill={T1}
              >
                {row.asset}
              </text>
              <text
                x={colXFull}
                y={ty}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="12"
                fontWeight="500"
                fill={T1}
              >
                {row.full}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
