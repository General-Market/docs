import * as React from 'react'

/* Apple-styled schematics for the Vision B docs (sources-browser & adding-sources).
   Server components, parameterless, data baked in. No imports beyond React. */

const FONT_DISPLAY = '"SF Pro Display","Helvetica Neue",sans-serif'
const FONT_TEXT = '"SF Pro Text","Helvetica Neue",sans-serif'
const FONT_MONO = '"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace'

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

/* ---------- Generic primitives ----------------------------------------- */

function Box({
  x, y, w, h, accent, title, sub, mono, titleSize = 14,
}: {
  x: number; y: number; w: number; h: number;
  accent?: string; title?: string; sub?: string; mono?: boolean; titleSize?: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={BG} stroke={BD} />
      {accent ? <rect x={x} y={y} width={4} height={h} rx={2} fill={accent} /> : null}
      {title ? (
        <text
          x={x + 16} y={y + 26}
          fontFamily={mono ? FONT_MONO : FONT_DISPLAY}
          fontSize={titleSize} fontWeight={600} letterSpacing="-0.005em" fill={T1}
        >{title}</text>
      ) : null}
      {sub ? (
        <text
          x={x + 16} y={y + (title ? 46 : 26)}
          fontFamily={FONT_TEXT} fontSize={12} fill={T2}
        >{sub}</text>
      ) : null}
    </g>
  )
}

function ArrowMarkers() {
  return (
    <defs>
      <marker id="vb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={T3} />
      </marker>
      <marker id="vb-arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={BLUE} />
      </marker>
    </defs>
  )
}

/* ===========================================================================
   sources-browser.mdx schematics
   ========================================================================= */

/* 1. Browser overview — two cards (listing → detail) */
export function BrowserOverview() {
  const W = 760, H = 320
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sources browser overview">
        <ArrowMarkers />
        <text x={W / 2} y={28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>
          Sources browser
        </text>

        <g>
          <rect x={40} y={60} width={300} height={230} rx={12} fill={BG} stroke={BD} />
          <rect x={40} y={60} width={4} height={230} rx={2} fill={BLUE} />
          <text x={60} y={86} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>Sources listing</text>
          <text x={60} y={104} fontFamily={FONT_MONO} fontSize={11.5} fill={T2}>/</text>
          {[
            'Category nav bar',
            'Sort bar',
            'Source cards grid',
            'Bitmap overlay',
          ].map((t, i) => (
            <g key={i}>
              <circle cx={66} cy={134 + i * 28} r={2} fill={T3} />
              <text x={78} y={138 + i * 28} fontFamily={FONT_TEXT} fontSize={12.5} fill={T1}>{t}</text>
            </g>
          ))}
        </g>

        <line x1={350} y1={175} x2={420} y2={175} stroke={T3} strokeWidth={1.5} markerEnd="url(#vb-arrow)" />
        <text x={385} y={168} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fill={T3}>click</text>

        <g>
          <rect x={430} y={60} width={300} height={230} rx={12} fill={BG} stroke={BD} />
          <rect x={430} y={60} width={4} height={230} rx={2} fill={GREEN} />
          <text x={450} y={86} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>Source detail</text>
          <text x={450} y={104} fontFamily={FONT_MONO} fontSize={11.5} fill={T2}>/source/[sourceId]</text>
          {[
            'Hero banner',
            'Batch tick bar',
            'Markets table',
            'Price history charts',
            'Top players board',
            'Batch entry panel',
          ].map((t, i) => (
            <g key={i}>
              <circle cx={456} cy={130 + i * 22} r={2} fill={T3} />
              <text x={468} y={134 + i * 22} fontFamily={FONT_TEXT} fontSize={12.5} fill={T1}>{t}</text>
            </g>
          ))}
        </g>
      </svg>
    </figure>
  )
}

/* 2. Category nav — pills grid */
export function CategoryNavBar() {
  const cats: { name: string; count: number }[] = [
    { name: 'All', count: 98 },
    { name: 'Finance', count: 14 },
    { name: 'Economic', count: 11 },
    { name: 'Tech', count: 8 },
    { name: 'Entertainment', count: 15 },
    { name: 'Geophysical', count: 15 },
    { name: 'Transport', count: 16 },
    { name: 'Nature', count: 4 },
    { name: 'Space', count: 3 },
    { name: 'Regulatory', count: 4 },
    { name: 'Academic', count: 3 },
  ]
  const W = 760
  const PAD = 12
  const GAP_X = 8
  const GAP_Y = 10
  const PILL_H = 32
  // measure widths
  const widths = cats.map(c => Math.ceil((c.name.length + String(c.count).length + 2) * 7.6) + 28)
  // wrap rows
  type Row = { items: { c: typeof cats[number]; x: number; w: number }[]; y: number }
  const rows: Row[] = []
  let curRow: Row['items'] = []
  let curX = PAD
  let yCursor = 22
  cats.forEach((c, i) => {
    const w = widths[i]
    if (curX + w + PAD > W && curRow.length > 0) {
      rows.push({ items: curRow, y: yCursor })
      curRow = []
      curX = PAD
      yCursor += PILL_H + GAP_Y
    }
    curRow.push({ c, x: curX, w })
    curX += w + GAP_X
  })
  if (curRow.length) rows.push({ items: curRow, y: yCursor })
  const H = yCursor + PILL_H + 16

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Category nav bar">
        {rows.map((r, ri) =>
          r.items.map((it, ci) => {
            const active = ri === 0 && ci === 0
            return (
              <g key={`${ri}-${ci}`}>
                <rect
                  x={it.x} y={r.y} width={it.w} height={PILL_H} rx={PILL_H / 2}
                  fill={active ? T1 : BG} stroke={active ? T1 : BD}
                />
                <text
                  x={it.x + it.w / 2} y={r.y + 21}
                  textAnchor="middle"
                  fontFamily={FONT_TEXT} fontSize={12.5} fontWeight={500} letterSpacing="-0.005em"
                  fill={active ? '#fff' : T1}
                >
                  {it.c.name}
                  <tspan fill={active ? 'rgba(255,255,255,0.7)' : T3} fontWeight={400}>
                    {'   '}{it.c.count}
                  </tspan>
                </text>
              </g>
            )
          })
        )}
      </svg>
    </figure>
  )
}

/* 3. Source card anatomy */
export function SourceCardAnatomy() {
  const W = 460, H = 360
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Source card anatomy">
        {/* card outline */}
        <rect x={60} y={20} width={340} height={320} rx={16} fill={BG} stroke={BD} />

        {/* logo area */}
        <rect x={60} y={20} width={340} height={140} rx={16} fill={SF} />
        <rect x={60} y={140} width={340} height={20} fill={SF} />
        <rect x={140} y={48} width={180} height={84} rx={12} fill={BG} stroke={BD} strokeDasharray="3 3" />
        <text x={230} y={96} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fill={T3}>Source logo</text>

        {/* category badge */}
        <rect x={330} y={36} width={60} height={20} rx={10} fill={BG} stroke={BD} />
        <text x={360} y={50} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={10} fontWeight={600} letterSpacing="0.06em" fill={T2}>FINANCE</text>

        {/* name + status + desc */}
        <text x={80} y={188} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>CoinGecko Crypto</text>
        <circle cx={328} cy={184} r={4} fill={GREEN} />
        <text x={338} y={188} fontFamily={FONT_TEXT} fontSize={11.5} fill={T2}>Live</text>
        <text x={80} y={208} fontFamily={FONT_TEXT} fontSize={12} fill={T2}>
          <tspan>Cryptocurrency market data —</tspan>
          <tspan x={80} dy={16}>prices, volumes, market caps…</tspan>
        </text>

        {/* stat row */}
        <line x1={60} y1={246} x2={400} y2={246} stroke={BD} />
        {[
          { label: 'MARKETS', value: '2,400' },
          { label: 'TYPE', value: 'Price' },
          { label: 'UPDATED', value: '2m ago' },
        ].map((s, i) => (
          <g key={i}>
            <text x={75 + i * 113} y={266} fontFamily={FONT_TEXT} fontSize={9.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>{s.label}</text>
            <text x={75 + i * 113} y={286} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={500} fill={T1}>{s.value}</text>
            {i < 2 ? <line x1={170 + i * 113} y1={250} x2={170 + i * 113} y2={302} stroke={BD} /> : null}
          </g>
        ))}

        {/* action row */}
        <line x1={60} y1={302} x2={400} y2={302} stroke={BD} />
        {['Markets', 'Batch', 'Details'].map((t, i) => (
          <g key={t}>
            <text x={130 + i * 113} y={324} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={12} fontWeight={500} fill={BLUE}>{t}</text>
            {i < 2 ? <line x1={173 + i * 113} y1={306} x2={173 + i * 113} y2={340} stroke={BD} /> : null}
          </g>
        ))}
      </svg>
    </figure>
  )
}

/* 4. Hover overlay */
export function HoverOverlay() {
  const rows = [
    { name: 'Bitcoin', value: '$67,432.10', side: 'up' as const },
    { name: 'Ethereum', value: '$3,891.55', side: 'up' as const },
    { name: 'Solana', value: '$142.33', side: null },
    { name: 'BNB', value: '$612.40', side: 'down' as const },
    { name: 'XRP', value: '$0.62', side: 'down' as const },
    { name: 'Dogecoin', value: '$0.15', side: null },
    { name: 'Cardano', value: '$0.45', side: 'up' as const },
  ]
  const W = 460, H = 380
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hover overlay">
        <rect x={60} y={20} width={340} height={340} rx={16} fill={BG} stroke={BD} />

        {/* header */}
        <text x={80} y={48} fontFamily={FONT_DISPLAY} fontSize={13.5} fontWeight={600} letterSpacing="-0.005em" fill={T1}>CoinGecko Crypto</text>
        <text x={380} y={48} textAnchor="end" fontFamily={FONT_TEXT} fontSize={11} fontWeight={500} letterSpacing="0.04em" fill={T3}>2,400</text>
        <line x1={60} y1={62} x2={400} y2={62} stroke={BD} />

        {/* rows */}
        {rows.map((r, i) => {
          const y = 78 + i * 30
          const sideColor = r.side === 'up' ? GREEN : r.side === 'down' ? RED : 'transparent'
          return (
            <g key={i}>
              <rect x={70} y={y - 14} width={3} height={24} rx={1.5} fill={sideColor} />
              <text x={84} y={y + 4} fontFamily={FONT_TEXT} fontSize={12.5} fill={T1}>{r.name}</text>
              <text x={388} y={y + 4} textAnchor="end" fontFamily={FONT_MONO} fontSize={12} fill={T1}>{r.value}</text>
            </g>
          )
        })}

        <text x={230} y={300} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11.5} fill={T3}>+2,393 more</text>

        {/* bottom counts */}
        <line x1={60} y1={318} x2={400} y2={318} stroke={BD} />
        <g fontFamily={FONT_TEXT} fontSize={12}>
          <text x={130} y={342} textAnchor="middle">
            <tspan fill={GREEN} fontWeight={600}>1,200</tspan>
            <tspan fill={T2}>{'  UP'}</tspan>
          </text>
          <text x={230} y={342} textAnchor="middle">
            <tspan fill={RED} fontWeight={600}>1,200</tspan>
            <tspan fill={T2}>{'  DN'}</tspan>
          </text>
          <text x={330} y={342} textAnchor="middle">
            <tspan fill={T1} fontWeight={600}>0</tspan>
            <tspan fill={T2}>{'  unset'}</tspan>
          </text>
        </g>
      </svg>
    </figure>
  )
}

/* 5. Source detail layout */
export function SourceDetailLayout() {
  const W = 880, H = 540
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Source detail layout">
        {/* nav strip */}
        <rect x={20} y={20} width={W - 40} height={36} rx={12} fill={BG} stroke={BD} />
        {[
          { t: 'All', n: '98', a: true },
          { t: 'Finance', n: '14' },
          { t: 'Economic', n: '11' },
          { t: 'Tech', n: '8' },
          { t: 'Space', n: '3' },
        ].map((c, i) => {
          const w = (c.t.length + c.n.length) * 7 + 26
          const x = 36 + i * 100
          return (
            <g key={i}>
              <rect x={x} y={28} width={w} height={20} rx={10} fill={c.a ? T1 : 'transparent'} stroke={c.a ? T1 : BD} />
              <text x={x + w / 2} y={42} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fontWeight={500} fill={c.a ? '#fff' : T1}>{c.t} {c.n}</text>
            </g>
          )
        })}

        {/* hero */}
        <rect x={20} y={70} width={W - 40} height={120} rx={14} fill={BG} stroke={BD} />
        <rect x={20} y={70} width={420} height={120} rx={14} fill={SF} fillOpacity={0.6} />
        <rect x={36} y={84} width={70} height={18} rx={9} fill={BG} stroke={BD} />
        <text x={71} y={97} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={10} fontWeight={600} letterSpacing="0.08em" fill={T2}>FINANCE</text>
        <circle cx={130} cy={93} r={4} fill={GREEN} />
        <text x={140} y={97} fontFamily={FONT_TEXT} fontSize={11} fill={T2}>LIVE</text>
        <text x={36} y={130} fontFamily={FONT_DISPLAY} fontSize={20} fontWeight={600} letterSpacing="-0.011em" fill={T1}>CoinGecko Crypto</text>
        <text x={36} y={154} fontFamily={FONT_TEXT} fontSize={12.5} fill={T2}>Cryptocurrency market data — prices,</text>
        <text x={36} y={172} fontFamily={FONT_TEXT} fontSize={12.5} fill={T2}>volumes, market caps for thousands of tokens.</text>
        <rect x={620} y={92} width={180} height={76} rx={10} fill={BG} stroke={BD} strokeDasharray="3 3" />
        <text x={710} y={134} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fill={T3}>Source logo</text>

        {/* batch bar */}
        <rect x={20} y={204} width={W - 40} height={42} rx={12} fill={BG} stroke={BD} />
        {[
          { l: 'TICK', v: '#1,247' },
          { l: 'PLAYERS', v: '42' },
          { l: 'POOL', v: '$12.5K' },
          { l: 'MULT', v: '1.2x' },
          { l: 'SET', v: '18/24' },
          { l: 'TIMER', v: '4:32' },
        ].map((s, i) => {
          const x = 40 + i * 100
          return (
            <g key={i}>
              <text x={x} y={222} fontFamily={FONT_TEXT} fontSize={9.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>{s.l}</text>
              <text x={x} y={238} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>{s.v}</text>
            </g>
          )
        })}
        {/* progress */}
        <rect x={640} y={216} width={200} height={14} rx={7} fill={SF} stroke={BD} />
        <rect x={640} y={216} width={130} height={14} rx={7} fill={BLUE} />

        {/* main two-column */}
        <rect x={20} y={260} width={550} height={260} rx={14} fill={BG} stroke={BD} />
        <text x={36} y={284} fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="-0.005em" fill={T1}>Markets table</text>
        {/* mini table rows */}
        {[
          { a: 'BTC-USD', v: '$67.4K', c: '+2.1%', side: 'up' },
          { a: 'ETH-USD', v: '$3.8K', c: '−0.5%', side: 'down' },
          { a: 'SOL-USD', v: '$142', c: '+4.2%', side: 'up' },
        ].map((r, i) => {
          const y = 308 + i * 26
          return (
            <g key={i}>
              <text x={40} y={y} fontFamily={FONT_MONO} fontSize={11.5} fill={T1}>{r.a}</text>
              <text x={180} y={y} fontFamily={FONT_MONO} fontSize={11.5} fill={T1}>{r.v}</text>
              <text x={300} y={y} fontFamily={FONT_MONO} fontSize={11.5} fill={r.c.startsWith('−') ? RED : GREEN}>{r.c}</text>
              <rect x={420} y={y - 13} width={50} height={20} rx={10} fill={r.side === 'up' ? GREEN : RED} fillOpacity={0.12} stroke={r.side === 'up' ? GREEN : RED} />
              <text x={445} y={y + 1} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={10} fontWeight={600} fill={r.side === 'up' ? GREEN : RED}>{r.side === 'up' ? 'UP' : 'DN'}</text>
            </g>
          )
        })}

        {/* price chart placeholder */}
        <rect x={36} y={394} width={520} height={70} rx={10} fill={SF} />
        <polyline points="50,450 90,440 130,432 170,438 210,420 250,412 290,418 330,402 370,394 410,408 450,400 490,392 540,400" fill="none" stroke={BLUE} strokeWidth={1.5} />
        <text x={296} y={482} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={10.5} fill={T3}>Price history (24h)</text>

        {/* leaderboard */}
        <line x1={36} y1={500} x2={555} y2={500} stroke={BD} />
        <text x={36} y={515} fontFamily={FONT_DISPLAY} fontSize={11.5} fontWeight={600} fill={T1}>Top players: 0xAb..12 · 0x7F..89 · 0xCd..56</text>

        {/* batch entry panel */}
        <rect x={585} y={260} width={275} height={260} rx={14} fill={BG} stroke={BD} />
        <text x={601} y={284} fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="-0.005em" fill={T1}>Batch entry panel</text>
        <text x={601} y={306} fontFamily={FONT_TEXT} fontSize={12} fill={T2}>Set your predictions and</text>
        <text x={601} y={322} fontFamily={FONT_TEXT} fontSize={12} fill={T2}>join the batch.</text>

        <text x={601} y={356} fontFamily={FONT_TEXT} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={T3}>DEPOSIT</text>
        <rect x={601} y={364} width={244} height={32} rx={8} fill={SF} stroke={BD} />
        <text x={613} y={385} fontFamily={FONT_MONO} fontSize={12} fill={T1}>USDC</text>

        <text x={601} y={420} fontFamily={FONT_TEXT} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={T3}>STAKE / TICK</text>
        <rect x={601} y={428} width={244} height={32} rx={8} fill={SF} stroke={BD} />
        <text x={613} y={449} fontFamily={FONT_MONO} fontSize={12} fill={T1}>USDC</text>

        <rect x={601} y={478} width={244} height={32} rx={8} fill={BLUE} />
        <text x={723} y={499} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={12.5} fontWeight={600} fill="#fff">Approve & Join</text>
      </svg>
    </figure>
  )
}

/* 6. Batch tick bar — long pill row */
export function BatchTickBar() {
  const cells = [
    { l: 'TICK', v: '#1,247' },
    { l: 'PLAYERS', v: '42' },
    { l: 'POOL', v: '$12.5K' },
    { l: 'MULT', v: '1.2×' },
    { l: 'SET', v: '18/24' },
    { l: 'TIMER', v: '4:32' },
  ]
  const W = 760, H = 100
  const cellW = 100
  const startX = 20
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Batch tick bar">
        <rect x={20} y={20} width={W - 40} height={60} rx={14} fill={BG} stroke={BD} />
        {cells.map((c, i) => {
          const x = startX + 20 + i * cellW
          return (
            <g key={i}>
              <text x={x} y={42} fontFamily={FONT_TEXT} fontSize={10} fontWeight={600} letterSpacing="0.08em" fill={T3}>{c.l}</text>
              <text x={x} y={62} fontFamily={FONT_MONO} fontSize={13.5} fill={T1}>{c.v}</text>
              {i < cells.length - 1 ? <line x1={x + cellW - 26} y1={32} x2={x + cellW - 26} y2={70} stroke={BD} /> : null}
            </g>
          )
        })}
        {/* progress bar inset right */}
        <rect x={620} y={48} width={120} height={6} rx={3} fill={SF} stroke={BD} />
        <rect x={620} y={48} width={78} height={6} rx={3} fill={BLUE} />
      </svg>
    </figure>
  )
}

/* 7. Markets table anatomy */
export function MarketsTableAnatomy() {
  const W = 760, H = 320
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Markets table anatomy">
        <rect x={20} y={20} width={W - 40} height={H - 40} rx={14} fill={BG} stroke={BD} />

        {/* header */}
        {['ASSET', 'VALUE', '24H CHANGE', 'YOUR BET'].map((h, i) => (
          <text key={i} x={48 + i * 170} y={50} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>{h}</text>
        ))}
        <line x1={36} y1={62} x2={W - 36} y2={62} stroke={BD} />

        {/* row: BTC */}
        <text x={48} y={88} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>BTC-USD</text>
        <text x={218} y={88} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>$67,432.10</text>
        <text x={388} y={88} fontFamily={FONT_MONO} fontSize={12.5} fill={GREEN}>+2.14%</text>
        <rect x={558} y={75} width={50} height={20} rx={10} fill={GREEN} fillOpacity={0.12} stroke={GREEN} />
        <text x={583} y={89} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fontWeight={600} fill={GREEN}>UP</text>

        {/* expanded chart */}
        <rect x={48} y={108} width={W - 96} height={106} rx={10} fill={SF} stroke={BD} />
        <text x={62} y={126} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.06em" fill={T3}>24H PRICE HISTORY</text>
        <polyline points="62,196 110,180 160,168 210,176 260,156 310,148 360,160 410,138 460,142 510,128 560,132 610,118 670,124" fill="none" stroke={BLUE} strokeWidth={1.5} />

        <line x1={36} y1={232} x2={W - 36} y2={232} stroke={BD} />

        {/* row: ETH */}
        <text x={48} y={258} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>ETH-USD</text>
        <text x={218} y={258} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>$3,891.55</text>
        <text x={388} y={258} fontFamily={FONT_MONO} fontSize={12.5} fill={RED}>−0.52%</text>
        <rect x={558} y={245} width={50} height={20} rx={10} fill={RED} fillOpacity={0.12} stroke={RED} />
        <text x={583} y={259} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fontWeight={600} fill={RED}>DOWN</text>

        <text x={48} y={286} fontFamily={FONT_TEXT} fontSize={11.5} fill={T3}>…</text>
      </svg>
    </figure>
  )
}

/* 8. Market ID anatomy — prefix + asset breakdown */
export function MarketIdAnatomy() {
  const examples = [
    { prefix: 'crypto_', asset: 'BTC-USD' },
    { prefix: 'earthquake_', asset: 'california' },
    { prefix: 'db_trains_', asset: 'berlin_hbf' },
    { prefix: 'mcbroken_', asset: 'chicago' },
  ]
  const W = 700
  const H = 60 + examples.length * 70
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Market ID anatomy">
        <text x={W / 2} y={32} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>
          Market ID anatomy
        </text>

        {examples.map((e, i) => {
          const y = 64 + i * 70
          const cx = W / 2
          const charW = 11
          const totalChars = e.prefix.length + e.asset.length
          const totalW = totalChars * charW
          const startX = cx - totalW / 2
          const prefixW = e.prefix.length * charW
          const assetW = e.asset.length * charW
          return (
            <g key={i}>
              {/* prefix box */}
              <rect x={startX - 6} y={y - 22} width={prefixW + 12} height={36} rx={8} fill={BLUE} fillOpacity={0.08} stroke={BLUE} strokeOpacity={0.5} />
              {/* asset box */}
              <rect x={startX + prefixW - 6} y={y - 22} width={assetW + 12} height={36} rx={8} fill={SF} stroke={BD} />
              <text x={startX} y={y + 4} fontFamily={FONT_MONO} fontSize={15} fill={BLUE} fontWeight={500}>{e.prefix}</text>
              <text x={startX + prefixW} y={y + 4} fontFamily={FONT_MONO} fontSize={15} fill={T1}>{e.asset}</text>
              <text x={startX + prefixW / 2} y={y + 36} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={10.5} fill={BLUE}>prefix</text>
              <text x={startX + prefixW + assetW / 2} y={y + 36} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={10.5} fill={T3}>asset</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* 9. Price chart example */
export function PriceChartExample() {
  const W = 760, H = 300
  // synthetic data points
  const pts: [number, number][] = [
    [0, 67100], [1, 67320], [2, 67450], [3, 67280], [4, 67500], [5, 67620],
    [6, 67550], [7, 67680], [8, 67430], [9, 67380], [10, 67510], [11, 67700],
    [12, 67780], [13, 67620], [14, 67410], [15, 67250], [16, 67040], [17, 66950],
    [18, 67120], [19, 67280], [20, 67410], [21, 67380], [22, 67460], [23, 67580],
  ]
  const xMin = 0, xMax = 23
  const yMin = 66500, yMax = 68000
  const plotX = 90, plotY = 60, plotW = W - 130, plotH = H - 120
  const sx = (x: number) => plotX + ((x - xMin) / (xMax - xMin)) * plotW
  const sy = (y: number) => plotY + plotH - ((y - yMin) / (yMax - yMin)) * plotH
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')

  const ticks = [66500, 67000, 67500, 68000]
  const xticks = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'now']

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Price chart — BTC-USD 24h">
        <text x={20} y={32} fontFamily={FONT_DISPLAY} fontSize={13.5} fontWeight={600} letterSpacing="-0.005em" fill={T1}>Price history: BTC-USD (24h)</text>

        {/* y grid */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={plotX} y1={sy(t)} x2={plotX + plotW} y2={sy(t)} stroke={BD} strokeDasharray="2 4" />
            <text x={plotX - 8} y={sy(t) + 4} textAnchor="end" fontFamily={FONT_MONO} fontSize={10.5} fill={T3}>${(t / 1000).toFixed(1)}K</text>
          </g>
        ))}

        {/* line */}
        <path d={path} fill="none" stroke={BLUE} strokeWidth={1.75} />
        {/* gradient fill below */}
        <defs>
          <linearGradient id="vb-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity="0.18" />
            <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L${sx(xMax)},${plotY + plotH} L${sx(xMin)},${plotY + plotH} Z`} fill="url(#vb-area)" />

        {/* x labels */}
        {xticks.map((t, i) => {
          const x = plotX + (i / (xticks.length - 1)) * plotW
          return (
            <g key={i}>
              <line x1={x} y1={plotY + plotH} x2={x} y2={plotY + plotH + 4} stroke={T3} />
              <text x={x} y={plotY + plotH + 18} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={10.5} fill={T3}>{t}</text>
            </g>
          )
        })}

        <line x1={plotX} y1={plotY + plotH} x2={plotX + plotW} y2={plotY + plotH} stroke={BD} />
      </svg>
    </figure>
  )
}

/* 10. Value-types-by-source table */
export function ValueTypesTable() {
  const rows = [
    ['CoinGecko', 'Price', 'USD', '$67,432.10'],
    ['Finnhub Stocks', 'Price', 'USD', '$189.52'],
    ['Polymarket', 'Probability', '%', '73.2%'],
    ['USGS Earthquakes', 'Magnitude', 'M', '4.2 M'],
    ['Deutsche Bahn', 'Avg Delay', 'min', '8.3 min'],
    ['Steam Gaming', 'Players', 'online', '1.2M online'],
    ['McBroken', '% Broken', '%', '12.5%'],
    ['GitHub', 'Stars', '—', '45.2K'],
    ['NOAA Tides', 'Water Level', 'ft', '2.34 ft'],
    ['London Underground', 'Disruption', '0–8', '3'],
    ['Air Quality', 'AQI', '0–500', '42'],
    ['NRC Nuclear', 'Power', '%', '98.5%'],
    ['Theme Park Waits', 'Avg Wait', 'min', '45 min'],
    ['Border Wait Times', 'Wait Time', 'min', '32 min'],
  ]
  const W = 760
  const headerH = 40
  const rowH = 28
  const H = headerH + rows.length * rowH + 28
  const cols = [40, 280, 440, 560]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Value types by source">
        <rect x={20} y={20} width={W - 40} height={H - 40} rx={14} fill={BG} stroke={BD} />

        {['Source', 'Value Label', 'Unit', 'Example'].map((h, i) => (
          <text key={i} x={cols[i]} y={48} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>{h.toUpperCase()}</text>
        ))}
        <line x1={36} y1={60} x2={W - 36} y2={60} stroke={BD} />

        {rows.map((r, i) => {
          const y = 60 + headerH / 2 + i * rowH
          return (
            <g key={i}>
              {i > 0 ? <line x1={36} y1={y - rowH / 2 - 8} x2={W - 36} y2={y - rowH / 2 - 8} stroke={BD} strokeOpacity={0.4} /> : null}
              <text x={cols[0]} y={y + 5} fontFamily={FONT_TEXT} fontSize={12.5} fill={T1}>{r[0]}</text>
              <text x={cols[1]} y={y + 5} fontFamily={FONT_TEXT} fontSize={12.5} fill={T2}>{r[1]}</text>
              <text x={cols[2]} y={y + 5} fontFamily={FONT_MONO} fontSize={12} fill={T2}>{r[2]}</text>
              <text x={cols[3]} y={y + 5} fontFamily={FONT_MONO} fontSize={12} fill={T1}>{r[3]}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* 11. Tick resolution flow */
export function SourceBrowserTickFlow() {
  const W = 760, H = 320
  const pts: [number, number][] = [
    [0, 67432], [1, 67410], [2, 67380], [3, 67450], [4, 67510], [5, 67580],
    [6, 67620], [7, 67700], [8, 67780], [9, 67830], [10, 67891],
  ]
  const xMin = 0, xMax = 10
  const yMin = 67200, yMax = 68000
  const plotX = 80, plotY = 110, plotW = W - 160, plotH = 130
  const sx = (x: number) => plotX + ((x - xMin) / (xMax - xMin)) * plotW
  const sy = (y: number) => plotY + plotH - ((y - yMin) / (yMax - yMin)) * plotH
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tick resolution flow">
        <text x={W / 2} y={28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>Tick resolution flow</text>

        {/* start label */}
        <g>
          <text x={plotX} y={56} fontFamily={FONT_TEXT} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={T3}>TICK START</text>
          <text x={plotX} y={78} fontFamily={FONT_MONO} fontSize={13} fill={T1}>BTC-USD = $67,432.10</text>
        </g>
        <g>
          <text x={W - plotX} y={56} textAnchor="end" fontFamily={FONT_TEXT} fontSize={11} fontWeight={600} letterSpacing="0.06em" fill={T3}>TICK END</text>
          <text x={W - plotX} y={78} textAnchor="end" fontFamily={FONT_MONO} fontSize={13} fill={T1}>BTC-USD = $67,891.55</text>
        </g>

        {/* chart frame */}
        <rect x={plotX - 12} y={plotY - 14} width={plotW + 24} height={plotH + 28} rx={12} fill={SF} stroke={BD} />
        <path d={path} fill="none" stroke={GREEN} strokeWidth={2} />
        <defs>
          <linearGradient id="vb-tick-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.22" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L${sx(xMax)},${plotY + plotH} L${sx(xMin)},${plotY + plotH} Z`} fill="url(#vb-tick-area)" />
        <text x={plotX + plotW / 2} y={plotY + plotH + 22} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fill={T3}>Tick duration · 10 min</text>

        {/* delta + result */}
        <text x={plotX} y={282} fontFamily={FONT_TEXT} fontSize={12.5} fill={T2}>
          Delta <tspan fontFamily={FONT_MONO} fill={T1}>+$459.45</tspan>
        </text>
        <rect x={plotX + 130} y={266} width={64} height={22} rx={11} fill={GREEN} fillOpacity={0.14} stroke={GREEN} />
        <text x={plotX + 162} y={282} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11.5} fontWeight={600} fill={GREEN}>UP</text>

        <text x={plotX} y={306} fontFamily={FONT_TEXT} fontSize={12} fill={T2}>UP wins · DOWN loses · winners split losers' stakes (minus 0.05% fee on profits)</text>
      </svg>
    </figure>
  )
}

/* 12. Source monitoring */
export function SourceMonitoring() {
  const stats = [
    { l: 'SOURCES', v: '98', c: T1 },
    { l: 'HEALTHY', v: '94', c: GREEN },
    { l: 'STALE', v: '3', c: ORANGE },
    { l: 'DEAD', v: '1', c: RED },
    { l: 'LIVE ASSETS', v: '4,200/4,500', c: T1 },
    { l: 'UPDATED', v: '14:32', c: T1 },
  ]
  const rows = [
    { src: 'coingecko', status: 'OK', statusColor: GREEN, assets: '2,400', stale: '0', zero: '0', age: '30s' },
    { src: 'earthquake', status: 'OK', statusColor: GREEN, assets: '12', stale: '0', zero: '0', age: '45s' },
    { src: 'steam', status: 'STALE', statusColor: ORANGE, assets: '85', stale: '3', zero: '0', age: '25m' },
    { src: '…', status: '', statusColor: T3, assets: '', stale: '', zero: '', age: '' },
  ]
  const W = 880, H = 360
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Source monitoring dashboard">
        <text x={20} y={32} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>Source monitoring</text>
        <text x={20} y={52} fontFamily={FONT_TEXT} fontSize={12} fill={T2}>Live health status of all data sources feeding market prices.</text>

        {/* stat strip */}
        <rect x={20} y={70} width={W - 40} height={64} rx={14} fill={BG} stroke={BD} />
        {stats.map((s, i) => {
          const x = 40 + i * 140
          return (
            <g key={i}>
              <text x={x} y={94} fontFamily={FONT_TEXT} fontSize={10} fontWeight={600} letterSpacing="0.08em" fill={T3}>{s.l}</text>
              <text x={x} y={120} fontFamily={FONT_DISPLAY} fontSize={20} fontWeight={600} letterSpacing="-0.011em" fill={s.c}>{s.v}</text>
              {i < stats.length - 1 ? <line x1={x + 122} y1={84} x2={x + 122} y2={122} stroke={BD} /> : null}
            </g>
          )
        })}

        {/* table */}
        <rect x={20} y={150} width={W - 40} height={H - 170} rx={14} fill={BG} stroke={BD} />
        {['Source', 'Status', 'Assets', 'Stale', 'Zero', 'Age'].map((h, i) => (
          <text key={i} x={40 + i * 130} y={178} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>{h.toUpperCase()}</text>
        ))}
        <line x1={36} y1={190} x2={W - 36} y2={190} stroke={BD} />

        {rows.map((r, i) => {
          const y = 218 + i * 32
          return (
            <g key={i}>
              <text x={40} y={y} fontFamily={FONT_MONO} fontSize={12} fill={T1}>{r.src}</text>
              {r.status ? (
                <g>
                  <circle cx={172} cy={y - 4} r={4} fill={r.statusColor} />
                  <text x={184} y={y} fontFamily={FONT_TEXT} fontSize={11.5} fontWeight={600} fill={r.statusColor}>{r.status}</text>
                </g>
              ) : null}
              <text x={300} y={y} fontFamily={FONT_MONO} fontSize={12} fill={T1}>{r.assets}</text>
              <text x={430} y={y} fontFamily={FONT_MONO} fontSize={12} fill={T2}>{r.stale}</text>
              <text x={560} y={y} fontFamily={FONT_MONO} fontSize={12} fill={T2}>{r.zero}</text>
              <text x={690} y={y} fontFamily={FONT_MONO} fontSize={12} fill={T2}>{r.age}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ===========================================================================
   adding-sources.mdx schematics
   ========================================================================= */

/* 1. Full pipeline — three lanes (External · Data Node · On-chain/Frontend) */
export function AddSourcePipeline() {
  const W = 920, H = 540
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Full pipeline: API to frontend">
        <ArrowMarkers />

        {/* Lane labels */}
        {[
          { x: 130, label: 'External' },
          { x: 460, label: 'Data Node (Rust)' },
          { x: 790, label: 'On-chain · Frontend' },
        ].map((l, i) => (
          <g key={i}>
            <rect x={l.x - 100} y={20} width={200} height={32} rx={16} fill={SF} stroke={BD} />
            <text x={l.x} y={40} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="-0.005em" fill={T1}>{l.label}</text>
          </g>
        ))}

        {/* External: API box */}
        <Box x={40} y={84} w={180} h={68} accent={ORANGE} title="Your API" sub="REST · JSON · XML" />

        {/* curved arrow to trait impl */}
        <path d="M220,118 C300,118 320,184 360,184" fill="none" stroke={T3} markerEnd="url(#vb-arrow)" />

        {/* Data Node: trait impl */}
        <Box x={360} y={150} w={220} h={64} accent={BLUE} title="MarketDataSource" sub="trait impl" mono />

        {/* fetch_assets / fetch_prices children */}
        <Box x={300} y={236} w={150} h={56} title="fetch_assets" sub="what to track" mono titleSize={12.5} />
        <Box x={490} y={236} w={150} h={56} title="fetch_prices" sub="current values" mono titleSize={12.5} />
        <line x1={420} y1={214} x2={375} y2={236} stroke={BD} />
        <line x1={520} y1={214} x2={565} y2={236} stroke={BD} />

        {/* SyncEngine */}
        <Box x={340} y={314} w={260} h={68} accent={BLUE} title="SyncEngine" />
        <text x={356} y={356} fontFamily={FONT_TEXT} fontSize={11.5} fill={T2}>fetch_assets() on start</text>
        <text x={356} y={372} fontFamily={FONT_TEXT} fontSize={11.5} fill={T2}>fetch_prices() every N s · dedup</text>
        <line x1={375} y1={292} x2={420} y2={314} stroke={BD} />
        <line x1={565} y1={292} x2={520} y2={314} stroke={BD} />

        {/* Writer + Hub */}
        <Box x={340} y={406} w={260} h={56} title="BatchWriter → PostgreSQL" mono titleSize={12} />
        <text x={356} y={448} fontFamily={FONT_TEXT} fontSize={11.5} fill={T2}>PriceBroadcastHub → WebSocket</text>
        <line x1={470} y1={382} x2={470} y2={406} stroke={T3} markerEnd="url(#vb-arrow)" />

        {/* Right column: three consumers */}
        <Box x={680} y={150} w={220} h={70} accent={GREEN} title="Vision API" sub="/api/vision/*" mono titleSize={12.5} />
        <Box x={680} y={246} w={220} h={70} accent={GREEN} title="Oracle Nodes" sub="BLS-sign · submit on-chain" titleSize={13} />
        <Box x={680} y={342} w={220} h={70} accent={BLUE} title="Frontend" sub="sources.ts · market-cats.ts" mono titleSize={12.5} />

        {/* fan-out arrows */}
        <path d="M600,434 C640,434 660,184 680,184" fill="none" stroke={T3} markerEnd="url(#vb-arrow)" />
        <path d="M600,434 C640,434 660,280 680,280" fill="none" stroke={T3} markerEnd="url(#vb-arrow)" />
        <path d="M600,434 C640,434 660,376 680,376" fill="none" stroke={T3} markerEnd="url(#vb-arrow)" />

        <text x={W / 2} y={510} textAnchor="middle" fontFamily={FONT_TEXT} fontSize={11} fill={T3}>API to frontend — the full path</text>
      </svg>
    </figure>
  )
}

/* 2. File map — three groups */
export function FileMap() {
  const groups = [
    {
      title: 'Backend (Rust)',
      accent: ORANGE,
      files: [
        ['data-node/src/market_data/sources/{source}/mod.rs', 're-export struct'],
        ['data-node/src/market_data/sources/{source}/client.rs', 'trait impl'],
        ['data-node/src/config/{source}.json', 'static asset list (or [])'],
        ['data-node/src/market_data/sources/mod.rs', 'pub mod + pub use'],
        ['data-node/src/main.rs', 'spawn_resilient() in run_serve()'],
        ['data-node/src/api.rs', 'SOURCE_META entry'],
      ],
    },
    {
      title: 'If API-key gated',
      accent: T3,
      files: [
        ['data-node/src/config.rs', 'CLI arg in ServeArgs'],
        ['start.sh', 'pass env var as flag'],
      ],
    },
    {
      title: 'Contracts (Solidity)',
      accent: BLUE,
      files: [
        ['contracts/script/DeployAllVisionBatches.s.sol', '_getSourceNames() + bump array sizes'],
      ],
    },
    {
      title: 'Frontend (TypeScript)',
      accent: GREEN,
      files: [
        ['frontend/lib/vision/sources.ts', 'VISION_SOURCES entry (S helper)'],
        ['frontend/lib/vision/market-categories.ts', 'PREFIX_MAP + CATEGORY_ORDER'],
        ['frontend/components/domain/vision/VisionMarketsGrid.tsx', 'CATEGORY_GROUPS'],
        ['frontend/components/domain/SourceDetailModal.tsx', 'SOURCE_META'],
        ['frontend/components/domain/SourceHealthTable.tsx', 'API_KEY_LINKS (if gated)'],
        ['frontend/public/source-imgs/new-{source}.svg', 'logo file'],
      ],
    },
  ]
  const W = 880
  const rowH = 32
  let y = 24
  // pre-calc layout
  type Layout = { y: number; h: number; group: typeof groups[number] }
  const layouts: Layout[] = []
  groups.forEach(g => {
    const h = 36 + g.files.length * rowH + 12
    layouts.push({ y, h, group: g })
    y += h + 16
  })
  const H = y + 20

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="File map">
        {layouts.map((l, gi) => (
          <g key={gi}>
            <rect x={20} y={l.y} width={W - 40} height={l.h} rx={14} fill={BG} stroke={BD} />
            <rect x={20} y={l.y} width={4} height={l.h} rx={2} fill={l.group.accent} />
            <text x={40} y={l.y + 24} fontFamily={FONT_DISPLAY} fontSize={13.5} fontWeight={600} letterSpacing="-0.005em" fill={T1}>{l.group.title}</text>
            {l.group.files.map(([path, desc], i) => {
              const ry = l.y + 44 + i * rowH
              return (
                <g key={i}>
                  <text x={40} y={ry + 6} fontFamily={FONT_MONO} fontSize={11.5} fill={T1}>{path}</text>
                  <text x={W - 40} y={ry + 6} textAnchor="end" fontFamily={FONT_TEXT} fontSize={11.5} fill={T2}>{desc}</text>
                </g>
              )
            })}
          </g>
        ))}
      </svg>
    </figure>
  )
}

/* 3. Feed quality table */
export function FeedQualityTable() {
  const rows: [string, string, string][] = [
    ['Live events', 'Score per team', '"Is the match over?" (bool)'],
    ['Streaming', 'Viewer count right now', 'Total lifetime views (static)'],
    ['Social', 'Upvotes, comment count', 'Post text (not numeric)'],
    ['Packages', 'Daily downloads', 'Total downloads (monotonic)'],
    ['Prices', 'Spot price (live)', 'Historical price (stale)'],
    ['Transport', 'Aircraft count', 'Aircraft tail number (static)'],
    ['Geophysical', 'Alert level, magnitude', 'Event location (never moves)'],
  ]
  const W = 860
  const headerH = 44
  const rowH = 32
  const H = headerH + rows.length * rowH + 28
  const cols = [40, 220, 540]
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Good feeds vs bad feeds">
        <rect x={20} y={20} width={W - 40} height={H - 40} rx={14} fill={BG} stroke={BD} />

        <text x={cols[0]} y={50} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>SOURCE TYPE</text>
        <text x={cols[1]} y={50} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={GREEN}>GOOD FEEDS</text>
        <text x={cols[2]} y={50} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={RED}>BAD FEEDS</text>
        <line x1={36} y1={64} x2={W - 36} y2={64} stroke={BD} />

        {rows.map((r, i) => {
          const y = 64 + headerH / 2 + i * rowH
          return (
            <g key={i}>
              {i > 0 ? <line x1={36} y1={y - rowH / 2 - 8} x2={W - 36} y2={y - rowH / 2 - 8} stroke={BD} strokeOpacity={0.4} /> : null}
              <text x={cols[0]} y={y + 5} fontFamily={FONT_TEXT} fontSize={12.5} fontWeight={500} fill={T1}>{r[0]}</text>
              <text x={cols[1]} y={y + 5} fontFamily={FONT_TEXT} fontSize={12.5} fill={T1}>{r[1]}</text>
              <text x={cols[2]} y={y + 5} fontFamily={FONT_TEXT} fontSize={12.5} fill={T2}>{r[2]}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* 4. Static vs Dynamic vs Hybrid discovery */
export function DiscoveryModes() {
  const modes = [
    {
      label: 'Static',
      accent: BLUE,
      code: '[\n  "volcano1",\n  "volcano2",\n  …\n]',
      best: ['Stable lists', 'Editorial control', 'No "list all" API'],
      examples: 'Volcanoes · Flights · Nuclear plants',
    },
    {
      label: 'Dynamic',
      accent: GREEN,
      code: 'fetch_assets()\n  discovers\n  new items at\n  runtime',
      best: ['Organic supply', 'Changes hourly', "Can't curate manually"],
      examples: 'Sports · HN · Twitch · Esports · Polymarket',
    },
    {
      label: 'Hybrid',
      accent: ORANGE,
      code: '[fixed…]\n  + discover_\n    upstream()\n  finds more',
      best: ['Curated base + API extras'],
      examples: 'CoinGecko',
    },
  ]
  const W = 880, H = 380
  const colW = (W - 60) / 3
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Static vs Dynamic vs Hybrid">
        {modes.map((m, i) => {
          const x = 20 + i * (colW + 10)
          return (
            <g key={i}>
              <rect x={x} y={20} width={colW} height={H - 40} rx={14} fill={BG} stroke={BD} />
              <rect x={x} y={20} width={4} height={H - 40} rx={2} fill={m.accent} />
              <text x={x + 18} y={48} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>{m.label}</text>

              <rect x={x + 18} y={64} width={colW - 36} height={120} rx={10} fill={SF} stroke={BD} />
              {m.code.split('\n').map((line, li) => (
                <text key={li} x={x + 32} y={86 + li * 18} fontFamily={FONT_MONO} fontSize={11.5} fill={T1}>{line}</text>
              ))}

              <text x={x + 18} y={208} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>BEST FOR</text>
              {m.best.map((b, bi) => (
                <g key={bi}>
                  <circle cx={x + 24} cy={224 + bi * 20} r={2} fill={m.accent} />
                  <text x={x + 34} y={228 + bi * 20} fontFamily={FONT_TEXT} fontSize={12} fill={T1}>{b}</text>
                </g>
              ))}

              <text x={x + 18} y={314} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>EXAMPLES</text>
              <text x={x + 18} y={332} fontFamily={FONT_TEXT} fontSize={11.5} fill={T2}>{m.examples}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* 5. Sync interval decision tree */
export function SyncIntervalTree() {
  const decisions: [string, string][] = [
    ['Live (scores, streams)', '1–5 min · SyncEngine'],
    ['Market prices', '1 min · SyncEngine'],
    ['Periodic readings', '5–10 min · SyncEngine'],
    ['Daily / slow data', '30–60 min · SyncEngine'],
    ['Known release schedule', 'ScheduledSyncEngine'],
  ]
  const W = 860
  const rowH = 44
  const H = 220 + decisions.length * rowH
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sync interval decision tree">
        <ArrowMarkers />
        <text x={20} y={36} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>How fast does the underlying data change?</text>

        {decisions.map(([from, to], i) => {
          const y = 70 + i * rowH
          return (
            <g key={i}>
              <rect x={20} y={y} width={300} height={32} rx={10} fill={BG} stroke={BD} />
              <text x={36} y={y + 21} fontFamily={FONT_TEXT} fontSize={12.5} fill={T1}>{from}</text>
              <line x1={328} y1={y + 16} x2={508} y2={y + 16} stroke={T3} markerEnd="url(#vb-arrow)" />
              <rect x={516} y={y} width={324} height={32} rx={10} fill={BLUE} fillOpacity={0.06} stroke={BLUE} strokeOpacity={0.4} />
              <text x={534} y={y + 21} fontFamily={FONT_MONO} fontSize={12} fill={BLUE}>{to}</text>
            </g>
          )
        })}

        {/* rate-limit budget */}
        <g>
          <rect x={20} y={H - 110} width={W - 40} height={86} rx={14} fill={SF} stroke={BD} />
          <text x={36} y={H - 86} fontFamily={FONT_TEXT} fontSize={11} fontWeight={600} letterSpacing="0.08em" fill={T3}>RATE-LIMIT BUDGET CHECK</text>
          <text x={36} y={H - 60} fontFamily={FONT_MONO} fontSize={13} fill={T1}>
            requests_per_sync × syncs_per_hour <tspan fill={T2}>&lt;</tspan> 80% of API hourly limit
          </text>
          <text x={36} y={H - 38} fontFamily={FONT_TEXT} fontSize={11.5} fill={T2}>Always leave headroom. APIs lie about their limits.</text>
        </g>
      </svg>
    </figure>
  )
}

/* 6. Source directory tree */
export function SourceDirectoryTree() {
  const W = 760, H = 130
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Source directory tree">
        <rect x={20} y={20} width={W - 40} height={H - 40} rx={14} fill={BG} stroke={BD} />
        <text x={40} y={48} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>data-node/src/market_data/sources/{`{source}`}/</text>
        <text x={56} y={72} fontFamily={FONT_MONO} fontSize={12} fill={T2}>├── mod.rs<tspan fill={T3}>{'        '}always the same two-liner</tspan></text>
        <text x={56} y={90} fontFamily={FONT_MONO} fontSize={12} fill={T2}>└── client.rs<tspan fill={T3}>{'     '}your implementation</tspan></text>
      </svg>
    </figure>
  )
}

/* 7. Implementation patterns — six cards */
export function ImplementationPatterns() {
  const patterns = [
    {
      letter: 'A',
      title: 'Single Call → Fan Out',
      diagram: 'GET /api/all-data  →  1 response  →  N assets',
      desc: '1 call for ALL assets. Parse each value from bulk.',
      ex: 'Volcano · Flights · Weather Alerts',
      accent: BLUE,
    },
    {
      letter: 'B',
      title: 'Grouped Fetches',
      diagram: 'for each group: GET /api/group/{id} → items',
      desc: 'Calls = number of groups, not assets.',
      ex: 'Sports (12 leagues = 12 calls for 300 games)',
      accent: GREEN,
    },
    {
      letter: 'C',
      title: 'Batch IDs',
      diagram: 'GET /api/prices?ids=a,b,c,…  →  parse batch',
      desc: '10,000 assets / 100 per batch = 100 requests.',
      ex: 'CoinGecko · NPM · Twitch',
      accent: ORANGE,
    },
    {
      letter: 'D',
      title: 'Rolling Cursor',
      diagram: '[a][b][c][d][e][f][g][h]  ←  cursor advances',
      desc: 'Slice fetch, advance cursor, wrap at end.',
      ex: 'Finnhub (780 stocks · 55/batch · 5 s)',
      accent: BLUE,
    },
    {
      letter: 'E',
      title: 'Scheduled Sync',
      diagram: 'next_fetch_time() · burst_mode() on event days',
      desc: 'ScheduledSyncEngine. Sleeps until release.',
      ex: 'FRED · ECB · BLS',
      accent: GREEN,
    },
    {
      letter: 'F',
      title: 'Full List Re-fetch',
      diagram: 'GET /api/markets?status=active  →  hashmap',
      desc: 'Discovery endpoint IS the price endpoint.',
      ex: 'Polymarket · Esports',
      accent: ORANGE,
    },
  ]
  const W = 880
  const colW = (W - 60) / 2
  const rowH = 156
  const H = 40 + Math.ceil(patterns.length / 2) * (rowH + 16)
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Implementation patterns">
        {patterns.map((p, i) => {
          const col = i % 2
          const row = Math.floor(i / 2)
          const x = 20 + col * (colW + 16)
          const y = 24 + row * (rowH + 16)
          return (
            <g key={i}>
              <rect x={x} y={y} width={colW} height={rowH} rx={14} fill={BG} stroke={BD} />
              <rect x={x} y={y} width={4} height={rowH} rx={2} fill={p.accent} />

              {/* letter badge */}
              <circle cx={x + 38} cy={y + 32} r={16} fill={p.accent} fillOpacity={0.12} stroke={p.accent} strokeOpacity={0.4} />
              <text x={x + 38} y={y + 37} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} fill={p.accent}>{p.letter}</text>

              <text x={x + 64} y={y + 28} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>{p.title}</text>
              <text x={x + 64} y={y + 46} fontFamily={FONT_TEXT} fontSize={11.5} fill={T3}>Pattern {p.letter}</text>

              <rect x={x + 16} y={y + 60} width={colW - 32} height={32} rx={8} fill={SF} stroke={BD} />
              <text x={x + 30} y={y + 80} fontFamily={FONT_MONO} fontSize={11} fill={T1}>{p.diagram}</text>

              <text x={x + 16} y={y + 110} fontFamily={FONT_TEXT} fontSize={12} fill={T1}>{p.desc}</text>
              <text x={x + 16} y={y + 132} fontFamily={FONT_TEXT} fontSize={11.5} fill={T2}>Used by: {p.ex}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* 8. Asset ID format */
export function AssetIdFormat() {
  const examples: { prefix: string; id: string; full: string }[] = [
    { prefix: 'github_', id: 'facebook_react', full: 'github_facebook_react' },
    { prefix: 'earthquake_', id: 'california', full: 'earthquake_california' },
    { prefix: 'db_trains_', id: 'berlin_hbf', full: 'db_trains_berlin_hbf' },
    { prefix: 'steam_', id: 'counter-strike-2', full: 'steam_counter-strike-2' },
    { prefix: 'mcbroken_', id: 'chicago', full: 'mcbroken_chicago' },
  ]
  const W = 880
  const rowH = 38
  const H = 130 + examples.length * rowH
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Asset ID format">
        <rect x={20} y={20} width={W - 40} height={H - 40} rx={14} fill={BG} stroke={BD} />
        <text x={40} y={50} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>Asset ID format</text>
        <text x={40} y={72} fontFamily={FONT_MONO} fontSize={12.5} fill={T2}>
          {`{`}<tspan fill={BLUE}>source_prefix</tspan>{`}_{`}<tspan fill={T1}>identifier</tspan>{`}`}
        </text>

        {/* table header */}
        <text x={48} y={110} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>PREFIX</text>
        <text x={240} y={110} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>IDENTIFIER</text>
        <text x={500} y={110} fontFamily={FONT_TEXT} fontSize={10.5} fontWeight={600} letterSpacing="0.08em" fill={T3}>FULL ASSET ID</text>
        <line x1={36} y1={120} x2={W - 36} y2={120} stroke={BD} />

        {examples.map((e, i) => {
          const y = 144 + i * rowH
          return (
            <g key={i}>
              {i > 0 ? <line x1={36} y1={y - rowH / 2 - 4} x2={W - 36} y2={y - rowH / 2 - 4} stroke={BD} strokeOpacity={0.4} /> : null}
              <text x={48} y={y} fontFamily={FONT_MONO} fontSize={12.5} fill={BLUE}>{e.prefix}</text>
              <text x={240} y={y} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>{e.id}</text>
              <text x={500} y={y} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>{e.full}</text>
            </g>
          )
        })}

        <text x={48} y={H - 32} fontFamily={FONT_TEXT} fontSize={11.5} fill={T2}>
          The prefix MUST match <tspan fontFamily={FONT_MONO} fill={T1}>PREFIX_MAP</tspan> in <tspan fontFamily={FONT_MONO} fill={T1}>frontend/lib/vision/market-categories.ts</tspan>.
        </text>
      </svg>
    </figure>
  )
}

/* 9. API-key gated note (small callout box) */
export function ApiKeyNote() {
  const W = 760, H = 80
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="API key gated note">
        <rect x={20} y={20} width={W - 40} height={H - 40} rx={12} fill={ORANGE} fillOpacity={0.08} stroke={ORANGE} strokeOpacity={0.4} />
        <circle cx={48} cy={H / 2} r={12} fill={ORANGE} />
        <text x={48} y={H / 2 + 5} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={700} fill="#fff">!</text>
        <text x={76} y={H / 2 + 5} fontFamily={FONT_TEXT} fontSize={13} fill={T1}>
          Only if your API requires a key. Skip this section for open / free APIs.
        </text>
      </svg>
    </figure>
  )
}

/* 10. S() helper signature */
export function SHelperSignature() {
  const params: [string, string][] = [
    ['id', 'unique string · matches Rust source_id()'],
    ['name', 'display name in UI'],
    ['description', 'one-liner shown on source card'],
    ['category', "'finance' | 'economic' | 'regulatory' | 'tech' | 'entertainment' | 'geophysical' | 'transport' | 'nature' | 'space' | 'academic'"],
    ['logo', 'path to SVG/PNG in public/source-imgs/'],
    ['brandBg', 'hex color for card background'],
    ['prefixes', 'array of asset ID prefix strings'],
    ['valueLabel', "column header (e.g. 'Price', 'Viewers', 'Magnitude')"],
    ['valueUnit', "unit label (e.g. 'USD', 'min', '%', '0–9')"],
    ['isPrice?', 'true → format with $ prefix'],
  ]
  const W = 880
  const rowH = 30
  const H = 132 + params.length * rowH
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="S() helper signature">
        <rect x={20} y={20} width={W - 40} height={H - 40} rx={14} fill={BG} stroke={BD} />
        <rect x={20} y={20} width={4} height={H - 40} rx={2} fill={GREEN} />

        <text x={40} y={50} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>S() helper signature</text>

        <rect x={40} y={66} width={W - 80} height={50} rx={10} fill={SF} stroke={BD} />
        <text x={56} y={88} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>S(id, name, description, category, logo, brandBg,</text>
        <text x={56} y={106} fontFamily={FONT_MONO} fontSize={12.5} fill={T1}>{'  '}prefixes, valueLabel, valueUnit, isPrice?)</text>

        {params.map(([k, v], i) => {
          const y = 140 + i * rowH
          return (
            <g key={i}>
              <text x={56} y={y} fontFamily={FONT_MONO} fontSize={12} fontWeight={500} fill={GREEN}>{k}</text>
              <text x={200} y={y} fontFamily={FONT_TEXT} fontSize={12} fill={T2}>{v}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* 11. Test flow — vertical sequence */
export function TestFlow() {
  const steps = [
    { title: 'curl the real API', sub: 'verify response shape', mono: false },
    { title: 'cargo check', sub: 'compiles?', mono: true },
    { title: 'cargo test {source}', sub: 'unit tests pass', mono: true },
    { title: 'npx tsc --noEmit', sub: 'frontend compiles?', mono: true },
    { title: 'Run locally', sub: 'check /sources UI', mono: false },
  ]
  const W = 720
  const stepH = 78
  const H = 40 + steps.length * stepH + 20
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Test flow">
        <ArrowMarkers />
        {steps.map((s, i) => {
          const y = 24 + i * stepH
          return (
            <g key={i}>
              <rect x={(W - 380) / 2} y={y} width={380} height={56} rx={14} fill={BG} stroke={BD} />
              <circle cx={(W - 380) / 2 + 28} cy={y + 28} r={14} fill={BLUE} fillOpacity={0.1} stroke={BLUE} strokeOpacity={0.4} />
              <text x={(W - 380) / 2 + 28} y={y + 33} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={12} fontWeight={600} fill={BLUE}>{i + 1}</text>
              <text x={(W - 380) / 2 + 56} y={y + 26} fontFamily={s.mono ? FONT_MONO : FONT_DISPLAY} fontSize={13.5} fontWeight={600} letterSpacing="-0.005em" fill={T1}>{s.title}</text>
              <text x={(W - 380) / 2 + 56} y={y + 44} fontFamily={FONT_TEXT} fontSize={12} fill={T2}>{s.sub}</text>
              {i < steps.length - 1 ? (
                <line x1={W / 2} y1={y + 56} x2={W / 2} y2={y + stepH} stroke={T3} markerEnd="url(#vb-arrow)" />
              ) : null}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* 12. Common pitfalls */
export function PitfallsList() {
  const items: [string, string][] = [
    ['Rate limits', 'Community/free APIs go down without warning. Test under sustained load. Leave 10–20% headroom.'],
    ['Partial data > no data', 'If one call fails, emit what you have. Never fake zeros — skip the failed asset.'],
    ['Asset ID prefix mismatch', 'Rust prefix MUST match PREFIX_MAP. Otherwise markets land in "Other" with generic labels.'],
    ['Forgot to bump array sizes', 'DeployAllVisionBatches.s.sol has TWO array size constants. Miss one and the deploy fails.'],
    ['Logo contrast', 'White on #f5f5f5 = invisible. Squint at the card. If the logo disappears, change brandBg or variant.'],
    ['Group API calls by key', 'Parse a group key from asset_id. One call per group, not per asset.'],
    ['The database is generic', 'No migrations. All sources share market_assets and market_prices. Compiles → data flows.'],
    ['Frontend is gracefully degradable', 'Missing entries show under "Other". Backend-only is fine for testing — polish frontend after.'],
  ]
  const W = 880
  const rowH = 56
  const H = 80 + items.length * rowH
  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Things that will bite you">
        <rect x={20} y={20} width={W - 40} height={H - 40} rx={14} fill={BG} stroke={BD} />
        <rect x={20} y={20} width={4} height={H - 40} rx={2} fill={RED} />
        <text x={40} y={50} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>Things that will bite you</text>
        <line x1={36} y1={64} x2={W - 36} y2={64} stroke={BD} />

        {items.map(([title, body], i) => {
          const y = 84 + i * rowH
          return (
            <g key={i}>
              <text x={40} y={y + 16} fontFamily={FONT_DISPLAY} fontSize={12} fontWeight={600} letterSpacing="0.06em" fill={RED}>
                {String(i + 1).padStart(2, '0')}
              </text>
              <text x={80} y={y + 16} fontFamily={FONT_DISPLAY} fontSize={13} fontWeight={600} letterSpacing="-0.005em" fill={T1}>{title}</text>
              <text x={80} y={y + 36} fontFamily={FONT_TEXT} fontSize={12} fill={T2}>{body}</text>
              {i < items.length - 1 ? <line x1={36} y1={y + rowH - 6} x2={W - 36} y2={y + rowH - 6} stroke={BD} strokeOpacity={0.4} /> : null}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* 13. New source checklist */
export function NewSourceChecklist() {
  const sections = [
    {
      title: 'Backend',
      accent: ORANGE,
      items: [
        'data-node/src/market_data/sources/{source}/client.rs · MarketDataSource',
        'data-node/src/market_data/sources/{source}/mod.rs · pub mod + pub use',
        'data-node/src/config/{source}.json · asset list or []',
        'data-node/src/market_data/sources/mod.rs · module registration',
        'data-node/src/main.rs · spawn_resilient()',
        'data-node/src/api.rs · SOURCE_META entry',
      ],
    },
    {
      title: 'If API-key gated',
      accent: T3,
      items: [
        'data-node/src/config.rs · CLI arg',
        'data-node/src/main.rs · record_not_started()',
        'start.sh · conditional --flag',
      ],
    },
    {
      title: 'Contracts',
      accent: BLUE,
      items: [
        'contracts/script/DeployAllVisionBatches.s.sol · _getSourceNames() (bump BOTH array size constants)',
      ],
    },
    {
      title: 'Frontend',
      accent: GREEN,
      items: [
        'frontend/public/source-imgs/new-{source}.svg · real company logo',
        'frontend/lib/vision/market-categories.ts · PREFIX_MAP + CATEGORY_ORDER',
        'frontend/lib/vision/sources.ts · S() entry',
        'frontend/components/.../VisionMarketsGrid.tsx · CATEGORY_GROUPS + COUNT_SOURCES',
        'frontend/components/.../SourceDetailModal.tsx · SOURCE_META',
        'frontend/components/.../SourceHealthTable.tsx · API_KEY_LINKS (only if gated)',
      ],
    },
    {
      title: 'Verify',
      accent: T1,
      items: [
        'cargo check · backend compiles',
        'cargo test {source} · unit tests pass',
        'npx tsc --noEmit (in frontend/) · frontend compiles',
        'curl the real API endpoint · returns valid data',
      ],
    },
  ]
  const W = 880
  const rowH = 28
  let y = 60
  type Layout = { y: number; h: number; section: typeof sections[number] }
  const layouts: Layout[] = []
  sections.forEach(s => {
    const h = 36 + s.items.length * rowH + 12
    layouts.push({ y, h, section: s })
    y += h + 14
  })
  const H = y + 12

  return (
    <figure className="docs-schematic schematic-arch">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="New source checklist">
        <text x={20} y={36} fontFamily={FONT_DISPLAY} fontSize={14} fontWeight={600} letterSpacing="-0.005em" fill={T1}>New source checklist</text>

        {layouts.map((l, gi) => (
          <g key={gi}>
            <rect x={20} y={l.y} width={W - 40} height={l.h} rx={14} fill={BG} stroke={BD} />
            <rect x={20} y={l.y} width={4} height={l.h} rx={2} fill={l.section.accent} />
            <text x={40} y={l.y + 24} fontFamily={FONT_DISPLAY} fontSize={13.5} fontWeight={600} letterSpacing="-0.005em" fill={T1}>{l.section.title}</text>
            {l.section.items.map((it, i) => {
              const ry = l.y + 44 + i * rowH
              return (
                <g key={i}>
                  <rect x={40} y={ry - 11} width={14} height={14} rx={3} fill={BG} stroke={BD} />
                  <text x={62} y={ry} fontFamily={FONT_MONO} fontSize={11.5} fill={T1}>{it}</text>
                </g>
              )
            })}
          </g>
        ))}
      </svg>
    </figure>
  )
}
