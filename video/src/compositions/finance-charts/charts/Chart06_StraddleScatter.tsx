import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, blueRedRamp, gaussian, mulberry32 } from "../tokens";
import {
  Axis,
  AxisLabel,
  ChartFrame,
  HorizontalColorBar,
  PlotArea,
  Title,
} from "../primitives";

const N_POINTS = 800;
const PRICE_MIN = 64000;
const PRICE_MAX = 82000;
const IV_MIN = 0.358;
const IV_MAX = 0.494;

const X_LABELS = [
  { t: 0.02, label: "Mar 29" },
  { t: 0.2, label: "Apr 05" },
  { t: 0.38, label: "Apr 12" },
  { t: 0.56, label: "Apr 19" },
  { t: 0.74, label: "Apr 26" },
  { t: 0.95, label: "May 03" },
];

type Pt = { x: number; y: number; iv: number };

export const Chart06: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [135, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const reveal = interpolate(frame, [10, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const plotLeft = 130;
  const plotTop = 220;
  const plotWidth = 1500;
  const plotHeight = 720;

  const points = React.useMemo<Pt[]>(() => {
    const rng = mulberry32(60614);
    const pts: Pt[] = [];
    let price = 66000;
    for (let i = 0; i < N_POINTS; i++) {
      const t = i / (N_POINTS - 1);
      const drift = 14500 * t;
      const wave = 1800 * Math.sin(t * Math.PI * 3.2);
      const noise = gaussian(rng, 0, 600);
      price = 66000 + drift + wave + noise;
      price = Math.max(PRICE_MIN + 200, Math.min(PRICE_MAX - 200, price));

      const ivBase = IV_MAX - (IV_MAX - IV_MIN) * t;
      const ivNoise = gaussian(rng, 0, 0.015);
      const iv = Math.max(IV_MIN, Math.min(IV_MAX, ivBase + ivNoise));

      pts.push({ x: t, y: price, iv });
    }
    return pts;
  }, []);

  const xAt = (t: number) => t * plotWidth;
  const yAt = (p: number) =>
    plotHeight - ((p - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * plotHeight;

  const yTicks = [];
  for (let v = PRICE_MIN; v <= PRICE_MAX; v += 2000) {
    yTicks.push({
      pos: yAt(v),
      label: `$${(v / 1000).toFixed(0)}k`,
    });
  }

  const xTicks = X_LABELS.map((l) => ({
    pos: xAt(l.t),
    label: l.label,
  }));

  const visibleCount = Math.floor(points.length * reveal);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <ChartFrame opacity={opacity}>
        <Title
          text="BTC-29MAY26-STRADDLE"
          subtitle="27 Mar 26 08:00 - 05 May 26 15:00"
          y={48}
        />

        <PlotArea
          left={plotLeft}
          top={plotTop}
          width={plotWidth}
          height={plotHeight}
        >
          {yTicks.map((t, i) => (
            <line
              key={`g-${i}`}
              x1={0}
              x2={plotWidth}
              y1={t.pos}
              y2={t.pos}
              stroke={C.gridFaint}
              strokeWidth={1}
            />
          ))}

          {points.slice(0, visibleCount).map((p, i) => {
            const ivT = (p.iv - IV_MIN) / (IV_MAX - IV_MIN);
            const color = blueRedRamp(ivT);
            return (
              <circle
                key={i}
                cx={xAt(p.x)}
                cy={yAt(p.y)}
                r={2.8}
                fill={color}
                opacity={0.85}
              />
            );
          })}

          <Axis
            orientation="left"
            ticks={yTicks}
            length={plotHeight}
            offset={0}
          />
          <Axis
            orientation="bottom"
            ticks={xTicks}
            length={plotWidth}
            offset={plotHeight}
          />
        </PlotArea>

        <AxisLabel
          text="Index Price (Close)"
          x={42}
          y={plotTop + plotHeight / 2}
          rotate={-90}
        />
        <AxisLabel
          text="Date (UTC)"
          x={plotLeft + plotWidth / 2}
          y={plotTop + plotHeight + 56}
        />

        <HorizontalColorBar
          x={1370}
          y={130}
          width={260}
          height={10}
          title="Implied volatility"
          leftLabel="35.8%"
          rightLabel="49.4%"
          stops={[
            { t: 0, color: "#3F7FBB" },
            { t: 0.5, color: "#F5F5F5" },
            { t: 1, color: "#D85050" },
          ]}
        />
      </ChartFrame>
    </AbsoluteFill>
  );
};
