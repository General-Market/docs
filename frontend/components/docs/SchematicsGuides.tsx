import * as React from 'react'

/* ─────────────────────────────────────────────────────────────
   Apple-style SVG schematics — replacements for ASCII diagrams
   in /docs guides (api/overview, guides/create-itp,
   guides/settlement). Each component is parameterless.
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

const FONT_DISPLAY = 'SF Pro Display, Helvetica Neue, sans-serif'
const FONT_TEXT = 'SF Pro Text, Helvetica Neue, sans-serif'

/* ─────────────────────────────────────────────────────────────
   OverviewArchitecture — api/overview
   Browser → Next.js proxy → three upstreams.
   ─────────────────────────────────────────────────────────── */

export function OverviewArchitecture() {
  const width = 760
  const height = 440

  // Browser
  const browser = { x: 290, y: 24, w: 180, h: 60 }
  // Proxy
  const proxy = { x: 240, y: 140, w: 280, h: 76 }
  // Three upstreams
  const upstreams = [
    {
      x: 36,
      y: 280,
      w: 220,
      h: 130,
      title: 'Data Node',
      sub: 'port 8200',
      bullets: ['prices', 'snapshots', 'sim engine', 'portfolio', 'explorer', 'market history'],
      accent: APPLE_BLUE,
    },
    {
      x: 270,
      y: 280,
      w: 220,
      h: 130,
      title: 'L3 RPC',
      sub: 'chain reads',
      bullets: ['getITPState', 'balanceOf', 'totalSupply'],
      accent: APPLE_GREEN,
    },
    {
      x: 504,
      y: 280,
      w: 220,
      h: 130,
      title: 'Oracle API',
      sub: 'port 10001',
      bullets: ['/vision/*', 'batches', 'bitmap', 'leaderboard'],
      accent: APPLE_ORANGE,
    },
  ]

  return (
    <figure className="docs-schematic schematic-arch">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Browser routes through Next.js API proxy to data node, L3 RPC, and oracle API"
      >
        <defs>
          <marker
            id="ovw-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_TEXT_3} />
          </marker>
        </defs>

        {/* Browser */}
        <rect
          x={browser.x}
          y={browser.y}
          width={browser.w}
          height={browser.h}
          rx={12}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />
        <text
          x={browser.x + browser.w / 2}
          y={browser.y + 38}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          Browser
        </text>

        {/* HTTPS arrow Browser → Proxy */}
        <line
          x1={browser.x + browser.w / 2}
          y1={browser.y + browser.h}
          x2={proxy.x + proxy.w / 2}
          y2={proxy.y}
          stroke={APPLE_TEXT_3}
          strokeWidth={1.25}
          markerEnd="url(#ovw-arrow)"
        />
        <text
          x={browser.x + browser.w / 2 + 16}
          y={(browser.y + browser.h + proxy.y) / 2 + 4}
          fontFamily={FONT_TEXT}
          fontSize="11"
          fill={APPLE_TEXT_3}
        >
          HTTPS
        </text>

        {/* Proxy */}
        <rect
          x={proxy.x}
          y={proxy.y}
          width={proxy.w}
          height={proxy.h}
          rx={12}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />
        <rect x={proxy.x} y={proxy.y} width={4} height={proxy.h} rx={2} fill={APPLE_BLUE} />
        <text
          x={proxy.x + 20}
          y={proxy.y + 30}
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          Next.js API Routes
        </text>
        <text
          x={proxy.x + 20}
          y={proxy.y + 50}
          fontFamily={FONT_TEXT}
          fontSize="12"
          fill={APPLE_TEXT_2}
        >
          server-side proxy · resolves mixed content
        </text>
        <text
          x={proxy.x + 20}
          y={proxy.y + 66}
          fontFamily={FONT_TEXT}
          fontSize="11"
          fill={APPLE_TEXT_3}
        >
          dedicated routes + /api/dn/[...path] catch-all
        </text>

        {/* Arrows proxy → upstreams */}
        {upstreams.map((u, i) => {
          const fromX = proxy.x + proxy.w / 2
          const fromY = proxy.y + proxy.h
          const toX = u.x + u.w / 2
          const toY = u.y
          const midY = (fromY + toY) / 2
          return (
            <g key={i}>
              <path
                d={`M${fromX},${fromY} C${fromX},${midY} ${toX},${midY} ${toX},${toY}`}
                fill="none"
                stroke={APPLE_BORDER}
                strokeWidth={1.25}
                markerEnd="url(#ovw-arrow)"
              />
              <text
                x={(fromX + toX) / 2}
                y={midY - 4}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="10.5"
                fill={APPLE_TEXT_3}
              >
                HTTP
              </text>
            </g>
          )
        })}

        {/* Upstream cards */}
        {upstreams.map((u, i) => (
          <g key={i}>
            <rect
              x={u.x}
              y={u.y}
              width={u.w}
              height={u.h}
              rx={12}
              fill={APPLE_BG}
              stroke={APPLE_BORDER}
            />
            <rect x={u.x} y={u.y} width={4} height={u.h} rx={2} fill={u.accent} />
            <text
              x={u.x + 20}
              y={u.y + 26}
              fontFamily={FONT_DISPLAY}
              fontSize="14"
              fontWeight="600"
              letterSpacing="-0.005em"
              fill={APPLE_TEXT}
            >
              {u.title}
            </text>
            <text
              x={u.x + 20}
              y={u.y + 44}
              fontFamily={FONT_TEXT}
              fontSize="11.5"
              fill={APPLE_TEXT_3}
            >
              {u.sub}
            </text>
            {u.bullets.map((b, bi) => (
              <text
                key={bi}
                x={u.x + 20}
                y={u.y + 64 + bi * 14}
                fontFamily={FONT_TEXT}
                fontSize="11.5"
                fill={APPLE_TEXT_2}
              >
                — {b}
              </text>
            ))}
          </g>
        ))}
      </svg>
      <figcaption>Every browser request crosses one server-side proxy. Mixed-content disappears in the seam.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   WeightToQuantity — guides/create-itp
   Visual transformation: weight + price → fixed share quantity.
   ─────────────────────────────────────────────────────────── */

export function WeightToQuantity() {
  const width = 760
  const height = 240

  const cardW = 200
  const cardH = 110
  const cardY = 60

  const cardA = { x: 40, y: cardY }
  const cardB = { x: 280, y: cardY }
  const cardC = { x: 520, y: cardY }

  const cards: Array<{
    x: number
    y: number
    eyebrow: string
    value: string
    sub: string
    accent: string
  }> = [
    { ...cardA, eyebrow: 'Weight', value: '0.01', sub: 'your intent · 1%', accent: APPLE_BLUE },
    { ...cardB, eyebrow: 'Price', value: '$1.00', sub: 'oracle consensus', accent: APPLE_TEXT_3 },
    { ...cardC, eyebrow: 'Quantity', value: '0.01', sub: 'tokens / share · permanent', accent: APPLE_GREEN },
  ]

  return (
    <figure className="docs-schematic schematic-flow">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Weight times one e18 divided by price equals fixed quantity per share"
      >
        <defs>
          <marker
            id="wtq-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_TEXT_3} />
          </marker>
        </defs>

        {/* Title formula */}
        <text
          x={width / 2}
          y={32}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          qty[i] = (weight[i] · 1e18) / price[i]
        </text>

        {/* Cards */}
        {cards.map((c, i) => (
          <g key={i}>
            <rect
              x={c.x}
              y={c.y}
              width={cardW}
              height={cardH}
              rx={12}
              fill={APPLE_BG}
              stroke={APPLE_BORDER}
            />
            <rect x={c.x} y={c.y} width={4} height={cardH} rx={2} fill={c.accent} />
            <text
              x={c.x + 20}
              y={c.y + 28}
              fontFamily={FONT_TEXT}
              fontSize="11"
              fontWeight="600"
              letterSpacing="0.08em"
              fill={c.accent}
            >
              {c.eyebrow.toUpperCase()}
            </text>
            <text
              x={c.x + 20}
              y={c.y + 60}
              fontFamily={FONT_DISPLAY}
              fontSize="22"
              fontWeight="600"
              letterSpacing="-0.011em"
              fill={APPLE_TEXT}
            >
              {c.value}
            </text>
            <text
              x={c.x + 20}
              y={c.y + 86}
              fontFamily={FONT_TEXT}
              fontSize="12"
              fill={APPLE_TEXT_2}
            >
              {c.sub}
            </text>
          </g>
        ))}

        {/* Connectors */}
        <line
          x1={cardA.x + cardW}
          y1={cardY + cardH / 2}
          x2={cardB.x}
          y2={cardY + cardH / 2}
          stroke={APPLE_BORDER}
          strokeWidth={1.25}
        />
        <text
          x={(cardA.x + cardW + cardB.x) / 2}
          y={cardY + cardH / 2 - 6}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="14"
          fontWeight="600"
          fill={APPLE_TEXT_3}
        >
          ÷
        </text>
        <line
          x1={cardB.x + cardW}
          y1={cardY + cardH / 2}
          x2={cardC.x}
          y2={cardY + cardH / 2}
          stroke={APPLE_BORDER}
          strokeWidth={1.25}
          markerEnd="url(#wtq-arrow)"
        />
        <text
          x={(cardB.x + cardW + cardC.x) / 2}
          y={cardY + cardH / 2 - 6}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="14"
          fontWeight="600"
          fill={APPLE_TEXT_3}
        >
          =
        </text>

        {/* Footer note */}
        <text
          x={width / 2}
          y={210}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="12"
          fill={APPLE_TEXT_3}
        >
          Quantities are stored on-chain. They do not change unless the creator rebalances.
        </text>
      </svg>
      <figcaption>Weights are intentions. Quantities are commitments.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   NavDecomposition — guides/create-itp
   Per-share NAV: sum(qty × price) across underlying assets.
   ─────────────────────────────────────────────────────────── */

export function NavDecomposition() {
  const width = 760
  const height = 280

  const rows: Array<{ label: string; qty: string; price: string; value: string }> = [
    { label: 'BTC', qty: '0.01', price: '$1.00', value: '$0.01' },
    { label: 'ETH', qty: '0.01', price: '$1.00', value: '$0.01' },
    { label: 'SOL', qty: '0.01', price: '$1.00', value: '$0.01' },
    { label: '… 97 others', qty: '0.01', price: '$1.00', value: '$0.97' },
  ]

  const tableX = 40
  const tableY = 60
  const colWidths = [180, 140, 140, 140]
  const colXs = colWidths.reduce<number[]>((acc, w, i) => {
    const prev = i === 0 ? tableX : acc[i - 1] + colWidths[i - 1]
    acc.push(prev)
    return acc
  }, [])
  const tableW = colWidths.reduce((a, b) => a + b, 0)
  const rowH = 30
  const headerH = 32

  return (
    <figure className="docs-schematic schematic-flow">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="NAV equals the sum of quantity times price across all underlying assets"
      >
        {/* Title */}
        <text
          x={width / 2}
          y={32}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          NAV = Σ qty[i] · price[i]
        </text>

        {/* Table outer */}
        <rect
          x={tableX}
          y={tableY}
          width={tableW}
          height={headerH + rows.length * rowH}
          rx={12}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />

        {/* Header */}
        <rect
          x={tableX}
          y={tableY}
          width={tableW}
          height={headerH}
          rx={12}
          fill={APPLE_SURFACE}
        />
        {/* Mask the bottom of the rounded surface so divider sits clean */}
        <rect x={tableX} y={tableY + headerH - 12} width={tableW} height={12} fill={APPLE_SURFACE} />
        <line
          x1={tableX}
          y1={tableY + headerH}
          x2={tableX + tableW}
          y2={tableY + headerH}
          stroke={APPLE_BORDER}
        />
        {['Asset', 'Quantity', 'Price', 'Value / share'].map((h, i) => (
          <text
            key={h}
            x={colXs[i] + 16}
            y={tableY + 21}
            fontFamily={FONT_TEXT}
            fontSize="11"
            fontWeight="600"
            letterSpacing="0.06em"
            fill={APPLE_TEXT_3}
          >
            {h.toUpperCase()}
          </text>
        ))}

        {/* Rows */}
        {rows.map((r, i) => {
          const y = tableY + headerH + i * rowH
          const cells = [r.label, r.qty, r.price, r.value]
          return (
            <g key={i}>
              {i > 0 ? (
                <line
                  x1={tableX + 12}
                  y1={y}
                  x2={tableX + tableW - 12}
                  y2={y}
                  stroke={APPLE_BORDER}
                  strokeOpacity="0.6"
                />
              ) : null}
              {cells.map((cell, ci) => (
                <text
                  key={ci}
                  x={colXs[ci] + 16}
                  y={y + 20}
                  fontFamily={FONT_TEXT}
                  fontSize="13"
                  fontWeight={ci === 0 ? '600' : '400'}
                  fill={ci === 3 ? APPLE_TEXT : APPLE_TEXT_2}
                >
                  {cell}
                </text>
              ))}
            </g>
          )
        })}

        {/* Sum bar */}
        <rect
          x={tableX}
          y={tableY + headerH + rows.length * rowH + 14}
          width={tableW}
          height={48}
          rx={12}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />
        <rect
          x={tableX}
          y={tableY + headerH + rows.length * rowH + 14}
          width={4}
          height={48}
          rx={2}
          fill={APPLE_GREEN}
        />
        <text
          x={tableX + 20}
          y={tableY + headerH + rows.length * rowH + 44}
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          NAV / share
        </text>
        <text
          x={tableX + tableW - 16}
          y={tableY + headerH + rows.length * rowH + 44}
          textAnchor="end"
          fontFamily={FONT_DISPLAY}
          fontSize="18"
          fontWeight="600"
          letterSpacing="-0.011em"
          fill={APPLE_TEXT}
        >
          $1.00
        </text>
      </svg>
      <figcaption>Same formula on-chain, in the oracle, and in the frontend. Quantities are the source of truth.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   TwoChainsArchitecture — guides/settlement
   Side-by-side L3 vs Settlement; what lives on each.
   ─────────────────────────────────────────────────────────── */

export function TwoChainsArchitecture() {
  const width = 760
  const height = 460

  const colW = 348
  const gap = 24
  const leftX = 20
  const rightX = leftX + colW + gap
  const topY = 20

  const headerH = 88

  const l3Sections: Array<{ title: string; lines: string[] }> = [
    {
      title: 'ITP Trading',
      lines: ['Buy / sell ITP shares', 'Order submission & matching', 'NAV computation'],
    },
    {
      title: 'Vision Prediction Markets',
      lines: ['Create & resolve markets', 'Place bets', 'Claim winnings'],
    },
    {
      title: 'Core Protocol',
      lines: ['BLS consensus', 'Batch / fill lifecycle', 'Oracle registry'],
    },
  ]

  const settlementSections: Array<{ title: string; lines: string[] }> = [
    { title: 'Bridge Custody', lines: ['USDC escrow for bridge buys', 'BridgedITP escrow for sells'] },
    {
      title: 'BridgedITP Tokens',
      lines: ['ERC-20 replicas of L3 ITP shares', 'Tradable on Settlement', 'Usable as Morpho collateral'],
    },
    {
      title: 'Morpho Lending',
      lines: ['Supply USDC to earn yield', 'Borrow USDC against BridgedITP'],
    },
    {
      title: 'Vision Deposits',
      lines: ['Deposit USDC for Vision betting', 'Withdraw USDC from Vision'],
    },
  ]

  const renderColumn = (
    x: number,
    title: string,
    chainId: string,
    native: string,
    decimals: string,
    sections: Array<{ title: string; lines: string[] }>,
    accent: string,
  ) => {
    const sectionGap = 10
    let cursorY = topY + headerH + 14
    const sectionLayouts = sections.map((s) => {
      const h = 30 + s.lines.length * 16 + 10
      const layout = { y: cursorY, h }
      cursorY += h + sectionGap
      return layout
    })

    return (
      <g key={x}>
        {/* Outer */}
        <rect
          x={x}
          y={topY}
          width={colW}
          height={height - topY - 20}
          rx={16}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />
        <rect x={x} y={topY} width={4} height={height - topY - 20} rx={2} fill={accent} />

        {/* Header */}
        <text
          x={x + 24}
          y={topY + 30}
          fontFamily={FONT_DISPLAY}
          fontSize="16"
          fontWeight="600"
          letterSpacing="-0.011em"
          fill={APPLE_TEXT}
        >
          {title}
        </text>
        <text
          x={x + 24}
          y={topY + 52}
          fontFamily={FONT_TEXT}
          fontSize="12"
          fill={APPLE_TEXT_2}
        >
          Chain ID {chainId} · Native {native}
        </text>
        <text
          x={x + 24}
          y={topY + 70}
          fontFamily={FONT_TEXT}
          fontSize="12"
          fill={APPLE_TEXT_2}
        >
          USDC: {decimals}
        </text>
        <line
          x1={x + 16}
          y1={topY + headerH}
          x2={x + colW - 16}
          y2={topY + headerH}
          stroke={APPLE_BORDER}
          strokeOpacity="0.7"
        />

        {/* Sections */}
        {sections.map((s, i) => {
          const layout = sectionLayouts[i]
          return (
            <g key={i}>
              <rect
                x={x + 16}
                y={layout.y}
                width={colW - 32}
                height={layout.h}
                rx={12}
                fill={APPLE_SURFACE}
              />
              <text
                x={x + 32}
                y={layout.y + 22}
                fontFamily={FONT_DISPLAY}
                fontSize="13"
                fontWeight="600"
                letterSpacing="-0.005em"
                fill={APPLE_TEXT}
              >
                {s.title}
              </text>
              {s.lines.map((ln, li) => (
                <text
                  key={li}
                  x={x + 32}
                  y={layout.y + 40 + li * 16}
                  fontFamily={FONT_TEXT}
                  fontSize="11.5"
                  fill={APPLE_TEXT_2}
                >
                  — {ln}
                </text>
              ))}
            </g>
          )
        })}
      </g>
    )
  }

  return (
    <figure className="docs-schematic schematic-arch">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Index L3 chain on the left, Settlement chain on the right, with the modules that live on each"
      >
        {renderColumn(leftX, 'Index L3 (Orbit)', '111222333', 'GM', '18 decimals', l3Sections, APPLE_BLUE)}
        {renderColumn(rightX, 'Settlement (Sonic Testnet)', '14601', 'S', '6 decimals', settlementSections, APPLE_ORANGE)}
      </svg>
      <figcaption>Two chains. One protocol. Trading where it is cheap, settlement where it is secure.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   WhichChainTable — guides/settlement
   Decision matrix: I want to … → which chain.
   ─────────────────────────────────────────────────────────── */

export function WhichChainTable() {
  const rows: Array<{ intent: string; chain: 'L3' | 'Settlement'; reason: string }> = [
    { intent: 'Buy or sell an ITP directly', chain: 'L3', reason: 'Core trading' },
    { intent: 'Place a Vision bet', chain: 'L3', reason: 'Markets live here' },
    { intent: 'Claim Vision winnings', chain: 'L3', reason: 'Payouts on L3' },
    { intent: 'View my portfolio', chain: 'L3', reason: 'Holdings on L3' },
    { intent: 'Bridge-buy an ITP', chain: 'Settlement', reason: 'USDC deposited' },
    { intent: 'Bridge-sell an ITP', chain: 'Settlement', reason: 'BridgedITP sent' },
    { intent: 'Lend USDC (earn yield)', chain: 'Settlement', reason: 'Morpho lives here' },
    { intent: 'Borrow against ITP', chain: 'Settlement', reason: 'Collateral here' },
    { intent: 'Deposit USDC for Vision', chain: 'Settlement', reason: 'Deposits here' },
    { intent: 'Withdraw from Vision', chain: 'Settlement', reason: 'Withdrawals here' },
  ]

  const width = 760
  const headerH = 56
  const rowH = 32
  const tableX = 16
  const tableY = 16
  const tableW = width - tableX * 2
  const height = tableY * 2 + headerH + rows.length * rowH

  const colWidths = [380, 160, 200]
  const colXs: number[] = []
  let xCursor = tableX
  for (const w of colWidths) {
    colXs.push(xCursor)
    xCursor += w
  }

  return (
    <figure className="docs-schematic schematic-arch">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Decision matrix: which chain do you need for each user action"
      >
        {/* Outer */}
        <rect
          x={tableX}
          y={tableY}
          width={tableW}
          height={headerH + rows.length * rowH}
          rx={16}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />

        {/* Header */}
        <rect
          x={tableX}
          y={tableY}
          width={tableW}
          height={headerH}
          rx={16}
          fill={APPLE_SURFACE}
        />
        <rect
          x={tableX}
          y={tableY + headerH - 16}
          width={tableW}
          height={16}
          fill={APPLE_SURFACE}
        />
        <text
          x={tableX + 24}
          y={tableY + 24}
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          Which chain do I need?
        </text>
        {['I want to…', 'Chain', 'Why'].map((h, i) => (
          <text
            key={h}
            x={colXs[i] + 16}
            y={tableY + headerH - 10}
            fontFamily={FONT_TEXT}
            fontSize="11"
            fontWeight="600"
            letterSpacing="0.06em"
            fill={APPLE_TEXT_3}
          >
            {h.toUpperCase()}
          </text>
        ))}
        <line
          x1={tableX}
          y1={tableY + headerH}
          x2={tableX + tableW}
          y2={tableY + headerH}
          stroke={APPLE_BORDER}
        />

        {rows.map((r, i) => {
          const y = tableY + headerH + i * rowH
          const isL3 = r.chain === 'L3'
          const accent = isL3 ? APPLE_BLUE : APPLE_ORANGE
          return (
            <g key={i}>
              {i > 0 ? (
                <line
                  x1={tableX + 12}
                  y1={y}
                  x2={tableX + tableW - 12}
                  y2={y}
                  stroke={APPLE_BORDER}
                  strokeOpacity="0.5"
                />
              ) : null}
              <text
                x={colXs[0] + 16}
                y={y + 21}
                fontFamily={FONT_TEXT}
                fontSize="13"
                fill={APPLE_TEXT}
              >
                {r.intent}
              </text>
              {/* Chain pill */}
              <rect
                x={colXs[1] + 12}
                y={y + 7}
                width={isL3 ? 40 : 96}
                height={18}
                rx={9}
                fill={APPLE_BG}
                stroke={accent}
              />
              <text
                x={colXs[1] + 12 + (isL3 ? 20 : 48)}
                y={y + 20}
                textAnchor="middle"
                fontFamily={FONT_TEXT}
                fontSize="11"
                fontWeight="600"
                letterSpacing="0.04em"
                fill={accent}
              >
                {r.chain.toUpperCase()}
              </text>
              <text
                x={colXs[2] + 16}
                y={y + 21}
                fontFamily={FONT_TEXT}
                fontSize="12.5"
                fill={APPLE_TEXT_2}
              >
                {r.reason}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>The app handles the switch. The table is for the curious.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   UsdcDecimals — guides/settlement
   100 USDC on Settlement vs L3 raw units; bridge converts.
   ─────────────────────────────────────────────────────────── */

export function UsdcDecimals() {
  const width = 760
  const height = 320

  const cardW = 320
  const cardH = 130
  const left = { x: 30, y: 80 }
  const right = { x: width - 30 - cardW, y: 80 }

  return (
    <figure className="docs-schematic schematic-flow">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="100 USDC in raw units on Settlement and L3, converted by DecimalLib"
      >
        <defs>
          <marker
            id="dec-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={APPLE_TEXT_3} />
          </marker>
        </defs>

        <text
          x={width / 2}
          y={36}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="16"
          fontWeight="600"
          letterSpacing="-0.011em"
          fill={APPLE_TEXT}
        >
          100 USDC, two encodings
        </text>
        <text
          x={width / 2}
          y={56}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="12"
          fill={APPLE_TEXT_3}
        >
          a 1e12 chasm. The bridge crosses it without your knowing.
        </text>

        {/* Settlement card */}
        <rect
          x={left.x}
          y={left.y}
          width={cardW}
          height={cardH}
          rx={12}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />
        <rect x={left.x} y={left.y} width={4} height={cardH} rx={2} fill={APPLE_ORANGE} />
        <text
          x={left.x + 20}
          y={left.y + 26}
          fontFamily={FONT_TEXT}
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.06em"
          fill={APPLE_ORANGE}
        >
          SETTLEMENT · 6 DECIMALS
        </text>
        <text
          x={left.x + 20}
          y={left.y + 64}
          fontFamily={FONT_DISPLAY}
          fontSize="20"
          fontWeight="600"
          letterSpacing="-0.011em"
          fill={APPLE_TEXT}
        >
          100_000_000
        </text>
        <text
          x={left.x + 20}
          y={left.y + 88}
          fontFamily={FONT_TEXT}
          fontSize="12"
          fill={APPLE_TEXT_2}
        >
          100 × 10^6 · standard ERC-20
        </text>
        <text
          x={left.x + 20}
          y={left.y + 108}
          fontFamily={FONT_TEXT}
          fontSize="11.5"
          fill={APPLE_TEXT_3}
        >
          bridge custody, Vision deposits, Morpho
        </text>

        {/* L3 card */}
        <rect
          x={right.x}
          y={right.y}
          width={cardW}
          height={cardH}
          rx={12}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />
        <rect x={right.x} y={right.y} width={4} height={cardH} rx={2} fill={APPLE_BLUE} />
        <text
          x={right.x + 20}
          y={right.y + 26}
          fontFamily={FONT_TEXT}
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.06em"
          fill={APPLE_BLUE}
        >
          INDEX L3 · 18 DECIMALS
        </text>
        <text
          x={right.x + 20}
          y={right.y + 64}
          fontFamily={FONT_DISPLAY}
          fontSize="20"
          fontWeight="600"
          letterSpacing="-0.011em"
          fill={APPLE_TEXT}
        >
          100_000_000_000_000_000_000
        </text>
        <text
          x={right.x + 20}
          y={right.y + 88}
          fontFamily={FONT_TEXT}
          fontSize="12"
          fill={APPLE_TEXT_2}
        >
          100 × 10^18 · ETH-style precision
        </text>
        <text
          x={right.x + 20}
          y={right.y + 108}
          fontFamily={FONT_TEXT}
          fontSize="11.5"
          fill={APPLE_TEXT_3}
        >
          ITP balances, NAV, leaderboards
        </text>

        {/* Conversion arrows */}
        <g>
          <line
            x1={left.x + cardW + 6}
            y1={left.y + cardH / 2 - 12}
            x2={right.x - 6}
            y2={right.y + cardH / 2 - 12}
            stroke={APPLE_BLUE}
            strokeWidth={1.5}
            markerEnd="url(#dec-arrow)"
          />
          <text
            x={(left.x + cardW + right.x) / 2}
            y={left.y + cardH / 2 - 18}
            textAnchor="middle"
            fontFamily={FONT_TEXT}
            fontSize="11.5"
            fontWeight="600"
            fill={APPLE_BLUE}
          >
            toInternal · ×1e12
          </text>
        </g>
        <g>
          <line
            x1={right.x - 6}
            y1={right.y + cardH / 2 + 12}
            x2={left.x + cardW + 6}
            y2={left.y + cardH / 2 + 12}
            stroke={APPLE_ORANGE}
            strokeWidth={1.5}
            markerEnd="url(#dec-arrow)"
          />
          <text
            x={(left.x + cardW + right.x) / 2}
            y={left.y + cardH / 2 + 28}
            textAnchor="middle"
            fontFamily={FONT_TEXT}
            fontSize="11.5"
            fontWeight="600"
            fill={APPLE_ORANGE}
          >
            toUsdc · ÷1e12
          </text>
        </g>

        {/* Bottom note */}
        <text
          x={width / 2}
          y={height - 22}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="12"
          fill={APPLE_TEXT_3}
        >
          Implemented in DecimalLib. Never send raw USDC between chains without the bridge.
        </text>
      </svg>
      <figcaption>The decimals are not a rounding error. They are a catastrophe waiting for the wrong path.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   BridgeFlow — guides/settlement
   Bridge buy and bridge sell across both chains.
   ─────────────────────────────────────────────────────────── */

export function BridgeFlow() {
  const width = 760
  const height = 540

  const laneW = 320
  const gap = 40
  const settleX = 30
  const l3X = settleX + laneW + gap

  const renderFlow = (
    yOffset: number,
    title: string,
    deposit: string,
    settlementBox: { title: string; bullets: string[] },
    l3Box: { title: string; bullets: string[] },
    accent: string,
  ) => {
    const titleY = yOffset
    const depositY = titleY + 30
    const lanesY = depositY + 60
    const boxH = 110

    return (
      <g>
        {/* Title */}
        <text
          x={width / 2}
          y={titleY}
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          {title}
        </text>
        {/* Deposit pill */}
        <rect
          x={width / 2 - 130}
          y={depositY}
          width={260}
          height={32}
          rx={16}
          fill={APPLE_BG}
          stroke={accent}
        />
        <text
          x={width / 2}
          y={depositY + 21}
          textAnchor="middle"
          fontFamily={FONT_TEXT}
          fontSize="12.5"
          fontWeight="600"
          fill={accent}
        >
          {deposit}
        </text>
        {/* fork lines */}
        <line
          x1={width / 2}
          y1={depositY + 32}
          x2={settleX + laneW / 2}
          y2={lanesY}
          stroke={APPLE_BORDER}
          strokeWidth={1.25}
        />
        <line
          x1={width / 2}
          y1={depositY + 32}
          x2={l3X + laneW / 2}
          y2={lanesY}
          stroke={APPLE_BORDER}
          strokeWidth={1.25}
        />

        {/* Settlement box */}
        <rect
          x={settleX}
          y={lanesY}
          width={laneW}
          height={boxH}
          rx={12}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />
        <rect x={settleX} y={lanesY} width={4} height={boxH} rx={2} fill={APPLE_ORANGE} />
        <text
          x={settleX + 20}
          y={lanesY + 24}
          fontFamily={FONT_TEXT}
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.06em"
          fill={APPLE_ORANGE}
        >
          SETTLEMENT
        </text>
        <text
          x={settleX + 20}
          y={lanesY + 46}
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          {settlementBox.title}
        </text>
        {settlementBox.bullets.map((b, i) => (
          <text
            key={i}
            x={settleX + 20}
            y={lanesY + 66 + i * 16}
            fontFamily={FONT_TEXT}
            fontSize="12"
            fill={APPLE_TEXT_2}
          >
            — {b}
          </text>
        ))}

        {/* L3 box */}
        <rect
          x={l3X}
          y={lanesY}
          width={laneW}
          height={boxH}
          rx={12}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />
        <rect x={l3X} y={lanesY} width={4} height={boxH} rx={2} fill={APPLE_BLUE} />
        <text
          x={l3X + 20}
          y={lanesY + 24}
          fontFamily={FONT_TEXT}
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.06em"
          fill={APPLE_BLUE}
        >
          INDEX L3
        </text>
        <text
          x={l3X + 20}
          y={lanesY + 46}
          fontFamily={FONT_DISPLAY}
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.005em"
          fill={APPLE_TEXT}
        >
          {l3Box.title}
        </text>
        {l3Box.bullets.map((b, i) => (
          <text
            key={i}
            x={l3X + 20}
            y={lanesY + 66 + i * 16}
            fontFamily={FONT_TEXT}
            fontSize="12"
            fill={APPLE_TEXT_2}
          >
            — {b}
          </text>
        ))}
      </g>
    )
  }

  return (
    <figure className="docs-schematic schematic-flow">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Bridge buy and bridge sell flows across Settlement and Index L3"
      >
        {renderFlow(
          30,
          'Bridge Buy',
          'User deposits USDC on Settlement',
          {
            title: 'BridgedITP minted',
            bullets: ['ERC-20 replica', 'Morpho-compatible collateral'],
          },
          {
            title: 'ITP shares minted',
            bullets: ['The "real" shares', 'Tracked by Index.sol · used for NAV'],
          },
          APPLE_GREEN,
        )}
        {renderFlow(
          290,
          'Bridge Sell',
          'User sends BridgedITP on Settlement',
          {
            title: 'BridgedITP burned',
            bullets: ['USDC returned to user'],
          },
          {
            title: 'ITP shares burned',
            bullets: ['Underlying assets sold', 'Position closed atomically'],
          },
          APPLE_ORANGE,
        )}
      </svg>
      <figcaption>Two representations. One position. Always equal — by invariant, not by promise.</figcaption>
    </figure>
  )
}

/* ─────────────────────────────────────────────────────────────
   SettlementQuickReference — guides/settlement
   Two side-by-side reference cards.
   ─────────────────────────────────────────────────────────── */

export function SettlementQuickReference() {
  const width = 760
  const height = 360

  const cardW = 348
  const gap = 24
  const leftX = 20
  const rightX = leftX + cardW + gap
  const topY = 24
  const cardH = height - topY * 2

  type Field = { label: string; value: string }
  const l3Fields: Field[] = [
    { label: 'Chain ID', value: '111222333' },
    { label: 'RPC', value: 'rpc.generalmarket.io' },
    { label: 'Native', value: 'GM' },
    { label: 'USDC', value: '18 decimals' },
    { label: 'Explorer', value: '—' },
  ]
  const settlementFields: Field[] = [
    { label: 'Chain ID', value: '14601' },
    { label: 'RPC', value: 'rpc.testnet.soniclabs.com' },
    { label: 'Native', value: 'S' },
    { label: 'USDC', value: '6 decimals' },
    { label: 'Explorer', value: 'testnet.sonicscan.org' },
  ]
  const l3Lives = ['ITP shares', 'Vision markets', 'Core protocol (Index.sol)', 'BLS consensus', 'Order matching']
  const settlementLives = [
    'BridgedITP (ERC-20 replicas)',
    'Bridge custody contracts',
    'Morpho lending markets',
    'Vision USDC deposits',
    'Settlement USDC',
  ]

  const renderCard = (
    x: number,
    title: string,
    accent: string,
    fields: Field[],
    livesTitle: string,
    lives: string[],
  ) => {
    const fieldsY = topY + 60
    const fieldRowH = 24
    const livesY = fieldsY + fields.length * fieldRowH + 18

    return (
      <g>
        <rect
          x={x}
          y={topY}
          width={cardW}
          height={cardH}
          rx={16}
          fill={APPLE_BG}
          stroke={APPLE_BORDER}
        />
        <rect x={x} y={topY} width={4} height={cardH} rx={2} fill={accent} />
        <text
          x={x + 24}
          y={topY + 32}
          fontFamily={FONT_DISPLAY}
          fontSize="16"
          fontWeight="600"
          letterSpacing="-0.011em"
          fill={APPLE_TEXT}
        >
          {title}
        </text>
        <line
          x1={x + 16}
          y1={topY + 48}
          x2={x + cardW - 16}
          y2={topY + 48}
          stroke={APPLE_BORDER}
          strokeOpacity="0.6"
        />

        {fields.map((f, i) => {
          const y = fieldsY + i * fieldRowH
          return (
            <g key={i}>
              <text
                x={x + 24}
                y={y + 12}
                fontFamily={FONT_TEXT}
                fontSize="11"
                fontWeight="600"
                letterSpacing="0.06em"
                fill={APPLE_TEXT_3}
              >
                {f.label.toUpperCase()}
              </text>
              <text
                x={x + cardW - 24}
                y={y + 12}
                textAnchor="end"
                fontFamily={FONT_TEXT}
                fontSize="12.5"
                fill={APPLE_TEXT}
              >
                {f.value}
              </text>
            </g>
          )
        })}

        <text
          x={x + 24}
          y={livesY}
          fontFamily={FONT_TEXT}
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.06em"
          fill={accent}
        >
          {livesTitle.toUpperCase()}
        </text>
        {lives.map((ln, i) => (
          <text
            key={i}
            x={x + 24}
            y={livesY + 18 + i * 16}
            fontFamily={FONT_TEXT}
            fontSize="12"
            fill={APPLE_TEXT_2}
          >
            — {ln}
          </text>
        ))}
      </g>
    )
  }

  return (
    <figure className="docs-schematic schematic-arch">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Quick reference: Index L3 and Settlement chain parameters and modules"
      >
        {renderCard(leftX, 'Index L3', APPLE_BLUE, l3Fields, 'What lives here', l3Lives)}
        {renderCard(rightX, 'Settlement', APPLE_ORANGE, settlementFields, 'What lives here', settlementLives)}
      </svg>
      <figcaption>The reference card. Bookmark it. Or re-read it. Both are honest reactions.</figcaption>
    </figure>
  )
}
