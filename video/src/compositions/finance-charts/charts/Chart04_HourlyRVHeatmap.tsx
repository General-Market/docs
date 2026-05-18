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
const VOL_MAX = 0.7;

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
        const base = 0.25;
        const diurnal =
          0.18 * Math.exp(-Math.pow((h - 14.5) / 3.2, 2)) +
          0.04 * Math.exp(-Math.pow((h - 21) / 4.0, 2));
        const weekly = weekend ? -0.06 : 0.02;
        const noise = gaussian(rng, 0, 0.025);
        const v = base + diurnal + weekly + noise;
        row.push(Math.max(0.1, Math.min(0.85, v)));
      }
      grid.push(row);
    }
    return grid;
  }, []);

  const plotLeft = 130;
  const plotTop = 150;
  const plotWidth = 1480;
  const plotHeight = 780;
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

        {Array.from({ length: HOURS }).map((_, h) => {
          if (h % 2 !== 0) return null;
          return (
            <div
              key={h}
              style={{
                position: "absolute",
                left: plotLeft + h * cellWidth + cellWidth / 2 - 14,
                top: plotTop + plotHeight + 14,
                color: C.inkDim,
                fontFamily: FONT_TEXT,
                fontSize: 11,
                width: 28,
                textAlign: "center",
              }}
            >
              {String(h).padStart(2, "0")}
            </div>
          );
        })}

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
                  width={cellWidth + 0.5}
                  height={cellHeight + 0.5}
                  fill={fill}
                  opacity={cellReveal}
                />
              );
            }),
          )}
        </svg>

        <AxisLabel
          text="Hour (UTC)"
          x={plotLeft + plotWidth / 2}
          y={plotTop + plotHeight + 56}
        />

        <VerticalColorBar
          x={1680}
          y={plotTop + 40}
          width={14}
          height={plotHeight - 80}
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
