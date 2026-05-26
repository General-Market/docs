import React from "react";
import { C, EASE, font, monoFont } from "./theme";
import { glassCard, glassPanel } from "./chrome";

// The three explainer ideas — the binary question, the oracle's line, and
// losers-paying-winners — rebuilt in the reel's own frosted-glass language so
// they live INSIDE the flow rather than cutting away to another world. Each
// takes a `reveal` (0..1 build) and is positioned + faded by the timeline.

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const usd = (n: number): string => "$" + Math.round(n).toLocaleString("en-US");

// ── 1 · One question — every market is a single binary call ──────────────────
export const GlassQuestion: React.FC<{ reveal: number }> = ({ reveal }) => {
  const yes = clamp01((reveal - 0.45) / 0.4);
  const no = clamp01((reveal - 0.6) / 0.4);
  const pill = (side: "up" | "down", t: number): React.ReactNode => {
    const isUp = side === "up";
    const color = isUp ? C.up : C.down;
    return (
      <div
        style={{
          flex: 1,
          height: 76,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: font,
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "0.01em",
          background: isUp ? C.upSoft : C.downSoft,
          color,
          border: `2px solid ${color}`,
          boxShadow: `0 10px 26px ${color}33, inset 0 1px 0 rgba(255,255,255,0.6)`,
          opacity: t,
          transform: `translateY(${((1 - t) * 16).toFixed(1)}px)`,
        }}
      >
        <span style={{ fontSize: 24 }}>{isUp ? "▲" : "▼"}</span>
        {isUp ? "UP" : "DOWN"}
      </div>
    );
  };
  return (
    <div style={{ ...glassPanel(28), width: 820, padding: "44px 48px 48px", boxSizing: "border-box" }}>
      <div style={{ fontFamily: monoFont, fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", color: C.faint }}>
        ONE MARKET · NEXT ROUND
      </div>
      <div style={{ marginTop: 18, fontFamily: font, fontSize: 52, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, color: C.text }}>
        Does Fartcoin close up or down?
      </div>
      <div style={{ display: "flex", gap: 20, marginTop: 36 }}>
        {pill("up", yes)}
        {pill("down", no)}
      </div>
    </div>
  );
};

// ── 2 · The oracle draws the line — the open price is the line ───────────────
const LINE_PTS = [0.18, 0.24, 0.2, 0.36, 0.3, 0.46, 0.6, 0.74, 0.86];
const OPEN_FRAC = 0.5;

export const GlassLine: React.FC<{ reveal: number }> = ({ reveal }) => {
  const W = 760;
  const Hc = 430;
  const px0 = 70;
  const px1 = W - 70;
  const plotW = px1 - px0;
  const baseY = Hc - 86;
  const topY = 96;
  const plotH = baseY - topY;
  const xAt = (i: number): number => px0 + (i / (LINE_PTS.length - 1)) * plotW;
  const yAt = (frac: number): number => baseY - frac * plotH;
  const pts = LINE_PTS.map((fr, i) => ({ x: xAt(i), y: yAt(fr) }));
  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const openY = yAt(OPEN_FRAC);

  const drawT = EASE.out(clamp01((reveal - 0.1) / 0.7));
  const revealW = drawT * plotW;
  const tipX = px0 + revealW;
  const yAtX = (x: number): number => {
    const span = plotW / (LINE_PTS.length - 1);
    const idx = Math.min(LINE_PTS.length - 2, Math.max(0, Math.floor((x - px0) / span)));
    const t = clamp01((x - xAt(idx)) / (xAt(idx + 1) - xAt(idx)));
    return pts[idx].y + (pts[idx + 1].y - pts[idx].y) * t;
  };
  const tipY = yAtX(tipX);
  const crossed = tipY < openY;
  const labelOp = clamp01(reveal / 0.25);

  return (
    <div style={{ ...glassCard(26), width: W, padding: "28px 30px 30px", boxSizing: "border-box" }}>
      <div style={{ fontFamily: monoFont, fontSize: 20, fontWeight: 700, letterSpacing: "0.1em", color: C.faint, marginBottom: 6 }}>
        THE ORACLE DRAWS THE LINE
      </div>
      <svg width={W - 60} height={Hc - 40} style={{ display: "block" }}>
        {/* open line */}
        <line x1={px0} y1={openY} x2={px1} y2={openY} stroke={C.dim} strokeWidth={2} strokeDasharray="10 9" opacity={labelOp * 0.7} />
        <text x={px1} y={openY - 12} textAnchor="end" fontFamily={monoFont} fontSize={20} fontWeight={700} fill={C.dim} opacity={labelOp}>open</text>
        {/* price line, revealed left→right */}
        <clipPath id="gl-reveal">
          <rect x={px0 - 4} y={topY - 40} width={revealW + 8} height={plotH + 80} />
        </clipPath>
        <polyline points={poly} fill="none" stroke={C.text} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#gl-reveal)" />
        {/* tip */}
        <circle cx={tipX} cy={tipY} r={crossed ? 12 : 9} fill={crossed ? C.up : C.text} />
        {crossed ? <circle cx={tipX} cy={tipY} r={22} fill="none" stroke={C.up} strokeWidth={2.5} opacity={0.5} /> : null}
      </svg>
      <div style={{ fontFamily: font, fontSize: 26, fontWeight: 700, color: C.text, textAlign: "center", marginTop: 4, opacity: clamp01((reveal - 0.5) / 0.4) }}>
        Above the open — <span style={{ color: C.up, fontWeight: 800 }}>UP wins</span>
      </div>
    </div>
  );
};

// ── 3 · The losers pay the winners — the parimutuel split, in glass ──────────
export const GlassFlow: React.FC<{ reveal: number; flow: number }> = ({ reveal, flow }) => {
  const winner = lerp(1000, 1840, flow);
  const loser = lerp(840, 0, flow);
  const pool = (title: string, amount: number, tone: "up" | "down", active: boolean): React.ReactNode => {
    const color = tone === "up" ? C.up : C.down;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div
          style={{
            ...glassCard(24),
            width: 300,
            height: 188,
            border: `2.5px solid ${color}`,
            boxShadow: active ? `0 18px 44px ${color}3D, 0 0 50px ${color}44, inset 0 1px 0 rgba(255,255,255,0.85)` : "0 10px 28px rgba(70,74,140,0.14), inset 0 1px 0 rgba(255,255,255,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: active ? 1 : 0.7,
          }}
        >
          <div style={{ fontFamily: font, fontSize: 60, fontWeight: 800, letterSpacing: "-0.02em", color: C.text, fontVariantNumeric: "tabular-nums" }}>
            {usd(amount)}
          </div>
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 22, fontWeight: 700, letterSpacing: "0.06em", color }}>{title}</div>
      </div>
    );
  };
  const leftX = 0;
  const rightX = 760;
  const coins = Array.from({ length: 7 });
  return (
    <div style={{ width: 760, opacity: clamp01(reveal / 0.3) }}>
      <div style={{ fontFamily: monoFont, fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", color: C.faint, textAlign: "center", marginBottom: 22 }}>
        THE LOSERS PAY THE WINNERS
      </div>
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {pool("UP · winners", winner, "up", true)}
        {/* flow of coins, right→left */}
        <svg style={{ position: "absolute", left: leftX + 300, top: 70, width: rightX - 300 - 300, height: 48, overflow: "visible" }} width={rightX - 600} height={48}>
          {coins.map((_, i) => {
            const period = 1;
            const phase = ((flow * 1.6 + i / coins.length) % period) / period;
            const cx = lerp(rightX - 600 - 10, 10, phase);
            const o = Math.sin(phase * Math.PI);
            return <circle key={i} cx={cx} cy={24 - Math.sin(phase * Math.PI) * 10} r={7} fill={C.up} opacity={o * 0.9} />;
          })}
        </svg>
        {pool("DOWN · losers", loser, "down", false)}
      </div>
    </div>
  );
};
