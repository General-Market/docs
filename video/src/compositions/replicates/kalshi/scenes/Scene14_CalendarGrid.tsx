import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import {
  baseText,
  GREEN,
  LightBg,
  easeOutExpo,
  progress,
  sceneFade,
  srand,
} from "../shared";

const COLS = 35;
const ROWS = 15;
const CELL = 11;
const GAP = 4;
const TOTAL = 150;

// The grid fills diagonally; the counter ticks up as squares appear
const FINAL_YEARS = 3800;
const MAX_DIAG = COLS + ROWS - 2;

export const Scene14_CalendarGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, TOTAL, 8, 8);

  // --- title ---
  const textP = progress(frame, 5, 18);
  const textOpacity = easeOutExpo(textP);

  // Count up from ~3,500 to 3,800 as the grid fills (frames 25..130)
  const countP = progress(frame, 25, 105);
  const years = Math.round(
    interpolate(countP, [0, 1], [3500, FINAL_YEARS], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const formattedYears = years.toLocaleString("en-US");

  // --- grid geometry ---
  const gridW = COLS * (CELL + GAP);
  const gridX = (1920 - gridW) / 2;
  const gridY = 320; // bottom ~70% of frame

  // Trailing-off threshold — bottom-right corner squares vanish stochastically
  const trailStart = MAX_DIAG - 10;

  const cells: React.ReactNode[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const diag = row + col;

      // Stochastic cull near the trailing diagonal edge
      if (diag > trailStart) {
        const keep = 1 - (diag - trailStart) / 10;
        if (srand(row * COLS + col + 42) > keep) continue;
      }

      // Diagonal wave entrance: earlier diags appear first
      const enterDelay = 20 + diag * 2.2;
      const s = spring({
        frame: frame - enterDelay,
        fps,
        config: { damping: 14, stiffness: 200, mass: 0.35 },
      });

      if (s < 0.01) continue; // skip invisible cells

      cells.push(
        <div
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            left: gridX + col * (CELL + GAP),
            top: gridY + row * (CELL + GAP),
            width: CELL,
            height: CELL,
            borderRadius: 2,
            backgroundColor: GREEN,
            transform: `scale(${s})`,
            opacity: s,
          }}
        />
      );
    }
  }

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <LightBg />

      {/* Title — positioned at ~15% from top */}
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 0,
          right: 0,
          textAlign: "center",
          ...baseText,
          fontSize: 70,
          opacity: textOpacity,
          transform: `translateY(${(1 - textOpacity) * 20}px)`,
        }}
      >
        over {formattedYears} years
      </div>

      {/* Dense green grid */}
      {cells}
    </div>
  );
};

export default Scene14_CalendarGrid;
