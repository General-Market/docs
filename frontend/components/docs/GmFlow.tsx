import type { ReactNode } from "react";

/* The ```gmflow fence — General Market docs diagrams, keyed by id.
   Seven registry diagrams (docs/docs-rebuild/spec.md), hand-built static SVG:
   numbered tracked-caps stage kickers, simple boxes (bold title + small grey
   sub-label), every arrow a labelled verb reading left-to-right, ONE accent
   (#0071e3) marking the reader's actor, ONE dark-filled terminal box (the
   result), branch forks in rounded pills. Server-rendered — no hooks, no JS
   shipped. Responsive via viewBox + the .gmd-svg width:100% rule. */

// ─── palette ────────────────────────────────────────────────────────────────

const T = {
  W: 760,
  ink: "#1d1d1f", // titles, the dark terminal fill
  sub: "#6e6e73", // sub-labels, arrow labels
  faint: "#86868b", // kickers, footnotes
  line: "#d2d2d7", // box borders, arrow strokes
  surface: "#ffffff",
  accent: "#0071e3", // the reader's actor — the one accent
  accentBg: "#eaf3fd",
  accentBd: "#a8cdf0",
};

// ─── primitives ─────────────────────────────────────────────────────────────

function Defs({ ns }: { ns: string }) {
  const tones: [string, string][] = [
    ["mute", T.sub],
    ["accent", T.accent],
  ];
  return (
    <defs>
      {tones.map(([name, color]) => (
        <marker
          key={name}
          id={`gmf-${ns}-${name}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M1,1 L9,5 L1,9" fill="none" stroke={color} strokeWidth={1.6} />
        </marker>
      ))}
    </defs>
  );
}

function Frame({
  ns,
  h,
  label,
  children,
}: {
  ns: string;
  h: number;
  label: string;
  children: ReactNode;
}) {
  return (
    <figure className="gmd" data-diagram-id={ns}>
      <svg viewBox={`0 0 ${T.W} ${h}`} className="gmd-svg" role="img" aria-label={label}>
        <Defs ns={ns} />
        {children}
      </svg>
    </figure>
  );
}

/** Numbered tracked-caps stage kicker: `1 · JOIN WINDOW`. */
function Kicker({ x, y, n, label }: { x: number; y: number; n: number; label: string }) {
  return (
    <text x={x} y={y} style={{ fontSize: 11, fontWeight: 700, fill: T.faint, letterSpacing: "1.1px" }}>
      {n} · {label.toUpperCase()}
    </text>
  );
}

type BoxKind = "plain" | "actor" | "dark";

/** A simple box: bold title + up to two small grey sub-labels. */
function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  sub2,
  kind = "plain",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  sub2?: string;
  kind?: BoxKind;
}) {
  const dark = kind === "dark";
  const actor = kind === "actor";
  const bg = dark ? T.ink : actor ? T.accentBg : T.surface;
  const bd = dark ? T.ink : actor ? T.accentBd : T.line;
  const titleFill = dark ? "#ffffff" : actor ? T.accent : T.ink;
  const subFill = dark ? "rgba(255,255,255,0.72)" : T.sub;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const lines = (sub ? 1 : 0) + (sub2 ? 1 : 0);
  const titleY = lines === 2 ? cy - 15 : lines === 1 ? cy - 8 : cy;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={bg} stroke={bd} strokeWidth={1.5} />
      <text x={cx} y={titleY} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13.5, fontWeight: 700, fill: titleFill }}>
        {title}
      </text>
      {sub && (
        <text x={cx} y={lines === 2 ? cy + 2 : cy + 10} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 10.5, fill: subFill }}>
          {sub}
        </text>
      )}
      {sub2 && (
        <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 10.5, fill: subFill }}>
          {sub2}
        </text>
      )}
    </g>
  );
}

function EdgeLabel({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 6.2 + 12;
  return (
    <g>
      <rect x={x - w / 2} y={y - 8.5} width={w} height={17} rx={4} fill={T.surface} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 10.5, fill: T.sub }}>
        {text}
      </text>
    </g>
  );
}

/** A straight labelled arrow — every arrow carries its verb. */
function Arrow({
  ns,
  x1,
  y1,
  x2,
  y2,
  label,
  labelDy = 0,
  dashed = false,
  tone = "mute",
}: {
  ns: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  /** Lift the label off the line (no backing rect) — for tight gaps where the
   *  white label background would erase the arrow itself. */
  labelDy?: number;
  dashed?: boolean;
  tone?: "mute" | "accent";
}) {
  const color = tone === "accent" ? T.accent : T.sub;
  const lx = (x1 + x2) / 2;
  const ly = (y1 + y2) / 2;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "5 4" : undefined}
        markerEnd={`url(#gmf-${ns}-${tone})`}
      />
      {label &&
        (labelDy === 0 ? (
          <EdgeLabel x={lx} y={ly} text={label} />
        ) : (
          <text x={lx} y={ly + labelDy} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 10.5, fill: T.sub }}>
            {label}
          </text>
        ))}
    </g>
  );
}

/** A row-wrap connector: down from a row's last box, across, down into the
 *  next row's first box — so multi-row flows still read left-to-right. */
function Wrap({
  ns,
  fromX,
  fromY,
  midY,
  toX,
  toY,
  label,
}: {
  ns: string;
  fromX: number;
  fromY: number;
  midY: number;
  toX: number;
  toY: number;
  label?: string;
}) {
  return (
    <g>
      <path
        d={`M${fromX},${fromY} L${fromX},${midY} L${toX},${midY} L${toX},${toY}`}
        fill="none"
        stroke={T.sub}
        strokeWidth={1.5}
        markerEnd={`url(#gmf-${ns}-mute)`}
      />
      {label && <EdgeLabel x={(fromX + toX) / 2} y={midY} text={label} />}
    </g>
  );
}

/** A branch fork in a rounded pill: `settles ✓ or grace passes → refund`. */
function Pill({ cx, cy, w, children }: { cx: number; cy: number; w: number; children: ReactNode }) {
  return (
    <g>
      <rect x={cx - w / 2} y={cy - 17} width={w} height={34} rx={17} fill={T.surface} stroke={T.line} strokeWidth={1.3} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12.5, fill: T.ink }}>
        {children}
      </text>
    </g>
  );
}

function Note({ cx, y, text }: { cx: number; y: number; text: string }) {
  return (
    <text x={cx} y={y} textAnchor="middle" style={{ fontSize: 11, fill: T.faint }}>
      {text}
    </text>
  );
}

// ─── 1 · vision-block-lifecycle ─────────────────────────────────────────────
// created → join window → lock → tick resolves → settle (or grace → refund).

function VisionBlockLifecycle() {
  const ns = "vision-block-lifecycle";
  return (
    <Frame ns={ns} h={364} label="The life of a block: created, joined, locked, resolved, settled — or refunded after the grace window.">
      <Kicker x={24} y={30} n={1} label="Created" />
      <Kicker x={290} y={30} n={2} label="Join window" />
      <Kicker x={556} y={30} n={3} label="Lock" />
      <Box x={24} y={46} w={204} h={68} title="Block created" sub="oracle mints the round" sub2="start prices snapshotted" />
      <Arrow ns={ns} x1={228} y1={80} x2={290} y2={80} label="opens" />
      <Box x={290} y={46} w={224} h={68} kind="actor" title="You join & predict" sub="deposit + sealed picks" sub2="change freely until lock" />
      <Arrow ns={ns} x1={514} y1={80} x2={556} y2={80} label="locks" />
      <Box x={556} y={46} w={180} h={68} title="Locked" sub="lockOffset before tick end" sub2="no joins, no changes" />

      <Wrap ns={ns} fromX={646} fromY={114} midY={150} toX={136} toY={188} label="tick ends" />

      <Kicker x={24} y={172} n={4} label="Resolve & settle" />
      <Box x={24} y={188} w={224} h={68} title="Tick resolves" sub="start vs end price" sub2="market by market" />
      <Arrow ns={ns} x1={248} y1={222} x2={328} y2={222} label="settles" />
      <Box x={328} y={188} w={224} h={68} kind="dark" title="Settled" sub="BLS-signed settleBatch" sub2="payouts straight to wallets" />

      <Arrow ns={ns} x1={136} y1={256} x2={136} y2={283} dashed />
      <Pill cx={380} cy={300} w={640}>
        settles ✓ — or grace passes → claimRefund returns your full deposit
      </Pill>
      <Note cx={380} y={348} text="every tick the oracle settles the old block and mints a new one — you join the next round fresh" />
    </Frame>
  );
}

// ─── 2 · vision-sealed-commitment ───────────────────────────────────────────
// hash on-chain + bitmap to oracle → sealed until lock → revealed at resolution.

function VisionSealedCommitment() {
  const ns = "vision-sealed-commitment";
  return (
    <Frame ns={ns} h={320} label="Sealed commitment: the hash goes on-chain, the bitmap goes to the oracle, and the picks are revealed only at resolution.">
      <Kicker x={24} y={30} n={1} label="Commit" />
      <Kicker x={280} y={30} n={2} label="Sealed" />
      <Kicker x={540} y={30} n={3} label="Revealed" />

      <Box x={24} y={98} w={186} h={68} kind="actor" title="Your picks" sub="UP/DOWN per market" sub2="packed into a bitmap" />
      <Box x={280} y={46} w={200} h={64} title="Vision contract" sub="keccak256 hash on-chain" sub2="public fingerprint" />
      <Box x={280} y={178} w={200} h={64} title="Oracle" sub="holds the bitmap" sub2="pending until lock" />

      <Arrow ns={ns} x1={210} y1={118} x2={280} y2={88} label="hash on-chain" />
      <Arrow ns={ns} x1={210} y1={146} x2={280} y2={200} label="bitmap to oracle" />

      <Box x={540} y={110} w={196} h={72} kind="dark" title="Revealed at resolution" sub="verified against the hash" sub2="scored, then public" />
      <Arrow ns={ns} x1={480} y1={86} x2={540} y2={130} label="proves" />
      <Arrow ns={ns} x1={480} y1={202} x2={540} y2={160} label="opens & checks" />

      <Pill cx={380} cy={290} w={660}>
        resubmit before lock → overwrites pending · hash mismatch → bitmap rejected
      </Pill>
    </Frame>
  );
}

// ─── 3 · vision-parimutuel ──────────────────────────────────────────────────
// per-market pool: losers' matched stakes → winners; zero-sum; fee on profit only.

function VisionParimutuel() {
  const ns = "vision-parimutuel";
  return (
    <Frame ns={ns} h={312} label="Parimutuel scoring in one market: both sides stake, the smaller side's total is matched, winners take twice their matched stake.">
      <Kicker x={24} y={30} n={1} label="One market" />
      <Kicker x={300} y={30} n={2} label="Match" />
      <Kicker x={566} y={30} n={3} label="Payout" />

      <Box x={24} y={46} w={210} h={64} kind="actor" title="UP side — you" sub="your per-market stake" sub2="deposit ÷ market count" />
      <Box x={24} y={140} w={210} h={64} title="DOWN side" sub="the other players' stakes" />

      <Box x={300} y={88} w={200} h={72} title="Matched pool" sub="the smaller side's total" sub2="only this is at risk" />
      <Arrow ns={ns} x1={234} y1={82} x2={300} y2={110} label="stakes" />
      <Arrow ns={ns} x1={234} y1={168} x2={300} y2={140} label="stakes" />

      <Box x={566} y={92} w={170} h={64} kind="dark" title="Winners paid" sub="2× their matched stake" />
      <Arrow ns={ns} x1={500} y1={124} x2={566} y2={124} label="losers pay" />

      <Arrow ns={ns} x1={400} y1={160} x2={400} y2={213} dashed />
      <Pill cx={380} cy={230} w={470}>
        unmatched stake → refunded untouched, win or lose
      </Pill>
      <Pill cx={380} cy={282} w={690}>
        zero-sum: payouts = deposits · the 0.05% fee comes off profit only — never losses or refunds
      </Pill>
    </Frame>
  );
}

// ─── 4 · bot-loop ───────────────────────────────────────────────────────────
// discover → fetch config → predict → encode → join → submit → sleep, repeat.

function BotLoop() {
  const ns = "bot-loop";
  return (
    <Frame ns={ns} h={330} label="The bot loop: discover blocks, fetch the market list, predict, encode the bitmap, join on-chain, submit to the oracle, sleep, repeat.">
      {/* the loop-back: sleep, then rediscover — a block lives one round */}
      <path
        d={`M736,220 L752,220 L752,18 L126,18 L126,48`}
        fill="none"
        stroke={T.sub}
        strokeWidth={1.5}
        strokeDasharray="5 4"
        markerEnd={`url(#gmf-${ns}-mute)`}
      />
      <EdgeLabel x={420} y={18} text="sleep poll_interval — repeat next tick" />

      <Kicker x={24} y={48} n={1} label="Discover" />
      <Kicker x={532} y={48} n={2} label="Predict" />
      <Box x={24} y={56} w={204} h={64} kind="actor" title="Bot discovers blocks" sub="GET /vision/batches" sub2="chain scan fallback" />
      <Arrow ns={ns} x1={228} y1={88} x2={278} y2={88} label="resolve" />
      <Box x={278} y={56} w={204} h={64} title="Fetch market list" sub="configHash → markets" />
      <Arrow ns={ns} x1={482} y1={88} x2={532} y2={88} label="decide" />
      <Box x={532} y={56} w={204} h={64} title="Predict" sub="strategy picks UP/DOWN" sub2="one call per market" />

      <Wrap ns={ns} fromX={634} fromY={120} midY={152} toX={126} toY={188} label="pack the picks" />

      <Kicker x={24} y={180} n={3} label="Commit" />
      <Kicker x={532} y={180} n={4} label="Sealed & in" />
      <Box x={24} y={188} w={204} h={64} title="Encode bitmap" sub="one bit per market" sub2="keccak256 → hash" />
      <Arrow ns={ns} x1={228} y1={220} x2={278} y2={220} label="commit" />
      <Box x={278} y={188} w={204} h={64} title="Join on-chain" sub="joinBatchDirect" sub2="deposit + hash" />
      <Arrow ns={ns} x1={482} y1={220} x2={532} y2={220} label="send" />
      <Box x={532} y={188} w={204} h={64} kind="dark" title="Bitmap submitted" sub="POST /vision/bitmap" sub2="must match the hash" />

      <Pill cx={380} cy={300} w={640}>
        a block lives one round — each pass joins a new block id with a fresh deposit
      </Pill>
    </Frame>
  );
}

// ─── 5 · index-order-lifecycle ──────────────────────────────────────────────
// submit (escrow) → PENDING → BATCHED → FILLED → settled; claimExpiredOrder net.

function IndexOrderLifecycle() {
  const ns = "index-order-lifecycle";
  return (
    <Frame ns={ns} h={330} label="The order lifecycle: you submit and funds escrow, oracles batch and fill under BLS signatures, settlement is immediate — and refunds are guaranteed.">
      <Kicker x={24} y={30} n={1} label="Submit" />
      <Kicker x={536} y={30} n={2} label="Batch" />
      <Box x={24} y={46} w={216} h={68} kind="actor" title="You submit" sub="USDC or shares escrow now" sub2="limit price + deadline" />
      <Arrow ns={ns} x1={240} y1={80} x2={288} y2={80} label="stores" />
      <Box x={288} y={46} w={200} h={68} title="PENDING" sub="waiting for the oracles" sub2="cancel any time, full refund" />
      <Arrow ns={ns} x1={488} y1={80} x2={536} y2={80} label="batches" />
      <Box x={536} y={46} w={200} h={68} title="BATCHED" sub="BLS-confirmed cycle" sub2="execution underway" />

      <Wrap ns={ns} fromX={636} fromY={114} midY={150} toX={136} toY={186} label="oracles net & route the orders" />

      <Kicker x={24} y={170} n={3} label="Fill & settle" />
      <Box x={24} y={186} w={224} h={68} title="FILLED" sub="limit enforced on-chain" sub2="unfilled remainder refunds" />
      <Arrow ns={ns} x1={248} y1={220} x2={328} y2={220} label="settles" />
      <Box x={328} y={186} w={224} h={68} kind="dark" title="Settled" sub="shares minted or USDC sent" sub2="straight to your wallet" />

      <Pill cx={380} cy={298} w={680}>
        fills ✓ — or expires → refund · after deadline + 24 h anyone can call claimExpiredOrder
      </Pill>
    </Frame>
  );
}

// ─── 6 · index-two-chain ────────────────────────────────────────────────────
// L3 (18-dec USDC) ↔ bridge ↔ settlement chain (6-dec USDC).

function IndexTwoChain() {
  const ns = "index-two-chain";
  return (
    <Frame ns={ns} h={226} label="Two chains, one balance: the L3 where you trade (18-decimal USDC), the oracle-run bridge, and the settlement chain (6-decimal USDC).">
      <Kicker x={24} y={38} n={1} label="The app chain" />
      <Kicker x={300} y={38} n={2} label="The bridge" />
      <Kicker x={516} y={38} n={3} label="The doorway" />

      <Box x={24} y={56} w={224} h={88} kind="actor" title="L3 — you trade here" sub="Vision · DTFs · lending" sub2="USDC = 18 decimals" />
      <Box x={300} y={56} w={164} h={88} title="Bridge" sub="oracle-run, BLS-signed" sub2="lock → release" />
      <Box x={516} y={56} w={220} h={88} kind="dark" title="Settlement chain" sub="USDC enters & exits here" sub2="USDC = 6 decimals" />

      {/* inbound lane: deposit on settlement, released on the L3 */}
      <Arrow ns={ns} x1={516} y1={82} x2={464} y2={82} label="deposit" labelDy={-13} />
      <Arrow ns={ns} x1={300} y1={82} x2={248} y2={82} label="mint" labelDy={-13} />
      {/* outbound lane: exit the L3, released on settlement */}
      <Arrow ns={ns} x1={248} y1={120} x2={300} y2={120} label="exit" labelDy={14} />
      <Arrow ns={ns} x1={464} y1={120} x2={516} y2={120} label="release" labelDy={14} />

      <Pill cx={380} cy={196} w={640}>
        same dollar, two scales — the bridge converts 18 ↔ 6 decimals (×1e12)
      </Pill>
    </Frame>
  );
}

// ─── 7 · gm-system ──────────────────────────────────────────────────────────
// data sources → data-node → oracle (BLS) → contracts (L3) → app.

function GmSystem() {
  const ns = "gm-system";
  return (
    <Frame ns={ns} h={330} label="The whole machine: external data sources feed the data-node, oracle nodes reach BLS consensus and drive the L3 contracts, and the app is your window onto all of it.">
      <Kicker x={24} y={30} n={1} label="Real world" />
      <Kicker x={532} y={30} n={2} label="Consensus" />
      <Box x={24} y={46} w={204} h={68} title="Data sources" sub="47 sources, 16 categories" sub2="prices, sports, weather…" />
      <Arrow ns={ns} x1={228} y1={80} x2={278} y2={80} label="feeds" />
      <Box x={278} y={46} w={204} h={68} title="Data-node" sub="polls every source" sub2="serves prices & snapshots" />
      <Arrow ns={ns} x1={482} y1={80} x2={532} y2={80} label="supplies" />
      <Box x={532} y={46} w={204} h={68} title="Oracle network" sub="independent nodes" sub2="BLS quorum co-signs" />

      <Wrap ns={ns} fromX={634} fromY={114} midY={150} toX={139} toY={186} label="creates · settles · fills · pushes NAV" />

      <Kicker x={24} y={170} n={3} label="On-chain" />
      <Kicker x={330} y={170} n={4} label="You" />
      <Box x={24} y={186} w={230} h={68} kind="dark" title="L3 contracts" sub="Vision · Index" sub2="hold funds, enforce rules" />
      <Box x={330} y={186} w={216} h={68} kind="actor" title="The app — you" sub="generalmarket.io" sub2="wallet + public API" />
      <Arrow ns={ns} x1={254} y1={206} x2={330} y2={206} label="serves" labelDy={-12} />
      <Arrow ns={ns} x1={330} y1={234} x2={254} y2={234} label="transacts" labelDy={14} dashed />

      <Pill cx={380} cy={298} w={680}>
        everything the app does, you can do directly — against the contracts and the public API
      </Pill>
    </Frame>
  );
}

// ─── registry ───────────────────────────────────────────────────────────────

const DIAGRAMS: Record<string, () => ReactNode> = {
  "vision-block-lifecycle": VisionBlockLifecycle,
  "vision-sealed-commitment": VisionSealedCommitment,
  "vision-parimutuel": VisionParimutuel,
  "bot-loop": BotLoop,
  "index-order-lifecycle": IndexOrderLifecycle,
  "index-two-chain": IndexTwoChain,
  "gm-system": GmSystem,
};

export function GmFlow({ id }: { id: string }) {
  const Diagram = DIAGRAMS[id];
  if (!Diagram) {
    // Unknown id — keep the labelled placeholder so the gap is visible, not
    // silent. The link checker also validates ids against the registry.
    return (
      <span className="gm-flow-stub" data-diagram-id={id}>
        <span className="gm-flow-stub__label">Diagram</span>
        <span className="gm-flow-stub__caption">unknown diagram id: {id}</span>
      </span>
    );
  }
  return <Diagram />;
}
