import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT_TEXT } from "../tokens";
import { Axis, AxisLabel, ChartFrame, PlotArea, linspace } from "../primitives";

const PLOT = {
  left: 130,
  top: 110,
  width: 1660,
  height: 860,
};

const X_MIN = 30_000;
const X_MAX = 120_000;
const Y_MIN = -100;
const Y_MAX = 100;

const xToPx = (v: number) =>
  ((v - X_MIN) / (X_MAX - X_MIN)) * PLOT.width;
const yToPx = (v: number) =>
  PLOT.height - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT.height;

const X_TICKS = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map((v) => ({
  pos: xToPx(v * 1000),
  label: `${v}k`,
}));

const Y_TICKS = [-100, -50, 0, 50, 100].map((v) => ({
  pos: yToPx(v),
  label: `${v}`,
}));

const SAMPLES = 240;
const SNAPSHOTS = 12;
// snapshot index 0 = most time to expiry (widest, lowest), SNAPSHOTS-1 = near expiry (narrow, peakier)

function vegaCurve(strike: number, xs: number[], width: number, scale: number): number[] {
  // Long-call vega — gaussian-shaped, peaks at strike, drops at extremes.
  return xs.map((x) => {
    const d = (x - strike) / width;
    return scale * Math.exp(-0.5 * d * d);
  });
}

const XS = linspace(X_MIN, X_MAX, SAMPLES);

function pathFromValues(values: number[]): string {
  let d = "";
  for (let i = 0; i < values.length; i++) {
    const cx = xToPx(XS[i]);
    const cy = yToPx(values[i]);
    d += `${i === 0 ? "M" : "L"}${cx.toFixed(2)},${cy.toFixed(2)} `;
  }
  return d;
}

type Series = {
  label: string;
  color: string;
  paths: { d: string; opacity: number; strokeWidth: number }[];
};

function buildSeries(): Series[] {
  const longStrike = 72_000;
  const shortStrike = 80_000;

  const longFamily: { d: string; opacity: number; strokeWidth: number }[] = [];
  const shortFamily: { d: string; opacity: number; strokeWidth: number }[] = [];
  const comboFamily: { d: string; opacity: number; strokeWidth: number }[] = [];

  for (let s = 0; s < SNAPSHOTS; s++) {
    // t in [0..1] where 1 = near expiry (narrower, higher peak)
    const t = s / (SNAPSHOTS - 1);
    const width = 26_000 - 14_000 * t;
    const peak = 50 + 18 * t;

    const longVals = vegaCurve(longStrike, XS, width, peak);
    const shortVals = vegaCurve(shortStrike, XS, width, -peak);
    const comboVals = longVals.map((v, i) => v + shortVals[i]);

    const opacity = 0.18 + 0.55 * t;

    longFamily.push({ d: pathFromValues(longVals), opacity, strokeWidth: 1.1 });
    shortFamily.push({ d: pathFromValues(shortVals), opacity, strokeWidth: 1.1 });
    comboFamily.push({ d: pathFromValues(comboVals), opacity: opacity * 0.85, strokeWidth: 1.0 });
  }

  // Bold combo overlay — average snapshot.
  const boldCombo = {
    d: pathFromValues(
      comboFamilyValuesAt(longStrike, shortStrike, 18_000, 60),
    ),
    opacity: 1,
    strokeWidth: 2.2,
  };
  comboFamily.push(boldCombo);

  return [
    { label: "Combo", color: C.white, paths: comboFamily },
    { label: "Buy 1 BTC-24APR26-72000-C", color: C.blue, paths: longFamily },
    { label: "Sell 1 BTC-24APR26-80000-C", color: C.red, paths: shortFamily },
  ];
}

function comboFamilyValuesAt(
  longStrike: number,
  shortStrike: number,
  width: number,
  peak: number,
): number[] {
  const longVals = vegaCurve(longStrike, XS, width, peak);
  const shortVals = vegaCurve(shortStrike, XS, width, -peak);
  return longVals.map((v, i) => v + shortVals[i]);
}

export const Chart09: React.FC = () => {
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

  const series = React.useMemo(buildSeries, []);

  // Legend rows
  const legend = [
    { label: "Combo", color: C.white },
    { label: "Buy 1 BTC-24APR26-72000-C", color: C.blue },
    { label: "Sell 1 BTC-24APR26-80000-C", color: C.red },
  ];

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
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
              strokeWidth={t.label === "0" ? 1 : 1}
              opacity={t.label === "0" ? 0.6 : 1}
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

          <defs>
            <clipPath id="chart09-clip">
              <rect
                x={0}
                y={0}
                width={PLOT.width * reveal}
                height={PLOT.height}
              />
            </clipPath>
          </defs>

          <g clipPath="url(#chart09-clip)">
            {series.map((s, si) =>
              s.paths.map((p, pi) => (
                <path
                  key={`${si}-${pi}`}
                  d={p.d}
                  stroke={s.color}
                  strokeWidth={p.strokeWidth}
                  strokeOpacity={p.opacity}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )),
            )}
          </g>

          <Axis
            orientation="bottom"
            ticks={X_TICKS}
            length={PLOT.width}
            offset={PLOT.height}
          />
          <Axis orientation="left" ticks={Y_TICKS} length={PLOT.height} />
        </PlotArea>

        <AxisLabel
          text="BTC Price"
          x={PLOT.left + PLOT.width / 2}
          y={PLOT.top + PLOT.height + 50}
        />
        <AxisLabel
          text="vega"
          x={PLOT.left - 70}
          y={PLOT.top + PLOT.height / 2}
          rotate={-90}
        />

        <div
          style={{
            position: "absolute",
            top: PLOT.top + 20,
            right: 90,
            padding: "14px 18px",
            backgroundColor: "rgba(0,0,0,0.65)",
            border: `1px solid ${C.grid}`,
            fontFamily: FONT_TEXT,
            color: C.ink,
            fontSize: 13,
            minWidth: 240,
          }}
        >
          <div
            style={{
              color: C.inkDim,
              fontSize: 11,
              marginBottom: 10,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Series
          </div>
          {legend.map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: row.color,
                  display: "inline-block",
                }}
              />
              <span style={{ color: C.ink, fontSize: 12 }}>{row.label}</span>
            </div>
          ))}
        </div>
      </ChartFrame>
    </AbsoluteFill>
  );
};
