import React from "react";
import { interpolate } from "remotion";
import { C, EASE, font, monoFont, PILL_GRADIENT } from "./theme";
import { glassCard } from "./chrome";
import { BATCHES_PER_DAY, LINES_PER_BATCH, THROUGHPUT_SOURCES, THROUGHPUT_TOTAL } from "./data";

// The throughput climax, told as ONE diagram the camera flies across — Max's
// storyboard, reskinned into the reel's frosted-glass world. A lone trader sends
// one call; a cursor clicks BLOCKS TRADE; the batch fires into a real field of
// ten thousand trades; that batch settles a hundred times across a day; and the
// machine is one of ten markets. The shot is a single continuous track-and-pull-
// back. The counts are real — ten thousand cells truly fill, a hundred ticks
// truly run, ten named blocks truly stand. One surface, one move.

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
// easeOutBack — overshoots past the target then settles, the tactile "pop".
const backOut = (t: number, s = 1.9): number => {
  const u = clamp01(t) - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};
// quadratic bezier — a curved path the cursor rides in on.
const qbez = (t: number, a: number, b: number, c: number): number => {
  const m = 1 - t;
  return m * m * a + 2 * m * t * b + t * t * c;
};
export const commas = (n: number): string => Math.round(n).toLocaleString("en-US");

const heroText = (size: number): React.CSSProperties => ({
  fontFamily: font,
  fontSize: size,
  fontWeight: 800,
  letterSpacing: "-0.035em",
  lineHeight: 0.95,
  fontVariantNumeric: "tabular-nums",
  background: PILL_GRADIENT,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  filter: "drop-shadow(0 14px 36px rgba(94,120,255,0.4))",
});

// ── The person — a clean glyph in a glass disc (still used by the trader row) ──
export const PersonIcon: React.FC<{ size?: number; accent?: string }> = ({ size = 156, accent = C.blue }) => (
  <div
    style={{
      ...glassCard(999),
      width: size,
      height: size,
      border: `2px solid ${accent}`,
      boxShadow: `0 20px 48px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.85)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4.3" fill={accent} />
      <path d="M3.4 21.5 C3.4 15.9 7.5 13.2 12 13.2 C16.5 13.2 20.6 15.9 20.6 21.5 Z" fill={accent} />
    </svg>
  </div>
);

// ── The lone trader — a line-art stick figure, drawn in the reel's ink ────────
const StickFigure: React.FC<{ draw?: number; scale?: number }> = ({ draw = 1, scale = 1 }) => {
  const op = clamp01(draw);
  const dy = (1 - op) * 18;
  return (
    <svg width={150 * scale} height={250 * scale} viewBox="0 0 150 250" style={{ overflow: "visible", opacity: op, transform: `translateY(${dy.toFixed(1)}px)` }}>
      <g fill="none" stroke={C.text} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={75} cy={48} r={34} />
        <line x1={75} y1={82} x2={75} y2={168} />
        <line x1={75} y1={168} x2={36} y2={236} />
        <line x1={75} y1={168} x2={114} y2={236} />
      </g>
    </svg>
  );
};

// ── A frosted box on the board (block / settlement node) ──────────────────────
const FlowBox: React.FC<{
  cx: number;
  cy: number;
  w: number;
  h: number;
  accent: string;
  reveal?: number;
  faint?: boolean;
  label?: string;
  fontSize?: number;
  z?: number;
}> = ({ cx, cy, w, h, accent, reveal = 1, faint = false, label, fontSize = 30, z = 10 }) => {
  if (reveal <= 0.01) return null;
  const s = lerp(0.62, 1, backOut(reveal));
  const arrival = Math.sin(clamp01(reveal) * Math.PI);
  const glowColor = accent.startsWith("#") ? accent : C.blue;
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: `translate(-50%,-50%) scale(${s.toFixed(3)})`,
        opacity: clamp01(reveal / 0.4),
        zIndex: z,
      }}
    >
      <div
        style={{
          width: w,
          height: h,
          ...glassCard(24),
          border: `${faint ? 2 : 2.5}px solid ${accent}`,
          boxShadow: faint
            ? `0 8px 22px rgba(70,74,140,0.12), 0 0 ${(arrival * 26).toFixed(0)}px ${glowColor}44, inset 0 1px 0 rgba(255,255,255,0.7)`
            : `0 16px 38px rgba(70,74,140,0.18), 0 0 ${(arrival * 44).toFixed(0)}px ${glowColor}66, inset 0 1px 0 rgba(255,255,255,0.85)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 18px",
          boxSizing: "border-box",
        }}
      >
        {label ? (
          <span style={{ fontFamily: font, fontSize, fontWeight: 800, letterSpacing: "-0.02em", color: C.text, whiteSpace: "nowrap" }}>{label}</span>
        ) : null}
      </div>
    </div>
  );
};

// ── A world-space text annotation (× labels, timestamps, names) ───────────────
const WorldLabel: React.FC<{
  cx: number;
  cy: number;
  text: string;
  size: number;
  reveal?: number;
  color?: string;
  mono?: boolean;
  weight?: number;
}> = ({ cx, cy, text, size, reveal = 1, color = C.text, mono = false, weight = 800 }) => {
  if (reveal <= 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: "translate(-50%,-50%)",
        opacity: clamp01(reveal),
        fontFamily: mono ? monoFont : font,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: mono ? "0.02em" : "-0.02em",
        color,
        whiteSpace: "nowrap",
        zIndex: 20,
      }}
    >
      {text}
    </div>
  );
};

// ── SVG connector — a line that draws from start to end, optional arrowhead ────
const Conn: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  reveal?: number;
  arrow?: boolean;
  width?: number;
  color?: string;
}> = ({ x1, y1, x2, y2, reveal = 1, arrow = false, width = 4, color = "rgba(0,113,227,0.55)" }) => {
  const r = clamp01(reveal);
  if (r <= 0.001) return null;
  const ex = lerp(x1, x2, r);
  const ey = lerp(y1, y2, r);
  const ang = Math.atan2(ey - y1, ex - x1);
  const hs = Math.max(13, width * 3.4);
  const ah = arrow && r > 0.6
    ? `${ex},${ey} ${(ex - hs * Math.cos(ang - 0.42)).toFixed(1)},${(ey - hs * Math.sin(ang - 0.42)).toFixed(1)} ${(ex - hs * Math.cos(ang + 0.42)).toFixed(1)},${(ey - hs * Math.sin(ang + 0.42)).toFixed(1)}`
    : null;
  return (
    <g>
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={width} strokeLinecap="round" />
      {ah ? <polygon points={ah} fill={color} opacity={clamp01((r - 0.6) / 0.2)} /> : null}
    </g>
  );
};

// ── Click burst — concentric rings, a white core, eight radial spikes ─────────
const ClickBurst: React.FC<{ x: number; y: number; t: number; color?: string }> = ({ x, y, t, color = C.blue }) => {
  if (t <= 0.001 || t >= 1) return null;
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const ringScale = lerp(0.3, 3.6, t);
  const ringOp = interpolate(t, [0, 0.15, 1], [0, 0.7, 0], cl);
  const ring2Scale = lerp(0.2, 2.4, t);
  const ring2Op = interpolate(t, [0, 0.25, 1], [0, 0.5, 0], cl);
  const coreOp = interpolate(t, [0, 0.08, 0.42], [0, 1, 0], cl);
  const coreScale = interpolate(t, [0, 0.42], [0.4, 1.8], cl);
  const spikeT = interpolate(t, [0, 0.5], [0, 1], cl);
  const spikeOp = interpolate(t, [0, 0.1, 0.6], [0, 1, 0], cl);
  const len = lerp(0, 74, spikeT);
  const off = lerp(12, 32, spikeT);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, zIndex: 40, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: -42, top: -42, width: 84, height: 84, borderRadius: "50%", border: `3px solid ${color}`, transform: `scale(${ringScale})`, opacity: ringOp }} />
      <div style={{ position: "absolute", left: -32, top: -32, width: 64, height: 64, borderRadius: "50%", border: `3px solid ${C.violet}`, transform: `scale(${ring2Scale})`, opacity: ring2Op }} />
      <div style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: "50%", background: "#fff", transform: `scale(${coreScale})`, opacity: coreOp, boxShadow: `0 0 30px ${color}` }} />
      <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: spikeOp }}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI * 2) / 8;
          return <line key={i} x1={Math.cos(a) * off} y1={Math.sin(a) * off} x2={Math.cos(a) * (off + len)} y2={Math.sin(a) * (off + len)} stroke={color} strokeWidth={4} strokeLinecap="round" />;
        })}
      </svg>
    </div>
  );
};

// ── The cursor — a mouse pointer that rides a bezier in and clicks ────────────
const WorldCursor: React.FC<{ x: number; y: number; squish: number; opacity: number; size?: number }> = ({ x, y, squish, opacity, size = 56 }) => {
  if (opacity <= 0.01) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: size, height: size, opacity, transform: `scale(${squish.toFixed(3)})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 6px 14px rgba(20,30,80,0.4))", zIndex: 42, pointerEvents: "none" }}>
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path d="M4.5 3 L4.5 19 L8.5 15.5 L11 21 L13.4 20 L10.9 14.6 L16.5 14.6 Z" fill="#ffffff" stroke={C.text} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ── The real ten-thousand-trade field — one vector grid, revealed by a clip ───
// Ten thousand cells in a 100×100 grid, built once as a single <path> so the
// renderer never reconciles ten thousand nodes. A clip rectangle sweeps down it
// row by row as the counter climbs — the batch genuinely filling to 10,000.
const FCOLS = 100;
const FROWS = 100;
const FCELL = 17;
const FGAP = 5;
const FPITCH = FCELL + FGAP; // 22
export const FIELD_W = FCOLS * FPITCH; // 2200
export const FIELD_H = FROWS * FPITCH; // 2200
const FIELD_PATH = (() => {
  let d = "";
  for (let r = 0; r < FROWS; r++) {
    const y = r * FPITCH;
    for (let c = 0; c < FCOLS; c++) {
      const x = c * FPITCH;
      d += `M${x} ${y}h${FCELL}v${FCELL}h${-FCELL}z`;
    }
  }
  return d;
})();

const TradeField: React.FC<{ x0: number; y0: number; reveal: number }> = ({ x0, y0, reveal }) => {
  const r = clamp01(reveal);
  const h = r * FIELD_H;
  return (
    <g transform={`translate(${x0} ${y0})`}>
      <defs>
        <clipPath id="tf-reveal">
          <rect x={-3} y={-3} width={FIELD_W + 6} height={h + 6} />
        </clipPath>
        <linearGradient id="tf-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.blue} />
          <stop offset="100%" stopColor={C.violet} />
        </linearGradient>
      </defs>
      <path d={FIELD_PATH} fill="url(#tf-fill)" fillOpacity={0.82} clipPath="url(#tf-reveal)" />
    </g>
  );
};

// ── A real day on the clock — a hundred settlement ticks running left to right ─
const TL_N = BATCHES_PER_DAY; // 100
const TL_P = 30;
export const TL_W = TL_N * TL_P; // 3000
const DayTicks: React.FC<{ x0: number; y: number; reveal: number }> = ({ x0, y, reveal }) => {
  const shown = clamp01(reveal) * TL_N;
  return (
    <g>
      <line x1={x0 - 14} y1={y} x2={x0 + TL_W + 6} y2={y} stroke="rgba(110,91,255,0.4)" strokeWidth={3} strokeLinecap="round" />
      {Array.from({ length: TL_N }, (_, i) => {
        const a = clamp01(shown - i);
        if (a <= 0.01) return null;
        const hgt = 26 + (i % 5 === 0 ? 34 : 14);
        const cx = x0 + i * TL_P + TL_P / 2;
        return <rect key={i} x={cx - 5} y={y - hgt * a} width={10} height={hgt * a} rx={3} fill={i % 5 === 0 ? C.blue : C.violet} opacity={0.78} />;
      })}
    </g>
  );
};

// ── One market as a huge block, the source name on it (the pull-back payoff) ───
const HugeBlock: React.FC<{ accent: string; name: string; reveal: number }> = ({ accent, name, reveal }) => {
  const s = lerp(0.78, 1, backOut(reveal));
  const arrival = Math.sin(clamp01(reveal) * Math.PI);
  return (
    <div style={{ opacity: clamp01(reveal / 0.4), transform: `scale(${s.toFixed(3)})`, transformOrigin: "top center" }}>
      <div
        style={{
          width: 156,
          height: 244,
          ...glassCard(20),
          border: `2.5px solid ${accent}`,
          boxShadow: `0 14px 34px rgba(70,74,140,0.18), 0 0 ${(18 + arrival * 30).toFixed(0)}px ${accent}5A, inset 0 1px 0 rgba(255,255,255,0.9)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 12px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontFamily: monoFont, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: C.faint }}>BLOCKS TRADE</div>
        <div
          style={{
            marginTop: 10,
            width: "100%",
            flex: 1,
            borderRadius: 12,
            background: `${accent}14`,
            backgroundImage: `radial-gradient(circle, ${accent}55 1px, transparent 1.4px)`,
            backgroundSize: "9px 9px",
            border: `1px solid ${accent}40`,
          }}
        />
        <div style={{ marginTop: 12, fontFamily: font, fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em", color: C.text, textAlign: "center", lineHeight: 1.08 }}>{name}</div>
      </div>
    </div>
  );
};

// ── The climax ────────────────────────────────────────────────────────────────
export const ThroughputClimax: React.FC<{ grow: number }> = ({ grow }) => {
  const BOX_W = 1920;
  const BOX_H = 1080;
  const SCX = BOX_W / 2;
  const SCY = BOX_H * 0.55;

  // ── the hero machine, in world pixels (one market, flown left → right) ──────
  const MY = 1240; // centre-line (high enough that the 2200px field stays positive)
  const TRADER = { cx: 150, cy: MY };
  const BUS_X = 440;
  const BLOCK = { cx: 780, w: 372, h: 156 };
  const blockL = BLOCK.cx - BLOCK.w / 2;
  const blockR = BLOCK.cx + BLOCK.w / 2;

  const FIELD_X0 = 1180;
  const FIELD_Y0 = MY - FIELD_H / 2;
  const FIELD_CX = FIELD_X0 + FIELD_W / 2;
  const fieldR = FIELD_X0 + FIELD_W;

  const TL_X0 = fieldR + 520;
  const tlEnd = TL_X0 + TL_W;
  const X100_X = tlEnd + 150;

  const WORLD_W = X100_X + 220;
  const WORLD_H = FIELD_Y0 + FIELD_H + 260;

  // ── the camera — a continuous track through the machine, then a pull-back ───
  const KF = [0, 0.1, 0.22, 0.42, 0.58, 0.72, 1.0];
  const ease = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: EASE.inOut };
  const camX = interpolate(grow, KF, [300, BLOCK.cx, FIELD_X0 + 360, FIELD_CX, TL_X0 + TL_W * 0.5, (BLOCK.cx + tlEnd) / 2, (BLOCK.cx + tlEnd) / 2], ease);
  const camY = interpolate(grow, KF, [MY, MY, FIELD_Y0 + 420, MY, MY, MY, MY], ease);
  const z = Math.exp(interpolate(grow, KF, [Math.log(1.45), Math.log(1.0), Math.log(0.66), Math.log(0.46), Math.log(0.5), Math.log(0.22), Math.log(0.16)], ease));
  const worldTransform = `translate(${SCX}px, ${SCY}px) scale(${z.toFixed(5)}) translate(${(-camX).toFixed(2)}px, ${(-camY).toFixed(2)}px)`;

  // ── the cursor rides in on a bezier and clicks the block to fire the batch ──
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const clickX = BLOCK.cx - 26;
  const clickY = MY + 10;
  const curMove = interpolate(grow, [0.03, 0.11], [0, 1], { ...cl, easing: EASE.out });
  const curX = qbez(curMove, BLOCK.cx - 150, BLOCK.cx - 420, clickX);
  const curY = qbez(curMove, MY + 470, MY + 150, clickY);
  const curSquish = interpolate(grow, [0.1, 0.118, 0.15], [1, 0.78, 1], cl);
  const curOp = interpolate(grow, [0.01, 0.04, 0.18, 0.23], [0, 1, 1, 0], cl);
  const burstT = interpolate(grow, [0.115, 0.25], [0, 1], cl);

  // ── reveal schedule — click, then a real field fills, then a real day runs ──
  const busR = clamp01((grow - 0.03) / 0.07);
  const blockR0 = clamp01((grow - 0.105) / 0.09); // pops on the click
  const fieldReveal = clamp01((grow - 0.15) / 0.26); // 10,000 cells genuinely fill
  const tlReveal = clamp01((grow - 0.44) / 0.15); // 100 ticks genuinely run
  const detailFade = clamp01(1 - (grow - 0.66) / 0.1);
  const heroFade = clamp01(1 - (grow - 0.72) / 0.13);
  const rowIn = clamp01((grow - 0.74) / 0.16);

  // ── the counter — climbs through the real tiers ─────────────────────────────
  const count =
    grow < 0.41
      ? interpolate(fieldReveal, [0, 1], [1, LINES_PER_BATCH], cl)
      : grow < 0.59
        ? interpolate(grow, [0.44, 0.59], [LINES_PER_BATCH, LINES_PER_BATCH * BATCHES_PER_DAY], { ...cl, easing: EASE.out })
        : interpolate(grow, [0.6, 0.88], [LINES_PER_BATCH * BATCHES_PER_DAY, THROUGHPUT_TOTAL], { ...cl, easing: EASE.out });
  const label = grow < 0.14 ? "One trader, one trade" : grow < 0.42 ? "Creating 10,000 trades" : grow < 0.6 ? "100 batches a day" : "Ten markets · one engine";

  // ── the finale row layout (screen space) ────────────────────────────────────
  const NM = THROUGHPUT_SOURCES.length;
  const F_BUS_Y = 372;
  const F_TOP = 446;
  const F_COL0 = 338;
  const F_GAP = (1762 - F_COL0) / (NM - 1);
  const fColX = (m: number): number => F_COL0 + m * F_GAP;
  const F_TRADER_X = 158;

  return (
    <div style={{ position: "relative", width: BOX_W, height: BOX_H }}>
      {/* counter + label, pinned to the top of the frame (screen space) */}
      <div style={{ position: "absolute", left: BOX_W / 2, top: 0, transform: "translateX(-50%)", textAlign: "center", zIndex: 60 }}>
        <div style={heroText(118)}>{commas(count)}</div>
        <div style={{ marginTop: 12, display: "inline-flex", padding: "11px 28px", borderRadius: 999, background: PILL_GRADIENT, fontFamily: font, fontSize: 30, fontWeight: 800, color: "#fff", boxShadow: "0 14px 34px rgba(94,120,255,0.4)" }}>{label}</div>
      </div>

      {/* the hero machine — one world the camera flies across, fading on handoff */}
      {heroFade > 0.01 && (
        <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W, height: WORLD_H, transformOrigin: "0 0", transform: worldTransform, willChange: "transform", opacity: heroFade }}>
          {/* a soft light blooming behind the block as the batch fires */}
          <div style={{ position: "absolute", left: BLOCK.cx, top: MY, transform: "translate(-50%,-50%)", width: 820, height: 560, borderRadius: "50%", background: `radial-gradient(circle, ${C.blue}30 0%, ${C.violet}1A 42%, transparent 70%)`, opacity: blockR0 * (0.6 + 0.4 * Math.sin(clamp01(blockR0) * Math.PI)), zIndex: 1 }} />

          <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {/* trader → block */}
            <Conn x1={TRADER.cx + 52} y1={MY} x2={BUS_X} y2={MY} reveal={busR} width={4} />
            <Conn x1={BUS_X} y1={MY} x2={blockL} y2={MY} reveal={busR} arrow width={4} />
            {/* block spills into the ten-thousand field — a converging fan */}
            {Array.from({ length: 7 }, (_, i) => {
              const fy = FIELD_Y0 + (FIELD_H * (i + 0.5)) / 7;
              return <Conn key={`bf${i}`} x1={blockR} y1={MY} x2={FIELD_X0 - 6} y2={fy} reveal={clamp01((fieldReveal - 0.02) / 0.25)} width={3} color="rgba(94,120,255,0.5)" />;
            })}
            {/* the field itself */}
            <TradeField x0={FIELD_X0} y0={FIELD_Y0} reveal={fieldReveal} />
            {/* field → the day's timeline (the batch becomes one tick of a hundred) */}
            {Array.from({ length: 7 }, (_, i) => {
              const fy = FIELD_Y0 + (FIELD_H * (i + 0.5)) / 7;
              return <Conn key={`ft${i}`} x1={fieldR + 6} y1={fy} x2={TL_X0 - 16} y2={MY} reveal={clamp01((tlReveal - 0.02) / 0.3)} width={2.5} color="rgba(110,91,255,0.45)" />;
            })}
            <DayTicks x0={TL_X0} y={MY} reveal={tlReveal} />
          </svg>

          {/* the lone trader */}
          <div style={{ position: "absolute", left: TRADER.cx, top: TRADER.cy - 18, transform: "translate(-50%,-50%)", zIndex: 30 }}>
            <StickFigure draw={clamp01(grow / 0.07)} />
          </div>
          <WorldLabel cx={TRADER.cx} cy={TRADER.cy + 150} text="Trader" size={46} reveal={clamp01(grow / 0.07)} />

          {/* the block being clicked */}
          <FlowBox cx={BLOCK.cx} cy={MY} w={BLOCK.w} h={BLOCK.h} accent={C.blue} reveal={blockR0} label="Blocks Trade" fontSize={34} z={14} />

          {/* the field's own labels — Trade #1 at the first cell, #10,000 at the last */}
          <WorldLabel cx={FIELD_X0 + 116} cy={FIELD_Y0 - 46} text="Trade #1" size={42} reveal={clamp01(fieldReveal / 0.15) * detailFade} color={C.text} />
          <WorldLabel cx={fieldR - 150} cy={FIELD_Y0 + FIELD_H + 46} text="Trade #10,000" size={42} reveal={clamp01((fieldReveal - 0.85) / 0.12) * detailFade} color={C.text} />
          <WorldLabel cx={FIELD_X0 - 250} cy={MY} text="× 10,000" size={92} reveal={clamp01((fieldReveal - 0.2) / 0.3) * detailFade} />

          {/* the day's labels */}
          <WorldLabel cx={TL_X0 + 30} cy={MY + 64} text="00:10" size={34} reveal={clamp01(tlReveal / 0.2) * detailFade} mono color={C.dim} weight={700} />
          <WorldLabel cx={tlEnd - 40} cy={MY + 64} text="24:00" size={34} reveal={clamp01((tlReveal - 0.85) / 0.12) * detailFade} mono color={C.dim} weight={700} />
          <WorldLabel cx={X100_X} cy={MY - 120} text="× 100" size={82} reveal={clamp01((tlReveal - 0.3) / 0.3) * detailFade} />

          {/* the cursor fires the batch — burst at the block, ring + spikes */}
          <ClickBurst x={BLOCK.cx} y={MY} t={burstT} />
          <WorldCursor x={curX} y={curY} squish={curSquish} opacity={curOp} />
        </div>
      )}

      {/* the finale — the trader feeds ten huge blocks, one per market */}
      {rowIn > 0.01 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50 }}>
          <svg width={BOX_W} height={BOX_H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <Conn x1={F_TRADER_X + 48} y1={F_BUS_Y} x2={fColX(NM - 1)} y2={F_BUS_Y} reveal={clamp01(rowIn / 0.5)} width={3.5} />
            {THROUGHPUT_SOURCES.map((s, m) => {
              const cr = clamp01((rowIn - 0.12 - m * 0.05) / 0.3);
              return <Conn key={`ftap${m}`} x1={fColX(m)} y1={F_BUS_Y} x2={fColX(m)} y2={F_TOP - 2} reveal={cr} arrow width={3} color={`${s.color}99`} />;
            })}
          </svg>

          <div style={{ position: "absolute", left: F_TRADER_X, top: F_BUS_Y - 96, transform: "translate(-50%,-50%)" }}>
            <StickFigure scale={0.92} />
          </div>
          <div style={{ position: "absolute", left: F_TRADER_X, top: F_BUS_Y + 36, transform: "translateX(-50%)", fontFamily: font, fontSize: 32, fontWeight: 800, color: C.text }}>Trader</div>

          {THROUGHPUT_SOURCES.map((s, m) => {
            const cr = clamp01((rowIn - 0.16 - m * 0.05) / 0.34);
            return (
              <div key={`fm${m}`} style={{ position: "absolute", left: fColX(m), top: F_TOP, transform: "translateX(-50%)" }}>
                <HugeBlock accent={s.color} name={s.name} reveal={cr} />
              </div>
            );
          })}

          <div style={{ position: "absolute", left: F_TRADER_X - 4, top: F_TOP + 230, transform: "translateX(-50%)", fontFamily: font, fontSize: 124, fontWeight: 800, letterSpacing: "-0.03em", color: C.text, opacity: clamp01((rowIn - 0.2) / 0.3) }}>× 10</div>
        </div>
      )}
    </div>
  );
};
