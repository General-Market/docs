import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, font, monoFont, PILL_GRADIENT } from "./theme";
import { BeatTitle, useFade } from "./chrome";
import { BARS, BATCHES_PER_DAY, GM_PER_DAY, SCALE_STEPS } from "./data";

type BeatProps = { durationInFrames: number };

const commas = (n: number): string => Math.round(n).toLocaleString("en-US");
const abbr = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`;

// ─── 7 · Zoom out — one transaction, a hundred times a day ────────────────────

export const ScaleBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFade(durationInFrames);

  const bigStart = 250;
  const big = interpolate(frame, [bigStart, bigStart + 110], [0, GM_PER_DAY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const x100Op = interpolate(frame, [200, 224], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <BeatTitle title="Now zoom out" sub="ten thousand markets in one transaction" />

      {/* left — the three sources, each one batch */}
      <div style={{ position: "absolute", left: 150, top: 286, display: "flex", flexDirection: "column", gap: 28, width: 760 }}>
        {SCALE_STEPS.map((s, i) => {
          const r = spring({ fps, frame: Math.max(0, frame - (30 + i * 34)), config: { damping: 16, stiffness: 110, mass: 0.7 }, durationInFrames: 26 });
          const target = parseInt(s.n.replace(/,/g, ""), 10);
          const shown = Math.round(interpolate(r, [0, 1], [0, target]));
          return (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 22, opacity: Math.min(1, r), transform: `translateX(${((1 - Math.min(1, r)) * -30).toFixed(1)}px)` }}>
              <div style={{ fontFamily: font, fontSize: 92, fontWeight: 800, letterSpacing: "-0.03em", color: C.text, fontVariantNumeric: "tabular-nums", minWidth: 320 }}>
                {commas(shown)}
              </div>
              <div>
                <div style={{ fontFamily: font, fontSize: 34, fontWeight: 700, color: C.text }}>{s.label}</div>
                <div style={{ fontFamily: monoFont, fontSize: 20, fontWeight: 600, color: C.dim }}>{s.sub}</div>
              </div>
            </div>
          );
        })}
        <div style={{ fontFamily: font, fontSize: 40, fontWeight: 800, color: C.blue, opacity: x100Op, marginTop: 6 }}>
          × {BATCHES_PER_DAY} batches a day
        </div>
      </div>

      {/* right — the throughput */}
      <div style={{ position: "absolute", right: 110, top: 420, width: 760, textAlign: "center", opacity: interpolate(frame, [bigStart - 10, bigStart + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 0.92,
            fontVariantNumeric: "tabular-nums",
            background: PILL_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 14px 36px rgba(94,120,255,0.40))",
          }}
        >
          {commas(big)}
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 30, fontWeight: 700, letterSpacing: "0.04em", color: C.dim, marginTop: 14 }}>
          MARKETS SETTLED · EVERY DAY
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── 8 · The throughput graph ─────────────────────────────────────────────────

const BASE_Y = 858;
const MAX_H = 470;
const COL_W = 188;
const BAR_X = [490, 960, 1430];

const Column: React.FC<{ index: number; scaleTop: number }> = ({ index, scaleTop }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bar = BARS[index];
  const start = 30 + index * 12;
  const local = frame - start;
  const rise = Math.max(0, spring({ fps, frame: local, config: { damping: 15, stiffness: 95, mass: 1 }, durationInFrames: 46 }));
  const h = Math.max(rise > 0 ? 6 : 0, (bar.value / scaleTop) * MAX_H * rise);
  const top = BASE_Y - h;
  const cx = BAR_X[index];
  const x = cx - COL_W / 2;
  const valOp = interpolate(rise, [0.25, 0.55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shown = bar.value * rise;

  return (
    <>
      <rect x={x} y={top} width={COL_W} height={h} rx={14} fill={bar.accent} opacity={0.4} filter="url(#bf-bar-glow)" />
      <rect x={x} y={top} width={COL_W} height={h} rx={14} fill={bar.accent} />
      <rect x={x} y={top} width={COL_W} height={h} rx={14} fill="url(#bf-bar-sheen)" />
      <text x={cx} y={top - 24} textAnchor="middle" fontFamily={font} fontSize={index === 0 ? 60 : 48} fontWeight={800} letterSpacing="-0.02em" fill={bar.accent} opacity={valOp}>
        {abbr(shown)}
      </text>
      <text x={cx} y={BASE_Y + 44} textAnchor="middle" fontFamily={font} fontSize={27} fontWeight={700} fill={C.text} opacity={valOp}>
        {bar.name}
      </text>
      <text x={cx} y={BASE_Y + 90} textAnchor="middle" fontFamily={font} fontSize={index === 0 ? 40 : 32} fontWeight={800} letterSpacing="-0.02em" fill={bar.accent} opacity={valOp}>
        {bar.users}
      </text>
      <text x={cx} y={BASE_Y + 122} textAnchor="middle" fontFamily={monoFont} fontSize={15} fontWeight={600} fill={C.faint} opacity={valOp}>
        {bar.note}
      </text>
    </>
  );
};

export const BarsBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const fade = useFade(durationInFrames);
  const scaleTop = Math.max(...BARS.map((b) => b.value));
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <BeatTitle title="Real trades a day" sub="and the users it took" />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="bf-bar-glow" x="-60%" y="-30%" width="220%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <linearGradient id="bf-bar-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.10)" />
          </linearGradient>
        </defs>
        <line x1={300} y1={BASE_Y} x2={1620} y2={BASE_Y} stroke={C.ruleStrong} strokeWidth={2} />
        {BARS.map((_b, i) => (
          <Column key={i} index={i} scaleTop={scaleTop} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
