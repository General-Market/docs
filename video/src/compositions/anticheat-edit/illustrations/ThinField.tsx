import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// THE PROBLEM IS STRUCTURAL — "Almost nowhere is safe".
//
// A field of venue tiles. One by one nearly all of them flip to a flagged
// red state — each carrying one of the thirteen mechanisms, labelled
// ORDER BOOK or AMM. Only a thin sliver stays clear and blue. The lesson:
// the safe ground is almost nonexistent, so a new instrument was needed.
// Ends on a small count — ≈ 2 of 200 clear.

const COLS = 20;
const ROWS = 10;
const TOTAL = COLS * ROWS; // 200

const GRID_W = 1560;
const GRID_TOP = 326;
const TILE_GAP = 8;
const TILE = (GRID_W - TILE_GAP * (COLS - 1)) / COLS; // ~70
const GRID_H = ROWS * TILE + (ROWS - 1) * TILE_GAP;
const GRID_LEFT = (1920 - GRID_W) / 2;

const RED = "#FF4D4D";

// Deterministic hash so the flip order and labels are stable per render.
const hash = (i: number): number => {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
};

// The clear survivors — a thin sliver. Two specific tiles stay blue.
const CLEAR = new Set<number>([COLS * 4 + 9, COLS * 6 + 13]);

// Each flagged tile carries a label. AMM vs ORDER BOOK split by hash.
const labelFor = (i: number): "AMM" | "BOOK" => (hash(i * 7 + 3) > 0.62 ? "AMM" : "BOOK");

// Flip schedule: tiles flip over a ~70-frame window in a hash-shuffled order
// so the wave reads as spreading, not sweeping. Settled well before 120.
const FLIP_START = 26;
const FLIP_WINDOW = 64;

const flipFrameFor = (i: number): number =>
  FLIP_START + hash(i * 3 + 11) * FLIP_WINDOW;

const Tile: React.FC<{ index: number; col: number; row: number }> = ({
  index,
  col,
  row,
}) => {
  const frame = useCurrentFrame();
  const isClear = CLEAR.has(index);

  // Entrance: tiles fade in as faint blue cells first.
  const appear = interpolate(frame, [index * 0.06, index * 0.06 + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const flipAt = flipFrameFor(index);
  const flip = isClear
    ? 0
    : interpolate(frame, [flipAt, flipAt + 9], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // Clear tiles get a soft steady glow so the eye can find them.
  const glow = isClear
    ? 0.5 + 0.5 * Math.sin((frame / 30) * 1.6)
    : 0;

  const x = GRID_LEFT + col * (TILE + TILE_GAP);
  const y = GRID_TOP + row * (TILE + TILE_GAP);

  const bg = isClear
    ? `rgba(91,121,255,${(0.22 + 0.18 * glow).toFixed(3)})`
    : flip > 0
      ? `rgba(255,77,77,${(0.1 + 0.18 * flip).toFixed(3)})`
      : "rgba(255,255,255,0.05)";

  const border = isClear
    ? scene.accentSoft
    : flip > 0
      ? `rgba(255,77,77,${(0.55 * flip + 0.2).toFixed(3)})`
      : scene.gridLine;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: TILE,
        height: TILE,
        opacity: appear,
        borderRadius: 9,
        background: bg,
        border: `1.5px solid ${border}`,
        boxShadow: isClear
          ? `0 0 ${(10 + 14 * glow).toFixed(0)}px rgba(91,121,255,0.55)`
          : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {isClear ? (
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            background: scene.ink,
            boxShadow: "0 0 8px rgba(255,255,255,0.7)",
          }}
        />
      ) : flip > 0.45 ? (
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: RED,
            opacity: (flip - 0.45) / 0.55,
          }}
        >
          {labelFor(index)}
        </span>
      ) : null}
    </div>
  );
};

export const ThinField: React.FC = () => {
  const frame = useCurrentFrame();

  // The count ticks down from 200 to 2 as tiles flip, then holds.
  const flaggedNow = Array.from({ length: TOTAL }).filter((_, i) => {
    if (CLEAR.has(i)) return false;
    return frame >= flipFrameFor(i) + 9;
  }).length;
  const clearNow = TOTAL - flaggedNow;

  const countOp = interpolate(frame, [FLIP_START + FLIP_WINDOW, FLIP_START + FLIP_WINDOW + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="THE PROBLEM IS STRUCTURAL" title="Almost nowhere is safe">
      <AbsoluteFill>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <Tile key={i} index={i} col={i % COLS} row={Math.floor(i / COLS)} />
        ))}

        {/* The count, centered below the grid */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: GRID_TOP + GRID_H + 40,
            textAlign: "center",
            opacity: countOp,
          }}
        >
          <span
            style={{
              fontFamily: font,
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-0.022em",
              color: scene.accentSoft,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ≈ {clearNow} of {TOTAL}
          </span>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: scene.inkDim,
              marginLeft: 18,
            }}
          >
            clear
          </span>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
