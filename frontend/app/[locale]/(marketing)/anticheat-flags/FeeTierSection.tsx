import { Reveal } from '@/components/ui/Reveal'
import { FEE_TIER_VENUES, type FeeTierVenue } from './data-fee-tiers'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

const PROGRAM_BADGE: Record<FeeTierVenue['publicProgram'], string> = {
  open: 'Public schedule',
  partial: 'Public retail · private MM',
  private: 'MM terms private',
}

const RANKED = [...FEE_TIER_VENUES]
  .filter((v): v is FeeTierVenue & { edgeBps: number } => typeof v.edgeBps === 'number')
  .sort((a, b) => b.edgeBps - a.edgeBps)

const MAX_EDGE = RANKED.length > 0 ? RANKED[0].edgeBps : 1

const UNDISCLOSED = FEE_TIER_VENUES.filter(v => v.edgeBps === null)

function FeeCard({ v, delay }: { v: FeeTierVenue; delay: number }) {
  return (
    <Reveal delay={delay}>
      <article
        className="flex flex-col h-full"
        style={{
          background: 'var(--apple-panel)',
          border: `1px solid ${LINE}`,
          borderRadius: 'var(--apple-r-md)',
          padding: 22,
          gap: 12,
          minHeight: 360,
        }}
      >
        <header className="flex items-baseline justify-between gap-3">
          <h3
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 21,
              fontWeight: 600,
              letterSpacing: '-0.022em',
              color: TEXT,
            }}
          >
            {v.name}
          </h3>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.016em',
              color: ACCENT,
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
            }}
          >
            {v.edgeLabel}
          </span>
        </header>

        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: TERTIARY,
            letterSpacing: '-0.005em',
          }}
        >
          {v.market} · {PROGRAM_BADGE[v.publicProgram]}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingTop: 6,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              lineHeight: 1.45,
              color: TEXT,
              fontWeight: 500,
              letterSpacing: '-0.011em',
            }}
          >
            <span style={{ color: TERTIARY, fontWeight: 400 }}>Retail · </span>
            {v.retailLine}
          </div>
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              lineHeight: 1.45,
              color: TEXT,
              fontWeight: 500,
              letterSpacing: '-0.011em',
            }}
          >
            <span style={{ color: TERTIARY, fontWeight: 400 }}>Inside · </span>
            {v.mmLine}
          </div>
        </div>

        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: SECONDARY,
            lineHeight: 1.5,
            letterSpacing: '-0.005em',
            paddingTop: 4,
          }}
        >
          <span style={{ color: TERTIARY }}>Cost of staying inside · </span>
          {v.qualification}
        </div>

        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: SECONDARY,
            lineHeight: 1.5,
            letterSpacing: '-0.005em',
          }}
        >
          <span style={{ color: TERTIARY }}>Quote obligations · </span>
          {v.obligations}
        </div>

        {v.note && (
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: SECONDARY,
              lineHeight: 1.5,
              letterSpacing: '-0.005em',
              fontStyle: 'italic',
            }}
          >
            {v.note}
          </div>
        )}

        <footer
          className="flex items-center justify-between gap-3 pt-3"
          style={{ marginTop: 'auto', borderTop: `1px solid ${LINE}` }}
        >
          <a
            href={v.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              fontWeight: 500,
              color: ACCENT,
              letterSpacing: '-0.005em',
            }}
            className="hover:underline"
          >
            {v.sourceLabel} ›
          </a>
        </footer>
      </article>
    </Reveal>
  )
}

function EdgeBarRow({
  label,
  market,
  bps,
  pct,
  filled,
  note,
}: {
  label: string
  market: string
  bps: number
  pct: number
  filled: boolean
  note?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          flex: '0 0 188px',
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            color: TEXT,
            letterSpacing: '-0.011em',
            fontWeight: 500,
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            marginTop: 2,
          }}
        >
          {market}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: SURFACE,
          borderRadius: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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
          flex: '0 0 110px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontSize: 15,
          fontWeight: 600,
          color: filled ? ACCENT : TERTIARY,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
        }}
      >
        {note ?? `${bps} bps`}
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
      <Reveal delay={0.1}>
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 17,
            lineHeight: 1.47,
            letterSpacing: 'var(--apple-track-tight)',
            color: SECONDARY,
            marginTop: 12,
            maxWidth: 780,
          }}
        >
          The retail trader pays a percentage of intent. The market maker is paid by the venue for being there. Between them sits the spread the platform extracts from anyone outside the room. Every venue publishes the first half. None of them publishes both.
        </p>
      </Reveal>

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        style={{ marginTop: 36 }}
      >
        {FEE_TIER_VENUES.map((v, i) => (
          <FeeCard key={v.slug} v={v} delay={Math.min(i * 0.03, 0.24)} />
        ))}
      </div>

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
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              marginBottom: 4,
            }}
          >
            The round-trip cost gap, sorted
          </div>
          <h3
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: TEXT,
              marginBottom: 28,
            }}
          >
            How many basis points the inside lane keeps per fill.
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {RANKED.map(v => (
              <EdgeBarRow
                key={v.slug}
                label={v.name}
                market={v.market}
                bps={v.edgeBps}
                pct={(v.edgeBps / MAX_EDGE) * 100}
                filled
              />
            ))}
            {UNDISCLOSED.map(v => (
              <EdgeBarRow
                key={v.slug}
                label={v.name}
                market={v.market}
                bps={0}
                pct={0}
                filled={false}
                note={v.edgeLabel}
              />
            ))}
            <EdgeBarRow
              label="General Market"
              market="Sealed bets · parimutuel"
              bps={0}
              pct={0}
              filled={false}
              note="No inside lane"
            />
          </div>

          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              lineHeight: 1.55,
              marginTop: 24,
              paddingTop: 16,
              borderTop: `1px solid ${LINE}`,
            }}
          >
            Bar length = round-trip gap between the retail taker fee and the market-maker net fee at the top tier, in basis points. Polymarket is reported in pp because the gap is a percentage of trade notional, not bps. Kalshi appears as undisclosed because its DMM rates are private and currently the subject of a federal class action. Robinhood&apos;s asymmetry is structural — wholesalers pay the broker for retail flow rather than receiving a fee tier. Pump.fun has no fee tier; the edge is execution latency. General Market: on-chain, sealed bets, parimutuel, BLS-verified — no fee tier to sell.
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
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              marginBottom: 4,
            }}
          >
            The cost of paying nothing · reference: Binance VIP 9, single venue, single region
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
            What the inside lane actually pays to stay inside.
          </h3>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 14,
              color: SECONDARY,
              lineHeight: 1.55,
              letterSpacing: '-0.011em',
              marginBottom: 8,
              maxWidth: 780,
            }}
          >
            Holding the top tier on one major venue costs a market-maker desk between <strong style={{ color: TEXT, fontWeight: 600 }}>$1.4M and $3.6M every month</strong>, before the P&amp;L on the flow itself. Most of it is invisible: BNB held against opportunity cost, working margin posted to keep quotes live, adverse-selection drag on tight markets, the colocation cabinet, the market-data feed, the six humans who keep the stack alive. The fee schedule is the part the public sees. The cost sheet is the part that decides who gets to be the market.
          </p>

          <div style={{ marginTop: 20 }}>
            <CostRow
              label="BNB holding requirement"
              value="$148K/mo"
              note="5,500 BNB held continuously (~$3.55M locked at $645.81 on 2026-05-18), opportunity cost at 5% APR · datawallet.com VIP levels · metamask.io price feed"
            />
            <CostRow
              label="Qualifying volume — exchange fees on $4B/30d"
              value="$340K/mo"
              note="$4B × 0.5 × 1.7 bps blended 50/50 maker/taker at VIP 9 futures · tradersunion.com / bitget.com academy"
            />
            <CostRow
              label="Inventory carry on working capital"
              value="$133K/mo"
              note="0.5% × $4B notional held as inventory × 8% APR / 12 · FIA derivatives survey 2024 ratios"
            />
            <CostRow
              label="Adverse-selection drag on tight quotes"
              value="$170K–$760K/mo"
              note="0.5% of taker flow hits informed flow at 9.6%–43% AS share of spread · Huang-Stoll 1997 lower bound · Stoll 1989 upper bound"
            />
            <CostRow
              label="Headcount — six FTEs (2 quant · 2 dev · 1 SRE · 0.5 comp · 0.5 ops)"
              value="$220K–$360K/mo"
              note="$300K–$600K all-in × 6 / 12 × 1.4 loaded · QuantBlueprint salary guide · eFinancialCareers compensation report"
            />
            <CostRow
              label="Working margin to keep quotes live"
              value="$333K/mo"
              note="$50M working margin × 8% APR / 12 · Binance futures margin model"
            />
            <CostRow
              label="Market data — LSEG Direct / Pico RedlineFeed + Bloomberg seats"
              value="$15K–$40K/mo"
              note="Single-region low-latency feed plus $2,665/seat/mo Bloomberg · a-teaminsight feed comparison · costbench.com"
            />
            <CostRow
              label="Colocation cabinet + cross-connects (Equinix NY5 tier)"
              value="$3K–$4.4K/mo"
              note="5kW cabinet $1.5–3K · four cross-connects at $341 avg each · Brightlio pricing · Equinix Americas pricing"
            />
            <CostRow
              label="Compliance, audit, legal retainer"
              value="$25K–$50K/mo"
              note="Surgence Labs estimates 'six figures annualized' for active multi-venue MM coverage"
            />
          </div>

          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: `1px solid ${LINE}`,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 18,
                fontWeight: 600,
                color: TEXT,
                letterSpacing: '-0.016em',
              }}
            >
              Monthly total — one venue, one region
            </div>
            <div
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 28,
                fontWeight: 600,
                color: ACCENT,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 'var(--apple-track-tighter)',
              }}
            >
              ~$2.4M
            </div>
          </div>
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              marginTop: 8,
              lineHeight: 1.55,
              textAlign: 'right',
            }}
          >
            Low / base / high: $1.4M / $2.4M / $3.6M · $29M–$43M per year
          </div>

          <div
            style={{
              marginTop: 28,
              padding: '20px 22px',
              background: SURFACE,
              borderRadius: 'var(--apple-r-sm)',
              borderLeft: `3px solid ${ACCENT}`,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 15,
                lineHeight: 1.55,
                letterSpacing: '-0.011em',
                color: TEXT,
                fontStyle: 'italic',
                margin: 0,
              }}
            >
              The retail trader pays the published fee and feels robbed. The market maker pays nothing and bleeds two and a half million a month to keep paying nothing. The published schedule is the museum exhibit. The cost sheet is the venue.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
