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

const N_POINTS = 900;
const PRICE_MIN = 64000;
const PRICE_MAX = 82000;
const PRICE_START = 66000;
const PRICE_END = 81000;
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
  const plotTop = 210;
  const plotWidth = 1500;
  const plotHeight = 720;

  const points = React.useMemo<Pt[]>(() => {
    const rng = mulberry32(60614);
    const pts: Pt[] = [];

    // Brownian-style walk with positive drift from PRICE_START to PRICE_END.
    const drift = (PRICE_END - PRICE_START) / (N_POINTS - 1);
    const sigma = 250;

    let price = PRICE_START;
    const raw: number[] = [];
    for (let i = 0; i < N_POINTS; i++) {
      if (i > 0) {
        price += drift + gaussian(rng, 0, sigma);
      }
      // Soft clamp inside the visible band.
      price = Math.max(PRICE_MIN + 400, Math.min(PRICE_MAX - 400, price));
      raw.push(price);
    }

    // Rescale so endpoints match the source exactly (66k -> 81k) without
    // killing the local volatility — anchor start/end, distribute residual.
    const targetStart = PRICE_START;
    const targetEnd = PRICE_END;
    const observedStart = raw[0];
    const observedEnd = raw[N_POINTS - 1];
    const slope =
      (targetEnd - targetStart - (observedEnd - observedStart)) /
      (N_POINTS - 1);

    for (let i = 0; i < N_POINTS; i++) {
      const adjusted =
        raw[i] + slope * i + (targetStart - observedStart);
      const t = i / (N_POINTS - 1);

      // IV inversely correlates with price: low price -> red (ivT high).
      // blueRedRamp(0) = blue, blueRedRamp(1) = red.
      const normalizedPrice =
        (adjusted - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
      const ivClean =
        IV_MAX - (IV_MAX - IV_MIN) * normalizedPrice;
      const ivNoise = gaussian(rng, 0, 0.008);
      const iv = Math.max(IV_MIN, Math.min(IV_MAX, ivClean + ivNoise));

      pts.push({ x: t, y: adjusted, iv });
    }
    return pts;
  }, []);

  const xAt = (t: number) => t * plotWidth;
  const yAt = (p: number) =>
    plotHeight - ((p - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * plotHeight;

  const yTicks: { pos: number; label: string }[] = [];
  for (let v = PRICE_MIN; v <= PRICE_MAX; v += 2000) {
    yTicks.push({
      pos: yAt(v),
      label: v.toLocaleString("en-US"),
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
          y={44}
          size={24}
        />

        <PlotArea
          left={plotLeft}
          top={plotTop}
          width={plotWidth}
          height={plotHeight}
        >
          {points.slice(0, visibleCount).map((p, i) => {
            const normalizedPrice =
              (p.y - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
            const ivT = 1 - normalizedPrice;
            const color = blueRedRamp(ivT);
            return (
              <circle
                key={i}
                cx={xAt(p.x)}
                cy={yAt(p.y)}
                r={4.0}
                fill={color}
                stroke={C.bg}
                strokeWidth={0.4}
                opacity={0.9}
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
          x={plotLeft + plotWidth - 280}
          y={100}
          width={260}
          height={8}
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
