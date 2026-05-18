import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  C,
  DIVERGING_BLUE_RED,
  divergingColor,
  FONT_TEXT,
  gaussian,
  mulberry32,
} from "../tokens";
import { ChartFrame, Title, VerticalColorBar } from "../primitives";

const SEED = 0x2b71c;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const GRID = {
  left: 200,
  top: 200,
  width: 1320,
  height: 660,
};

const GAP = 2;
const CELL_W = (GRID.width - GAP * (HOURS.length - 1)) / HOURS.length;
const CELL_H = (GRID.height - GAP * (DAYS.length - 1)) / DAYS.length;

const PNL_MIN = -1000;
const PNL_MAX = 500;

function buildGrid(): (number | null)[][] {
  const rng = mulberry32(SEED);
  const grid: (number | null)[][] = [];
  for (let r = 0; r < DAYS.length; r++) {
    const row: (number | null)[] = [];
    for (let c = 0; c < HOURS.length; c++) {
      if (r === 0 && c < 13) {
        row.push(null);
        continue;
      }
      let bias = 0;
      if (c >= 0 && c <= 6) bias = 90;
      if (c >= 8 && c <= 12) bias = -260;
      if (c >= 18 && c <= 22) bias = -80;

      let v = gaussian(rng, bias, 260);
      if (rng() < 0.08) v -= 500 + rng() * 400;
      v = Math.max(PNL_MIN, Math.min(PNL_MAX, v));
      row.push(v);
    }
    grid.push(row);
  }
  return grid;
}

function colorForPnl(v: number): string {
  const t = v >= 0 ? v / PNL_MAX : v / Math.abs(PNL_MIN);
  const scaled = t > 0 ? t * 0.2 : t * 0.4;
  return divergingColor(scaled, -0.4, 0.2);
}

export const Chart02: React.FC = () => {
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

  const grid = React.useMemo(buildGrid, []);

  const cbStops = DIVERGING_BLUE_RED.map((s) => ({
    t: (s.stop - -0.4) / (0.2 - -0.4),
    color: s.color,
  }));

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < DAYS.length; r++) {
    for (let c = 0; c < HOURS.length; c++) {
      const v = grid[r][c];
      const x = c * (CELL_W + GAP);
      const y = r * (CELL_H + GAP);
      const order = r * HOURS.length + c;
      const total = DAYS.length * HOURS.length;
      const appearAt = (order / total) * 0.7;
      const local = (reveal - appearAt) / 0.3;
      const a = Math.max(0, Math.min(1, local));

      if (v === null) {
        cells.push(
          <rect
            key={`${r}-${c}`}
            x={x}
            y={y}
            width={CELL_W}
            height={CELL_H}
            fill={C.bg}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />,
        );
        continue;
      }
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x}
          y={y}
          width={CELL_W}
          height={CELL_H}
          fill={colorForPnl(v)}
          fillOpacity={a}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={1}
        />,
      );
    }
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      <ChartFrame>
        <Title
          text="MTM PnL by Weekday and UTC Hour"
          subtitle="Source: Thalex | 02 Mar 2026 - 07 May 2026"
          y={56}
        />

        <svg
          style={{
            position: "absolute",
            left: GRID.left,
            top: GRID.top,
            width: GRID.width,
            height: GRID.height,
            overflow: "visible",
          }}
        >
          {cells}
        </svg>

        {DAYS.map((d, i) => (
          <div
            key={d}
            style={{
              position: "absolute",
              left: GRID.left - 18,
              top: GRID.top + i * (CELL_H + GAP) + CELL_H / 2,
              transform: "translate(-100%, -50%)",
              color: C.inkDim,
              fontFamily: FONT_TEXT,
              fontSize: 13,
            }}
          >
            {d}
          </div>
        ))}

        {HOURS.map((h) => (
          <div
            key={h}
            style={{
              position: "absolute",
              left: GRID.left + h * (CELL_W + GAP) + CELL_W / 2,
              top: GRID.top + GRID.height + 14,
              transform: "translateX(-50%)",
              color: C.inkDim,
              fontFamily: FONT_TEXT,
              fontSize: 11,
            }}
          >
            {String(h).padStart(2, "0")}
          </div>
        ))}

        <div
          style={{
            position: "absolute",
            left: GRID.left + GRID.width / 2,
            top: GRID.top + GRID.height + 56,
            transform: "translateX(-50%)",
            color: C.ink,
            fontFamily: FONT_TEXT,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          UTC hour
        </div>
        <div
          style={{
            position: "absolute",
            left: GRID.left - 92,
            top: GRID.top + GRID.height / 2,
            transform: "translate(-50%, -50%) rotate(-90deg)",
            color: C.ink,
            fontFamily: FONT_TEXT,
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Weekday
        </div>

        <VerticalColorBar
          x={1600}
          y={GRID.top}
          width={14}
          height={GRID.height}
          stops={cbStops}
          ticks={[
            { t: 1, label: "+500" },
            { t: (0 - -0.4) / 0.6, label: "0" },
            { t: (-0.2 - -0.4) / 0.6, label: "-500" },
            { t: 0, label: "-1,000" },
          ]}
          title="MTM PnL"
        />
      </ChartFrame>
    </AbsoluteFill>
  );
};
