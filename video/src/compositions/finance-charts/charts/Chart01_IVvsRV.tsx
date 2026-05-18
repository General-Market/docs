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

type Point = { iv: number; rv: number; diff: number };

function buildPoints(): Point[] {
  const rng = mulberry32(SEED);
  const pts: Point[] = [];
  for (let i = 0; i < 570; i++) {
    const cluster = rng();
    let iv: number;
    if (cluster < 0.72) {
      iv = 0.32 + gaussian(rng, 0, 0.07);
    } else if (cluster < 0.92) {
      iv = 0.5 + gaussian(rng, 0, 0.09);
    } else {
      iv = 0.7 + gaussian(rng, 0, 0.08);
    }
    iv = Math.max(0.26, Math.min(0.88, iv));

    const expected = 0.85 * iv + 0.05;
    const sigma = 0.07 + 0.05 * (iv - 0.3);
    let rv = expected + gaussian(rng, 0, sigma);
    rv = Math.max(0.2, Math.min(0.9, rv));

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

  const diagX1 = xToPx(Math.max(X_MIN, Y_MIN));
  const diagY1 = yToPx(Math.max(X_MIN, Y_MIN));
  const diagX2 = xToPx(Math.min(X_MAX, Y_MAX));
  const diagY2 = yToPx(Math.min(X_MAX, Y_MAX));
  const diagDx = diagX2 - diagX1;
  const diagDy = diagY2 - diagY1;

  const cbStops = DIVERGING_BLUE_RED.map((s) => ({
    t: (s.stop - -0.4) / (0.2 - -0.4),
    color: s.color,
  }));

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        <Title
          text="BTCUSD 7-day ATM IV vs Forward RV"
          subtitle="Daily 8:00 UTC samples | 2024-10-08 to 2026-04-29"
          y={56}
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
              stroke={C.grid}
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
              stroke={C.grid}
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
            const color = divergingColor(-p.diff, -0.4, 0.2);
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={2.5}
                fill={color}
                fillOpacity={0.85 * a}
                stroke={C.bg}
                strokeWidth={0.5}
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
          y={200}
          width={14}
          height={240}
          stops={cbStops}
          ticks={[
            { t: 1, label: "+20%" },
            { t: (0 - -0.4) / 0.6, label: "0%" },
            { t: (-0.2 - -0.4) / 0.6, label: "-20%" },
            { t: 0, label: "-40%" },
          ]}
          title="IV − forward RV"
        />
      </ChartFrame>
    </AbsoluteFill>
  );
};
