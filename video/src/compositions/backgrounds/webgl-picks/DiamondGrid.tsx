// Faithful port of the original GSAP 50×50 diamond-grid ripple.
//
// The source builds a 50×50 grid of <path> elements. Each cell starts as
// a thin hexagon (path A) and morphs to a fat diamond (path B), fill #111
// to #f00. A GSAP `stagger:{amount:6, from:50, grid:[50,50], repeat:-1,
// yoyo:true, ease:'sine.in'}` fires the cells in a wave from grid index 50
// (column 0, row 1 of the row-major array), with the wave taking 6s to
// sweep across the grid. The group itself is rotated 45° and scaled 1.4×.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

// ── The two morph endpoints, taken verbatim from the source ────────────────
//   from: "M.5,.5 .2,.4 1.3,.4 1.5,.5 1.3,.6 .2,.6"   (thin hexagon)
//   to:   "M-.5,.5 .5,-.2 1,-.2 1.5,.5 1,1.2 .5,1.2"  (fat diamond)
// Both have six vertices, so we can lerp coordinate-by-coordinate.

type Pt = [number, number];

const FROM_PTS: Pt[] = [
  [0.5, 0.5],
  [0.2, 0.4],
  [1.3, 0.4],
  [1.5, 0.5],
  [1.3, 0.6],
  [0.2, 0.6],
];

const TO_PTS: Pt[] = [
  [-0.5, 0.5],
  [0.5, -0.2],
  [1.0, -0.2],
  [1.5, 0.5],
  [1.0, 1.2],
  [0.5, 1.2],
];

const morphPath = (t: number): string => {
  const pts = FROM_PTS.map(
    ([fx, fy], i): Pt => {
      const [tx, ty] = TO_PTS[i];
      return [fx + (tx - fx) * t, fy + (ty - fy) * t];
    },
  );
  return [
    `M${pts[0][0]},${pts[0][1]}`,
    ...pts.slice(1).map(([x, y]) => `${x},${y}`),
  ].join(" ");
};

// Color lerp between #111 and #f00.
const lerpColor = (t: number): string => {
  const r = Math.round(17 + (255 - 17) * t);
  const g = Math.round(17 + (0 - 17) * t);
  const b = Math.round(17 + (0 - 17) * t);
  return `rgb(${r},${g},${b})`;
};

// ── Grid + stagger config ──────────────────────────────────────────────────

const GRID_N = 50;

// The source's for-loop order is `for(x) for(y)`, so index = x*N + y.
// GSAP's `from: 50` picks index 50 → (x=1, y=0).
const ORIGIN_X = 1;
const ORIGIN_Y = 0;

// Chebyshev distance — matches GSAP's `grid` stagger default
// (max(abs(dx), abs(dy))).
const cellDistance = (x: number, y: number): number => {
  return Math.max(Math.abs(x - ORIGIN_X), Math.abs(y - ORIGIN_Y));
};

const MAX_DIST = cellDistance(GRID_N - 1, GRID_N - 1);

// GSAP `stagger:{amount:6}` spreads delays evenly so the very last cell
// starts at +6s from the first. So per-cell delay = (distance / maxDist) * 6s.
const STAGGER_AMOUNT_S = 6;

// Per-cell morph duration is 3s forward + 3s back (yoyo), so a full
// per-cell cycle is 6s. Repeat:-1.
const CELL_DURATION_S = 3;
const CELL_FULL_CYCLE_S = CELL_DURATION_S * 2;

// `ease:'expo'` on the forward morph, `yoyoEase:'sine.inOut'` on the reverse
// (which means yoyo uses sine.inOut). GSAP `expo` ≈ powerOut(3), but for the
// morph we want the forward to feel snappy: use the standard expoOut curve.
const expoOut = Easing.bezier(0.16, 1, 0.3, 1);
const sineInOut = Easing.bezier(0.4, 0, 0.6, 1);

// `stagger.ease:'sine.in'` shapes how cell delays distribute along the
// stagger window. With ease:'sine.in', cells near the origin fire slowly
// then more cells fire later. Apply that easing to the normalised distance
// before multiplying by STAGGER_AMOUNT_S.
const sineIn = Easing.bezier(0.12, 0, 0.39, 0);

const cellDelaySeconds = (x: number, y: number): number => {
  const dNorm = cellDistance(x, y) / MAX_DIST;
  return sineIn(dNorm) * STAGGER_AMOUNT_S;
};

// Compute a cell's morph progress at a given scene time (seconds).
const cellMorphProgress = (delay: number, sceneSec: number): number => {
  // Each cell starts at its delay, runs 3s forward, then 3s back, then
  // repeats forever. We loop within the 6s full cycle.
  const tInCycle = ((sceneSec - delay) % CELL_FULL_CYCLE_S +
    CELL_FULL_CYCLE_S) %
    CELL_FULL_CYCLE_S;

  if (tInCycle < CELL_DURATION_S) {
    // Forward — expoOut
    return expoOut(tInCycle / CELL_DURATION_S);
  }
  // Back — sineInOut
  return 1 - sineInOut((tInCycle - CELL_DURATION_S) / CELL_DURATION_S);
};

export const DiamondGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneSec = frame / fps;

  // Build the grid in the source's row-major order (for(x) for(y))
  // so per-cell positions and the wave shape match.
  const cells: React.ReactNode[] = [];
  for (let x = 0; x < GRID_N; x++) {
    for (let y = 0; y < GRID_N; y++) {
      const delay = cellDelaySeconds(x, y);
      const p = cellMorphProgress(delay, sceneSec);
      const d = morphPath(p);
      const fill = lerpColor(p);
      // Per-cell transform from the source's gsap.set:
      //   x: x-.2, y: y-.2, transformOrigin: '0.5 0.5',
      //   rotate: 45, scaleX: 1.5
      const tx = x - 0.2;
      const ty = y - 0.2;
      cells.push(
        <path
          key={`${x}-${y}`}
          d={d}
          fill={fill}
          transform={
            `translate(${tx} ${ty}) ` +
            `rotate(45 0.5 0.5) ` +
            `scale(1.5 1)`
          }
        />,
      );
    }
  }

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 50 50"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block", background: "#000" }}
      >
        {/* Group-level transform from source:
            gsap.set(g, {svgOrigin:'25 25', rotate:45, scale:1.4}) */}
        <g transform="translate(25 25) rotate(45) scale(1.4) translate(-25 -25)">
          {cells}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
