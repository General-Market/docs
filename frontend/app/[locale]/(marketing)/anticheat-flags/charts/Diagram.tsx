import type { ChartProps, Mechanism } from '../types'

/*
  Four diagram templates. One big idea per card, hairline strokes, generous
  whitespace, single accent for the "loss" line. No looping animation.
  Entrance fade is handled by the IncidentCard's Reveal wrapper.
*/

const ACCENT = '#0071e3'
const LINE = 'rgba(0,0,0,0.08)'
const TEXT = '#1d1d1f'
const SECONDARY = '#6e6e73'
const TERTIARY = '#86868b'

const FRAME: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  background: '#fbfbfd',
  border: `1px solid ${LINE}`,
  borderRadius: 12,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  overflow: 'hidden',
}

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  letterSpacing: '0.011em',
  fontWeight: 500,
  color: TERTIARY,
  textTransform: 'uppercase',
}

const HEADLINE: React.CSSProperties = {
  fontFamily: 'var(--apple-font-display)',
  fontSize: 'clamp(28px, 5.5vw, 44px)',
  letterSpacing: '-0.022em',
  fontWeight: 600,
  color: TEXT,
  lineHeight: 1.05,
  fontVariantNumeric: 'tabular-nums',
}

const CAPTION: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 12,
  letterSpacing: '-0.005em',
  color: SECONDARY,
  lineHeight: 1.35,
}

/* ──────────────────────────────────────────────────────────────────────────
   1. WICK — single line that spikes, used for price-wick, rug-cliff,
   outage-cascade, listing-dump, insider-runup.
   ────────────────────────────────────────────────────────────────────────── */
function WickDiagram({ loss, extracted, recipient, pctMove, kind }: ChartProps & { kind: 'spike' | 'cliff' | 'runup' | 'outage' | 'dump' }) {
  // Each kind shapes the polyline differently. All share the same chrome.
  let points: string
  let accentIdx: number
  let yAccent: number
  let xAccent: number
  switch (kind) {
    case 'spike':
      // Flat then sudden vertical wick down and back up
      points = '0,60 60,60 120,62 180,60 220,60 230,58 240,28 245,90 252,28 260,60 320,60 400,60'
      xAccent = 245; yAccent = 90
      accentIdx = 4
      break
    case 'cliff':
      // Parabolic up then vertical drop
      points = '0,80 40,78 80,72 120,64 160,52 200,38 240,22 270,12 280,12 282,86 320,86 400,86'
      xAccent = 282; yAccent = 86
      accentIdx = 9
      break
    case 'runup':
      // Quiet then ramp up before a marked event
      points = '0,68 60,67 120,66 180,64 220,58 260,46 300,30 320,22 340,20 400,20'
      xAccent = 320; yAccent = 22
      accentIdx = 7
      break
    case 'outage':
      // Plateau, gap (offline), step down on resume
      points = '0,40 80,40 140,42 200,42 200,42 260,42 260,72 320,72 400,72'
      xAccent = 260; yAccent = 72
      accentIdx = 6
      break
    case 'dump':
      // Spike up at listing, slow grind down
      points = '0,84 30,82 60,30 90,28 120,34 160,44 220,56 280,68 340,76 400,82'
      xAccent = 60; yAccent = 30
      accentIdx = 2
      break
  }
  void accentIdx

  return (
    <div style={FRAME}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={LABEL}>{recipient ?? 'price'}</div>
        {pctMove && <div style={{ ...LABEL, color: TEXT }}>{pctMove}</div>}
      </div>

      <div style={{ position: 'relative', flex: 1, marginTop: 8, marginBottom: 8 }}>
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden>
          {/* baseline */}
          <line x1="0" y1="60" x2="400" y2="60" stroke={LINE} strokeWidth="1" strokeDasharray="2 4" />
          {/* main trace */}
          <polyline points={points} fill="none" stroke={SECONDARY} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          {/* accent point */}
          <circle cx={xAccent} cy={yAccent} r="3" fill={ACCENT} />
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <div style={HEADLINE}>{extracted ?? '—'}</div>
          {loss && <div style={{ ...CAPTION, marginTop: 4 }}>{loss}</div>}
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   2. DRAIN — single big number with a bar that empties.
   hack-drain, withdrawal-freeze, button-freeze, backdoor.
   ────────────────────────────────────────────────────────────────────────── */
function DrainDiagram({ loss, extracted, recipient }: ChartProps) {
  return (
    <div style={FRAME}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={LABEL}>balance</div>
        <div style={{ ...LABEL, color: TEXT }}>{recipient ?? ''}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, margin: '8px 0' }}>
        <div style={HEADLINE}>{extracted ?? '—'}</div>
        <div style={{ position: 'relative', height: 4, width: '100%', background: LINE, borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              right: '92%',
              background: ACCENT,
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {loss && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div style={CAPTION}>{loss}</div>
          <div style={{ ...LABEL, color: TERTIARY }}>drained</div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   3. CARVEOUT — before / after blocks, hairline divider, single accent
   showing the truncated portion.
   carveout, oracle-override, margin-doubled, socialized-loss, b-book-mirror.
   ────────────────────────────────────────────────────────────────────────── */
function CarveoutDiagram({ loss, extracted, recipient, pctMove }: ChartProps) {
  return (
    <div style={FRAME}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={LABEL}>payoff before</div>
        <div style={LABEL}>after</div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, margin: '12px 0' }}>
        {/* before — full block */}
        <div style={{ flex: 1, position: 'relative' }}>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 60, display: 'block' }} aria-hidden>
            <rect x="1" y="2" width="98" height="36" rx="2" fill="#fff" stroke={LINE} strokeWidth="1" />
          </svg>
          <div style={{ ...CAPTION, marginTop: 8, color: TEXT, fontWeight: 500 }}>
            {pctMove ?? 'promise'}
          </div>
        </div>

        {/* arrow */}
        <div style={{ fontSize: 14, color: TERTIARY, fontFamily: 'var(--apple-font-text)' }}>→</div>

        {/* after — truncated, accent showing the carved-off piece */}
        <div style={{ flex: 1, position: 'relative' }}>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 60, display: 'block' }} aria-hidden>
            <rect x="1" y="2" width="34" height="36" rx="2" fill="#fff" stroke={LINE} strokeWidth="1" />
            <rect x="36" y="2" width="63" height="36" rx="2" fill={ACCENT} fillOpacity="0.08" stroke={ACCENT} strokeWidth="1" strokeDasharray="2 3" />
          </svg>
          <div style={{ ...CAPTION, marginTop: 8, color: TEXT, fontWeight: 500 }}>
            {extracted ?? loss ?? 'carved'}
          </div>
        </div>
      </div>

      {recipient && (
        <div style={{ ...LABEL, color: TERTIARY }}>kept by {recipient}</div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   4. FLOW — three nodes with arrows, showing value moving from user
   to a recipient. compliance-fine, wash-trading.
   ────────────────────────────────────────────────────────────────────────── */
function FlowDiagram({ loss, extracted, recipient }: ChartProps) {
  return (
    <div style={FRAME}>
      <div style={LABEL}>flow</div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '12px 0', minHeight: 0 }}>
        <Node title="user" subtitle={loss ?? '—'} tone="muted" />
        <Arrow />
        <Node title="venue" subtitle="" tone="muted" />
        <Arrow />
        <Node title={recipient ?? 'recipient'} subtitle={extracted ?? '—'} tone="accent" />
      </div>

      <div style={{ ...LABEL, color: TERTIARY }}>{extracted ?? ''} → {recipient ?? ''}</div>
    </div>
  )
}

function Node({ title, subtitle, tone }: { title: string; subtitle: string; tone: 'muted' | 'accent' }) {
  const borderColor = tone === 'accent' ? ACCENT : LINE
  const titleColor = tone === 'accent' ? ACCENT : SECONDARY
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      border: `1px solid ${borderColor}`,
      borderRadius: 8,
      padding: '8px 10px',
      background: '#fff',
      overflow: 'hidden',
    }}>
      <div style={{ ...LABEL, color: titleColor, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 14,
          fontWeight: 600,
          color: tone === 'accent' ? TEXT : SECONDARY,
          letterSpacing: '-0.016em',
          marginTop: 2,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

function Arrow() {
  return (
    <svg width="20" height="8" viewBox="0 0 20 8" style={{ flexShrink: 0 }} aria-hidden>
      <line x1="0" y1="4" x2="16" y2="4" stroke={TERTIARY} strokeWidth="1" />
      <path d="M14 1 L19 4 L14 7" fill="none" stroke={TERTIARY} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

const REGISTRY: Record<Mechanism, (p: ChartProps) => React.ReactElement> = {
  'price-wick':         (p) => <WickDiagram {...p} kind="spike" />,
  'rug-cliff':          (p) => <WickDiagram {...p} kind="cliff" />,
  'outage-cascade':     (p) => <WickDiagram {...p} kind="outage" />,
  'listing-dump':       (p) => <WickDiagram {...p} kind="dump" />,
  'insider-runup':      (p) => <WickDiagram {...p} kind="runup" />,

  'hack-drain':         (p) => <DrainDiagram {...p} />,
  'withdrawal-freeze':  (p) => <DrainDiagram {...p} />,
  'button-freeze':      (p) => <DrainDiagram {...p} />,
  'backdoor':           (p) => <DrainDiagram {...p} />,

  'carveout':           (p) => <CarveoutDiagram {...p} />,
  'oracle-override':    (p) => <CarveoutDiagram {...p} />,
  'margin-doubled':     (p) => <CarveoutDiagram {...p} />,
  'socialized-loss':    (p) => <CarveoutDiagram {...p} />,
  'b-book-mirror':      (p) => <CarveoutDiagram {...p} />,

  'compliance-fine':    (p) => <FlowDiagram {...p} />,
  'wash-trading':       (p) => <FlowDiagram {...p} />,
}

export function Diagram({ mechanism, ...props }: { mechanism: Mechanism } & ChartProps) {
  const Component = REGISTRY[mechanism]
  return Component(props)
}
