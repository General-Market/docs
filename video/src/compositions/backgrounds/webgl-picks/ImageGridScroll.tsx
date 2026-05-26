// Source: a 299-image Flickr grid that scrolled under an isometric tilt as you
// dragged the page. We don't fetch 299 remote photos — we generate a dense wall
// of gradient tiles (varied hues, a handful carrying a shape or a number) and
// scroll the whole lattice diagonally as a frame-driven seamless loop. The
// isometric rotateX/rotateZ + the per-tile rounded shadow are kept verbatim so
// it still reads as that tilted photo gallery sliding past.
//
// Coverage is the whole game here: under scale(1.35) rotateX(45) rotateZ(45) a
// flat plane projects to a diamond, so a finite grid slides off and bares the
// background. The fix is a torus — the tile field is periodic in BOTH axes
// (PERIOD_COLS × PERIOD_ROWS) and we render far more cells than the viewport
// needs, then shift by one cell pitch wrapped on the period. Every cell pulls
// its tile by (row mod PERIOD_ROWS, col mod PERIOD_COLS), so the wall is
// infinite in both directions and no edge can ever enter frame.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

const TILE = 175; // px — matches the original span size
const MARGIN = 10; // px — original span margin
const STEP = TILE + MARGIN * 2; // one cell pitch (195px)
const STAGE_SCALE = 1.35;

// The plane is rotated 45° then tilted 45° and scaled. Its on-screen bounding
// box is roughly STAGE_SCALE * (W' + H') / sqrt(2) wide. To bury a 1920×1080
// frame with margin to spare we render a generously oversized lattice — ~30
// cells each way puts the pre-transform plane near 5850px, far beyond need.
const COLS = 30;
const ROWS = 30;

// One full period of unique tiles in each axis. Scroll wraps on these periods so
// the diagonal loop is seamless: cell (r,c) and (r+PERIOD_ROWS, c) — or
// (r, c+PERIOD_COLS) — carry identical tiles, and the offset resets cleanly.
const PERIOD_COLS = 12;
const PERIOD_ROWS = 12;

// Deterministic hash → [0,1)
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

interface Tile {
  hueA: number;
  hueB: number;
  satA: number;
  satB: number;
  litA: number;
  litB: number;
  angle: number;
  glyph: "none" | "circle" | "diag" | "number";
  num: number;
}

function buildTile(i: number): Tile {
  const h1 = Math.floor(hash(i * 1.7 + 4) * 360);
  const h2 = (h1 + 30 + Math.floor(hash(i * 2.3 + 9) * 90)) % 360;
  const g = hash(i * 3.1 + 17);
  const glyph: Tile["glyph"] =
    g > 0.86 ? "number" : g > 0.74 ? "circle" : g > 0.66 ? "diag" : "none";
  return {
    hueA: h1,
    hueB: h2,
    satA: 55 + Math.floor(hash(i * 5.5 + 2) * 30),
    satB: 60 + Math.floor(hash(i * 6.6 + 8) * 30),
    litA: 42 + Math.floor(hash(i * 7.7 + 1) * 20),
    litB: 30 + Math.floor(hash(i * 8.8 + 5) * 18),
    angle: Math.floor(hash(i * 9.9 + 3) * 360),
    glyph,
    num: 1 + Math.floor(hash(i * 11.1 + 6) * 99),
  };
}

const SHADOW = "rgba(0, 0, 0, 0.8)";

const TileCell: React.FC<{ tile: Tile }> = ({ tile }) => {
  const bg = `linear-gradient(${tile.angle}deg, hsl(${tile.hueA} ${tile.satA}% ${tile.litA}%), hsl(${tile.hueB} ${tile.satB}% ${tile.litB}%))`;

  return (
    <span
      style={{
        display: "block",
        width: TILE,
        height: TILE,
        margin: MARGIN,
        position: "relative",
      }}
    >
      {/* the original :before drop-shadow plate, pushed back in Z */}
      <span
        style={{
          content: "''",
          borderRadius: 10,
          display: "block",
          width: "100%",
          height: "100%",
          position: "absolute",
          background: SHADOW,
          boxShadow: `0 0 1px 1px ${SHADOW}`,
          transform: "translateZ(-1px)",
          opacity: 0.6,
        }}
      />
      <span
        style={{
          display: "block",
          border: "1px solid #ccc",
          borderRadius: 10,
          width: "100%",
          height: "100%",
          background: bg,
          transform: "translateZ(0)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {tile.glyph === "circle" && (
          <span
            style={{
              position: "absolute",
              inset: "30%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.22)",
              boxShadow: "inset 0 0 24px rgba(255,255,255,0.18)",
            }}
          />
        )}
        {tile.glyph === "diag" && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0 14px, transparent 14px 28px)",
            }}
          />
        )}
        {tile.glyph === "number" && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontFamily:
                '"SF Pro Display", Inter, "Helvetica Neue", sans-serif',
              fontSize: 64,
              fontWeight: 700,
              color: "rgba(255,255,255,0.82)",
              letterSpacing: "-0.02em",
            }}
          >
            {tile.num}
          </span>
        )}
      </span>
    </span>
  );
};

export const ImageGridScroll: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const tiles = useMemo(
    () =>
      Array.from({ length: PERIOD_ROWS * PERIOD_COLS }, (_, i) => buildTile(i)),
    [],
  );

  // Seamless diagonal scroll. Advance the lattice by an integer number of cells
  // over the whole clip so frame 0 and frame durationInFrames land identically.
  // The shift is taken modulo one cell pitch for the sub-cell translate, and the
  // whole-cell part feeds the source-index wrap below — together they make the
  // motion continuous AND the seam invisible.
  const loop = (frame % durationInFrames) / durationInFrames;
  const totalCellShift = PERIOD_ROWS; // whole cells advanced across the loop
  const advanceY = loop * totalCellShift * STEP; // px down the plane's y axis
  const advanceX = advanceY; // pure diagonal — matches the rotateZ(45) axis

  const cellShiftRow = Math.floor(advanceY / STEP);
  const cellShiftCol = Math.floor(advanceX / STEP);
  const subY = advanceY - cellShiftRow * STEP;
  const subX = advanceX - cellShiftCol * STEP;

  // Render one extra ring of cells beyond the oversized plane so the sub-cell
  // translate never reveals an edge.
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    const sourceRow =
      (((cellShiftRow + r) % PERIOD_ROWS) + PERIOD_ROWS) % PERIOD_ROWS;
    for (let c = 0; c < COLS; c++) {
      const sourceCol =
        (((cellShiftCol + c) % PERIOD_COLS) + PERIOD_COLS) % PERIOD_COLS;
      const idx = sourceRow * PERIOD_COLS + sourceCol;
      cells.push(<TileCell key={`${r}-${c}`} tile={tiles[idx]} />);
    }
  }

  const gridWidth = COLS * STEP;
  const gridHeight = ROWS * STEP;

  return (
    <AbsoluteFill style={{ backgroundColor: "#fcfcfc", overflow: "hidden" }}>
      {/* isometric stage — rotateX(45) rotateZ(45), verbatim. The grid div is
          its own box, so translate(-50%,-50%) centers the whole lattice on the
          viewport; only the sub-cell scroll remainder rides on the inner div. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transformStyle: "preserve-3d",
          transform: `translate(-50%, -50%) scale(${STAGE_SCALE}) rotateX(45deg) rotateZ(45deg)`,
        }}
      >
        <div
          style={{
            width: gridWidth,
            height: gridHeight,
            display: "flex",
            flexWrap: "wrap",
            transform: `translate(${-subX}px, ${-subY}px)`,
          }}
        >
          {cells}
        </div>
      </div>
    </AbsoluteFill>
  );
};
