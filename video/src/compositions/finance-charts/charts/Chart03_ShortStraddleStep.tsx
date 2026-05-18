import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, gaussian, mulberry32 } from "../tokens";
import { Axis, AxisLabel, ChartFrame, PlotArea, Title } from "../primitives";

const SEED = 0x3c0fe;

const PLOT = {
  left: 130,
  top: 160,
  width: 1660,
  height: 780,
};

const Y_MIN = -5000;
const Y_MAX = 30000;
const N_DAYS = 365;

type Day = { i: number; daily: number; cumulative: number; isShock: boolean };

function buildSeries(): Day[] {
  const rng = mulberry32(SEED);
  const series: Day[] = [];
  let cum = 0;

  const shockIdx = new Set<number>([
    Math.floor(N_DAYS * 0.55),
    Math.floor(N_DAYS * 0.62),
    Math.floor(N_DAYS * 0.74),
  ]);

  for (let i = 0; i < N_DAYS; i++) {
    let daily: number;
    let isShock = false;
    if (shockIdx.has(i)) {
      daily = -(1500 + rng() * 1500);
      isShock = true;
    } else {
      const drift = 95;
      daily = drift + gaussian(rng, 0, 180);
      if (rng() < 0.05) daily -= 200 + rng() * 400;
    }
    cum += daily;
    series.push({ i, daily, cumulative: cum, isShock });
  }

  const finalCum = series[series.length - 1].cumulative;
  const target = 28500;
  const scale = target / finalCum;
  for (const d of series) {
    d.daily *= scale;
    d.cumulative *= scale;
  }
  return series;
}

const xToPx = (i: number) => (i / (N_DAYS - 1)) * PLOT.width;
const yToPx = (v: number) =>
  PLOT.height - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT.height;

const Y_TICKS = [-5000, 0, 5000, 10000, 15000, 20000, 25000, 30000].map(
  (v) => ({
    pos: yToPx(v),
    label: v.toLocaleString(),
  }),
);

const X_LABELS: { idx: number; label: string }[] = [
  { idx: Math.floor(N_DAYS * 0.04), label: "April" },
  { idx: Math.floor(N_DAYS * 0.27), label: "July" },
  { idx: Math.floor(N_DAYS * 0.5), label: "October" },
  { idx: Math.floor(N_DAYS * 0.72), label: "2026" },
  { idx: Math.floor(N_DAYS * 0.96), label: "April" },
];

const X_TICKS = X_LABELS.map((l) => ({ pos: xToPx(l.idx), label: l.label }));

const ZERO_Y = yToPx(0);
const BAR_W = Math.max(2, PLOT.width / N_DAYS - 1);

function barColor(daily: number, isShock: boolean): string {
  if (isShock) return C.redDeep;
  if (daily > 0) {
    const t = Math.min(1, daily / 600);
    return `rgba(91, 155, 213, ${0.55 + t * 0.4})`;
  }
  const t = Math.min(1, Math.abs(daily) / 600);
  return `rgba(216, 80, 80, ${0.6 + t * 0.35})`;
}

export const Chart03: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [135, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);
  const reveal = interpolate(frame, [0, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const series = React.useMemo(buildSeries, []);

  const stepCount = Math.max(1, Math.floor(series.length * reveal));
  const stepPath = React.useMemo(() => {
    if (stepCount < 1) return "";
    const parts: string[] = [];
    const first = series[0];
    parts.push(`M ${xToPx(first.i).toFixed(2)} ${yToPx(0).toFixed(2)}`);
    let prevY = yToPx(0);
    for (let k = 0; k < stepCount; k++) {
      const d = series[k];
      const x = xToPx(d.i);
      const y = yToPx(d.cumulative);
      parts.push(`L ${x.toFixed(2)} ${prevY.toFixed(2)}`);
      parts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
      prevY = y;
    }
    return parts.join(" ");
  }, [series, stepCount]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        <Title
          text="BTC Short Weekly Straddle | 16h - 13h on Weekdays | $80k Notional Size"
          subtitle="Source: Thalex | 19 Mar 2025 - 08 May 2026"
          y={56}
          size={24}
        />

        <PlotArea
          left={PLOT.left}
          top={PLOT.top}
          width={PLOT.width}
          height={PLOT.height}
        >
          {Y_TICKS.map((t, i) => (
            <line
              key={`gy-${i}`}
              x1={0}
              x2={PLOT.width}
              y1={t.pos}
              y2={t.pos}
              stroke={t.label === "0" ? C.inkFaint : C.grid}
              strokeWidth={1}
            />
          ))}

          {series.map((d, i) => {
            if (i >= stepCount) return null;
            const x = xToPx(d.i);
            const h = Math.max(1, Math.abs(d.daily) * 0.014);
            const y = d.daily >= 0 ? ZERO_Y - h : ZERO_Y;
            return (
              <rect
                key={i}
                x={x - BAR_W / 2}
                y={y}
                width={BAR_W}
                height={h}
                fill={barColor(d.daily, d.isShock)}
              />
            );
          })}

          <path
            d={stepPath}
            stroke={C.blue}
            strokeWidth={1.8}
            fill="none"
            strokeLinejoin="miter"
            strokeLinecap="butt"
          />

          <Axis
            orientation="bottom"
            ticks={X_TICKS}
            length={PLOT.width}
            offset={PLOT.height}
          />
          <Axis orientation="left" ticks={Y_TICKS} length={PLOT.height} />
        </PlotArea>

        <AxisLabel
          text="PnL"
          x={PLOT.left - 78}
          y={PLOT.top + PLOT.height / 2}
          rotate={-90}
        />
      </ChartFrame>
    </AbsoluteFill>
  );
};
