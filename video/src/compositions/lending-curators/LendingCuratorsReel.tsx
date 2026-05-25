import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { EASE } from "../../common/easing";
import {
  CURATORS,
  CURATORS_ASOF,
  CURATORS_SOURCE,
  fmtPct,
  fmtUSD,
  TOP_GAINER_ID,
  type Curator,
} from "./data";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

const WIDTH = 2160;
const HEIGHT = 2160;
const FPS = 60;
const DURATION = 540;

const PALETTE = {
  bgTop: "#1A1E25",
  bgBottom: "#06080C",
  gridLine: "rgba(255, 255, 255, 0.055)",
  gridDot: "rgba(255, 255, 255, 0.13)",
  text: "#F5F6F8",
  textDim: "#8E939D",
  textVeryDim: "#5F6571",
  gold: "#F1B638",
  goldBright: "#F4B73B",
  loss: "#D8584F",
  lossDim: "rgba(216, 88, 79, 0.85)",
  axis: "#E4E7EB",
  tick: "rgba(255, 255, 255, 0.30)",
  baseline: "rgba(255, 255, 255, 0.42)",
  morpho: "#5B7CFA",
  rowHi: "rgba(241, 182, 56, 0.07)",
};

// Symmetric diverging scale — the longest bar (gain or loss) reaches the edge.
const MAX_ABS = Math.max(...CURATORS.map((c) => Math.abs(c.change24h)));
const SCALE_MAX = Math.ceil(MAX_ABS * 10) / 10; // round up to a clean 0.1

const MARGIN = 120;
const ROWS_TOP = 620;
const ROWS_BOTTOM = 1820;
const ROW_GAP = (ROWS_BOTTOM - ROWS_TOP) / CURATORS.length;
const ROW_H = ROW_GAP - 18;

// The bar plot lives to the right of the name gutter; zero sits at its center.
const PLOT_L = 770;
const PLOT_R = WIDTH - MARGIN; // 2040
const PLOT_W = PLOT_R - PLOT_L;
const X_ZERO = (PLOT_L + PLOT_R) / 2;
const HALF_W = PLOT_W / 2;

const xForValue = (v: number) => X_ZERO + (v / SCALE_MAX) * HALF_W;

const GridBackdrop: React.FC = () => {
  const spacing = 120;
  const cols = Math.ceil(WIDTH / spacing);
  const rows = Math.ceil(HEIGHT / spacing);
  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="lc-grid-mask" cx="50%" cy="40%" r="64%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="60%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="lc-grid-fade">
            <rect width={WIDTH} height={HEIGHT} fill="url(#lc-grid-mask)" />
          </mask>
        </defs>
        <g mask="url(#lc-grid-fade)">
          {Array.from({ length: rows + 1 }).map((_, r) => (
            <line key={`h-${r}`} x1={0} y1={r * spacing} x2={WIDTH} y2={r * spacing} stroke={PALETTE.gridLine} strokeWidth={1.2} />
          ))}
          {Array.from({ length: cols + 1 }).map((_, c) => (
            <line key={`v-${c}`} x1={c * spacing} y1={0} x2={c * spacing} y2={HEIGHT} stroke={PALETTE.gridLine} strokeWidth={1.2} />
          ))}
          {Array.from({ length: rows + 1 }).flatMap((_, r) =>
            Array.from({ length: cols + 1 }).map((__, c) => (
              <circle key={`d-${r}-${c}`} cx={c * spacing} cy={r * spacing} r={2.5} fill={PALETTE.gridDot} />
            )),
          )}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const Row: React.FC<{ curator: Curator; index: number; rank: number }> = ({ curator, index, rank }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const start = 36 + index * 7;
  const local = frame - start;

  const enter = spring({ frame: local, fps, config: { damping: 200, mass: 0.6 }, durationInFrames: 22 });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const slide = interpolate(enter, [0, 1], [-40, 0]);

  // Bar grows out of the zero baseline once the row has arrived.
  const grow = interpolate(local, [10, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  const cy = ROWS_TOP + index * ROW_GAP + ROW_GAP / 2;
  const isGain = curator.change24h >= 0;
  const isTop = curator.id === TOP_GAINER_ID;
  const barColor = isGain ? (isTop ? PALETTE.goldBright : PALETTE.gold) : PALETTE.loss;

  const fullEnd = xForValue(curator.change24h);
  const animEnd = X_ZERO + (fullEnd - X_ZERO) * grow;
  const barX = Math.min(X_ZERO, animEnd);
  const barW = Math.abs(animEnd - X_ZERO);

  const shownPct = curator.change24h * grow;
  const logoSize = 92;
  const logoX = MARGIN;
  const nameX = logoX + logoSize + 30;

  // The top gainer breathes a touch after it has fully arrived.
  const crownPulse = isTop
    ? 1 + 0.06 * Math.sin(Math.max(0, frame - start - 50) / 12)
    : 1;

  const pctLabelX = isGain ? animEnd + 28 : animEnd - 28;

  return (
    <div style={{ position: "absolute", inset: 0, opacity, transform: `translateX(${slide}px)` }}>
      {/* highlight band behind the top gainer */}
      {isTop ? (
        <div
          style={{
            position: "absolute",
            top: cy - ROW_H / 2 - 6,
            left: MARGIN - 28,
            width: WIDTH - (MARGIN - 28) - (MARGIN - 28),
            height: ROW_H + 12,
            borderRadius: 28,
            background: PALETTE.rowHi,
            border: "1px solid rgba(241, 182, 56, 0.22)",
          }}
        />
      ) : null}

      {/* logo chip */}
      <div
        style={{
          position: "absolute",
          top: cy - logoSize / 2,
          left: logoX,
          width: logoSize,
          height: logoSize,
          borderRadius: 24,
          overflow: "hidden",
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 14px 34px -22px rgba(0,0,0,0.9)",
          transform: `scale(${crownPulse})`,
        }}
      >
        <img
          src={staticFile(`lending-curators/logos/${curator.id}.jpg`)}
          alt={curator.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* name + AUM + rank */}
      <div style={{ position: "absolute", top: cy - 46, left: nameX, width: PLOT_L - nameX - 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: INTER, fontSize: 30, fontWeight: 700, color: PALETTE.textVeryDim, fontVariantNumeric: "tabular-nums", width: 44 }}>
            {rank}
          </span>
          <span style={{ fontFamily: INTER, fontSize: 46, fontWeight: 700, letterSpacing: "-0.02em", color: PALETTE.text }}>
            {curator.name}
          </span>
          {isTop ? <span style={{ fontSize: 38, lineHeight: 1 }}>👑</span> : null}
          {curator.morpho ? (
            <span
              style={{
                fontFamily: INTER,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: PALETTE.morpho,
                border: `1.5px solid ${PALETTE.morpho}`,
                borderRadius: 999,
                padding: "4px 14px",
              }}
            >
              MORPHO
            </span>
          ) : null}
        </div>
        <div style={{ fontFamily: INTER, fontSize: 28, fontWeight: 500, color: PALETTE.textDim, marginTop: 6, marginLeft: 60 }}>
          {fmtUSD(curator.aum)} under curation
        </div>
      </div>

      {/* bar + value */}
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <rect x={barX} y={cy - 22} width={Math.max(0, barW)} height={44} rx={10} fill={barColor} />
        <text
          x={pctLabelX}
          y={cy + 16}
          textAnchor={isGain ? "start" : "end"}
          fontFamily={INTER}
          fontSize={44}
          fontWeight={800}
          letterSpacing="-0.01em"
          fill={isGain ? PALETTE.goldBright : PALETTE.loss}
          style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
        >
          {fmtPct(shownPct)}
        </text>
      </svg>
    </div>
  );
};

export const LendingCuratorsReel: React.FC = () => {
  const frame = useCurrentFrame();

  const headerEnter = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });
  const headerLift = interpolate(headerEnter, [0, 1], [36, 0]);

  // Ranked by 24h change, descending (data is already sorted).
  const rows = CURATORS;

  // Axis ticks across the diverging scale.
  const ticks: number[] = [];
  for (let t = -SCALE_MAX; t <= SCALE_MAX + 1e-9; t += 0.5) ticks.push(Math.round(t * 100) / 100);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 100% 70% at 50% 22%, ${PALETTE.bgTop} 0%, ${PALETTE.bgBottom} 100%)`,
        fontFamily: INTER,
      }}
    >
      <GridBackdrop />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, transparent 0%, transparent 50%, ${PALETTE.bgBottom} 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div style={{ position: "absolute", top: MARGIN, left: MARGIN, opacity: headerEnter, transform: `translateY(${headerLift}px)` }}>
        <div style={{ fontFamily: INTER, fontSize: 34, fontWeight: 700, letterSpacing: "0.16em", color: PALETTE.gold }}>
          LAST 24 HOURS
        </div>
        <div style={{ fontFamily: INTER, fontSize: 94, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.0, color: PALETTE.text, marginTop: 18 }}>
          Lending’s risk curators
        </div>
        <div style={{ fontFamily: INTER, fontSize: 38, fontWeight: 500, letterSpacing: "-0.01em", color: PALETTE.textDim, marginTop: 18, maxWidth: 1280 }}>
          Change in assets under curation — the desks running the Morpho, Euler &amp; Spark lending vaults.
        </div>
      </div>

      {/* Morpho lockup — top right */}
      <div
        style={{
          position: "absolute",
          top: MARGIN + 6,
          right: MARGIN,
          display: "flex",
          alignItems: "center",
          gap: 22,
          opacity: headerEnter,
          transform: `translateY(${headerLift}px)`,
        }}
      >
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: INTER, fontSize: 26, fontWeight: 600, letterSpacing: "0.04em", color: PALETTE.morpho }}>
            MORPHO CURATORS
          </div>
          <div style={{ fontFamily: INTER, fontSize: 24, fontWeight: 500, color: PALETTE.textVeryDim, marginTop: 4 }}>
            marked below
          </div>
        </div>
        <div style={{ width: 96, height: 96, borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.96)", boxShadow: "0 16px 40px -24px rgba(0,0,0,0.9)" }}>
          <img src={staticFile("lending-curators/logos/morpho.png")} alt="Morpho" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>

      {/* Axis: gridlines + zero baseline + tick labels */}
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, opacity: headerEnter }}>
        {ticks.map((t) => {
          const x = xForValue(t);
          const isZero = Math.abs(t) < 1e-9;
          return (
            <g key={`tick-${t}`}>
              <line
                x1={x}
                x2={x}
                y1={ROWS_TOP - 26}
                y2={ROWS_BOTTOM + 8}
                stroke={isZero ? PALETTE.baseline : PALETTE.gridLine}
                strokeWidth={isZero ? 3 : 1.5}
              />
              <text
                x={x}
                y={ROWS_TOP - 44}
                textAnchor="middle"
                fontFamily={INTER}
                fontSize={28}
                fontWeight={600}
                fill={isZero ? PALETTE.axis : PALETTE.textVeryDim}
                style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
              >
                {t > 0 ? `+${t}%` : `${t}%`}
              </text>
            </g>
          );
        })}
      </svg>

      {rows.map((c, i) => (
        <Row key={c.id} curator={c} index={i} rank={i + 1} />
      ))}

      {/* Source line — bottom left */}
      <div
        style={{
          position: "absolute",
          top: ROWS_BOTTOM + 92,
          left: MARGIN,
          width: 1360,
          fontFamily: INTER,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          lineHeight: 1.45,
          color: PALETTE.textVeryDim,
          opacity: headerEnter,
        }}
      >
        Source: {CURATORS_SOURCE}
      </div>

      {/* As-of stamp — bottom right */}
      <div
        style={{
          position: "absolute",
          top: ROWS_BOTTOM + 92,
          right: MARGIN,
          fontFamily: INTER,
          fontSize: 24,
          fontWeight: 600,
          color: PALETTE.textDim,
          opacity: headerEnter,
        }}
      >
        as of {CURATORS_ASOF}
      </div>
    </AbsoluteFill>
  );
};

export const lendingCuratorsReelMeta = {
  id: "LendingCuratorsReel",
  component: LendingCuratorsReel,
  durationInFrames: DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
};
