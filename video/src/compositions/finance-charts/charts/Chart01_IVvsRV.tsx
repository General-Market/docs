import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  C,
  DIVERGING_BLUE_RED,
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

const SEED = 0x1f01a;

const PLOT = {
  left: 130,
  top: 160,
  width: 1380,
  height: 780,
};

const X_MIN = 0.25;
const X_MAX = 0.92;
const Y_MIN = 0.18;
const Y_MAX = 0.92;

const DIFF_MIN = -0.4;
const DIFF_MAX = 0.2;

type Point = { iv: number; rv: number; diff: number };

function buildPoints(): Point[] {
  const rng = mulberry32(SEED);
  const pts: Point[] = [];
  for (let i = 0; i < 570; i++) {
    const cluster = rng();
    let iv: number;
    if (cluster < 0.78) {
      // Bulk cluster: IV 30–55%
      iv = 0.42 + gaussian(rng, 0, 0.07);
    } else if (cluster < 0.95) {
      // Mid-high tail: IV 50–70%
      iv = 0.58 + gaussian(rng, 0, 0.07);
    } else {
      // Sparse high IV tail up to ~80%
      iv = 0.72 + gaussian(rng, 0, 0.05);
    }
    iv = Math.max(0.26, Math.min(0.82, iv));

    // Most points: RV slightly below IV (positive diff = blue, IV > RV)
    // A small outlier set: RV well above IV (negative diff = red, top-left)
    const isOutlier = rng() < 0.06;
    let rv: number;
    if (isOutlier) {
      // Top-left outliers: low/medium IV, high RV
      const ivOutlier = Math.min(iv, 0.55);
      const lift = 0.18 + Math.abs(gaussian(rng, 0, 0.08));
      rv = Math.min(0.9, ivOutlier + lift);
      pts.push({ iv: ivOutlier, rv, diff: ivOutlier - rv });
      continue;
    }

    // Bulk: RV concentrates slightly below IV, with mild noise.
    const expected = iv - 0.04;
    const sigma = 0.05 + 0.03 * (iv - 0.3);
    rv = expected + gaussian(rng, 0, sigma);
    rv = Math.max(0.2, Math.min(0.88, rv));

    pts.push({ iv, rv, diff: iv - rv });
  }
  return pts;
}

const xToPx = (v: number) =>
  ((v - X_MIN) / (X_MAX - X_MIN)) * PLOT.width;
const yToPx = (v: number) =>
  PLOT.height - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT.height;

const X_TICKS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((v) => ({
  pos: xToPx(v),
  label: `${Math.round(v * 100)}%`,
}));

const Y_TICKS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((v) => ({
  pos: yToPx(v),
  label: `${Math.round(v * 100)}%`,
}));

export const Chart01: React.FC = () => {
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

  const points = React.useMemo(buildPoints, []);
  const dashReveal = interpolate(frame, [6, 38], [0, 1], {
    extrapolateRight: "clamp",
  });

  // IV = RV diagonal from (X_MIN, X_MIN) to (X_MAX, X_MAX), clipped to plot bounds.
  const diagLo = Math.max(X_MIN, Y_MIN);
  const diagHi = Math.min(X_MAX, Y_MAX);
  const diagX1 = xToPx(diagLo);
  const diagY1 = yToPx(diagLo);
  const diagX2 = xToPx(diagHi);
  const diagY2 = yToPx(diagHi);
  const diagDx = diagX2 - diagX1;
  const diagDy = diagY2 - diagY1;

  const cbStops = DIVERGING_BLUE_RED.map((s) => ({
    t: (s.stop - DIFF_MIN) / (DIFF_MAX - DIFF_MIN),
    color: s.color,
  }));

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        <Title
          text="BTCUSD 7-day ATM IV vs Forward RV"
          subtitle="Daily 8:00 UTC samples | 2024-10-08 to 2026-04-29"
          y={24}
          size={18}
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
              stroke={C.gridFaint}
              strokeWidth={1}
            />
          ))}
          {X_TICKS.map((t, i) => (
            <line
              key={`gx-${i}`}
              x1={t.pos}
              x2={t.pos}
              y1={0}
              y2={PLOT.height}
              stroke={C.gridFaint}
              strokeWidth={1}
            />
          ))}

          <line
            x1={diagX1}
            y1={diagY1}
            x2={diagX1 + diagDx * dashReveal}
            y2={diagY1 + diagDy * dashReveal}
            stroke={C.white}
            strokeWidth={1.2}
            strokeDasharray="6 6"
            opacity={0.85}
          />

          {points.map((p, i) => {
            const appearAt = (i / points.length) * 0.85;
            const local = (reveal - appearAt) / 0.15;
            const a = Math.max(0, Math.min(1, local));
            if (a <= 0) return null;
            const cx = xToPx(p.iv);
            const cy = yToPx(p.rv);
            // Positive diff (IV > RV) → blue (matches legend top).
            const color = divergingColor(p.diff, DIFF_MIN, DIFF_MAX);
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={3.5}
                fill={color}
                fillOpacity={0.92 * a}
                stroke={C.bg}
                strokeWidth={0.4}
              />
            );
          })}

          <Axis
            orientation="bottom"
            ticks={X_TICKS}
            length={PLOT.width}
            offset={PLOT.height}
          />
          <Axis orientation="left" ticks={Y_TICKS} length={PLOT.height} />
        </PlotArea>

        <AxisLabel
          text="7-day ATM implied volatility"
          x={PLOT.left + PLOT.width / 2}
          y={PLOT.top + PLOT.height + 56}
        />
        <AxisLabel
          text="Forward 7-day realized volatility"
          x={PLOT.left - 78}
          y={PLOT.top + PLOT.height / 2}
          rotate={-90}
        />

        <VerticalColorBar
          x={1620}
          y={180}
          width={12}
          height={180}
          stops={cbStops}
          ticks={[
            { t: 1, label: "+20%" },
            { t: (0 - DIFF_MIN) / (DIFF_MAX - DIFF_MIN), label: "0%" },
            { t: (-0.2 - DIFF_MIN) / (DIFF_MAX - DIFF_MIN), label: "-20%" },
            { t: 0, label: "-40%" },
          ]}
          title="IV − forward RV"
        />
      </ChartFrame>
    </AbsoluteFill>
  );
};
