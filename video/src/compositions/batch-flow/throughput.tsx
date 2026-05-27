import React from "react";
import { C, EASE, font, monoFont, PILL_GRADIENT } from "./theme";
import { glassCard } from "./chrome";

// The throughput climax, in the reel's frosted-glass language: one person makes
// one trade; that trade fans into ten thousand settled lines; a day repeats it a
// hundred times; ten different sources each run the same machine. The camera
// flies right across the first three, then pulls back to reveal the ten.

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const commas = (n: number): string => Math.round(n).toLocaleString("en-US");

const rng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

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

// ── The person — a clean glyph in a glass disc, firing one trade ──────────────
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

// ── One trade → ten thousand lines ────────────────────────────────────────────
// `reveal` (0..1) extends the fan outward and fades in the multitude behind it;
// `count` is the number the reel ticks to 10,000 under the fan.
export const TradeFan: React.FC<{ reveal: number; count: number }> = ({ reveal, count }) => {
  const W = 900;
  const Hc = 560;
  const ox = 44;
  const oy = Hc * 0.40;
  const tipX = W - 56;
  const midX = ox + (tipX - ox) * 0.40;
  const N1 = 7;
  const N2 = 7;
  const M = N1 * N2;
  const branchHalf = Hc * 0.27;
  const endHalf = Hc * 0.36;

  const t1 = EASE.out(clamp01(reveal / 0.42));
  const t2 = EASE.out(clamp01((reveal - 0.26) / 0.52));
  const hazeT = clamp01((reveal - 0.5) / 0.5);

  const mainY = (i: number): number => oy + ((i - (N1 - 1) / 2) / ((N1 - 1) / 2)) * branchHalf;
  const endY = (k: number): number => oy + ((k - (M - 1) / 2) / ((M - 1) / 2)) * endHalf;

  const rnd = rng(7);
  const haze = Array.from({ length: 240 }, () => {
    const fx = 0.46 + rnd() * 0.6;
    const x = ox + (tipX - ox) * fx;
    const spreadAtX = endHalf * clamp01((x - ox) / (tipX - ox)) * 1.04;
    const y = oy + (rnd() * 2 - 1) * spreadAtX;
    return { x, y, len: 5 + rnd() * 11, o: 0.08 + rnd() * 0.2 };
  });

  return (
    <div style={{ position: "relative", width: W, height: Hc }}>
      <svg width={W} height={Hc} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {haze.map((h, i) => (
          <line key={`h${i}`} x1={h.x} y1={h.y} x2={h.x + h.len} y2={h.y} stroke={C.blue} strokeWidth={2} strokeLinecap="round" opacity={h.o * hazeT} />
        ))}
        {Array.from({ length: M }, (_, k) => {
          const parent = Math.floor(k / N2);
          const px = midX;
          const py = mainY(parent);
          const ex = lerp(px, tipX, t2);
          const ey = lerp(py, endY(k), t2);
          return <line key={`e${k}`} x1={px} y1={py} x2={ex} y2={ey} stroke={C.violet} strokeWidth={1.6} strokeLinecap="round" opacity={0.5 * t2} />;
        })}
        {Array.from({ length: N1 }, (_, i) => {
          const bx = lerp(ox, midX, t1);
          const by = lerp(oy, mainY(i), t1);
          return <line key={`m${i}`} x1={ox} y1={oy} x2={bx} y2={by} stroke={C.blue} strokeWidth={3.2} strokeLinecap="round" opacity={0.6 * t1} />;
        })}
        <circle cx={ox} cy={oy} r={13} fill={C.blue} />
        <circle cx={ox} cy={oy} r={13 + 12 * (1 - t1)} fill="none" stroke={C.blue} strokeWidth={2} opacity={0.5 * (1 - t1)} />
      </svg>
      <div style={{ position: "absolute", left: W / 2, top: Hc - 4, transform: "translateX(-50%)", textAlign: "center" }}>
        <div style={heroText(146)}>{commas(count)}</div>
        <div style={{ fontFamily: monoFont, fontSize: 25, fontWeight: 700, letterSpacing: "0.05em", color: C.dim, marginTop: 6 }}>
          lines settled · one transaction
        </div>
      </div>
    </div>
  );
};

// ── A day repeats it a hundred times ─────────────────────────────────────────
// `stamps` (0..100) lights the day's batches left→right; `product` is the
// running total the reel ticks to 1,000,000.
export const DayTimeline: React.FC<{ stamps: number; product: number }> = ({ stamps, product }) => {
  const W = 1240;
  const axisY = 360;
  const x0 = 70;
  const x1 = W - 70;
  const N = 100;
  const lit = Math.floor(clamp01(stamps / N) * N + 0.0001);
  const xAt = (i: number): number => x0 + (i / (N - 1)) * (x1 - x0);
  const ticks = [0, 25, 50, 75, 99];
  const labels = ["00:00", "06:00", "12:00", "18:00", "24:00"];

  return (
    <div style={{ position: "relative", width: W, height: 520 }}>
      <div style={{ position: "absolute", left: W / 2, top: 18, transform: "translateX(-50%)", textAlign: "center" }}>
        <div style={heroText(132)}>{commas(product)}</div>
        <div style={{ fontFamily: monoFont, fontSize: 25, fontWeight: 700, letterSpacing: "0.05em", color: C.dim, marginTop: 6 }}>
          settlements today
        </div>
      </div>
      <svg width={W} height={520} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={x0} y1={axisY} x2={x1} y2={axisY} stroke={C.rule} strokeWidth={2} />
        {Array.from({ length: N }, (_, i) => {
          const x = xAt(i);
          const on = i < lit;
          const col = on ? C.blue : "rgba(60,64,130,0.16)";
          const h = on ? 34 : 16;
          return (
            <g key={i}>
              <line x1={x} y1={axisY} x2={x} y2={axisY - h} stroke={col} strokeWidth={2.4} strokeLinecap="round" opacity={on ? 1 : 0.7} />
              {on ? <circle cx={x} cy={axisY - h - 5} r={2.8} fill={C.blue} /> : null}
            </g>
          );
        })}
        {ticks.map((i, j) => (
          <text key={j} x={xAt(i)} y={axisY + 32} textAnchor="middle" fontFamily={monoFont} fontSize={20} fontWeight={700} fill={C.faint}>
            {labels[j]}
          </text>
        ))}
      </svg>
      <div style={{ position: "absolute", left: W / 2, top: axisY + 80, transform: "translateX(-50%)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 28px", borderRadius: 999, background: PILL_GRADIENT, fontFamily: font, fontSize: 30, fontWeight: 800, color: "#fff", boxShadow: "0 14px 34px rgba(94,120,255,0.4)" }}>
          × 100 batches a day
        </div>
      </div>
    </div>
  );
};

// ── Ten sources, each running the same machine ───────────────────────────────
// `rise` (0..1) brings rows 1..n in beneath the live row; `total` is the grand
// total the reel ticks to 10,000,000. `liveName` marks the source already shown.
export type ThroughputSource = { name: string; color: string };

export const SourceStack: React.FC<{
  sources: ThroughputSource[];
  rise: number;
  total: number;
  perSource: number;
}> = ({ sources, rise, total, perSource }) => {
  const ROWH = 132;
  const rowW = 940;
  return (
    <div style={{ position: "relative", width: rowW, height: sources.length * ROWH }}>
      {/* the grand total, above the stack */}
      <div style={{ position: "absolute", left: rowW / 2, top: -240, transform: "translateX(-50%)", textAlign: "center" }}>
        <div style={heroText(176)}>{commas(total)}</div>
        <div style={{ fontFamily: monoFont, fontSize: 30, fontWeight: 700, letterSpacing: "0.07em", color: C.dim, marginTop: 8 }}>
          SETTLEMENTS · A DAY
        </div>
      </div>
      {sources.map((s, i) => {
        const isLive = i === 0;
        const appear = isLive ? 1 : clamp01((rise - (i - 1) * 0.06) / 0.4);
        const e = EASE.out(appear);
        return (
          <div
            key={s.name}
            style={{
              position: "absolute",
              left: 0,
              top: i * ROWH,
              width: rowW,
              height: ROWH - 18,
              opacity: e,
              transform: `translateX(${((1 - e) * 60).toFixed(1)}px)`,
              ...glassCard(20),
              border: `2px solid ${isLive ? s.color : "rgba(255,255,255,0.6)"}`,
              boxShadow: isLive
                ? `0 18px 44px ${s.color}3D, 0 0 46px ${s.color}33, inset 0 1px 0 rgba(255,255,255,0.85)`
                : "0 10px 28px rgba(70,74,140,0.14), inset 0 1px 0 rgba(255,255,255,0.8)",
              display: "flex",
              alignItems: "center",
              padding: "0 30px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 999, background: s.color, boxShadow: `0 4px 12px ${s.color}88`, marginRight: 20 }} />
            <div style={{ fontFamily: font, fontSize: 36, fontWeight: 800, color: C.text, width: 320 }}>{s.name}</div>
            <div style={{ fontFamily: monoFont, fontSize: 26, fontWeight: 700, color: C.faint, flex: 1 }}>10,000 × 100</div>
            <div style={{ fontFamily: monoFont, fontSize: 34, fontWeight: 800, color: isLive ? s.color : C.dim, fontVariantNumeric: "tabular-nums" }}>
              {commas(perSource)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
