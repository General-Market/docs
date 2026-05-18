import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  C,
  FONT_TEXT,
  SEQUENTIAL_RED,
  gaussian,
  mulberry32,
  sequentialColor,
} from "../tokens";
import {
  AxisLabel,
  ChartFrame,
  Title,
  VerticalColorBar,
} from "../primitives";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = 24;
const VOL_MIN = 0.15;
const VOL_MAX = 0.65;

export const Chart04: React.FC = () => {
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

  const cells = React.useMemo(() => {
    const rng = mulberry32(40412);
    const grid: number[][] = [];
    for (let d = 0; d < DAYS.length; d++) {
      const row: number[] = [];
      const weekend = d >= 5;
      for (let h = 0; h < HOURS; h++) {
        const base = 0.22;
        const hotAmp = weekend ? 0.12 : 0.3;
        const diurnal =
          hotAmp * Math.exp(-Math.pow((h - 14.5) / 2.0, 2)) +
          0.05 * Math.exp(-Math.pow((h - 21) / 3.0, 2));
        const weekly = weekend ? -0.04 : 0.04;
        const noise = gaussian(rng, 0, 0.015);
        const v = base + diurnal + weekly + noise;
        row.push(Math.max(0.16, Math.min(0.7, v)));
      }
      grid.push(row);
    }
    return grid;
  }, []);

  // Source aspect: heatmap is wide, cells slightly wider than tall.
  // 24 cols across ~1450px, 7 rows. Cells ~60w × ~70h works for the source feel.
  const plotLeft = 130;
  const plotTop = 170;
  const plotWidth = 1450;
  const plotHeight = 540;
  const cellWidth = plotWidth / HOURS;
  const cellHeight = plotHeight / DAYS.length;

  const norm = (v: number) =>
    Math.max(0, Math.min(1, (v - VOL_MIN) / (VOL_MAX - VOL_MIN)));

  const totalCells = DAYS.length * HOURS;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <ChartFrame opacity={opacity}>
        <Title
          text="BTC Hourly Realized Volatility — Average by Day and Hour"
          subtitle="Source: Thalex, 2025-03-14 — 2026-05-04"
          y={48}
        />

        {DAYS.map((d, i) => (
          <div
            key={d}
            style={{
              position: "absolute",
              left: 70,
              top: plotTop + i * cellHeight + cellHeight / 2 - 9,
              color: C.inkDim,
              fontFamily: FONT_TEXT,
              fontSize: 13,
              width: 50,
              textAlign: "right",
            }}
          >
            {d}
          </div>
        ))}

        {Array.from({ length: HOURS }).map((_, h) => (
          <div
            key={h}
            style={{
              position: "absolute",
              left: plotLeft + h * cellWidth + cellWidth / 2,
              top: plotTop + plotHeight + 14,
              color: C.inkDim,
              fontFamily: FONT_TEXT,
              fontSize: 12,
              transform: "translate(-50%, 0) rotate(-90deg)",
              transformOrigin: "center top",
              whiteSpace: "nowrap",
            }}
          >
            {h}
          </div>
        ))}

        <svg
          style={{
            position: "absolute",
            left: plotLeft,
            top: plotTop,
            width: plotWidth,
            height: plotHeight,
            overflow: "visible",
          }}
        >
          {cells.map((row, di) =>
            row.map((v, hi) => {
              const idx = di * HOURS + hi;
              const cellReveal = Math.max(
                0,
                Math.min(1, reveal * totalCells - idx),
              );
              const fill = sequentialColor(norm(v), SEQUENTIAL_RED);
              return (
                <rect
                  key={`${di}-${hi}`}
                  x={hi * cellWidth}
                  y={di * cellHeight}
                  width={cellWidth}
                  height={cellHeight}
                  fill={fill}
                  stroke="#0A0A0A"
                  strokeWidth={1.5}
                  opacity={cellReveal}
                />
              );
            }),
          )}
        </svg>

        <AxisLabel
          text="Hour (UTC)"
          x={plotLeft + plotWidth / 2}
          y={plotTop + plotHeight + 90}
        />

        <AxisLabel
          text="Day of Week"
          x={42}
          y={plotTop + plotHeight / 2}
          rotate={-90}
        />

        <VerticalColorBar
          x={1660}
          y={plotTop + 30}
          width={14}
          height={plotHeight - 60}
          title="Avg Realized Vol (ann.)"
          stops={[
            { t: 0, color: SEQUENTIAL_RED[0] },
            { t: 0.2, color: SEQUENTIAL_RED[1] },
            { t: 0.4, color: SEQUENTIAL_RED[2] },
            { t: 0.6, color: SEQUENTIAL_RED[3] },
            { t: 0.8, color: SEQUENTIAL_RED[5] },
            { t: 1, color: SEQUENTIAL_RED[6] },
          ]}
          ticks={[
            { t: (0.2 - VOL_MIN) / (VOL_MAX - VOL_MIN), label: "20%" },
            { t: (0.4 - VOL_MIN) / (VOL_MAX - VOL_MIN), label: "40%" },
            { t: (0.6 - VOL_MIN) / (VOL_MAX - VOL_MIN), label: "60%" },
          ]}
        />
      </ChartFrame>
    </AbsoluteFill>
  );
};
