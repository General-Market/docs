import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FPS, H, W, colors } from "./theme";
import { bgLayerTransform } from "./transitions";

// Two layers, no more, no less.
//
// Layer 1 — the fine uniform dot grid that fills the entire canvas. Faint
// Base blue. Reads as paper texture, not as a foreground element. Static.
//
// Layer 2 — the bold horizontal bands. They share the grid's spacing and
// dot positions; what makes a band a band is that its dots are saturated
// rather than faint, and that 1, 2 or 3 grid rows can be stacked together
// to give the band visible thickness. The band stream travels horizontally
// at varied velocities — that contrast reads as acceleration.
//
// Each band wraps modularly: when its leading dot exits the right edge it
// reappears on the left so the stream is continuous.

const FINE_SPACING_X = 14;
const FINE_SPACING_Y = 14;
const FINE_RADIUS = 1.6;
const FINE_ALPHA = 0.22;

// ─── Layer 2 — moving bands ──────────────────────────────────────────────────

type Band = {
  // Vertical center of the band, fraction of canvas height.
  y: number;
  // Effective length, fraction of width.
  len: number;
  // Anchor — fraction of width where the band's mid-point sits when phase=0.
  anchor: number;
  // Number of grid rows this band occupies (1, 2 or 3).
  rows: number;
  // Peak alpha at band center.
  alpha: number;
  // Horizontal velocity (px/sec).
  velocity: number;
  // Phase offset (0..1) so bands don't all hit the anchor at the same frame.
  phase: number;
};

// Bands clustered in three vertical zones — top, mid, bottom. Speeds vary
// so fast streaks live alongside slow drifts; the contrast reads as motion.
const BANDS: Band[] = [
  // ── Top cluster
  { y: 0.045, len: 0.62, anchor: 0.30, rows: 2, alpha: 0.95, velocity: 380, phase: 0.00 },
  { y: 0.080, len: 0.58, anchor: 0.46, rows: 1, alpha: 0.92, velocity: 540, phase: 0.30 },
  { y: 0.115, len: 0.42, anchor: 0.22, rows: 2, alpha: 0.95, velocity: 320, phase: 0.55 },

  // ── Mid-upper accent
  { y: 0.21, len: 0.50, anchor: 0.70, rows: 1, alpha: 0.92, velocity: 620, phase: 0.10 },
  { y: 0.245, len: 0.30, anchor: 0.84, rows: 2, alpha: 0.95, velocity: 720, phase: 0.40 },

  // ── Quiet middle (one short fast streak)
  { y: 0.42, len: 0.18, anchor: 0.10, rows: 1, alpha: 0.85, velocity: 820, phase: 0.65 },

  // ── Lower-mid accent
  { y: 0.62, len: 0.36, anchor: 0.78, rows: 2, alpha: 0.92, velocity: 580, phase: 0.20 },
  { y: 0.655, len: 0.22, anchor: 0.88, rows: 1, alpha: 0.90, velocity: 700, phase: 0.50 },

  // ── Bottom cluster
  { y: 0.85, len: 0.58, anchor: 0.62, rows: 2, alpha: 0.95, velocity: 360, phase: 0.05 },
  { y: 0.885, len: 0.62, anchor: 0.42, rows: 1, alpha: 0.92, velocity: 500, phase: 0.35 },
  { y: 0.92, len: 0.46, anchor: 0.74, rows: 3, alpha: 0.95, velocity: 280, phase: 0.60 },
];

const FADE_FRACTION = 0.18;

type Props = {
  intensity?: number;
  speed?: number;
};

// Snaps a fractional canvas y to the nearest grid row center.
const snapToGridY = (frac: number) => {
  const px = frac * H;
  return Math.round(px / FINE_SPACING_Y) * FINE_SPACING_Y;
};

// Snaps a px x to the nearest grid column.
const snapToGridX = (px: number) =>
  Math.round(px / FINE_SPACING_X) * FINE_SPACING_X;

// Acceleration profile. Bands' effective travel distance grows as
// t * (1 + t * RAMP) instead of plain t. Result: at scene start they drift
// at the base velocity; by scene end they're moving several times faster.
// The eye reads the ramp as acceleration.
const ACCEL_RAMP = 0.85;
const accelDistance = (t: number) => t * (1 + t * ACCEL_RAMP);

export const DotGrid: React.FC<Props> = ({ intensity = 1, speed = 1.5 }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cycleW = W * 1.6;

  const fineCols = Math.ceil(W / FINE_SPACING_X) + 2;
  const fineRows = Math.ceil(H / FINE_SPACING_Y) + 2;

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
        transform: bgLayerTransform,
        transformOrigin: "50% 50%",
        willChange: "transform",
      }}
    >
      {/* Layer 1 — uniform fine grid */}
      <g opacity={FINE_ALPHA * intensity}>
        {Array.from({ length: fineRows }).map((_, ry) => {
          const y = ry * FINE_SPACING_Y - FINE_SPACING_Y / 2;
          return (
            <g key={`r${ry}`}>
              {Array.from({ length: fineCols }).map((_, rx) => {
                const x = rx * FINE_SPACING_X - FINE_SPACING_X / 2;
                return (
                  <circle
                    key={`r${ry}c${rx}`}
                    cx={x}
                    cy={y}
                    r={FINE_RADIUS}
                    fill={colors.accent}
                  />
                );
              })}
            </g>
          );
        })}
      </g>

      {/* Layer 2 — moving bands. Aligned to the fine-grid lattice. */}
      <g>
        {BANDS.map((band, bi) => {
          const yCenterPx = snapToGridY(band.y);
          const lenPx = band.len * W;
          const halfLen = lenPx / 2;
          const drift = band.velocity * speed * accelDistance(t);
          const phasePx = band.phase * cycleW;
          const wrappedMid =
            ((band.anchor * W + drift + phasePx) % cycleW + cycleW) % cycleW
            - cycleW * 0.3;
          const x0 = snapToGridX(wrappedMid - halfLen);
          const x1 = snapToGridX(wrappedMid + halfLen);

          if (x1 < -20 || x0 > W + 20) return null;

          const fadePx = lenPx * FADE_FRACTION;
          const cols = Math.max(2, Math.round((x1 - x0) / FINE_SPACING_X) + 1);

          // Stack `rows` rows, centered vertically on yCenterPx.
          const rowOffsets: number[] = [];
          for (let r = 0; r < band.rows; r++) {
            rowOffsets.push((r - (band.rows - 1) / 2) * FINE_SPACING_Y);
          }

          return (
            <g key={`b${bi}`}>
              {rowOffsets.map((yOff, ri) => (
                <g key={`b${bi}r${ri}`}>
                  {Array.from({ length: cols }).map((_, di) => {
                    const x = x0 + di * FINE_SPACING_X;
                    if (x < -10 || x > W + 10) return null;

                    const fromStart = x - x0;
                    const fromEnd = x1 - x;
                    let alphaScale = 1;
                    if (fromStart < fadePx) alphaScale *= fromStart / fadePx;
                    if (fromEnd < fadePx) alphaScale *= fromEnd / fadePx;
                    alphaScale = Math.max(0, Math.min(1, alphaScale));

                    return (
                      <circle
                        key={`d${di}`}
                        cx={x}
                        cy={yCenterPx + yOff}
                        r={FINE_RADIUS}
                        fill={colors.accent}
                        opacity={band.alpha * alphaScale * intensity}
                      />
                    );
                  })}
                </g>
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

// ─── Vertical variant ────────────────────────────────────────────────────────
//
// Same lattice, same band logic — rotated 90°. Bright vertical bands of
// saturated dots drift downward through the field. Used for scenes where
// the rhythm needs to feel like falling rather than running.

type VBand = {
  // Horizontal center of the band, fraction of canvas width.
  x: number;
  // Effective length, fraction of height.
  len: number;
  // Anchor — fraction of height where the band's mid-point sits when phase=0.
  anchor: number;
  // Number of grid columns this band occupies (1, 2 or 3).
  cols: number;
  // Peak alpha at band center.
  alpha: number;
  // Vertical velocity (px/sec).
  velocity: number;
  // Phase offset (0..1).
  phase: number;
};

const V_BANDS: VBand[] = [
  // Left cluster
  { x: 0.045, len: 0.62, anchor: 0.30, cols: 2, alpha: 0.95, velocity: 380, phase: 0.00 },
  { x: 0.080, len: 0.58, anchor: 0.46, cols: 1, alpha: 0.92, velocity: 540, phase: 0.30 },
  { x: 0.115, len: 0.42, anchor: 0.22, cols: 2, alpha: 0.95, velocity: 320, phase: 0.55 },

  // Mid-left accent
  { x: 0.21, len: 0.50, anchor: 0.70, cols: 1, alpha: 0.92, velocity: 620, phase: 0.10 },
  { x: 0.245, len: 0.30, anchor: 0.84, cols: 2, alpha: 0.95, velocity: 720, phase: 0.40 },

  // Centre (short fast streak)
  { x: 0.50, len: 0.18, anchor: 0.10, cols: 1, alpha: 0.85, velocity: 820, phase: 0.65 },

  // Mid-right accent
  { x: 0.78, len: 0.36, anchor: 0.78, cols: 2, alpha: 0.92, velocity: 580, phase: 0.20 },
  { x: 0.815, len: 0.22, anchor: 0.88, cols: 1, alpha: 0.90, velocity: 700, phase: 0.50 },

  // Right cluster
  { x: 0.885, len: 0.58, anchor: 0.62, cols: 2, alpha: 0.95, velocity: 360, phase: 0.05 },
  { x: 0.92, len: 0.62, anchor: 0.42, cols: 1, alpha: 0.92, velocity: 500, phase: 0.35 },
  { x: 0.955, len: 0.46, anchor: 0.74, cols: 3, alpha: 0.95, velocity: 280, phase: 0.60 },
];

const snapToGridXPx = (px: number) =>
  Math.round(px / FINE_SPACING_X) * FINE_SPACING_X;

const snapToGridYPx = (px: number) =>
  Math.round(px / FINE_SPACING_Y) * FINE_SPACING_Y;

const snapToGridXFrac = (frac: number) => snapToGridXPx(frac * W);

export const VerticalDotGrid: React.FC<Props> = ({
  intensity = 1,
  speed = 1.5,
}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cycleH = H * 1.6;

  const fineCols = Math.ceil(W / FINE_SPACING_X) + 2;
  const fineRows = Math.ceil(H / FINE_SPACING_Y) + 2;

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
        transform: bgLayerTransform,
        transformOrigin: "50% 50%",
        willChange: "transform",
      }}
    >
      {/* Layer 1 — uniform fine grid */}
      <g opacity={FINE_ALPHA * intensity}>
        {Array.from({ length: fineRows }).map((_, ry) => {
          const y = ry * FINE_SPACING_Y - FINE_SPACING_Y / 2;
          return (
            <g key={`r${ry}`}>
              {Array.from({ length: fineCols }).map((_, rx) => {
                const x = rx * FINE_SPACING_X - FINE_SPACING_X / 2;
                return (
                  <circle
                    key={`r${ry}c${rx}`}
                    cx={x}
                    cy={y}
                    r={FINE_RADIUS}
                    fill={colors.accent}
                  />
                );
              })}
            </g>
          );
        })}
      </g>

      {/* Layer 2 — vertical bands drifting downward */}
      <g>
        {V_BANDS.map((band, bi) => {
          const xCenterPx = snapToGridXFrac(band.x);
          const lenPx = band.len * H;
          const halfLen = lenPx / 2;
          const drift = band.velocity * speed * accelDistance(t);
          const phasePx = band.phase * cycleH;
          const wrappedMid =
            (((band.anchor * H + drift + phasePx) % cycleH) + cycleH) %
              cycleH -
            cycleH * 0.3;
          const y0 = snapToGridYPx(wrappedMid - halfLen);
          const y1 = snapToGridYPx(wrappedMid + halfLen);

          if (y1 < -20 || y0 > H + 20) return null;

          const fadePx = lenPx * FADE_FRACTION;
          const rows = Math.max(2, Math.round((y1 - y0) / FINE_SPACING_Y) + 1);

          const colOffsets: number[] = [];
          for (let r = 0; r < band.cols; r++) {
            colOffsets.push((r - (band.cols - 1) / 2) * FINE_SPACING_X);
          }

          return (
            <g key={`b${bi}`}>
              {colOffsets.map((xOff, ri) => (
                <g key={`b${bi}c${ri}`}>
                  {Array.from({ length: rows }).map((_, di) => {
                    const y = y0 + di * FINE_SPACING_Y;
                    if (y < -10 || y > H + 10) return null;

                    const fromStart = y - y0;
                    const fromEnd = y1 - y;
                    let alphaScale = 1;
                    if (fromStart < fadePx) alphaScale *= fromStart / fadePx;
                    if (fromEnd < fadePx) alphaScale *= fromEnd / fadePx;
                    alphaScale = Math.max(0, Math.min(1, alphaScale));

                    return (
                      <circle
                        key={`d${di}`}
                        cx={xCenterPx + xOff}
                        cy={y}
                        r={FINE_RADIUS}
                        fill={colors.accent}
                        opacity={band.alpha * alphaScale * intensity}
                      />
                    );
                  })}
                </g>
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export const DotGridVignette: React.FC<{ intensity?: number }> = ({
  intensity = 0.25,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `radial-gradient(ellipse at center, rgba(240,242,244,0) 40%, rgba(240,242,244,${intensity}) 100%)`,
      transform: bgLayerTransform,
      transformOrigin: "50% 50%",
      willChange: "transform",
    }}
  />
);

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

// Re-export the grid lattice constants so scenes that inline a custom
// dot grid (e.g. the inverted endcard) can stay aligned to the same spacing.
export const GRID_SPACING_X = FINE_SPACING_X;
export const GRID_SPACING_Y = FINE_SPACING_Y;
export const GRID_DOT_RADIUS = FINE_RADIUS;
