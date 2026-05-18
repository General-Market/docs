import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT_TEXT, gaussian, mulberry32 } from "../tokens";
import {
  Axis,
  AxisLabel,
  ChartFrame,
  PlotArea,
  Title,
  linspace,
} from "../primitives";

const DTE_TICKS = [7, 14, 21, 42, 133, 224];
const Y_MIN = 0.2;
const Y_MAX = 1.1;

const BAND_COLORS = {
  minMax: "#5C1010",
  p10p90: "#9B1717",
  p25p75: "#DD5641",
  median: "#F5A98F",
  iv: "#F4E0D2",
  rv: C.blueCool,
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

  const plotLeft = 130;
  const plotTop = 150;
  const plotWidth = 1500;
  const plotHeight = 780;

  const dteMin = DTE_TICKS[0];
  const dteMax = DTE_TICKS[DTE_TICKS.length - 1];
  const logMin = Math.log(dteMin);
  const logMax = Math.log(dteMax);

  const xAt = (d: number) =>
    ((Math.log(d) - logMin) / (logMax - logMin)) * plotWidth;
  const yAt = (v: number) =>
    plotHeight - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * plotHeight;

  const { bands, samples, currentIV, currentRV } = React.useMemo(() => {
    const rng = mulberry32(50513);
    const days = linspace(dteMin, dteMax, 96);

    const make = (
      aUpper: number,
      bUpper: number,
      aLower: number,
      bLower: number,
      jitter: number,
    ): Band => ({
      upper: days.map(
        (d: number) =>
          aUpper * Math.pow(d, -0.3) + bUpper + gaussian(rng, 0, jitter),
      ),
      lower: days.map(
        (d: number) =>
          aLower * Math.pow(d, -0.3) + bLower + gaussian(rng, 0, jitter),
      ),
    });

    const b = {
      minMax: make(1.05, 0.16, -0.55, 0.36, 0.006),
      p10p90: make(0.78, 0.2, -0.36, 0.4, 0.005),
      p25p75: make(0.52, 0.24, -0.18, 0.44, 0.004),
      median: make(0.21, 0.32, 0.18, 0.33, 0.003),
    };

    const ivVal = 0.62;
    const rvVal = 0.41;

    return {
      bands: b,
      samples: days,
      currentIV: days.map(() => ivVal + gaussian(rng, 0, 0.005)),
      currentRV: days.map(() => rvVal + gaussian(rng, 0, 0.004)),
    };
  }, []);

  const bandPath = (band: Band, t: number) => {
    const n = Math.max(2, Math.floor(samples.length * t));
    const upper = band.upper
      .slice(0, n)
      .map((v, i) => `${xAt(samples[i])},${yAt(v)}`)
      .join(" L ");
    const lower = band.lower
      .slice(0, n)
      .reverse()
      .map((v, i) => {
        const idx = n - 1 - i;
        return `${xAt(samples[idx])},${yAt(v)}`;
      })
      .join(" L ");
    return `M ${upper} L ${lower} Z`;
  };

  const linePath = (vals: number[], t: number, dash = false) => {
    const n = Math.max(2, Math.floor(samples.length * t));
    const pts = vals
      .slice(0, n)
      .map((v, i) => `${xAt(samples[i])},${yAt(v)}`)
      .join(" L ");
    return { d: `M ${pts}`, dash };
  };

  const yTicks = [];
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

  const ivLine = linePath(currentIV, lineReveal, true);
  const rvLine = linePath(currentRV, lineReveal, false);

  const legend = [
    { color: BAND_COLORS.minMax, label: "min – max" },
    { color: BAND_COLORS.p10p90, label: "10th – 90th" },
    { color: BAND_COLORS.p25p75, label: "25th – 75th" },
    { color: BAND_COLORS.median, label: "median" },
    { color: BAND_COLORS.iv, label: "current IV", dashed: true },
    { color: BAND_COLORS.rv, label: "current RV" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <ChartFrame opacity={opacity}>
        <Title
          text="BTC realized vol cone (Hodges-Tompkins corrected)"
          subtitle="Source: Thalex · 12 May 2024 – 15 May 2026"
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

          <path d={bandPath(bands.minMax, reveal)} fill={BAND_COLORS.minMax} />
          <path
            d={bandPath(bands.p10p90, reveal)}
            fill={BAND_COLORS.p10p90}
          />
          <path
            d={bandPath(bands.p25p75, reveal)}
            fill={BAND_COLORS.p25p75}
          />
          <path
            d={bandPath(bands.median, reveal)}
            fill={BAND_COLORS.median}
          />

          <path
            d={ivLine.d}
            stroke={BAND_COLORS.iv}
            strokeWidth={2}
            strokeDasharray="8 6"
            fill="none"
          />
          <path
            d={rvLine.d}
            stroke={BAND_COLORS.rv}
            strokeWidth={2}
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
            top: plotTop + 16,
            right: 80,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontFamily: FONT_TEXT,
            fontSize: 12,
            color: C.inkDim,
            background: "rgba(10,10,10,0.6)",
            padding: "12px 16px",
            border: `1px solid ${C.gridFaint}`,
          }}
        >
          {legend.map((l) => (
            <div
              key={l.label}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              {l.dashed ? (
                <span
                  style={{
                    width: 18,
                    height: 0,
                    borderTop: `2px dashed ${l.color}`,
                  }}
                />
              ) : (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
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
