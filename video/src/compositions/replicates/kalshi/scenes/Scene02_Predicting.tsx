import React from "react";
import {
  useCurrentFrame,
  interpolate,
  AbsoluteFill,
} from "remotion";
import {
  baseText,
  GREEN,
  LightBg,
  sceneFade,
  srand,
} from "../shared";

const DURATION = 120;
const WIDTH = 1920;
const HEIGHT = 1080;

const ROW_HEIGHT = 55;
const ROW_GAP = 20;
const RECT_GAP = 20;
const BORDER_RADIUS = 8;
const BORDER_WIDTH = 2;

// Each row: array of rectangle widths, seeded for determinism
function generateRowWidths(rowIndex: number, count: number): number[] {
  const widths: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = srand(rowIndex * 100 + i);
    // Widths between 250 and 520, biased toward the reference frames
    widths.push(250 + r * 270);
  }
  return widths;
}

// 8 rows, enough rectangles to tile well beyond 1920px on each side
const ROWS = Array.from({ length: 8 }, (_, i) => ({
  widths: generateRowWidths(i, 12),
  direction: i % 2 === 0 ? 1 : -1, // alternating scroll direction
  speed: 0.6 + srand(i * 7) * 0.4, // slight speed variation per row
}));

// Total width of a full set of rects in a row (for seamless tiling)
function totalRowWidth(widths: number[]): number {
  return widths.reduce((sum, w) => sum + w + RECT_GAP, 0);
}

const RectRow: React.FC<{
  widths: number[];
  direction: number;
  speed: number;
  frame: number;
  rowOpacity: number;
}> = ({ widths, direction, speed, frame, rowOpacity }) => {
  const total = totalRowWidth(widths);
  // Continuous scroll offset
  const scrollPx = frame * speed * 2.5 * direction;
  // Start offset: shift by half the total width so rects span both sides of center
  const baseOffset = -total + scrollPx;

  // Render two full copies for seamless wrap
  const rects: React.ReactNode[] = [];
  for (let copy = 0; copy < 3; copy++) {
    widths.forEach((w, i) => {
      const key = `${copy}-${i}`;
      const x =
        baseOffset +
        copy * total +
        widths.slice(0, i).reduce((s, v) => s + v + RECT_GAP, 0);

      rects.push(
        <div
          key={key}
          style={{
            position: "absolute",
            left: x,
            top: 0,
            width: w,
            height: ROW_HEIGHT,
            border: `${BORDER_WIDTH}px solid ${GREEN}`,
            borderRadius: BORDER_RADIUS,
            boxSizing: "border-box",
          }}
        />,
      );
    });
  }

  return (
    <div
      style={{
        position: "relative",
        width: WIDTH,
        height: ROW_HEIGHT,
        overflow: "hidden",
        opacity: rowOpacity,
      }}
    >
      {rects}
    </div>
  );
};

// Text reveal: "Predicting" → "Predicting all 63" → "Predicting all 63 games"
const WORDS = ["Predicting", "all", "63", "games"];
const WORD_ENTER_FRAMES = [15, 55, 65, 75]; // staggered reveal

export const Scene02_Predicting: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, DURATION);

  // Rows fade in with a slight stagger from center outward
  const centerRow = (ROWS.length - 1) / 2;

  // Total grid height
  const gridHeight = ROWS.length * ROW_HEIGHT + (ROWS.length - 1) * ROW_GAP;
  const gridTop = (HEIGHT - gridHeight) / 2;

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Scrolling rectangle rows */}
      <div
        style={{
          position: "absolute",
          top: gridTop,
          left: 0,
          width: WIDTH,
        }}
      >
        {ROWS.map((row, i) => {
          const distFromCenter = Math.abs(i - centerRow);
          const enterDelay = distFromCenter * 3;
          const rowOpacity = interpolate(
            frame,
            [enterDelay, enterDelay + 10],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          return (
            <div
              key={i}
              style={{ marginBottom: i < ROWS.length - 1 ? ROW_GAP : 0 }}
            >
              <RectRow
                widths={row.widths}
                direction={row.direction}
                speed={row.speed}
                frame={frame}
                rowOpacity={rowOpacity}
              />
            </div>
          );
        })}
      </div>

      {/* Center text: word-by-word reveal */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
          {WORDS.map((word, i) => {
            const enter = WORD_ENTER_FRAMES[i];
            const opacity = interpolate(
              frame,
              [enter, enter + 6],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const y = interpolate(
              frame,
              [enter, enter + 8],
              [24, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );

            return (
              <span
                key={i}
                style={{
                  ...baseText,
                  fontSize: 80,
                  opacity,
                  transform: `translateY(${y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
