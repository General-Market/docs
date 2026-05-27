import React from "react";
import { interpolate } from "remotion";
import { C, EASE, font, PILL_GRADIENT } from "./theme";
import { glassCard } from "./chrome";
import { BATCHES_PER_DAY, LINES_PER_BATCH, THROUGHPUT_SOURCES, THROUGHPUT_TOTAL } from "./data";

// The throughput climax, in the reel's frosted-glass language: one person makes
// one trade; that trade fans into ten thousand settled lines; a day repeats it a
// hundred times; ten different sources each run the same machine. The camera
// flies right across the first three, then pulls back to reveal the ten.

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

// ── The climax as ONE continuous pull-back ────────────────────────────────────
// A vertical three-level tree the camera only ever zooms OUT of: one trade fans
// into a 10,000-line graph (a transaction); that whole graph becomes one cell of
// a hundred (a day → 1,000,000); that field becomes one of ten sources
// (→ 10,000,000). Self-similar hub-and-spokes at every level; detail cross-fades
// by zoom so the eye always reads a connected graph, never three separate scenes.

const climaxRng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const ThroughputClimax: React.FC<{ grow: number }> = ({ grow }) => {
  const BOX_W = 1760;
  const BOX_H = 1080;
  const cxs = BOX_W / 2;
  const cys = 600;

  // world geometry — the focus chain runs straight up (-y) from the root
  const RW = 3600; // root → source
  const RF = 1040; // source → day
  const RC = 250; // day → leaf
  const NS = THROUGHPUT_SOURCES.length; // ten sources
  const ND = 10; // days drawn per source (representative of 100)
  const NL = 46; // leaves drawn for the focus transaction (representative of 10,000)
  const focusSourceY = -RW;
  const focusDayY = -RW - RF;

  // camera pulls back along the chain; zoom shrinks (log-smooth)
  const clampEase = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: EASE.inOut };
  // Camera holds on the focus cell while it fans to 10,000, then pulls back to
  // the day field, then to the ten-source world — aligned to the counter tiers.
  const camY = interpolate(grow, [0, 0.35, 0.7, 1], [focusDayY, focusDayY, focusSourceY, 0], clampEase);
  const z = Math.exp(interpolate(grow, [0, 0.35, 0.7, 1], [Math.log(1.3), Math.log(1.3), Math.log(0.42), Math.log(0.1)], clampEase));
  const sx = (wx: number): number => cxs + z * wx;
  const sy = (wy: number): number => cys + z * (wy - camY);
  const nr = (base: number): number => Math.max(1.4, base * z);
  const ew = (base: number): number => Math.max(0.5, base * z);

  // level-of-detail: which tier of the tree is drawn, cross-fading by zoom
  const leafOp = clamp01(1 - (grow - 0.4) / 0.12);
  const fieldOp = clamp01((grow - 0.38) / 0.12) * clamp01(1 - (grow - 0.76) / 0.12);
  const worldOp = clamp01((grow - 0.68) / 0.14);

  const sources = THROUGHPUT_SOURCES.map((s, i) => {
    const ang = (-90 + i * (360 / NS)) * (Math.PI / 180);
    return { ...s, i, x: Math.cos(ang) * RW, y: Math.sin(ang) * RW, isFocus: i === 0 };
  });
  const focusDays = Array.from({ length: ND }, (_, j) => {
    const ang = (-90 + j * (360 / ND)) * (Math.PI / 180);
    return { j, x: Math.cos(ang) * RF, y: focusSourceY + Math.sin(ang) * RF, isFocus: j === 0 };
  });
  const focusDay = { x: 0, y: focusDayY };
  const leafRnd = climaxRng(7);
  const leaves = Array.from({ length: NL }, () => {
    const ang = leafRnd() * Math.PI * 2;
    const rr = RC * (0.55 + leafRnd() * 0.55);
    return { x: focusDay.x + Math.cos(ang) * rr, y: focusDay.y + Math.sin(ang) * rr };
  });
  const leafGrow = clamp01((grow - 0.04) / 0.26);

  const count =
    grow < 0.34
      ? interpolate(grow, [0.02, 0.34], [1, LINES_PER_BATCH], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out })
      : grow < 0.7
        ? interpolate(grow, [0.34, 0.7], [LINES_PER_BATCH, LINES_PER_BATCH * BATCHES_PER_DAY], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out })
        : interpolate(grow, [0.7, 1], [LINES_PER_BATCH * BATCHES_PER_DAY, THROUGHPUT_TOTAL], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const label = grow < 0.4 ? "One transaction → 10,000 lines" : grow < 0.72 ? "× 100 batches a day" : "Ten sources · one engine";

  return (
    <div style={{ position: "relative", width: BOX_W, height: BOX_H }}>
      {/* counter + label, fixed at the top */}
      <div style={{ position: "absolute", left: BOX_W / 2, top: 0, transform: "translateX(-50%)", textAlign: "center", zIndex: 5 }}>
        <div style={heroText(132)}>{commas(count)}</div>
        <div style={{ marginTop: 12, display: "inline-flex", padding: "11px 28px", borderRadius: 999, background: PILL_GRADIENT, fontFamily: font, fontSize: 30, fontWeight: 800, color: "#fff", boxShadow: "0 14px 34px rgba(94,120,255,0.4)" }}>{label}</div>
      </div>

      <svg width={BOX_W} height={BOX_H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {/* WORLD — root → ten sources, each carrying a faint day-ring */}
        {worldOp > 0.01 && (
          <g opacity={worldOp}>
            {sources.map((s) => (
              <line key={`rs${s.i}`} x1={sx(0)} y1={sy(0)} x2={sx(s.x)} y2={sy(s.y)} stroke="rgba(0,113,227,0.32)" strokeWidth={ew(2.4)} strokeLinecap="round" />
            ))}
            {sources.map((s) => {
              const rnd = climaxRng(s.i * 17 + 3);
              return Array.from({ length: 8 }, (_, d) => {
                const ang = (d / 8) * Math.PI * 2 + rnd();
                const dx = s.x + Math.cos(ang) * RF * 0.5;
                const dy = s.y + Math.sin(ang) * RF * 0.5;
                return <circle key={`sd${s.i}-${d}`} cx={sx(dx)} cy={sy(dy)} r={nr(6)} fill={s.color} opacity={0.6} />;
              });
            })}
            {sources.map((s) => (
              <circle key={`s${s.i}`} cx={sx(s.x)} cy={sy(s.y)} r={nr(s.isFocus ? 20 : 16)} fill={s.color} stroke="#fff" strokeWidth={ew(2)} />
            ))}
            <circle cx={sx(0)} cy={sy(0)} r={nr(24)} fill={C.blue} stroke="#fff" strokeWidth={ew(2.5)} />
          </g>
        )}

        {/* FIELD — focus source → its day-ring (each day a small fan) */}
        {fieldOp > 0.01 && (
          <g opacity={fieldOp}>
            {focusDays.map((d) => (
              <line key={`fd${d.j}`} x1={sx(0)} y1={sy(focusSourceY)} x2={sx(d.x)} y2={sy(d.y)} stroke="rgba(0,113,227,0.3)" strokeWidth={ew(2)} strokeLinecap="round" />
            ))}
            {focusDays.map((d) => {
              if (d.isFocus) return null;
              const rnd = climaxRng(d.j * 13 + 1);
              return Array.from({ length: 6 }, (_, l) => {
                const ang = (l / 6) * Math.PI * 2 + rnd();
                const lx = d.x + Math.cos(ang) * RC * 0.5;
                const ly = d.y + Math.sin(ang) * RC * 0.5;
                return <circle key={`dl${d.j}-${l}`} cx={sx(lx)} cy={sy(ly)} r={nr(4.5)} fill={C.violet} opacity={0.55} />;
              });
            })}
            {focusDays.map((d) => (
              <circle key={`fdn${d.j}`} cx={sx(d.x)} cy={sy(d.y)} r={nr(d.isFocus ? 14 : 11)} fill={d.isFocus ? C.blue : "#7C89B8"} stroke="#fff" strokeWidth={ew(1.6)} />
            ))}
            <circle cx={sx(0)} cy={sy(focusSourceY)} r={nr(18)} fill={C.blue} stroke="#fff" strokeWidth={ew(2)} />
          </g>
        )}

        {/* CELL — the focus transaction: one node fans into its 10,000 lines */}
        {leafOp > 0.01 && (
          <g opacity={leafOp}>
            {leaves.map((lf, k) => {
              const ex = lerp(focusDay.x, lf.x, leafGrow);
              const ey = lerp(focusDay.y, lf.y, leafGrow);
              return <line key={`le${k}`} x1={sx(focusDay.x)} y1={sy(focusDay.y)} x2={sx(ex)} y2={sy(ey)} stroke="rgba(110,91,255,0.42)" strokeWidth={ew(1.8)} strokeLinecap="round" />;
            })}
            {leaves.map((lf, k) => {
              const ex = lerp(focusDay.x, lf.x, leafGrow);
              const ey = lerp(focusDay.y, lf.y, leafGrow);
              return <circle key={`ln${k}`} cx={sx(ex)} cy={sy(ey)} r={nr(7)} fill={C.blue} opacity={0.85} />;
            })}
            <circle cx={sx(focusDay.x)} cy={sy(focusDay.y)} r={nr(16)} fill={C.blue} stroke="#fff" strokeWidth={ew(2.5)} />
          </g>
        )}
      </svg>

      {/* source names, at world scale */}
      {worldOp > 0.01 &&
        sources.map((s) => (
          <div key={`sl${s.i}`} style={{ position: "absolute", left: sx(s.x), top: sy(s.y) + nr(16) + 9, transform: "translate(-50%,0)", opacity: worldOp, fontFamily: font, fontSize: 17, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>
            {s.name}
          </div>
        ))}
    </div>
  );
};
