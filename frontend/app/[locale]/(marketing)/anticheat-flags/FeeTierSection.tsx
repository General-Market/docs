import { Reveal } from '@/components/ui/Reveal'
import { FEE_TIER_VENUES, type FeeTierVenue } from './data-fee-tiers'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

const RANKED = [...FEE_TIER_VENUES]
  .filter((v): v is FeeTierVenue & { edgeBps: number } => typeof v.edgeBps === 'number')
  .sort((a, b) => b.edgeBps - a.edgeBps)

const MAX_EDGE = RANKED.length > 0 ? RANKED[0].edgeBps : 1

const UNDISCLOSED = FEE_TIER_VENUES.filter(v => v.edgeBps === null)

interface MaxingCost {
  slug: string
  name: string
  infraMonthly: number
  staffMonthly: number
  infraRangeLow: number
  infraRangeHigh: number
  topCostLine: string
  computationNote: string
  netNote?: string
  sources: { label: string; url: string }[]
}

const MAXING_COSTS: MaxingCost[] = [
  {
    slug: 'robinhood',
    name: 'Robinhood (composite)',
    infraMonthly: 110_550_000,
    staffMonthly: 3_000_000,
    infraRangeLow: 100_000_000,
    infraRangeHigh: 120_000_000,
    topCostLine: 'Options PFOF paid to Robinhood',
    computationNote: '$760M FY2024 options PFOF ÷ 12 = $63.3M, plus $14.75M equity PFOF and $22M inventory capital',
    netNote: 'Revenue captured: ~$115.4M/mo. Net composite +$1.85M/mo.',
    sources: [
      {
        label: 'Robinhood 10-K FY2024',
        url: 'https://www.sec.gov/Archives/edgar/data/1783879/000178387925000049/hood-20241231.htm',
      },
      {
        label: 'Ernst-Spatt PFOF (NBER w29883)',
        url: 'https://www.nber.org/system/files/working_papers/w29883/w29883.pdf',
      },
    ],
  },
  {
    slug: 'binance',
    name: 'Binance',
    infraMonthly: 4_370_000,
    staffMonthly: 150_000,
    infraRangeLow: 3_870_000,
    infraRangeHigh: 4_870_000,
    topCostLine: 'Volume requirement exchange fees',
    computationNote: '$30B futures notional × 50% taker share × 1.7 bps = $2.55M, plus $1M inventory carry',
    sources: [
      {
        label: 'Binance USDⓈ-M futures fee schedule',
        url: 'https://www.binance.com/en/fee/futureFee',
      },
      {
        label: 'Binance VIP levels (Datawallet)',
        url: 'https://www.datawallet.com/crypto/binance-vip-levels-explained',
      },
    ],
  },
  {
    slug: 'bybit',
    name: 'Bybit',
    infraMonthly: 4_065_000,
    staffMonthly: 150_000,
    infraRangeLow: 3_560_000,
    infraRangeHigh: 4_570_000,
    topCostLine: 'Taker fees net of MMIP rebate',
    computationNote: '$30B × 50% × 3 bps − $15B maker × 1.5 bps MMIP rebate = $2.25M net',
    sources: [
      {
        label: 'Bybit Trading Fee Structure',
        url: 'https://www.bybit.com/en/help-center/article/Trading-Fee-Structure',
      },
      {
        label: 'Market Maker Incentive Program',
        url: 'https://www.bybit.com/en/help-center/article/Introduction-to-the-Market-Maker-Incentive-Program',
      },
    ],
  },
  {
    slug: 'deribit',
    name: 'Deribit',
    infraMonthly: 2_295_167,
    staffMonthly: 900_000,
    infraRangeLow: 2_100_000,
    infraRangeHigh: 2_500_000,
    topCostLine: 'Options margin carry + adverse selection',
    computationNote: '$5B × 0.01% effective options fee = $500K, plus 2% margin × 8% APR / 12 = $666K',
    sources: [
      {
        label: 'Deribit volume discounts',
        url: 'https://insights.deribit.com/education/new-volume-discounts-on-trading-fees/',
      },
      {
        label: 'Deribit server infrastructure (LD4)',
        url: 'https://support.deribit.com/hc/en-us/articles/25944617582877-Server-Infrastructure',
      },
    ],
  },
  {
    slug: 'hyperliquid',
    name: 'Hyperliquid',
    infraMonthly: 1_154_433,
    staffMonthly: 900_000,
    infraRangeLow: 1_000_000,
    infraRangeHigh: 1_300_000,
    topCostLine: 'Adverse-selection drag on $13B maker volume',
    computationNote: '25% × 2 bps × $13B/mo maker notional = $650K, plus $433K inventory carry',
    sources: [
      {
        label: 'Hyperliquid fees',
        url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees',
      },
      {
        label: 'Validator self-stake (HYPE)',
        url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/validators/running-a-validator',
      },
    ],
  },
  {
    slug: 'kalshi',
    name: 'Kalshi (DMM)',
    infraMonthly: 347_500,
    staffMonthly: 525_000,
    infraRangeLow: 155_000,
    infraRangeHigh: 540_000,
    topCostLine: 'Adverse-selection drag on binary outcomes',
    computationNote: '20–60% × $400–800M notional × 1¢–3¢ spreads, less LIP rebate ($50K–$250K/mo)',
    sources: [
      {
        label: 'Kalshi LIP self-certification (CFTC)',
        url: 'https://kalshi-public-docs.s3.amazonaws.com/regulatory/notices/Volume%20and%20Liquidity%20Incentive%20Program%20-%20August%202025.pdf',
      },
      {
        label: 'Kalshi Rulebook v1.18',
        url: 'https://www.cftc.gov/sites/default/files/filings/orgrules/25/07/rules07012525155.pdf',
      },
    ],
  },
  {
    slug: 'pumpfun',
    name: 'Pump.fun (sniper)',
    infraMonthly: 626_316,
    staffMonthly: 60_000,
    infraRangeLow: 600_000,
    infraRangeHigh: 650_000,
    topCostLine: 'Jito tip auction',
    computationNote: '3,000 SOL/mo tipped at $180 = $540K, plus $72K failed-bundle burn',
    sources: [
      {
        label: 'Jito low-latency txn send',
        url: 'https://docs.jito.wtf/lowlatencytxnsend/',
      },
      {
        label: 'Bitget sniper hit-rate study',
        url: 'https://www.bitget.com/news/detail/12560604803448',
      },
    ],
  },
  {
    slug: 'ibkr',
    name: 'IBKR (institutional DMA)',
    infraMonthly: 180_427,
    staffMonthly: 266_667,
    infraRangeLow: 150_000,
    infraRangeHigh: 210_000,
    topCostLine: 'Adverse-selection drag',
    computationNote: '$20M/day × 21 days × 1.8¢ effective spread × 18% AS share = $97K, plus $33K Reg-T carry',
    sources: [
      {
        label: 'IB Prime services',
        url: 'https://www.interactivebrokers.com/en/trading/prime-broker-services.php',
      },
      {
        label: 'IBKR market data pricing',
        url: 'https://www.interactivebrokers.com/en/pricing/market-data-pricing.php',
      },
    ],
  },
  {
    slug: 'polymarket',
    name: 'Polymarket',
    infraMonthly: 131_217,
    staffMonthly: 150_000,
    infraRangeLow: 110_000,
    infraRangeHigh: 155_000,
    topCostLine: 'Adverse-selection drag on binary outcomes',
    computationNote: '$5M/day × 30 days × 1.2¢ effective spread × 30% AS share = $108K',
    sources: [
      {
        label: 'Polymarket liquidity rewards',
        url: 'https://docs.polymarket.com/market-makers/liquidity-rewards',
      },
      {
        label: 'CTF Exchange off-chain matching',
        url: 'https://github.com/Polymarket/ctf-exchange',
      },
    ],
  },
  {
    slug: 'coinbase',
    name: 'Coinbase',
    infraMonthly: 103_667,
    staffMonthly: 150_000,
    infraRangeLow: 90_000,
    infraRangeHigh: 120_000,
    topCostLine: 'Tier 8 taker fees net of LP rebate',
    computationNote: '$500M × 2.5 bps blended − $50K LP rebate = $75K, plus $16.7K inventory carry',
    sources: [
      {
        label: 'Coinbase Advanced fee schedule',
        url: 'https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees',
      },
      {
        label: 'Coinbase Exchange Liquidity Program',
        url: 'https://www.coinbase.com/exchange/liquidity-program',
      },
    ],
  },
  {
    slug: 'etoro',
    name: 'eToro (Elite Pro)',
    infraMonthly: 0,
    staffMonthly: 0,
    infraRangeLow: 0,
    infraRangeHigh: 0,
    topCostLine: 'Net subsidy received',
    computationNote: '1.5% × $10M AUC / 12 = +$12.5K/mo subsidy. Operator is the cost: one human, no desk.',
    netNote: 'Net positive: roughly +$148.5K/yr to +$298K/yr at $20M cap.',
    sources: [
      {
        label: 'eToro Popular Investor program',
        url: 'https://www.etoro.com/copytrader/popular-investor/',
      },
      {
        label: 'Popular Investor level requirements',
        url: 'https://help.etoro.com/Copy-Trading/886382132/What-are-the-Popular-Investor-level-requirements.htm',
      },
    ],
  },
]

const MAX_TOTAL = Math.max(
  ...MAXING_COSTS.map(c => c.infraMonthly + c.staffMonthly),
  1,
)

function formatMoneyPerMonth(n: number): string {
  if (n === 0) return '$0/mo'
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const formatted = m >= 10 ? m.toFixed(0) : m.toFixed(2)
    return `${sign}$${formatted}M/mo`
  }
  if (abs >= 1_000) {
    return `${sign}$${Math.round(abs / 1_000)}k/mo`
  }
  return `${sign}$${abs}/mo`
}

function formatStaffAddOn(n: number): string {
  if (n <= 0) return ''
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `+$${m >= 10 ? m.toFixed(0) : m.toFixed(1)}M humans`
  }
  return `+$${Math.round(n / 1_000)}k humans`
}

function MaxingCostBar({ row }: { row: MaxingCost }) {
  const isNetPositive = row.infraMonthly === 0 && row.staffMonthly === 0
  const total = row.infraMonthly + row.staffMonthly
  const totalPct = Math.max(0, (total / MAX_TOTAL) * 100)
  const infraPct = Math.max(0, (Math.max(row.infraMonthly, 0) / MAX_TOTAL) * 100)

  return (
    <div className="acf-bar-row">
      <div
        className="acf-bar-label"
        style={{
          flex: '0 0 180px',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          color: TEXT,
          letterSpacing: '-0.011em',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.name}
      </div>
      <div
        className="acf-bar-track"
        style={{
          flex: 1,
          height: 14,
          background: SURFACE,
          borderRadius: 4,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {isNetPositive ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 0,
              borderLeft: `2px solid ${ACCENT}`,
            }}
          />
        ) : (
          <>
            {totalPct > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${totalPct}%`,
                  background: ACCENT,
                  opacity: 0.32,
                  borderRadius: 4,
                }}
              />
            )}
            {infraPct > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${infraPct}%`,
                  background: ACCENT,
                  borderRadius: 4,
                }}
              />
            )}
          </>
        )}
      </div>
      <div
        className="acf-bar-value"
        style={{
          flex: '0 0 120px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontSize: 14,
          fontWeight: 600,
          color: isNetPositive ? ACCENT : ACCENT,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}
      >
        <div>{isNetPositive ? 'net positive' : formatMoneyPerMonth(row.infraMonthly)}</div>
        {row.staffMonthly > 0 && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: TERTIARY,
              marginTop: 2,
              letterSpacing: '-0.005em',
            }}
          >
            {formatStaffAddOn(row.staffMonthly)}
          </div>
        )}
      </div>
    </div>
  )
}

const SORTED_COSTS = [...MAXING_COSTS].sort(
  (a, b) => b.infraMonthly + b.staffMonthly - (a.infraMonthly + a.staffMonthly),
)

function GeneralMarketRow({
  caption,
  labelWidth,
  valueWidth,
}: {
  caption: string
  labelWidth: number
  valueWidth: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="acf-bar-row">
        <div
          className="acf-bar-label"
          style={{
            flex: `0 0 ${labelWidth}px`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: TEXT,
            letterSpacing: '-0.011em',
            fontWeight: 600,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt=""
            width={14}
            height={14}
            style={{ borderRadius: 3, flexShrink: 0 }}
          />
          General
        </div>
        <div
          className="acf-bar-track"
          style={{
            flex: 1,
            height: 14,
            background: SURFACE,
            borderRadius: 4,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: -3,
              bottom: -3,
              width: 0,
              borderLeft: `1px dashed color-mix(in srgb, ${TERTIARY} 50%, transparent)`,
            }}
            aria-hidden
          />
        </div>
        <div
          className="acf-bar-value"
          style={{
            flex: `0 0 ${valueWidth}px`,
            textAlign: 'right',
            fontFamily: 'var(--apple-font-display)',
            fontSize: 14,
            fontWeight: 600,
            color: TERTIARY,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.016em',
            whiteSpace: 'nowrap',
          }}
        >
          0
        </div>
      </div>
      <div
        className="acf-bar-caption"
        style={{
          paddingLeft: labelWidth + 12,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: SECONDARY,
          letterSpacing: '-0.005em',
          lineHeight: 1.45,
          fontStyle: 'italic',
        }}
      >
        {caption}
      </div>
    </div>
  )
}

function EdgeBarRow({
  label,
  bps,
  pct,
  filled,
  note,
}: {
  label: string
  bps: number
  pct: number
  filled: boolean
  note?: string
}) {
  return (
    <div className="acf-bar-row">
      <div
        className="acf-bar-label"
        style={{
          flex: '0 0 120px',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          color: TEXT,
          letterSpacing: '-0.011em',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
      <div
        className="acf-bar-track"
        style={{
          flex: 1,
          height: 14,
          background: SURFACE,
          borderRadius: 4,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -3,
            bottom: -3,
            width: 0,
            borderLeft: `1px dashed color-mix(in srgb, ${TERTIARY} 50%, transparent)`,
          }}
          aria-hidden
        />
        {filled && pct > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${pct}%`,
              background: ACCENT,
              borderRadius: 4,
            }}
          />
        )}
      </div>
      <div
        className="acf-bar-value"
        style={{
          flex: '0 0 100px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontSize: 14,
          fontWeight: 600,
          color: filled ? ACCENT : TERTIARY,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          whiteSpace: 'nowrap',
        }}
      >
        {note ?? `+${bps} bps`}
      </div>
    </div>
  )
}

export function FeeTierSection() {
  return (
    <section
      id="fee-tier-edge"
      style={{
        paddingTop: 80,
        paddingBottom: 24,
        borderTop: `1px solid ${LINE}`,
        scrollMarginTop: 80,
      }}
    >
      <Reveal>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            marginBottom: 10,
          }}
        >
          The edge measured in basis points · 14 venues · most numbers off the public page
        </div>
      </Reveal>
      <Reveal mask delay={0.04}>
        <h2
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(28px, 3.6vw, 40px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tighter)',
            lineHeight: 1.1,
            color: TEXT,
            maxWidth: 880,
          }}
        >
          Unfair fee tier
        </h2>
      </Reveal>
      <Reveal delay={0.12}>
        <div
          className="acf-chart-panel"
          style={{
            marginTop: 48,
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div className="acf-chart-grid">
            <div>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                Subsidy · {RANKED.length} sourced · bps round-trip
              </div>
              <h3
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: TEXT,
                  marginBottom: 10,
                }}
              >
                Unfair fee tier
              </h3>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  color: SECONDARY,
                  letterSpacing: '-0.011em',
                  lineHeight: 1.55,
                  marginBottom: 10,
                }}
              >
                Bar = MM round-trip rebate over retail at this venue, in basis points. Single shade — no gating sub-portion, this is the full disclosed fee delta. Retail baseline = 0.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                {RANKED.length + UNDISCLOSED.length} venues
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {RANKED.map(v => (
                <EdgeBarRow
                  key={v.slug}
                  label={v.name}
                  bps={v.edgeBps}
                  pct={(v.edgeBps / MAX_EDGE) * 100}
                  filled
                />
              ))}
              {UNDISCLOSED.map(v => (
                <EdgeBarRow
                  key={v.slug}
                  label={v.name}
                  bps={0}
                  pct={0}
                  filled={false}
                  note={v.edgeLabel}
                />
              ))}
              <GeneralMarketRow
                caption="One fee, one tier. The VIP table is empty."
                labelWidth={120}
                valueWidth={100}
              />
            </div>
          </div>

          {/* Source footer cards. Same format as edge matrix */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: `1px solid ${LINE}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '14px 22px',
            }}
          >
            {FEE_TIER_VENUES.map(v => (
              <div
                key={v.slug}
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                  lineHeight: 1.5,
                }}
              >
                <div
                  style={{
                    color: TEXT,
                    fontWeight: 600,
                    marginBottom: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {v.name}{' '}
                  <span style={{ color: TERTIARY, fontWeight: 400 }}>· {v.edgeLabel}</span>
                </div>
                <div style={{ marginBottom: 4, fontStyle: 'italic', color: SECONDARY }}>
                  Retail: {v.retailLine} | MM: {v.mmLine}
                </div>
                <div style={{ marginBottom: 4, color: SECONDARY, fontStyle: 'italic' }}>
                  Mechanism: {v.market}
                </div>
                <a
                  href={v.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: ACCENT, fontSize: 11, fontWeight: 500 }}
                  className="hover:underline"
                >
                  {v.sourceLabel} ›
                </a>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.16}>
        <div
          className="acf-chart-panel"
          style={{
            marginTop: 32,
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div className="acf-chart-grid">
            <div>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                {MAXING_COSTS.length} venues · USD/month
              </div>
              <h3
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: TEXT,
                  marginBottom: 10,
                }}
              >
                Cost of maxing out advantages
              </h3>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  color: SECONDARY,
                  letterSpacing: '-0.011em',
                  lineHeight: 1.55,
                  marginBottom: 10,
                }}
              >
                Bar = monthly burn to keep the maxed-out MM seat at this venue, in USD. Solid inner = infrastructure cost (fees, capital lockup, colocation, market data feeds, opportunity drag). Faded extension = adds a 4–6 person desk at loaded comp. Retail baseline = 0.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                Sorted by total monthly burn. eToro is the lone net-positive seat.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {SORTED_COSTS.map(row => (
                <MaxingCostBar key={row.slug} row={row} />
              ))}
              <GeneralMarketRow
                caption="Nothing to max out. The advantage was never built."
                labelWidth={180}
                valueWidth={120}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: `1px solid ${LINE}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px 22px',
            }}
          >
            {SORTED_COSTS.map(row => (
              <div
                key={row.slug}
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                  lineHeight: 1.5,
                }}
              >
                <div
                  style={{
                    color: TEXT,
                    fontWeight: 600,
                    marginBottom: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.name}{' '}
                  <span style={{ color: TERTIARY, fontWeight: 400 }}>
                    · {formatMoneyPerMonth(row.infraMonthly)} infra
                    {row.staffMonthly > 0 && ` · ${formatStaffAddOn(row.staffMonthly)}`}
                  </span>
                </div>
                <div style={{ marginBottom: 4, fontStyle: 'italic', color: SECONDARY }}>
                  Top line: {row.topCostLine}
                </div>
                <div style={{ marginBottom: 4, color: SECONDARY }}>
                  Computation: {row.computationNote}
                </div>
                {row.netNote && (
                  <div style={{ marginBottom: 4, color: SECONDARY, fontStyle: 'italic' }}>
                    {row.netNote}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {row.sources.map(s => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: ACCENT, fontSize: 11, fontWeight: 500 }}
                      className="hover:underline"
                    >
                      {s.label} ›
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              lineHeight: 1.6,
              marginTop: 20,
              paddingTop: 16,
              borderTop: `1px solid ${LINE}`,
            }}
          >
            Infra midpoints from sourced reports (Binance VIP 9, Bybit Supreme + MMIP, Coinbase Tier 8, Deribit VIP 6, Hyperliquid Mkr Tier 3, Kalshi DMM, Polymarket LP, Robinhood composite wholesaler + RH-side margin, IBKR institutional DMA, eToro Elite Pro, Pump.fun sniper). Staff midpoints use loaded-comp benchmarks per FIA Derivatives Market Structure 2024 and venue-specific desk-size reporting (efinancialcareers, hedgefundcompensationreport). Robinhood is the composite extractor seat: wholesaler PFOF, internal margin spread, securities lending. Costs only, before $115M/mo revenue netting back to +$1.85M. eToro pays the operator.
          </div>
        </div>
      </Reveal>
    </section>
  )
}
