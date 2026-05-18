import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT_TEXT } from "../tokens";
import {
  Axis,
  AxisLabel,
  ChartFrame,
  PlotArea,
  Title,
} from "../primitives";

const DTE_TICKS = [7, 14, 21, 42, 133, 224];
const Y_MIN = 0.2;
const Y_MAX = 1.1;
const POWER = 0.32;
const N_SAMPLES = 200;

const BAND_COLORS = {
  minMax: "#8B1A1A",
  p10p90: "#C53A2C",
  p25p75: "#E97A5E",
  median: "#F5C8B0",
  iv: "#FCEBD8",
  rv: "#6E8FCC",
};

type BandParams = {
  aUpper: number;
  bUpper: number;
  aLower: number;
  bLower: number;
};

const BAND_PARAMS: Record<"minMax" | "p10p90" | "p25p75" | "median", BandParams> = {
  minMax: { aUpper: 1.05, bUpper: 0.18, aLower: -0.55, bLower: 0.36 },
  p10p90: { aUpper: 0.55, bUpper: 0.22, aLower: -0.3, bLower: 0.38 },
  p25p75: { aUpper: 0.3, bUpper: 0.27, aLower: -0.15, bLower: 0.42 },
  median: { aUpper: 0.12, bUpper: 0.31, aLower: 0.18, bLower: 0.32 },
};

type Band = {
  upper: number[];
  lower: number[];
};

export const Chart05: React.FC = () => {
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
  const lineReveal = interpolate(frame, [40, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const plotLeft = 140;
  const plotTop = 120;
  const plotWidth = 1620;
  const plotHeight = 860;

  const dteMin = DTE_TICKS[0];
  const dteMax = DTE_TICKS[DTE_TICKS.length - 1];
  const logMin = Math.log(dteMin);
  const logMax = Math.log(dteMax);

  const xAt = (d: number) =>
    ((Math.log(d) - logMin) / (logMax - logMin)) * plotWidth;
  const yAt = (v: number) =>
    plotHeight - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * plotHeight;

  const { bands, samples, currentIV, currentRV } = React.useMemo(() => {
    // Evenly spaced in log space from 7 to 224 days.
    const days: number[] = Array.from({ length: N_SAMPLES }, (_, i) => {
      const t = i / (N_SAMPLES - 1);
      return Math.exp(logMin + t * (logMax - logMin));
    });

    const make = (p: BandParams): Band => ({
      upper: days.map((d) => p.aUpper * Math.pow(d, -POWER) + p.bUpper),
      lower: days.map((d) => p.aLower * Math.pow(d, -POWER) + p.bLower),
    });

    const b = {
      minMax: make(BAND_PARAMS.minMax),
      p10p90: make(BAND_PARAMS.p10p90),
      p25p75: make(BAND_PARAMS.p25p75),
      median: make(BAND_PARAMS.median),
    };

    // Current IV ~ slightly rising flat band; current RV ~ rising from low to mid.
    const iv = days.map((d) => 0.49 + 0.02 * (Math.log(d) - logMin) / (logMax - logMin));
    const rv = days.map((d) => {
      const t = (Math.log(d) - logMin) / (logMax - logMin);
      return 0.34 + 0.12 * Math.pow(t, 0.65);
    });

    return {
      bands: b,
      samples: days,
      currentIV: iv,
      currentRV: rv,
    };
  }, [logMin, logMax]);

  const bandPath = (band: Band, t: number) => {
    const n = Math.max(2, Math.floor(samples.length * t));
    const upperPts = band.upper
      .slice(0, n)
      .map((v, i) => `${xAt(samples[i]).toFixed(2)},${yAt(v).toFixed(2)}`)
      .join(" L ");
    const lowerPts = [];
    for (let i = n - 1; i >= 0; i--) {
      lowerPts.push(`${xAt(samples[i]).toFixed(2)},${yAt(band.lower[i]).toFixed(2)}`);
    }
    return `M ${upperPts} L ${lowerPts.join(" L ")} Z`;
  };

  const linePath = (vals: number[], t: number) => {
    const n = Math.max(2, Math.floor(samples.length * t));
    const pts = vals
      .slice(0, n)
      .map((v, i) => `${xAt(samples[i]).toFixed(2)},${yAt(v).toFixed(2)}`)
      .join(" L ");
    return `M ${pts}`;
  };

  const yTicks: { pos: number; label: string }[] = [];
  for (let v = 0.2; v <= 1.1 + 1e-6; v += 0.1) {
    yTicks.push({
      pos: yAt(v),
      label: `${Math.round(v * 100)}%`,
    });
  }

  const xTicks = DTE_TICKS.map((d) => ({
    pos: xAt(d),
    label: `${d}d`,
  }));

  const ivD = linePath(currentIV, lineReveal);
  const rvD = linePath(currentRV, lineReveal);

  const legend: {
    color: string;
    label: string;
    kind: "swatch" | "dashed" | "solid";
  }[] = [
    { color: BAND_COLORS.minMax, label: "min – max", kind: "swatch" },
    { color: BAND_COLORS.p10p90, label: "10th – 90th", kind: "swatch" },
    { color: BAND_COLORS.p25p75, label: "25th – 75th", kind: "swatch" },
    { color: BAND_COLORS.median, label: "median", kind: "swatch" },
    { color: BAND_COLORS.iv, label: "current IV", kind: "dashed" },
    { color: BAND_COLORS.rv, label: "current RV", kind: "solid" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <ChartFrame opacity={opacity}>
        <Title
          text="BTC realized vol cone (Hodges-Tompkins corrected)"
          subtitle="Source: Thalex · 12 May 2024 – 15 May 2026"
          y={40}
          size={22}
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

          <path
            d={bandPath(bands.minMax, reveal)}
            fill={BAND_COLORS.minMax}
            shapeRendering="geometricPrecision"
          />
          <path
            d={bandPath(bands.p10p90, reveal)}
            fill={BAND_COLORS.p10p90}
            shapeRendering="geometricPrecision"
          />
          <path
            d={bandPath(bands.p25p75, reveal)}
            fill={BAND_COLORS.p25p75}
            shapeRendering="geometricPrecision"
          />
          <path
            d={bandPath(bands.median, reveal)}
            fill={BAND_COLORS.median}
            shapeRendering="geometricPrecision"
          />

          <path
            d={ivD}
            stroke={BAND_COLORS.iv}
            strokeWidth={2.5}
            strokeDasharray="8 4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={rvD}
            stroke={BAND_COLORS.rv}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />

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
          text="Annualized volatility"
          x={42}
          y={plotTop + plotHeight / 2}
          rotate={-90}
        />
        <AxisLabel
          text="Days to expiry"
          x={plotLeft + plotWidth / 2}
          y={plotTop + plotHeight + 56}
        />

        <div
          style={{
            position: "absolute",
            top: plotTop + 12,
            right: 64,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontFamily: FONT_TEXT,
            fontSize: 12,
            color: C.inkDim,
            background: "rgba(10,10,10,0.6)",
            padding: "8px 12px",
            border: `1px solid ${C.gridFaint}`,
            letterSpacing: 0,
          }}
        >
          {legend.map((l) => (
            <div
              key={l.label}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              {l.kind === "dashed" ? (
                <span
                  style={{
                    width: 18,
                    height: 0,
                    borderTop: `2px dashed ${l.color}`,
                  }}
                />
              ) : l.kind === "solid" ? (
                <span
                  style={{
                    width: 18,
                    height: 0,
                    borderTop: `2px solid ${l.color}`,
                  }}
                />
              ) : (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: l.color,
                  }}
                />
              )}
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      </ChartFrame>
    </AbsoluteFill>
  );
};
