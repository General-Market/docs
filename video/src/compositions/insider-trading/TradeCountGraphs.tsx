import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const interFamily = loadInter("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800", "900"],
}).fontFamily;

const FPS = 30;
const DURATION = 240;

// ─── Palette ───
const PAGE_BG = "#f4f5ee";
const INK = "#0e0f0c";
const INK_MUTED = "rgba(14,15,12,0.52)";
const INK_FAINT = "rgba(14,15,12,0.28)";
const GRID = "rgba(14,15,12,0.08)";

// ─── Timings (frames) ───
const TITLE_IN_END = 6;
const TITLE_HOLD_END = 18;
const TITLE_OUT_END = 24;
const SCENE_IN_START = 20;
const SCENE_IN_END = 30;
const DRAW_START = 26;
const DRAW_END = 176;
const PAYOFF_START = 180;
const PAYOFF_SLAM = 212;

const BEATS = [30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210];
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ─── Line model ───
// Each line is a staircase of (xFrac, cumulative) points, where xFrac is the
// fraction of the day elapsed. The "tx" of each venue lands at evenly spaced
// xFrac positions; the jump at each tx is a random draw from [stepMin, stepMax].
// General Market's defining trait: each tx batches 10k–100k trades. The other
// venues process trades one-or-few at a time.
type LineSpec = {
  id: string;
  label: string;
  strokeWidth: number;
  dash?: string;
  bold?: boolean;
  steps: number;
  stepMin: number;
  stepMax: number;
};

const LINES: LineSpec[] = [
  {
    id: "predictions",
    label: "Predictions",
    strokeWidth: 2.5,
    dash: "2 9",
    steps: 600,
    stepMin: 1,
    stepMax: 6,
  },
  {
    id: "perps",
    label: "Perps",
    strokeWidth: 2.5,
    dash: "8 10",
    steps: 600,
    stepMin: 8,
    stepMax: 40,
  },
  {
    id: "options",
    label: "Options",
    strokeWidth: 2.5,
    steps: 600,
    stepMin: 80,
    stepMax: 350,
  },
  {
    id: "memecoins",
    label: "Memecoins",
    strokeWidth: 2.5,
    dash: "14 4",
    steps: 600,
    stepMin: 600,
    stepMax: 2400,
  },
  {
    id: "gm",
    label: "General Market",
    strokeWidth: 5,
    bold: true,
    steps: 40,
    stepMin: 10_000,
    stepMax: 100_000,
  },
];

// ─── Deterministic per-id PRNG so the staircase is stable across renders ──
const seedFromId = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const prng = (n: number): number => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// Build the cumulative staircase for one line: array of (xFrac, value).
const buildSteps = (spec: LineSpec): Array<[number, number]> => {
  const base = seedFromId(spec.id);
  const out: Array<[number, number]> = [[0, 0]];
  let cum = 0;
  for (let i = 1; i <= spec.steps; i++) {
    const x = i / spec.steps;
    const r = prng(base + i * 17);
    const delta = spec.stepMin + r * (spec.stepMax - spec.stepMin);
    cum += delta;
    out.push([x, cum]);
  }
  return out;
};

const STAIRS: Array<{ spec: LineSpec; data: Array<[number, number]> }> =
  LINES.map((spec) => ({ spec, data: buildSteps(spec) }));

const FINALS: Record<string, number> = Object.fromEntries(
  STAIRS.map((s) => [s.spec.id, s.data[s.data.length - 1][1]]),
);

// Fixed log ceiling — picked above GM final so the line doesn't graze the top.
const Y_MAX = Math.max(3_500_000, FINALS.gm * 1.6);
const Y_LOG_DEN = Math.log10(Y_MAX + 1);

// 0..1 vertical fraction on log scale.
const logY = (v: number): number =>
  Math.log10(Math.max(0, v) + 1) / Y_LOG_DEN;

// Last cumulative value at or before xFrac (linear scan; staircase is short).
const valueAt = (
  data: Array<[number, number]>,
  xFrac: number,
): number => {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] > xFrac) break;
    last = data[i][1];
  }
  return last;
};

const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

const formatTick = (v: number): string => {
  if (v <= 0.5) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${Math.round(v)}`;
};

const beatPulse = (frame: number): number => {
  for (let i = BEATS.length - 1; i >= 0; i--) {
    if (frame >= BEATS[i]) {
      const d = frame - BEATS[i];
      if (d < 8) return Math.pow(1 - d / 8, 1.6);
      return 0;
    }
  }
  return 0;
};

// ─── Paper grain ──────────────────────────────────────────────────────────
const GrainOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const fid = `tcg-grain-${frame}`;
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        mixBlendMode: "multiply",
        opacity: 0.11,
      }}
    >
      <filter id={fid}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          seed={frame}
          stitchTiles="stitch"
        />
        <feColorMatrix values="0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 1 0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${fid})`} />
    </svg>
  );
};

// ─── Chart ────────────────────────────────────────────────────────────────
const LOG_TICKS = [0, 1_000, 10_000, 100_000, 1_000_000];

const Chart: React.FC<{
  progress: number;
  appear: number;
  payoff: number;
  slam: number;
  gmJitterX: number;
  gmJitterY: number;
}> = ({ progress, appear, payoff, slam, gmJitterX, gmJitterY }) => {
  const W = 1720;
  const H = 640;
  const padL = 110;
  const padR = 320;
  const padT = 40;
  const padB = 56;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const toSvg = (xFrac: number, val: number): { x: number; y: number } => ({
    x: padL + xFrac * innerW,
    y: padT + innerH - logY(val) * innerH,
  });

  // Stepped path for one staircase, clipped horizontally to `progress`.
  const buildPath = (data: Array<[number, number]>): string => {
    let d = "";
    let prevV = 0;
    let started = false;
    for (let i = 0; i < data.length; i++) {
      const [x, v] = data[i];
      if (x > progress) {
        if (started) {
          const s = toSvg(progress, prevV);
          d += ` L ${s.x.toFixed(2)},${s.y.toFixed(2)}`;
        }
        return d;
      }
      if (!started) {
        const s = toSvg(x, v);
        d = `M ${s.x.toFixed(2)},${s.y.toFixed(2)}`;
        started = true;
      } else {
        const s1 = toSvg(x, prevV);
        const s2 = toSvg(x, v);
        d += ` L ${s1.x.toFixed(2)},${s1.y.toFixed(2)} L ${s2.x.toFixed(2)},${s2.y.toFixed(2)}`;
      }
      prevV = v;
    }
    return d;
  };

  const chromeOp = 1 - payoff * 0.55;
  const ghostOp = 1 - payoff * 0.92;

  // End-position for each line at current progress.
  const ends = STAIRS.map(({ spec, data }) => {
    const v = valueAt(data, progress);
    return { spec, value: v, pos: toSvg(progress, v) };
  });

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", opacity: appear, overflow: "visible" }}
    >
      <defs>
        <filter id="gm-glow" x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur
            stdDeviation={1.4 + payoff * 5 + slam * 6}
            result="b"
          />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Log-scale grid lines + Y labels */}
      {LOG_TICKS.map((v, i) => {
        const y = padT + innerH - logY(v) * innerH;
        return (
          <g key={`yg-${i}`} opacity={chromeOp}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke={GRID}
              strokeDasharray={i === 0 ? undefined : "3 7"}
            />
            <text
              x={padL - 18}
              y={y + 6}
              textAnchor="end"
              fontFamily={interFamily}
              fontSize={16}
              fontWeight={500}
              fill={INK_MUTED}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatTick(v)}
            </text>
          </g>
        );
      })}

      <line
        x1={padL}
        x2={W - padR}
        y1={padT + innerH}
        y2={padT + innerH}
        stroke={INK_FAINT}
        strokeWidth={1}
        opacity={chromeOp}
      />

      {/* Non-bold staircases */}
      {STAIRS.filter(({ spec }) => !spec.bold).map(({ spec, data }) => (
        <path
          key={spec.id}
          d={buildPath(data)}
          fill="none"
          stroke={INK_FAINT}
          strokeWidth={spec.strokeWidth}
          strokeDasharray={spec.dash}
          strokeLinecap="square"
          strokeLinejoin="miter"
          opacity={ghostOp}
        />
      ))}

      {/* GM staircase — chunky 10k–100k jumps, glow, jitter on slam */}
      {STAIRS.filter(({ spec }) => spec.bold).map(({ spec, data }) => (
        <g
          key={spec.id}
          transform={`translate(${gmJitterX}, ${gmJitterY})`}
          filter="url(#gm-glow)"
        >
          <path
            d={buildPath(data)}
            fill="none"
            stroke={INK}
            strokeWidth={spec.strokeWidth + payoff * 4 + slam * 3}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </g>
      ))}

      {/* End markers + labels */}
      {ends.map(({ spec, pos }) => {
        const isBold = !!spec.bold;
        if (!isBold) {
          if (ghostOp <= 0) return null;
          return (
            <g key={`end-${spec.id}`} opacity={ghostOp}>
              <circle cx={pos.x} cy={pos.y} r={4} fill={INK_FAINT} />
              <text
                x={pos.x + 14}
                y={pos.y + 5}
                fontFamily={interFamily}
                fontSize={16}
                fontWeight={600}
                fill={INK_MUTED}
              >
                {spec.label}
              </text>
            </g>
          );
        }
        const labelSize = 22 + payoff * 18;
        return (
          <g
            key={`end-${spec.id}`}
            transform={`translate(${gmJitterX}, ${gmJitterY})`}
          >
            <circle
              cx={pos.x}
              cy={pos.y}
              r={7 + payoff * 8 + slam * 3}
              fill={INK}
            />
            <text
              x={pos.x + 18}
              y={pos.y + (-2 - payoff * 6)}
              fontFamily={interFamily}
              fontSize={labelSize}
              fontWeight={800}
              fill={INK}
              letterSpacing="-0.02em"
            >
              {spec.label}
            </text>
            {/* Sub-label: the per-tx batch claim */}
            <text
              x={pos.x + 18}
              y={pos.y + 18 + payoff * 10}
              fontFamily={interFamily}
              fontSize={13 + payoff * 4}
              fontWeight={600}
              fill={INK_MUTED}
              letterSpacing={1.6}
              style={{ textTransform: "uppercase" }}
            >
              10k–100k trades / tx
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Ticker cards ─────────────────────────────────────────────────────────
const TickerRow: React.FC<{
  progress: number;
  appear: number;
  payoff: number;
  beatVal: number;
  slam: number;
}> = ({ progress, appear, payoff, beatVal, slam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "stretch",
        opacity: appear,
      }}
    >
      {STAIRS.map(({ spec, data }, i) => {
        const entryBeat = BEATS[Math.min(i, 4)];
        const entry = spring({
          frame: Math.max(0, frame - entryBeat),
          fps,
          config: { damping: 16, mass: 0.9, stiffness: 140 },
          durationInFrames: 22,
        });
        const value = valueAt(data, progress);
        const isBold = !!spec.bold;
        const cardOp = isBold ? 1 : 1 - payoff * 0.9;
        if (cardOp <= 0.02) return null;

        const pulseScale = isBold ? 1 + beatVal * 0.018 + slam * 0.03 : 1;
        const gmFlex = isBold ? 2 + payoff * 6 : 1;
        const display =
          isBold && value >= 10_000 ? Math.floor(value / 1000) * 1000 : value;

        return (
          <div
            key={spec.id}
            style={{
              flex: gmFlex,
              background: "#ffffff",
              border: `1px solid ${GRID}`,
              borderRadius: 16,
              padding: "18px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              opacity: entry * cardOp,
              transform: `translateY(${(1 - entry) * 24}px) scale(${pulseScale})`,
              transformOrigin: "50% 50%",
              boxShadow: isBold
                ? `0 ${6 + beatVal * 10 + payoff * 14}px ${28 + beatVal * 26 + payoff * 30}px rgba(14,15,12,${0.12 + beatVal * 0.14 + payoff * 0.18})`
                : "0 2px 10px rgba(14,15,12,0.05)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontFamily: interFamily,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 2.4,
                color: INK_MUTED,
                textTransform: "uppercase",
              }}
            >
              {spec.label}
            </div>
            <div
              style={{
                fontFamily: interFamily,
                fontSize: isBold ? 68 + payoff * 78 + slam * 8 : 34,
                fontWeight: isBold ? 900 : 700,
                letterSpacing: "-0.03em",
                color: INK,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt(display)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const TradeCountGraphs: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOp = interpolate(
    frame,
    [0, TITLE_IN_END, TITLE_HOLD_END, TITLE_OUT_END],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const titleLift = (1 - titleOp) * 6;

  const sceneOp = interpolate(frame, [SCENE_IN_START, SCENE_IN_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Chart progress 0..1, eased so early time is denser than late (lines show
  // their identity in the first half, GM keeps stepping in the second).
  const rawProgress = interpolate(frame, [DRAW_START, DRAW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = 1 - Math.pow(1 - rawProgress, 1.8);

  const payoff = interpolate(frame, [PAYOFF_START, PAYOFF_SLAM], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  const slam =
    frame < PAYOFF_SLAM ? 0 : Math.max(0, 1 - (frame - PAYOFF_SLAM) / 14);

  const anticip = interpolate(
    frame,
    [PAYOFF_SLAM - 8, PAYOFF_SLAM - 1, PAYOFF_SLAM],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const beatVal = beatPulse(frame);

  const stageFilter = `saturate(${1 + beatVal * 0.08 + slam * 0.15}) contrast(${1 + beatVal * 0.04 + slam * 0.12 + payoff * 0.04}) brightness(${1 + beatVal * 0.02 + slam * 0.05 - anticip * 0.03})`;
  const stageScale =
    1 + beatVal * 0.004 + slam * 0.012 - anticip * 0.006 + payoff * 0.003;

  const jx = slam * Math.sin(frame * 21.1 + 2.3) * 5;
  const jy = slam * Math.cos(frame * 17.7 + 1.1) * 5;

  return (
    <AbsoluteFill style={{ background: PAGE_BG, fontFamily: interFamily }}>
      <GrainOverlay />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 92% 72% at 50% 50%, transparent 38%, rgba(14,15,12,0.08) 80%, rgba(14,15,12,0.18) 100%)",
        }}
      />

      {titleOp > 0 ? (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: titleOp,
          }}
        >
          <div
            style={{
              fontSize: 120,
              fontWeight: 900,
              letterSpacing: "-0.035em",
              color: INK,
              lineHeight: 1,
              transform: `translateY(${titleLift}px)`,
              textAlign: "center",
              maxWidth: 1500,
            }}
          >
            Experience AGI-era trading
          </div>
        </AbsoluteFill>
      ) : null}

      {sceneOp > 0 ? (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "80px 100px 88px",
            opacity: sceneOp,
            gap: 40,
            justifyContent: "center",
            transform: `scale(${stageScale})`,
            transformOrigin: "50% 50%",
            filter: stageFilter,
          }}
        >
          <div style={{ flex: 1, minHeight: 0 }}>
            <Chart
              progress={progress}
              appear={sceneOp}
              payoff={payoff}
              slam={slam}
              gmJitterX={jx}
              gmJitterY={jy}
            />
          </div>
          <TickerRow
            progress={progress}
            appear={sceneOp}
            payoff={payoff}
            beatVal={beatVal}
            slam={slam}
          />
        </AbsoluteFill>
      ) : null}

      {slam > 0 ? (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background: "#ffffff",
            opacity: slam * 0.22,
            mixBlendMode: "screen",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const tradeCountGraphsMeta = {
  id: "TradeCountGraphs",
  component: TradeCountGraphs,
  durationInFrames: DURATION,
  fps: FPS,
  width: 1920,
  height: 1080,
};
