import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  C,
  FONT_TEXT,
  divergingColor,
  gaussian,
  mulberry32,
} from "../tokens";
import {
  Axis,
  AxisLabel,
  ChartFrame,
  PlotArea,
  Title,
  VerticalColorBar,
} from "../primitives";

const SEED = 0x12c0fe;
const N = 50;

const PLOT = {
  left: 110,
  top: 150,
  width: 1500,
  height: 800,
};

const Y_MIN = -20000;
const Y_MAX = 60000;
const Y_TICKS = [-20000, -10000, 0, 10000, 20000, 30000, 40000, 50000, 60000];

const SHORT_PNL_MIN = -15000;
const SHORT_PNL_MAX = 5000;

const MONTHS = [
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
  "JAN",
  "FEB",
];

function buildExpiries(): string[] {
  const out: string[] = [];
  let day = 14;
  let monthIdx = 0;
  let year = 25;
  for (let i = 0; i < N; i++) {
    out.push(`${String(day).padStart(2, "0")}${MONTHS[monthIdx]}${year}`);
    day += 7;
    if (day > 28) {
      day -= 28;
      monthIdx += 1;
      if (monthIdx >= MONTHS.length) {
        monthIdx = 0;
        year += 1;
      }
    }
  }
  return out;
}

type Bar = { label: string; pnl: number; cum: number };

function buildBars(): Bar[] {
  const rng = mulberry32(SEED);
  const labels = buildExpiries();
  const bars: Bar[] = [];
  let cum = 0;
  for (let i = 0; i < N; i++) {
    let pnl = 700 + gaussian(rng, 0, 900);
    // Three vol-explosion losses.
    if (i === 14) pnl = -3500;
    if (i === 32) pnl = -2800;
    if (i === 46) pnl = -18000;
    cum += pnl;
    bars.push({ label: labels[i], pnl, cum });
  }

  // Force the ending near +50k and the dip near +25k by smoothing.
  // The dramatic dip is already planted at i=46; nudge the rest to land cleanly.
  const targetEnd = 50000;
  const drift = (targetEnd - cum) / N;
  let running = 0;
  for (let i = 0; i < N; i++) {
    if (i !== 14 && i !== 32 && i !== 46) {
      bars[i].pnl += drift;
    }
    running += bars[i].pnl;
    bars[i].cum = running;
  }

  return bars;
}

const xPos = (i: number) => ((i + 0.5) / N) * PLOT.width;
const yPos = (v: number) =>
  PLOT.height - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT.height;

const BAR_W = (PLOT.width / N) * 0.7;

export const Chart12: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [135, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const reveal = interpolate(frame, [10, 70], [0, 1], {
    extrapolateRight: "clamp",
  });

  const bars = React.useMemo(buildBars, []);

  const yTicks = Y_TICKS.map((v) => ({
    pos: yPos(v),
    label:
      v === 0
        ? "0"
        : v < 0
          ? `−${Math.abs(v / 1000)}k`
          : `+${v / 1000}k`,
  }));

  const visibleCount = Math.floor(reveal * N);
  let stepPath = "";
  if (visibleCount >= 1) {
    const startY = yPos(0);
    stepPath = `M ${xPos(0) - BAR_W / 2} ${startY}`;
    for (let i = 0; i < visibleCount; i++) {
      const x = xPos(i);
      const y = yPos(bars[i].cum);
      stepPath += ` L ${x} ${i === 0 ? startY : yPos(bars[i - 1].cum)}`;
      stepPath += ` L ${x} ${y}`;
    }
    if (visibleCount > 0) {
      stepPath += ` L ${xPos(visibleCount - 1) + BAR_W / 2} ${yPos(bars[visibleCount - 1].cum)}`;
    }
  }

  const cbStops = [
    { t: 0, color: "#9B1717" },
    { t: 0.25, color: "#D85050" },
    { t: 0.5, color: "#F5F5F5" },
    { t: 0.75, color: "#9CC1DD" },
    { t: 1, color: "#3F7FBB" },
  ];

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        <Title
          text="1W Straddle Sold Each Friday 8AM UTC"
          subtitle="Source: Thalex | 07 Mar 2025 - 13 Mar 2026"
          y={48}
        />

        <PlotArea
          left={PLOT.left}
          top={PLOT.top}
          width={PLOT.width}
          height={PLOT.height}
        >
          {yTicks.map((t, i) => {
            const isZero = Y_TICKS[i] === 0;
            return (
              <line
                key={`gy-${i}`}
                x1={0}
                x2={PLOT.width}
                y1={t.pos}
                y2={t.pos}
                stroke={isZero ? C.inkFaint : C.grid}
                strokeWidth={1}
                opacity={isZero ? 0.6 : 1}
              />
            );
          })}

          {bars.map((b, i) => {
            const appearAt = (i / N) * 0.85;
            const local = (reveal - appearAt) / 0.15;
            const a = Math.max(0, Math.min(1, local));
            if (a <= 0) return null;

            const zeroY = yPos(0);
            const endY = yPos(b.pnl);
            const animEndY = zeroY + (endY - zeroY) * a;
            const y = Math.min(zeroY, animEndY);
            const h = Math.abs(animEndY - zeroY);

            const t = (b.pnl - SHORT_PNL_MIN) / (SHORT_PNL_MAX - SHORT_PNL_MIN);
            // Map to divergingColor space: -0.4..0.2 from t (0..1) inverted
            // (negative → red on the left, positive → blue on the right).
            const dv = -0.4 + t * 0.6;
            const fill = divergingColor(dv, -0.4, 0.2);

            return (
              <rect
                key={`b-${i}`}
                x={xPos(i) - BAR_W / 2}
                y={y}
                width={BAR_W}
                height={Math.max(0.5, h)}
                fill={fill}
                opacity={0.9}
              />
            );
          })}

          <path
            d={stepPath}
            stroke={C.white}
            strokeWidth={1.5}
            fill="none"
            strokeLinejoin="miter"
            opacity={0.95}
          />

          <Axis orientation="left" ticks={yTicks} length={PLOT.height} />
          <line
            x1={0}
            x2={PLOT.width}
            y1={PLOT.height}
            y2={PLOT.height}
            stroke={C.inkFaint}
            strokeWidth={1}
          />
        </PlotArea>

        {bars.map((b, i) => (
          <div
            key={`xt-${i}`}
            style={{
              position: "absolute",
              left: PLOT.left + xPos(i),
              top: PLOT.top + PLOT.height + 12,
              transform: "translate(-50%, 0) rotate(-65deg)",
              transformOrigin: "left top",
              color: C.inkDim,
              fontFamily: FONT_TEXT,
              fontSize: 9.5,
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
            }}
          >
            {b.label}
          </div>
        ))}

        <AxisLabel
          text="PnL"
          x={PLOT.left - 70}
          y={PLOT.top + PLOT.height / 2}
          rotate={-90}
        />
        <AxisLabel
          text="expiry"
          x={PLOT.left + PLOT.width / 2}
          y={PLOT.top + PLOT.height + 110}
        />

        <VerticalColorBar
          x={1700}
          y={PLOT.top + 60}
          width={14}
          height={PLOT.height - 140}
          title="short_pnl"
          stops={cbStops}
          ticks={[
            { t: 0, label: "−15k" },
            { t: 0.25, label: "−10k" },
            { t: 0.5, label: "−5k" },
            { t: 0.75, label: "0" },
            { t: 1, label: "+5k" },
          ]}
        />
      </ChartFrame>
    </AbsoluteFill>
  );
};
