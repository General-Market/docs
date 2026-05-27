import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { FPS, W, H, NAVY, SANS, SANS_TEXT } from "./theme";
import { BrandMark } from "../../components/BrandMark";

// Self-contained on the article-2 dark system — no glass-theme imports (those
// pull in local brand fonts that abort an empty-publicDir render).

// ── a small face — the only expression any actor wears ──────────────────────
const FACE = { happy: "#1FB877", unhappy: "#F2566B", neutral: "#E8A13A" } as const;
type FaceKind = keyof typeof FACE;
const Face: React.FC<{ state: FaceKind; size?: number }> = ({ state, size = 56 }) => {
  const color = FACE[state];
  const eyeY = size * 0.4;
  const eyeDx = size * 0.2;
  const r = size * 0.07;
  const my = size * 0.62;
  const mw = size * 0.34;
  const mouth =
    state === "happy"
      ? `M ${size / 2 - mw / 2} ${my} Q ${size / 2} ${my + mw * 0.6} ${size / 2 + mw / 2} ${my}`
      : state === "unhappy"
        ? `M ${size / 2 - mw / 2} ${my + mw * 0.4} Q ${size / 2} ${my - mw * 0.3} ${size / 2 + mw / 2} ${my + mw * 0.4}`
        : `M ${size / 2 - mw / 2} ${my} L ${size / 2 + mw / 2} ${my}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={color} />
      <circle cx={size / 2 - eyeDx} cy={eyeY} r={r} fill="#fff" />
      <circle cx={size / 2 + eyeDx} cy={eyeY} r={r} fill="#fff" />
      <path d={mouth} stroke="#fff" strokeWidth={size * 0.06} fill="none" strokeLinecap="round" />
      {state === "neutral" && (
        <text x={size / 2} y={size * 0.92} textAnchor="middle" fontSize={size * 0.28} fontWeight={800} fill="#fff" fontFamily={SANS}>
          ?
        </text>
      )}
    </svg>
  );
};

// ── a comet of dots travelling A→B; active (0..1) gates it ──────────────────
const FlowStream: React.FC<{ from: { x: number; y: number }; to: { x: number; y: number }; active: number; color: string; count?: number; speed?: number; dotR?: number }> = ({
  from,
  to,
  active,
  color,
  count = 7,
  speed = 0.8,
  dotR = 9,
}) => {
  const frame = useCurrentFrame();
  const a = active < 0 ? 0 : active > 1 ? 1 : active;
  if (a <= 0) return null;
  const t = (frame / FPS) * speed;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={2} opacity={a * 0.18} strokeDasharray="2 9" strokeLinecap="round" />
      {Array.from({ length: count }).map((_, i) => {
        const ph = (t + i / count) % 1;
        const tri = 1 - Math.abs(ph * 2 - 1);
        return <circle key={i} cx={from.x + (to.x - from.x) * ph} cy={from.y + (to.y - from.y) * ph} r={dotR} fill={color} opacity={a * tri} />;
      })}
    </svg>
  );
};

// Wall 3 · The house wins — until it can't.
// Free choice: a trader bets only the two markets they know — Bitcoin and a
// $10k-cap coin. On a normal book the maker picks them off: trader wins 1 in 10,
// the maker 9 in 10. Then General forces BOTH to trade every market, pooled and
// symmetric — the maker can't cherry-pick, the odds become 50/50, and the
// trader finally nets a win. The hero numbers are the two win rates, in the same
// dark style as the server wall.

const DURATION = 216; // ~7.2s @30fps

const B = {
  setup: 24, // markets + dials arrive
  fillEnd: 96, // phase 1: dials reach 10 / 90, money piles on the maker
  generalIn: 120, // General sweeps, the market set explodes
  equalizeEnd: 186, // dials swing to 50 / 50, money flows back
  // 186–216: hold on the turn
};

const ORANGE = "#F7931A"; // bitcoin
const LOSE = "#F2566B";
const WIN = "#1FB877";
const NEUT = "#E8A13A";
const BLUE = "#0A84FF";

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const ci = (f: number, a: number, b: number, from: number, to: number, e?: (t: number) => number): number =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
const easeOut = (t: number): number => Easing.out(Easing.cubic)(clamp01(t));
const easeInOut = (t: number): number => Easing.inOut(Easing.cubic)(clamp01(t));

// ── win-rate dial — the hero number, a ring that fills to pct ─────────────────
const WinDial: React.FC<{
  cx: number;
  cy: number;
  pct: number;
  label: string;
  color: string;
  faceState: "happy" | "unhappy" | "neutral";
  showFace: boolean;
}> = ({ cx, cy, pct, label, color, faceState, showFace }) => {
  const size = 300;
  const r = 124;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - clamp01(pct / 100));
  return (
    <div style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size }}>
      {showFace && (
        <div style={{ position: "absolute", left: "50%", top: -52, transform: "translateX(-50%)" }}>
          <Face state={faceState} size={56} />
        </div>
      )}
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={20} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={20}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 16px ${color}aa)` }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: SANS, fontSize: 92, fontWeight: 800, letterSpacing: "-2px", color: "#fff", fontVariantNumeric: "tabular-nums" }}>
          {Math.round(pct)}%
        </span>
        <span style={{ fontFamily: SANS_TEXT, fontSize: 22, fontWeight: 700, letterSpacing: "1px", color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
          WIN RATE
        </span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: size + 8, textAlign: "center", fontFamily: SANS, fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
        {label}
      </div>
    </div>
  );
};

// ── a market token ────────────────────────────────────────────────────────────
const MarketToken: React.FC<{ cx: number; cy: number; size: number; glyph: string; name: string; sub?: string; color: string; opacity?: number }> = ({
  cx,
  cy,
  size,
  glyph,
  name,
  sub,
  color,
  opacity = 1,
}) => (
  <div style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, display: "flex", flexDirection: "column", alignItems: "center", opacity }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(150deg, ${color}, ${color}CC)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SANS,
        fontSize: size * 0.5,
        fontWeight: 800,
        color: "#fff",
        boxShadow: `0 8px 26px ${color}66, inset 0 1px 0 rgba(255,255,255,0.35)`,
      }}
    >
      {glyph}
    </div>
    {size > 60 && (
      <>
        <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 8 }}>{name}</div>
        {sub && <div style={{ fontFamily: SANS_TEXT, fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{sub}</div>}
      </>
    )}
  </div>
);

// the long-tail markets that General forces into play
const TAIL = [
  { glyph: "Ξ", color: "#627EEA" },
  { glyph: "◎", color: "#14F195" },
  { glyph: "K", color: "#5B6Cff" },
  { glyph: "P", color: "#FF6FB5" },
  { glyph: "S", color: "#17B0A6" },
  { glyph: "D", color: "#C2A633" },
  { glyph: "A", color: "#0033AD" },
  { glyph: "X", color: "#23292F" },
  { glyph: "L", color: "#345D9D" },
  { glyph: "M", color: "#F195FF" },
  { glyph: "T", color: "#26A17B" },
  { glyph: "B", color: "#F3BA2F" },
];

export const AsphyxiationByWinners: React.FC = () => {
  const frame = useCurrentFrame();

  // win rates — fill to 10/90 in phase 1, swing to 50/50 under General
  const traderWin = frame < B.fillEnd ? ci(frame, B.setup, B.fillEnd, 0, 10, easeOut) : ci(frame, B.generalIn, B.equalizeEnd, 10, 50, easeInOut);
  const mmWin = frame < B.fillEnd ? ci(frame, B.setup, B.fillEnd, 0, 90, easeOut) : ci(frame, B.generalIn, B.equalizeEnd, 90, 50, easeInOut);

  // money flows: phase 1 trader → maker (losses); phase 2 maker → trader (net win)
  const loseFlow = ci(frame, B.setup + 8, B.fillEnd, 0, 1) * ci(frame, B.generalIn - 12, B.generalIn, 1, 0);
  const winFlow = ci(frame, B.generalIn + 20, B.equalizeEnd, 0, 1);

  // the General sweep + the market set exploding from 2 → many
  const general = ci(frame, B.generalIn, B.generalIn + 30, 0, 1, easeOut);
  const tailIn = ci(frame, B.generalIn + 6, B.equalizeEnd - 10, 0, 1, easeOut);

  // faces — trader unhappy while fleeced, happy after; maker happy then neutral
  const showFace = frame > B.setup + 6;
  const phase2 = frame >= B.generalIn;
  const traderFace = phase2 && frame > B.generalIn + 30 ? "happy" : "unhappy";
  const mmFace = phase2 && frame > B.generalIn + 30 ? "neutral" : "happy";

  const TRADER = { x: 330, y: 470 };
  const MAKER = { x: W - 330, y: 470 };
  const BTC = { x: W / 2, y: 360 };
  const COIN = { x: W / 2, y: 620 };

  // title blur-swap
  const titleP = phase2 ? clamp01((frame - B.generalIn) / 10) : clamp01((frame - 4) / 10);
  const title = phase2 ? "GENERAL" : "NORMAL MARKET";
  const titleCol = phase2 ? BLUE : "rgba(255,255,255,0.85)";

  // caption
  const cap =
    frame < B.generalIn
      ? frame > B.fillEnd - 30
        ? "you win 1 in 10 — the maker takes the rest"
        : ""
      : frame > B.generalIn + 36
        ? "forced to trade every market, fair — you net a win"
        : "everyone trades every market — pooled, symmetric";

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, fontFamily: SANS, overflow: "hidden" }}>
      <BrandMark surface="dark" />

      {/* phase 2 floor glow */}
      <AbsoluteFill style={{ background: "radial-gradient(80% 70% at 50% 48%, rgba(10,132,255,0.16), transparent 60%)", opacity: general }} />

      {/* title */}
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: "2px",
            color: titleCol,
            opacity: easeOut(titleP),
            filter: titleP < 1 ? `blur(${(1 - titleP) * 9}px)` : undefined,
            textShadow: phase2 ? `0 0 36px ${BLUE}` : "none",
          }}
        >
          {title}
        </div>
      </div>

      {/* the markets being traded */}
      <MarketToken cx={BTC.x} cy={BTC.y} size={108} glyph="₿" name="Bitcoin" sub="the one everyone trades" color={ORANGE} />
      <MarketToken cx={COIN.x} cy={COIN.y} size={84} glyph="◆" name="MOON" sub="$10K market cap" color="#8A5BFF" />

      {/* the long tail General forces into play */}
      {tailIn > 0.01 &&
        TAIL.map((m, i) => {
          const ang = (i / TAIL.length) * Math.PI * 2;
          const rad = 300 + (i % 3) * 36;
          const cx = W / 2 + Math.cos(ang) * rad * 1.15;
          const cy = 490 + Math.sin(ang) * rad * 0.62;
          const pop = clamp01(tailIn * TAIL.length - i);
          return <MarketToken key={i} cx={cx} cy={cy} size={56 * pop} glyph={m.glyph} name="" color={m.color} opacity={pop} />;
        })}

      {/* money flows */}
      <FlowStream from={TRADER} to={MAKER} active={loseFlow} color={LOSE} count={7} speed={0.8} dotR={9} />
      <FlowStream from={MAKER} to={TRADER} active={winFlow} color={WIN} count={7} speed={0.8} dotR={9} />

      {/* the two win-rate dials — the hero numbers */}
      <WinDial cx={TRADER.x} cy={TRADER.y} pct={traderWin} label="YOU" color={frame >= B.generalIn + 30 ? WIN : LOSE} faceState={traderFace} showFace={showFace} />
      <WinDial cx={MAKER.x} cy={MAKER.y} pct={mmWin} label="MARKET MAKER" color={frame >= B.generalIn + 30 ? NEUT : WIN} faceState={mmFace} showFace={showFace} />

      {/* caption */}
      {cap && (
        <div style={{ position: "absolute", bottom: 56, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ fontFamily: SANS_TEXT, fontSize: 34, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.3px", textAlign: "center" }}>
            {cap}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const asphyxiationByWinnersMeta = {
  id: "AsphyxiationByWinners",
  component: AsphyxiationByWinners,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
