// Source: a 50×50 grid of black quadrilateral cells that morph into red
// elongated diamonds via path attr-tween + a staggered ripple from one corner
// across the grid. The original is GSAP timeline with stagger:{from:50, grid}.
// Here we compute the same per-cell delay deterministically and run a single
// progress value per frame.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const GRID_N = 50;
const ORIGIN_X = GRID_N - 1; // bottom-right corner
const ORIGIN_Y = 0;
// Diagonal distance from origin (Chebyshev) — same look as GSAP's grid+from
const cellDistance = (x: number, y: number) => {
  return Math.max(Math.abs(x - ORIGIN_X), Math.abs(y - ORIGIN_Y));
};

// We can't easily morph one path → another in pure SVG without a polyfill.
// Both shapes have 6 vertices though, so we just linearly interpolate the
// coordinates and emit a new "M x y L x y L x y …" each frame.
const FROM_PTS: [number, number][] = [
  [0.5, 0.5], [0.2, 0.4], [1.3, 0.4], [1.5, 0.5], [1.3, 0.6], [0.2, 0.6],
];
const TO_PTS: [number, number][] = [
  [-0.5, 0.5], [0.5, -0.2], [1, -0.2], [1.5, 0.5], [1, 1.2], [0.5, 1.2],
];

const morphPath = (t: number) => {
  const e = (a: number, b: number) => a + (b - a) * t;
  const pts = FROM_PTS.map(([fx, fy], i) => {
    const [tx, ty] = TO_PTS[i];
    return [e(fx, tx), e(fy, ty)] as [number, number];
  });
  return [
    `M${pts[0][0]},${pts[0][1]}`,
    ...pts.slice(1).map(([x, y]) => `${x},${y}`),
  ].join(" ");
};

const lerpColor = (t: number): string => {
  // From near-black to red and back, like the yoyo
  const r = Math.round(17 + (255 - 17) * t);
  const g = Math.round(17 + (0 - 17) * t);
  const b = Math.round(17 + (0 - 17) * t);
  return `rgb(${r},${g},${b})`;
};

const MAX_DIST = cellDistance(0, GRID_N - 1);
// Each cell's delay (0..1) — closer to ORIGIN starts first
const cellDelay = (x: number, y: number) => cellDistance(x, y) / MAX_DIST;
// Per-cell duration as fraction of scene
const CELL_LEN = 0.35; // fraction of the scene the morph takes
// Total scene fraction over which the stagger plays. Set high so the wave
// sweeps across the grid before yo-yo'ing back.
const STAGGER_SPAN = 0.6;

const cellProgress = (delay: number, t: number) => {
  const halfT = t < 0.5 ? t * 2 : (1 - t) * 2; // yo-yo
  const start = delay * STAGGER_SPAN;
  const local = (halfT - start) / CELL_LEN;
  if (local <= 0) return 0;
  if (local >= 1) return 1;
  // Sine-in/out easing
  return 0.5 - 0.5 * Math.cos(local * Math.PI);
};

export const DiamondGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;

  const cells: React.ReactNode[] = [];
  // The grid is rotated 45° and scaled up so that the diamonds (which extend
  // outside their 1×1 cell when morphed) appear edge-to-edge.
  for (let y = 0; y < GRID_N; y++) {
    for (let x = 0; x < GRID_N; x++) {
      const p = cellProgress(cellDelay(x, y), t);
      cells.push(
        <path
          key={`${x}-${y}`}
          d={morphPath(p)}
          fill={lerpColor(p)}
          transform={`translate(${x - 0.2} ${y - 0.2}) rotate(45 0.5 0.5) scale(1.5 1)`}
        />,
      );
    }
  }

  return (
    <AbsoluteFill style={{ background: "black", display: "grid", placeItems: "center" }}>
      <svg
        viewBox="0 0 50 50"
        width="100vw"
        height="100vh"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block" }}
      >
        <g
          style={{ transformOrigin: "25px 25px" }}
          transform="rotate(45 25 25) scale(1.4)"
        >
          {cells}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
