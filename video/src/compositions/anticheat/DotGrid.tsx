import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { H, W, colors } from "./theme";

// The Base-style dotted-line backdrop.
//
// Horizontal rows of small dots, of varying lengths and densities, scattered
// asymmetrically across the field. Some rows hug the left edge, some the
// right, some sit cleanly mid-canvas. The dot color is Base blue (the
// `accent`) at low alpha — the texture must read as paper under x-ray, not
// as a foreground element.
//
// The grid drifts very slowly so it never feels frozen on long holds.

type Row = {
  // Vertical position as a fraction of canvas height.
  y: number;
  // Horizontal start, fraction of width. Negative is allowed (off-canvas).
  x0: number;
  // Length, fraction of width.
  len: number;
  // Dot count along the row.
  count: number;
  // Dot radius in px.
  r: number;
  // 0 → near-invisible, 1 → full accent at base alpha.
  weight: number;
  // 0 → dotted, 1 → dashes (treated as elongated dot strokes).
  dash: number;
};

// A hand-tuned set so the texture looks designed, not noisy.
// Dots are sparse near vertical center (where headlines live) and dense
// near top and bottom edges.
const ROWS: Row[] = [
  { y: 0.04, x0: -0.02, len: 0.30, count: 22, r: 2.5, weight: 0.6, dash: 0 },
  { y: 0.06, x0: 0.30, len: 0.18, count: 12, r: 2.0, weight: 0.4, dash: 0 },
  { y: 0.08, x0: 0.62, len: 0.42, count: 32, r: 2.5, weight: 0.7, dash: 0 },
  { y: 0.11, x0: 0.04, len: 0.22, count: 15, r: 2.0, weight: 0.5, dash: 0 },
  { y: 0.13, x0: 0.38, len: 0.12, count: 8, r: 2.0, weight: 0.35, dash: 0 },
  { y: 0.16, x0: 0.55, len: 0.30, count: 22, r: 2.5, weight: 0.55, dash: 0 },
  { y: 0.19, x0: 0.10, len: 0.40, count: 28, r: 2.0, weight: 0.45, dash: 0 },
  { y: 0.22, x0: 0.66, len: 0.20, count: 14, r: 2.0, weight: 0.35, dash: 0 },
  { y: 0.26, x0: 0.02, len: 0.16, count: 11, r: 2.0, weight: 0.30, dash: 0 },
  { y: 0.30, x0: 0.74, len: 0.24, count: 17, r: 2.0, weight: 0.40, dash: 0 },
  { y: 0.34, x0: 0.20, len: 0.10, count: 7, r: 1.8, weight: 0.25, dash: 0 },
  { y: 0.38, x0: 0.58, len: 0.18, count: 13, r: 2.0, weight: 0.35, dash: 0 },
  { y: 0.42, x0: -0.02, len: 0.14, count: 10, r: 1.8, weight: 0.22, dash: 0 },
  { y: 0.50, x0: 0.78, len: 0.10, count: 7, r: 1.8, weight: 0.20, dash: 0 },
  { y: 0.54, x0: 0.05, len: 0.12, count: 8, r: 1.8, weight: 0.22, dash: 0 },
  { y: 0.58, x0: 0.62, len: 0.20, count: 14, r: 2.0, weight: 0.30, dash: 0 },
  { y: 0.62, x0: 0.18, len: 0.16, count: 11, r: 1.8, weight: 0.30, dash: 0 },
  { y: 0.66, x0: 0.74, len: 0.22, count: 16, r: 2.0, weight: 0.40, dash: 0 },
  { y: 0.70, x0: 0.04, len: 0.26, count: 18, r: 2.0, weight: 0.45, dash: 0 },
  { y: 0.74, x0: 0.46, len: 0.14, count: 10, r: 2.0, weight: 0.35, dash: 0 },
  { y: 0.78, x0: 0.10, len: 0.40, count: 28, r: 2.5, weight: 0.55, dash: 0 },
  { y: 0.81, x0: 0.62, len: 0.18, count: 13, r: 2.0, weight: 0.40, dash: 0 },
  { y: 0.84, x0: 0.02, len: 0.18, count: 13, r: 2.0, weight: 0.40, dash: 0 },
  { y: 0.87, x0: 0.36, len: 0.30, count: 22, r: 2.5, weight: 0.55, dash: 0 },
  { y: 0.90, x0: 0.72, len: 0.26, count: 19, r: 2.5, weight: 0.65, dash: 0 },
  { y: 0.93, x0: 0.06, len: 0.16, count: 12, r: 2.0, weight: 0.45, dash: 0 },
  { y: 0.96, x0: 0.42, len: 0.36, count: 26, r: 2.5, weight: 0.70, dash: 0 },
];

type Props = {
  // Multiplier on overall dot opacity. Default 1.
  intensity?: number;
  // When true, the grid drifts slowly horizontally — handy for static scenes.
  drift?: boolean;
};

export const DotGrid: React.FC<Props> = ({ intensity = 1, drift = true }) => {
  const frame = useCurrentFrame();
  const driftOffset = drift ? Math.sin(frame / 240) * 8 : 0;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {ROWS.map((row, ri) => {
        const yPx = row.y * H;
        const x0Px = row.x0 * W + driftOffset;
        const lenPx = row.len * W;
        const step = lenPx / Math.max(1, row.count - 1);
        const baseAlpha = 0.42 * row.weight * intensity;

        return (
          <g key={ri}>
            {Array.from({ length: row.count }).map((_, di) => {
              const x = x0Px + di * step;
              if (x < -10 || x > W + 10) return null;
              return (
                <circle
                  key={di}
                  cx={x}
                  cy={yPx}
                  r={row.r}
                  fill={colors.accent}
                  opacity={baseAlpha}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

// A faint vignette in the corners so headlines on the centerline get more
// breathing room than the dot grid alone provides.
export const DotGridVignette: React.FC<{ intensity?: number }> = ({
  intensity = 0.25,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `radial-gradient(ellipse at center, rgba(240,242,244,0) 40%, rgba(240,242,244,${intensity}) 100%)`,
    }}
  />
);

// Optional intensity ramp for scene entries: dots fade up over the first
// `inFrames`, hold, then optionally fade down before `outAt`.
export const useGridIntensity = (
  inFrames = 8,
  outAt?: number,
  outFrames = 8,
): number => {
  const frame = useCurrentFrame();
  const inT = interpolate(frame, [0, inFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (outAt === undefined) return inT;
  const outT = interpolate(
    frame,
    [outAt, outAt + outFrames],
    [1, 0.4],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return inT * outT;
};
