import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { H, W, scene } from "./tokens";

// PixelReveal — the chunky "big pixel" dissolve from the reference.
//
// A scene wipes in over whatever sits below it (the talking head) along a
// diagonal front. The front is built from square cells, not a clean edge —
// so it reads as blocky pixels, and a band of solid Base-blue squares
// scatters just ahead of the front before the real scene resolves behind it.
//
//   mode="in"   children are hidden, then revealed cell by cell.
//   mode="out"  children start whole, then dissolve away cell by cell.
//
// Pass `progress` (0..1) directly, or let it ride a frame window via
// startFrame / durationInFrames. Cells reveal in diagonal order from `from`,
// jittered per cell so the edge stays ragged.

type Corner =
  | "down-left"
  | "down-right"
  | "up-left"
  | "up-right"
  | "left"
  | "right";

export type PixelRevealProps = {
  children?: React.ReactNode;
  /** Explicit 0..1 reveal amount. Overrides the frame window. */
  progress?: number;
  startFrame?: number;
  durationInFrames?: number;
  mode?: "in" | "out";
  from?: Corner;
  /** Square cell edge in px. Bigger = chunkier pixels. */
  cellSize?: number;
  /** How far the scatter band leads the front, in progress units. */
  lead?: number;
  /** Per-cell ragged-edge amount, in progress units. */
  jitter?: number;
};

// Deterministic per-cell hash, GLSL-style — stable across frames.
const hash = (c: number, r: number): number => {
  const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// Diagonal coordinate 0..1 for a cell, given the origin corner/edge.
const diagFor = (from: Corner, fx: number, fy: number): number => {
  switch (from) {
    case "down-left":
      return 0.5 * fx + 0.5 * (1 - fy);
    case "down-right":
      return 0.5 * (1 - fx) + 0.5 * (1 - fy);
    case "up-left":
      return 0.5 * fx + 0.5 * fy;
    case "up-right":
      return 0.5 * (1 - fx) + 0.5 * fy;
    case "left":
      return fx;
    case "right":
      return 1 - fx;
  }
};

export const PixelReveal: React.FC<PixelRevealProps> = ({
  children,
  progress,
  startFrame = 0,
  durationInFrames = 24,
  mode = "in",
  from = "down-left",
  cellSize = 56,
  lead = 0.14,
  jitter = 0.18,
}) => {
  const frame = useCurrentFrame();
  const p =
    progress ??
    interpolate(frame, [startFrame, startFrame + durationInFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const cols = Math.ceil(W / cellSize);
  const rows = Math.ceil(H / cellSize);

  // Per-cell reveal threshold + the scatter band, recomputed each frame as p
  // advances. Cell is "shown" (content visible) once its threshold passes.
  const { maskUrl, scatter } = useMemo(() => {
    let rects = "";
    const blocks: { x: number; y: number; a: number; s: number; dx: number; dy: number }[] = [];

    for (let r = 0; r < rows; r++) {
      const fy = rows > 1 ? r / (rows - 1) : 0;
      for (let c = 0; c < cols; c++) {
        const fx = cols > 1 ? c / (cols - 1) : 0;
        const d = diagFor(from, fx, fy);
        const j = hash(c, r) * jitter;
        const threshold = (d + j) / (1 + jitter);

        const shown = mode === "in" ? threshold <= p : threshold > p;
        if (shown) {
          rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}"/>`;
        }

        // Scatter band of solid squares riding just ahead of the front.
        if (threshold > p && threshold <= p + lead) {
          const k = (threshold - p) / lead; // 0 at front → 1 at band edge
          const hjit = hash(c * 3 + 1, r * 7 + 5);
          blocks.push({
            x: c * cellSize,
            y: r * cellSize,
            a: (1 - k) * (0.55 + 0.45 * hjit),
            s: 0.6 + 0.5 * (1 - k),
            dx: (hjit - 0.5) * cellSize * 0.5 * k,
            dy: (hash(c * 5, r * 2) - 0.5) * cellSize * 0.5 * k,
          });
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g fill="#fff" shape-rendering="crispEdges">${rects}</g></svg>`;
    const url = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
    return { maskUrl: url, scatter: blocks };
  }, [p, mode, from, cellSize, cols, rows, jitter, lead]);

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          WebkitMaskImage: maskUrl,
          maskImage: maskUrl,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      >
        {children}
      </AbsoluteFill>

      {/* Scatter band — solid Base-blue pixels leading the front. */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {scatter.map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: cellSize,
              height: cellSize,
              background: scene.accent,
              borderRadius: 2,
              opacity: b.a,
              transform: `translate(${b.dx.toFixed(1)}px, ${b.dy.toFixed(1)}px) scale(${b.s.toFixed(3)})`,
            }}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
