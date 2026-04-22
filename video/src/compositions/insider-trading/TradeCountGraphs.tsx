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

// ─── Beats ─── frame anchors, ~120 BPM (beat every 15 frames at 30fps).
// Ticker cards enter on beats 0..4; chart pulses on every beat.
const BEATS = [30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210];

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ─── Line model ───
// One day of cumulative trades. Five lines, all starting at (0, 0).
// X = time elapsed in the day; 0 → X_MAX = one day.
const X_MAX = 100;

type LineSpec = {
  id: string;
  label: string;
  fn: (x: number) => number;
  strokeWidth: number;
  dash?: string;
  bold?: boolean;
};

const LINES: LineSpec[] = [
  {
    id: "predictions",
    label: "Predictions",
    fn: (x) => x * 1.8,
    strokeWidth: 2.5,
    dash: "2 9",
  },
  {
    id: "perps",
    label: "Perps",
    fn: (x) => x * 3.4,
    strokeWidth: 2.5,
    dash: "8 10",
  },
  {
    id: "options",
    label: "Options",
    fn: (x) => x * 5.2,
    strokeWidth: 2.5,
  },
  {
    id: "memecoins",
    label: "Memecoins",
    fn: (x) => x * 8.7,
    strokeWidth: 2.5,
    dash: "14 4",
  },
  {
    id: "gm",
    label: "General Market",
    fn: (x) => Math.pow(x / X_MAX, 1.5) * 10_000_000,
    strokeWidth: 5,
    bold: true,
  },
];

const MIN_X = 0.25;

const samplePoints = (
  fn: (x: number) => number,
  currentMaxX: number,
  n: number,
): Array<[number, number]> => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * currentMaxX;
    pts.push([x, fn(x)]);
  }
  return pts;
};

const fmt = (n: number): string => {
  if (n >= 1_000_000) return n.toLocaleString("en-US");
  return Math.round(n).toLocaleString("en-US");
};

const formatAxis = (v: number): string => {
  if (v <= 0.5) return "0";
  if (v >= 1_000_000)
    return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${Math.round(v)}`;
};

// Most-recent beat → 0..1 pulse that decays over 8 frames.
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

// ─── Paper-grain via SVG turbulence, reseeded every frame so it crawls. ─
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

// ─── Chart ───
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
  const padL = 96;
  const padR = 300;
  const padT = 40;
  const padB = 48;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const drawMaxX = Math.max(MIN_X * 0.4, progress * X_MAX);

  const sampled = LINES.map((l) => ({
    spec: l,
    points: samplePoints(l.fn, drawMaxX, 90),
  }));

  const yMax = Math.max(
    1,
    ...sampled.map((s) => s.points[s.points.length - 1][1]),
  );

  const toSvg = (p: [number, number]): { x: number; y: number } => ({
    x: padL + (p[0] / X_MAX) * innerW,
    y: padT + innerH - (p[1] / yMax) * innerH,
  });

  const mkPath = (pts: Array<[number, number]>): string =>
    pts
      .map((p, i) => {
        const s = toSvg(p);
        return `${i === 0 ? "M" : "L"}${s.x},${s.y}`;
      })
      .join(" ");

  const yTicks = [0, yMax * 0.5, yMax];

  // Axis/tick dim during payoff — the chart becomes the GM line alone.
  const chromeOp = 1 - payoff * 0.55;
  const ghostOp = 1 - payoff * 0.94;

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
          <feGaussianBlur stdDeviation={1.2 + payoff * 5 + slam * 6} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {yTicks.map((v, i) => {
        const y = padT + innerH - (v / yMax) * innerH;
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
              x={padL - 16}
              y={y + 6}
              textAnchor="end"
              fontFamily={interFamily}
              fontSize={16}
              fontWeight={500}
              fill={INK_MUTED}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatAxis(v)}
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

      {/* Non-bold lines — dim to nothing in payoff */}
      {sampled
        .filter(({ spec }) => !spec.bold)
        .map(({ spec, points }) => (
          <path
            key={spec.id}
            d={mkPath(points)}
            fill="none"
            stroke={INK_FAINT}
            strokeWidth={spec.strokeWidth}
            strokeDasharray={spec.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={ghostOp}
          />
        ))}

      {/* GM line — thickens and glows through payoff, jitters on slam */}
      {sampled
        .filter(({ spec }) => spec.bold)
        .map(({ spec, points }) => (
          <g
            key={spec.id}
            transform={`translate(${gmJitterX}, ${gmJitterY})`}
            filter="url(#gm-glow)"
          >
            <path
              d={mkPath(points)}
              fill="none"
              stroke={INK}
              strokeWidth={spec.strokeWidth + payoff * 4 + slam * 3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

      {/* End labels */}
      {sampled.map(({ spec, points }) => {
        const end = toSvg(points[points.length - 1]);
        const isBold = !!spec.bold;
        if (!isBold) {
          if (ghostOp <= 0) return null;
          return (
            <g key={`end-${spec.id}`} opacity={ghostOp}>
              <circle cx={end.x} cy={end.y} r={4} fill={INK_FAINT} />
              <text
                x={end.x + 14}
                y={end.y + 5}
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
              cx={end.x}
              cy={end.y}
              r={7 + payoff * 8 + slam * 3}
              fill={INK}
            />
            <text
              x={end.x + 18}
              y={end.y + (-2 - payoff * 6)}
              fontFamily={interFamily}
              fontSize={labelSize}
              fontWeight={800}
              fill={INK}
              letterSpacing="-0.02em"
            >
              {spec.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Ticker cards — beat-staggered spring entry, GM card swells in payoff.
const TickerRow: React.FC<{
  progress: number;
  appear: number;
  payoff: number;
  beatVal: number;
  slam: number;
}> = ({ progress, appear, payoff, beatVal, slam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMaxX = progress * X_MAX;

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "stretch",
        opacity: appear,
      }}
    >
      {LINES.map((l, i) => {
        const entryBeat = BEATS[Math.min(i, 4)];
        const entry = spring({
          frame: Math.max(0, frame - entryBeat),
          fps,
          config: { damping: 16, mass: 0.9, stiffness: 140 },
          durationInFrames: 22,
        });
        const value =
          l.id === "gm"
            ? Math.floor(l.fn(currentMaxX) / 10_000) * 10_000
            : Math.floor(l.fn(currentMaxX));
        const isBold = !!l.bold;
        const cardOp = isBold ? 1 : 1 - payoff * 0.9;
        if (cardOp <= 0.02) return null;

        const pulseScale = isBold ? 1 + beatVal * 0.018 + slam * 0.03 : 1;
        const gmFlex = isBold ? 2 + payoff * 6 : 1;

        return (
          <div
            key={l.id}
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
              {l.label}
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
              {fmt(value)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const TradeCountGraphs: React.FC = () => {
  const frame = useCurrentFrame();

  // Title
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

  // Chart draw + camera pull-back — pushed harder than before.
  const rawProgress = interpolate(frame, [DRAW_START, DRAW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = 1 - Math.pow(1 - rawProgress, 2.2);

  // Payoff ramp 0→1 from PAYOFF_START → PAYOFF_SLAM.
  const payoff = interpolate(frame, [PAYOFF_START, PAYOFF_SLAM], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  // Terminal slam — single impulse at PAYOFF_SLAM, decays over 14 frames.
  const slam =
    frame < PAYOFF_SLAM
      ? 0
      : Math.max(0, 1 - (frame - PAYOFF_SLAM) / 14);

  // Pre-slam anticipation — a tiny dip just before the impulse, so the slam
  // reads as a release and not as a jump from nowhere.
  const anticip = interpolate(
    frame,
    [PAYOFF_SLAM - 8, PAYOFF_SLAM - 1, PAYOFF_SLAM],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const beatVal = beatPulse(frame);

  // Stage-wide: breathe on beats, flash on slam, micro-scale on impulse.
  const stageFilter = `saturate(${1 + beatVal * 0.08 + slam * 0.15}) contrast(${1 + beatVal * 0.04 + slam * 0.12 + payoff * 0.04}) brightness(${1 + beatVal * 0.02 + slam * 0.05 - anticip * 0.03})`;
  const stageScale =
    1 + beatVal * 0.004 + slam * 0.012 - anticip * 0.006 + payoff * 0.003;

  // GM-line jitter on slam only — chart is sharpest before impact, shakes on.
  const jx = slam * Math.sin(frame * 21.1 + 2.3) * 5;
  const jy = slam * Math.cos(frame * 17.7 + 1.1) * 5;

  return (
    <AbsoluteFill
      style={{
        background: PAGE_BG,
        fontFamily: interFamily,
      }}
    >
      {/* Paper grain — crawls every frame */}
      <GrainOverlay />

      {/* Vignette — keeps focus centred, darkens corners subtly */}
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

      {/* Slam flash — white bloom over everything on the impulse frame */}
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
