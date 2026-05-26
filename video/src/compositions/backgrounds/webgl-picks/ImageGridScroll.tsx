// Source: a 299-image Flickr grid that scrolled under an isometric tilt as you
// dragged the page. We don't fetch 299 remote photos — we generate a dense wall
// of gradient tiles (varied hues, a handful carrying a shape or a number) and
// scroll the whole lattice diagonally as a frame-driven seamless loop. The
// isometric rotateX/rotateZ + the per-tile rounded shadow are kept verbatim so
// it still reads as that tilted photo gallery sliding past.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

const COLS = 6;
const TILE = 175; // px — matches the original span size
const MARGIN = 10; // px — original span margin
const STEP = TILE + MARGIN * 2; // one cell pitch
const ROWS_VISIBLE = 9; // enough rows to overfill the tilted viewport

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

// One full period of unique tiles. The scroll wraps on this period so the loop
// is seamless: row r and row r+PERIOD_ROWS carry identical tiles.
const PERIOD_ROWS = 16;
const TILE_COUNT = COLS * PERIOD_ROWS;

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
    () => Array.from({ length: TILE_COUNT }, (_, i) => buildTile(i)),
    [],
  );

  // Seamless diagonal scroll: advance exactly PERIOD_ROWS cells over the whole
  // clip, then modulo so frame 0 and frame durationInFrames land identically.
  const periodPx = PERIOD_ROWS * STEP;
  const loop = (frame % durationInFrames) / durationInFrames;
  const offsetY = ((loop * periodPx) % periodPx);
  const offsetX = offsetY * 0.18; // gentle diagonal drift

  // We render a vertical stack tall enough to cover the tilt; rows are pulled
  // from the periodic tile set with a row index that also wraps, so the wall is
  // infinite in both directions of the scroll.
  const totalRows = ROWS_VISIBLE + PERIOD_ROWS;
  const rowStart = Math.floor(offsetY / STEP);
  const subY = offsetY - rowStart * STEP;

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < totalRows; r++) {
    const sourceRow = ((rowStart + r) % PERIOD_ROWS + PERIOD_ROWS) % PERIOD_ROWS;
    for (let c = 0; c < COLS; c++) {
      const idx = sourceRow * COLS + c;
      cells.push(<TileCell key={`${r}-${c}`} tile={tiles[idx]} />);
    }
  }

  const gridWidth = COLS * STEP;
  const gridHeight = totalRows * STEP;

  return (
    <AbsoluteFill style={{ backgroundColor: "#fcfcfc", overflow: "hidden" }}>
      {/* isometric stage — translateX(-50%) rotateX(45) rotateZ(45), verbatim */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transformStyle: "preserve-3d",
          transform:
            "translate(-50%, -50%) scale(1.35) rotateX(45deg) rotateZ(45deg)",
        }}
      >
        <div
          style={{
            width: gridWidth,
            height: gridHeight,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            transform: `translate(${-offsetX}px, ${-(subY + STEP)}px)`,
          }}
        >
          {cells}
        </div>
      </div>
    </AbsoluteFill>
  );
};
