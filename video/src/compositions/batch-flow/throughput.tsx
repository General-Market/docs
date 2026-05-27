import React from "react";
import { interpolate } from "remotion";
import { C, EASE, font, monoFont, PILL_GRADIENT } from "./theme";
import { glassCard } from "./chrome";
import { BATCHES_PER_DAY, LINES_PER_BATCH, THROUGHPUT_SOURCES, THROUGHPUT_TOTAL } from "./data";

// The throughput climax, told as ONE diagram the camera flies across — Max's
// storyboard, reskinned into the reel's frosted-glass world. A lone trader sends
// one call; the engine BLOCKS it into a batch of ten thousand trades; every
// trade settles on a clock that ticks a hundred times a day. The shot opens
// tight on the trader and tracks right through that one machine — the fan to ten
// thousand, the × 100 settlement timeline — then pulls all the way back to reveal
// the machine is one of ten markets, a row of them across the frame, ten million
// settlements a day. One surface, one continuous move.

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
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

// ── A frosted box on the board (block / trade / settlement tick) ──────────────
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
  const s = 0.7 + 0.3 * clamp01(reveal);
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: `translate(-50%,-50%) scale(${s.toFixed(3)})`,
        opacity: clamp01(reveal),
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
            ? `0 8px 22px rgba(70,74,140,0.12), inset 0 1px 0 rgba(255,255,255,0.7)`
            : `0 16px 38px rgba(70,74,140,0.18), inset 0 1px 0 rgba(255,255,255,0.85)`,
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

// ── One market's machine, compact, for the ten-across finale row ──────────────
const FinaleMachine: React.FC<{ accent: string; name: string; reveal: number }> = ({ accent, name, reveal }) => {
  const s = 0.82 + 0.18 * clamp01(reveal);
  const tile = (w: number, h: number, faint: boolean): React.CSSProperties => ({
    width: w,
    height: h,
    borderRadius: 14,
    background: faint ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.9)",
    border: `2px solid ${faint ? "rgba(94,108,170,0.45)" : accent}`,
    boxShadow: "0 6px 16px rgba(70,74,140,0.14), inset 0 1px 0 rgba(255,255,255,0.9)",
  });
  const link = <div style={{ width: 3, height: 18, background: "rgba(110,91,255,0.5)" }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: clamp01(reveal), transform: `scale(${s.toFixed(3)})`, transformOrigin: "top center" }}>
      <div style={tile(132, 56, false)} />
      {link}
      <div style={tile(118, 42, true)} />
      {link}
      <div style={tile(118, 42, true)} />
      {link}
      <div style={tile(118, 42, true)} />
      <div style={{ marginTop: 16, fontFamily: font, fontSize: 22, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>{name}</div>
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
  const MY = 540; // machine centre-line
  const ROW_DY = 340; // the three trade rows: −ROW_DY, 0, +ROW_DY
  const rowYs = [-ROW_DY, 0, ROW_DY];
  const TRADER = { cx: 150, cy: MY };
  const BUS_X = 460;
  const BLOCK = { cx: 860, w: 392, h: 158 };
  const TRADE = { cx: 1860, w: 300, h: 130 };
  const TL0 = 2560;
  const TL_STEP = 540;
  const TL_N = 3;
  const TLB = { w: 234, h: 122 };
  const tlCx = (i: number): number => TL0 + i * TL_STEP;
  const X100_X = tlCx(TL_N - 1) + TL_STEP * 0.78;
  const WORLD_W = X100_X + 360;
  const WORLD_H = MY + ROW_DY + 420;

  const blockL = BLOCK.cx - BLOCK.w / 2;
  const blockR = BLOCK.cx + BLOCK.w / 2;
  const tradeL = TRADE.cx - TRADE.w / 2;
  const tradeR = TRADE.cx + TRADE.w / 2;

  // ── the camera over the hero machine — a continuous track-and-pull-back ─────
  const KF = [0, 0.15, 0.3, 0.5, 0.7, 1.0];
  const ease = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: EASE.inOut };
  const camX = interpolate(grow, KF, [300, BLOCK.cx, 1700, 3060, (BLOCK.cx + X100_X) / 2, (BLOCK.cx + X100_X) / 2], ease);
  const camY = interpolate(grow, KF, [MY - 70, MY, MY, MY - ROW_DY, MY, MY], ease);
  const z = Math.exp(interpolate(grow, KF, [Math.log(1.5), Math.log(1.05), Math.log(0.78), Math.log(0.66), Math.log(0.4), Math.log(0.27)], ease));
  const worldTransform = `translate(${SCX}px, ${SCY}px) scale(${z.toFixed(5)}) translate(${(-camX).toFixed(2)}px, ${(-camY).toFixed(2)}px)`;

  // ── reveal schedule for the hero machine ────────────────────────────────────
  const busR = clamp01((grow - 0.04) / 0.1);
  const blockR0 = clamp01((grow - 0.07) / 0.12);
  const fanR = clamp01((grow - 0.18) / 0.16);
  const tlR = clamp01((grow - 0.4) / 0.15);
  const detailFade = clamp01(1 - (grow - 0.66) / 0.1); // fine labels recede before the pull-back

  // the hero machine fades as the ten-market row blooms — a motion-led handoff
  const heroFade = clamp01(1 - (grow - 0.72) / 0.13);
  const rowIn = clamp01((grow - 0.74) / 0.16);

  // ── the counter — climbs through the tiers as the multipliers reveal ────────
  const count =
    grow < 0.3
      ? interpolate(grow, [0.18, 0.3], [1, LINES_PER_BATCH], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out })
      : grow < 0.56
        ? interpolate(grow, [0.3, 0.56], [LINES_PER_BATCH, LINES_PER_BATCH * BATCHES_PER_DAY], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out })
        : interpolate(grow, [0.56, 0.88], [LINES_PER_BATCH * BATCHES_PER_DAY, THROUGHPUT_TOTAL], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const label = grow < 0.3 ? "One trader, one trade" : grow < 0.56 ? "10,000 trades in a block" : grow < 0.82 ? "100 batches a day" : "Ten markets · one engine";

  // ── the finale row layout (screen space) ────────────────────────────────────
  const NM = THROUGHPUT_SOURCES.length;
  const F_BUS_Y = 250;
  const F_COL0 = 332;
  const F_GAP = (1764 - F_COL0) / (NM - 1);
  const fColX = (m: number): number => F_COL0 + m * F_GAP;
  const F_TRADER_X = 156;
  const F_TOP = 300; // machine top (block top)

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
          <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {/* trader → block */}
            <Conn x1={TRADER.cx + 52} y1={TRADER.cy} x2={BUS_X} y2={TRADER.cy} reveal={busR} width={4} />
            <Conn x1={BUS_X} y1={MY} x2={blockL} y2={MY} reveal={busR} arrow width={4} />
            {/* block fans to its three trades */}
            {rowYs.map((dy, ri) => (
              <Conn key={`fan${ri}`} x1={blockR} y1={MY} x2={tradeL} y2={MY + dy} reveal={fanR} arrow width={3.5} color="rgba(94,120,255,0.62)" />
            ))}
            {/* each trade runs its settlement timeline */}
            {rowYs.map((dy, ri) => {
              const ry = MY + dy;
              const segs: React.ReactNode[] = [];
              segs.push(<Conn key={`tl${ri}-s`} x1={tradeR} y1={ry} x2={tlCx(0) - TLB.w / 2} y2={ry} reveal={clamp01(tlR / 0.45)} width={3} color="rgba(110,91,255,0.5)" />);
              for (let i = 0; i < TL_N - 1; i++) {
                segs.push(
                  <Conn key={`tl${ri}-${i}`} x1={tlCx(i) + TLB.w / 2} y1={ry} x2={tlCx(i + 1) - TLB.w / 2} y2={ry} reveal={clamp01((tlR - (i + 1) * 0.22) / 0.3)} width={3} color="rgba(110,91,255,0.5)" />,
                );
              }
              return segs;
            })}
          </svg>

          {/* the lone trader */}
          <div style={{ position: "absolute", left: TRADER.cx, top: TRADER.cy - 18, transform: "translate(-50%,-50%)", zIndex: 30 }}>
            <StickFigure draw={clamp01(grow / 0.08)} />
          </div>
          <WorldLabel cx={TRADER.cx} cy={TRADER.cy + 150} text="Trader" size={46} reveal={clamp01(grow / 0.08)} />

          {/* the block, its three trades, its settlement ticks */}
          <FlowBox cx={BLOCK.cx} cy={MY} w={BLOCK.w} h={BLOCK.h} accent={C.blue} reveal={blockR0} label="Blocks Trade" fontSize={34} z={14} />
          {rowYs.map((dy, ri) => {
            const ry = MY + dy;
            const tradeLabel = ri === 0 ? "Trade #1" : ri === 2 ? "Trade #10,000" : undefined;
            return (
              <React.Fragment key={`row${ri}`}>
                <FlowBox cx={TRADE.cx} cy={ry} w={TRADE.w} h={TRADE.h} accent={C.violet} reveal={fanR} label={tradeLabel} fontSize={27} z={13} />
                {Array.from({ length: TL_N }, (_, i) => {
                  const tickRev = clamp01((tlR - i * 0.12) / 0.4);
                  return (
                    <React.Fragment key={`tick${ri}-${i}`}>
                      <FlowBox cx={tlCx(i)} cy={ry} w={TLB.w} h={TLB.h} accent="rgba(0,113,227,0.55)" reveal={tickRev} faint z={12} />
                      <WorldLabel cx={tlCx(i)} cy={ry - TLB.h / 2 - 58} text={`00:${(i + 1) * 10}`} size={40} reveal={tickRev * detailFade} mono color={C.dim} weight={700} />
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* the multipliers — the storyboard's annotations, in world space */}
          <WorldLabel cx={lerp(BLOCK.cx, TRADE.cx, 0.5)} cy={MY + ROW_DY * 0.66} text="× 10,000" size={66} reveal={fanR * detailFade} />
          <WorldLabel cx={X100_X} cy={MY - ROW_DY} text="× 100" size={62} reveal={tlR * detailFade} />
        </div>
      )}

      {/* the finale — the trader feeds a row of ten market-machines */}
      {rowIn > 0.01 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50 }}>
          <svg width={BOX_W} height={BOX_H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <Conn x1={F_TRADER_X + 48} y1={F_BUS_Y} x2={fColX(NM - 1)} y2={F_BUS_Y} reveal={clamp01(rowIn / 0.5)} width={3.5} />
            {THROUGHPUT_SOURCES.map((s, m) => {
              const cr = clamp01((rowIn - 0.12 - m * 0.05) / 0.3);
              return <Conn key={`ftap${m}`} x1={fColX(m)} y1={F_BUS_Y} x2={fColX(m)} y2={F_TOP - 2} reveal={cr} width={3} color={`${s.color}99`} />;
            })}
          </svg>

          <div style={{ position: "absolute", left: F_TRADER_X, top: F_BUS_Y + 6, transform: "translate(-50%,-50%)" }}>
            <StickFigure scale={0.92} />
          </div>
          <div style={{ position: "absolute", left: F_TRADER_X, top: F_BUS_Y + 132, transform: "translateX(-50%)", fontFamily: font, fontSize: 34, fontWeight: 800, color: C.text }}>Trader</div>

          {THROUGHPUT_SOURCES.map((s, m) => {
            const cr = clamp01((rowIn - 0.16 - m * 0.05) / 0.34);
            return (
              <div key={`fm${m}`} style={{ position: "absolute", left: fColX(m), top: F_TOP, transform: "translateX(-50%)" }}>
                <FinaleMachine accent={s.color} name={s.name} reveal={cr} />
              </div>
            );
          })}

          {/* the last multiplier — × 10 markets */}
          <div style={{ position: "absolute", left: F_TRADER_X - 4, top: F_BUS_Y + 320, transform: "translateX(-50%)", fontFamily: font, fontSize: 132, fontWeight: 800, letterSpacing: "-0.03em", color: C.text, opacity: clamp01((rowIn - 0.2) / 0.3) }}>× 10</div>
        </div>
      )}
    </div>
  );
};
