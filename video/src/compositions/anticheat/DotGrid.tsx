import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FPS, H, W, colors } from "./theme";

// Two layers, no more, no less.
//
// Layer 1 — the fine uniform dot grid that fills the entire canvas. Faint
// Base blue. Reads as paper texture, not as a foreground element. Static.
//
// Layer 2 — the bold horizontal bands. Tightly-packed rows of saturated
// Base blue dots. They stream horizontally at varying velocities so the
// field reads as accelerating. Faster bands have tighter spacing — that
// contrast is what registers as motion.
//
// Each band wraps modularly: when a dot exits the right edge it reappears
// on the left so the stream is continuous.

// ─── Layer 1 — uniform background grid (static) ──────────────────────────────

const FINE_SPACING_X = 14;
const FINE_SPACING_Y = 14;
const FINE_RADIUS = 1.6;
const FINE_ALPHA = 0.22;

// ─── Layer 2 — moving bands ──────────────────────────────────────────────────

type Band = {
  // Vertical center of the band, fraction of canvas height.
  y: number;
  // Effective length of the band as drawn at any instant, fraction of width.
  // The shorter the length, the more "streak"-like the band.
  len: number;
  // Anchor — fraction of width where the band's mid-point sits when the
  // global cycle phase is 0. Lets us cluster bands around chosen rows.
  anchor: number;
  // Dot spacing (px). Smaller = denser/faster-feeling.
  spacing: number;
  // Dot radius (px).
  radius: number;
  // Peak alpha at band center.
  alpha: number;
  // Horizontal velocity (px/sec). Positive = drift right.
  velocity: number;
  // Phase offset (0..1) so bands don't all hit the same x at the same frame.
  phase: number;
};

// Bands clustered in three vertical zones — top, mid, bottom — like the
// Base reference. Speeds vary so the field has fast streaks alongside
// slow drifts; that contrast reads as acceleration.
const BANDS: Band[] = [
  // ── Top cluster (3 bands very close in y, different speeds)
  { y: 0.045, len: 0.62, anchor: 0.30, spacing: 7, radius: 2.4, alpha: 0.95, velocity: 380, phase: 0.00 },
  { y: 0.062, len: 0.58, anchor: 0.46, spacing: 6, radius: 2.4, alpha: 0.95, velocity: 540, phase: 0.30 },
  { y: 0.078, len: 0.42, anchor: 0.22, spacing: 7, radius: 2.4, alpha: 0.92, velocity: 320, phase: 0.55 },

  // ── Mid-upper accent
  { y: 0.18, len: 0.50, anchor: 0.70, spacing: 6, radius: 2.4, alpha: 0.92, velocity: 620, phase: 0.10 },
  { y: 0.197, len: 0.30, anchor: 0.84, spacing: 6, radius: 2.4, alpha: 0.92, velocity: 720, phase: 0.40 },

  // ── Quiet middle (one short fast streak so the eye keeps the rhythm)
  { y: 0.42, len: 0.18, anchor: 0.10, spacing: 6, radius: 2.2, alpha: 0.85, velocity: 820, phase: 0.65 },

  // ── Lower-mid accent
  { y: 0.61, len: 0.36, anchor: 0.78, spacing: 6, radius: 2.3, alpha: 0.90, velocity: 580, phase: 0.20 },
  { y: 0.628, len: 0.22, anchor: 0.88, spacing: 6, radius: 2.3, alpha: 0.90, velocity: 700, phase: 0.50 },

  // ── Bottom cluster (mirror of top)
  { y: 0.85, len: 0.58, anchor: 0.62, spacing: 7, radius: 2.4, alpha: 0.95, velocity: 360, phase: 0.05 },
  { y: 0.867, len: 0.62, anchor: 0.42, spacing: 6, radius: 2.4, alpha: 0.95, velocity: 500, phase: 0.35 },
  { y: 0.884, len: 0.46, anchor: 0.74, spacing: 7, radius: 2.4, alpha: 0.92, velocity: 280, phase: 0.60 },
];

// Edge fade fraction — how much of the band length on each side fades to
// zero. Same on both sides so streaks look symmetrical.
const FADE_FRACTION = 0.18;

type Props = {
  // Multiplier on overall dot opacity. Default 1.
  intensity?: number;
  // Multiplier on every band's velocity. 0 freezes the bands. Default 1.
  speed?: number;
};

export const DotGrid: React.FC<Props> = ({ intensity = 1, speed = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS; // seconds
  const cycleW = W * 1.6; // wrap width — enough that bands always have somewhere to come from

  // Build the fine grid once.
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

      {/* Layer 2 — streaming bands */}
      <g>
        {BANDS.map((band, bi) => {
          const yPx = band.y * H;
          const lenPx = band.len * W;
          const halfLen = lenPx / 2;

          // Mid-x of the band drifts to the right and wraps modularly.
          // Phase offset spreads bands across the cycle so they don't all
          // arrive at the anchor at the same frame.
          const drift = band.velocity * speed * t;
          const phasePx = band.phase * cycleW;
          const wrappedMid =
            ((band.anchor * W + drift + phasePx) % cycleW + cycleW) % cycleW
            - cycleW * 0.3;
          const x0Px = wrappedMid - halfLen;
          const x1Px = wrappedMid + halfLen;

          // Skip bands that are entirely off-screen.
          if (x1Px < -20 || x0Px > W + 20) return null;

          const fadePx = lenPx * FADE_FRACTION;
          const count = Math.max(2, Math.floor(lenPx / band.spacing));

          return (
            <g key={`b${bi}`}>
              {Array.from({ length: count }).map((_, di) => {
                const x = x0Px + di * band.spacing;
                if (x < -10 || x > W + 10) return null;

                const fromStart = x - x0Px;
                const fromEnd = x1Px - x;
                let alphaScale = 1;
                if (fromStart < fadePx) alphaScale *= fromStart / fadePx;
                if (fromEnd < fadePx) alphaScale *= fromEnd / fadePx;
                alphaScale = Math.max(0, Math.min(1, alphaScale));

                return (
                  <circle
                    key={`d${di}`}
                    cx={x}
                    cy={yPx}
                    r={band.radius}
                    fill={colors.accent}
                    opacity={band.alpha * alphaScale * intensity}
                  />
                );
              })}
            </g>
          );
        })}
      </g>
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
