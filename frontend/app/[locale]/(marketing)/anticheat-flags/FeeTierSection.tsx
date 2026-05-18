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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
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

function CostRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 0',
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            color: TEXT,
            fontWeight: 500,
            letterSpacing: '-0.011em',
          }}
        >
          {label}
        </div>
        {note && (
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              marginTop: 4,
              lineHeight: 1.45,
            }}
          >
            {note}
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 17,
          fontWeight: 600,
          color: TEXT,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
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
          style={{
            marginTop: 48,
            padding: '32px 28px',
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: 32,
              alignItems: 'start',
            }}
          >
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
                Retail baseline = 0. Bar = MM round-trip rebate over retail at this venue, in basis points.
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
              <EdgeBarRow
                label="General Market"
                bps={0}
                pct={0}
                filled={false}
                note="0"
              />
            </div>
          </div>

          {/* Source footer cards — same format as edge matrix */}
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
          style={{
            marginTop: 32,
            padding: '32px 28px',
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Cost · {EXCHANGE_COSTS.length} venues · $/month
          </div>
          <h3
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: TEXT,
              marginBottom: 8,
            }}
          >
            Cost of maxing out advantages
          </h3>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 14,
              color: SECONDARY,
              lineHeight: 1.55,
              letterSpacing: '-0.011em',
              marginBottom: 20,
              maxWidth: 780,
            }}
          >
            What a market-maker desk pays per month to stay at the top tier at each venue.
          </p>

          <div>
            {EXCHANGE_COSTS.map(c => (
              <CostRow
                key={c.slug}
                label={c.name}
                value={c.monthly}
                note={c.breakdown}
              />
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
            Ranges are orders of magnitude defensible from public fee schedules and tier disclosures. Binance VIP 9 detail (datawallet.com VIP levels, Huang-Stoll AS-share bounds, FIA derivatives survey ratios, QuantBlueprint salary guide) cross-checked across five 2025–2026 sources; other venues anchor to their published MM-tier docs.
          </div>
        </div>
      </Reveal>
    </section>
  )
}

interface ExchangeCost {
  slug: string
  name: string
  monthly: string
  breakdown: string
}

const EXCHANGE_COSTS: ExchangeCost[] = [
  {
    slug: 'binance',
    name: 'Binance',
    monthly: '$1.4M–$3.6M/mo',
    breakdown: 'VIP 9: $30B/30d futures + 5,500 BNB held + adverse-selection drag + six FTEs + Equinix cabinet · datawallet.com VIP levels, Huang-Stoll AS bounds, FIA survey, QuantBlueprint',
  },
  {
    slug: 'bybit',
    name: 'Bybit',
    monthly: '$800K–$2.0M/mo',
    breakdown: 'Supreme/MM tier: $500M/30d + bilateral institutional services contract + MMGW infra · bybit.com institutional services + MM Incentive Program docs',
  },
  {
    slug: 'coinbase',
    name: 'Coinbase',
    monthly: '$400K–$1.2M/mo',
    breakdown: 'Tier 8: $250M+ 30d volume or Fee Upgrade Program ($500K/mo proof) + LP program acceptance · coinbase.com/exchange/liquidity-program',
  },
  {
    slug: 'hyperliquid',
    name: 'Hyperliquid',
    monthly: '$300K–$700K/mo',
    breakdown: 'Tier 6: $7B+ 14-day rolling volume + >3% maker share + HLP capital lockup + HYPE for gossip priority · hyperliquid.gitbook.io/hyperliquid-docs/trading/fees',
  },
  {
    slug: 'deribit',
    name: 'Deribit',
    monthly: '$300K–$900K/mo',
    breakdown: 'VIP 6: $5B 30-day options volume + bilateral DMM agreement + LD4 cage cross-connect · support.deribit.com/hc fees',
  },
  {
    slug: 'kalshi',
    name: 'Kalshi',
    monthly: '$150K–$500K/mo (est.)',
    breakdown: 'LIP + DMM: 98% quote uptime across 80+ products + private DMM agreement (Susquehanna, Jump) — exact terms unpublished · help.kalshi.com MM program',
  },
  {
    slug: 'polymarket',
    name: 'Polymarket',
    monthly: '$100K–$300K/mo (est.)',
    breakdown: 'Maker Rebates: pool-dominant capital + latency + (Jump received equity for liquidity — terms undisclosed) · docs.polymarket.com maker rebates',
  },
  {
    slug: 'etoro',
    name: 'eToro',
    monthly: '$50K–$200K/mo',
    breakdown: 'Popular Investor Elite Pro: 2-2.5% of AUC subsidy from copy-trade flow (different model — no MM tier) · etoro.com Popular Investor tiers',
  },
  {
    slug: 'robinhood',
    name: 'Robinhood',
    monthly: 'N/A',
    breakdown: 'No tier-based MM program. Wholesalers (Citadel, Virtu, SIG) pay Robinhood for retail order flow rather than receiving a fee tier · SEC Rule 606 disclosures',
  },
  {
    slug: 'ibkr',
    name: 'IBKR',
    monthly: 'N/A',
    breakdown: 'No MM tier program after Timber Hill wound down 2017. Exchange rebates pass through to Pro clients · interactivebrokers.com commissions',
  },
  {
    slug: 'pumpfun',
    name: 'Pump.fun',
    monthly: 'N/A',
    breakdown: 'AMM, no MM tier. The cost is infrastructure: validator-adjacent RPC + Jito tips + sniper-bot stack · pump.fun/docs/fees',
  },
]
