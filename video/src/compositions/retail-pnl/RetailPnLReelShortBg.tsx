// Portrait, constant-speed port of anticheat/DotGrid (the AntiCheatFull
// background). Two layers: a fine dot grid breathing under a domain-warped wave
// field, and bright dot bands streaking across fast. direction picks the band
// axis — "horizontal" bands run left→right (white field), "vertical" bands fall
// top→bottom (blue field). tone flips the dot colour blue / white.
//
// The original ramps band speed inside a 12s scene; this loop runs longer, so
// the ramp is dropped for a steady fast drift. `lead` shifts the clock forward
// so the field is already in motion on frame 0.

import React from "react";
import { useCurrentFrame } from "remotion";

const W = 1080;
const H = 1920;
const FPS = 60;
const ACCENT = "#0052FF";

const FINE_SPACING = 18;
const FINE_RADIUS = 1.8;
const FINE_ALPHA = 0.22;

// ── Layer 1 — domain-warped interference field (verbatim from DotGrid) ───────
const WAVE_K1 = (2 * Math.PI) / 760;
const WAVE_K2 = (2 * Math.PI) / 1180;
const WAVE_OMEGA_1 = 4.4;
const WAVE_OMEGA_2 = 2.7;
const WAVE_WARP_AMP = 220;
const WAVE_WARP_OMEGA_1 = 1.85;
const WAVE_WARP_OMEGA_2 = 1.45;
const WAVE_RADIAL_K = 0.0115;
const WAVE_RADIAL_OMEGA = 3.4;
const WAVE_CENTRE_OMEGA_X = 0.78;
const WAVE_CENTRE_OMEGA_Y = 0.95;
const WAVE_RADIUS_MIN = 0.79;
const WAVE_RADIUS_MAX = 1.21;
const WAVE_ALPHA_MIN = 0.89;
const WAVE_ALPHA_MAX = 1.11;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const waveAt = (x: number, y: number, t: number) => {
  const wx = Math.sin(0.0036 * x + 0.0021 * y + WAVE_WARP_OMEGA_1 * t);
  const wy = Math.cos(0.0027 * x - 0.0033 * y + WAVE_WARP_OMEGA_2 * t + 1.7);
  const xw = x + WAVE_WARP_AMP * wx;
  const yw = y + WAVE_WARP_AMP * wy;
  const a = Math.sin(WAVE_K1 * xw + 0.32 * WAVE_K1 * yw - WAVE_OMEGA_1 * t);
  const b = Math.sin(
    0.62 * WAVE_K2 * xw + 0.95 * WAVE_K2 * yw - WAVE_OMEGA_2 * t + 1.37,
  );
  const cx = W * 0.5 + 0.28 * W * Math.sin(WAVE_CENTRE_OMEGA_X * t);
  const cy = H * 0.5 + 0.32 * H * Math.cos(WAVE_CENTRE_OMEGA_Y * t + 0.7);
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const radial = Math.sin(WAVE_RADIAL_K * r - WAVE_RADIAL_OMEGA * t);
  const raw = 1.6 * a * b + 0.7 * radial;
  return (Math.tanh(raw * 0.85) + 1) * 0.5;
};

// ── Layer 2 — bands. `main` is the travel axis, `cross` the stacked axis. ────
type Band = {
  cross: number; // fraction across the cross axis where the band sits
  len: number; // fraction of the travel axis
  anchor: number; // fraction of the travel axis at phase 0
  thick: number; // rows/cols of dots stacked across
  alpha: number;
  velocity: number; // px/sec along the travel axis
  phase: number;
};

const BANDS: Band[] = [
  { cross: 0.045, len: 0.62, anchor: 0.3, thick: 2, alpha: 0.95, velocity: 380, phase: 0.0 },
  { cross: 0.08, len: 0.58, anchor: 0.46, thick: 1, alpha: 0.92, velocity: 540, phase: 0.3 },
  { cross: 0.115, len: 0.42, anchor: 0.22, thick: 2, alpha: 0.95, velocity: 320, phase: 0.55 },
  { cross: 0.21, len: 0.5, anchor: 0.7, thick: 1, alpha: 0.92, velocity: 620, phase: 0.1 },
  { cross: 0.245, len: 0.3, anchor: 0.84, thick: 2, alpha: 0.95, velocity: 720, phase: 0.4 },
  { cross: 0.5, len: 0.18, anchor: 0.1, thick: 1, alpha: 0.85, velocity: 820, phase: 0.65 },
  { cross: 0.78, len: 0.36, anchor: 0.78, thick: 2, alpha: 0.92, velocity: 580, phase: 0.2 },
  { cross: 0.815, len: 0.22, anchor: 0.88, thick: 1, alpha: 0.9, velocity: 700, phase: 0.5 },
  { cross: 0.885, len: 0.58, anchor: 0.62, thick: 2, alpha: 0.95, velocity: 360, phase: 0.05 },
  { cross: 0.92, len: 0.62, anchor: 0.42, thick: 1, alpha: 0.92, velocity: 500, phase: 0.35 },
  { cross: 0.955, len: 0.46, anchor: 0.74, thick: 3, alpha: 0.95, velocity: 280, phase: 0.6 },
];

const FADE_FRACTION = 0.18;
const snap = (px: number) =>
  Math.round((px + FINE_SPACING / 2) / FINE_SPACING) * FINE_SPACING -
  FINE_SPACING / 2;

type Props = {
  direction?: "horizontal" | "vertical";
  tone?: "accent" | "white";
  intensity?: number;
  speed?: number;
  lead?: number; // frames of head-start so the field is already moving at 0
};

export const RetailPnLReelShortBg: React.FC<Props> = ({
  direction = "horizontal",
  tone = "accent",
  intensity = 1,
  speed = 2.6,
  lead = 0,
}) => {
  const frame = useCurrentFrame();
  const t = (frame + lead) / FPS;
  const horizontal = direction === "horizontal";
  const travel = horizontal ? W : H; // length of the travel axis
  const cycle = travel * 1.6;
  const dotFill = tone === "white" ? "#FFFFFF" : ACCENT;

  const fineCols = Math.ceil(W / FINE_SPACING) + 2;
  const fineRows = Math.ceil(H / FINE_SPACING) + 2;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {/* Layer 1 — fine grid breathing under the wave field */}
      <g>
        {Array.from({ length: fineRows }).map((_, ry) => {
          const y = ry * FINE_SPACING - FINE_SPACING / 2;
          return (
            <g key={`r${ry}`}>
              {Array.from({ length: fineCols }).map((_, rx) => {
                const x = rx * FINE_SPACING - FINE_SPACING / 2;
                const w = waveAt(x, y, t);
                const r = FINE_RADIUS * lerp(WAVE_RADIUS_MIN, WAVE_RADIUS_MAX, w);
                const a =
                  FINE_ALPHA *
                  intensity *
                  Math.min(1, lerp(WAVE_ALPHA_MIN, WAVE_ALPHA_MAX, w));
                return (
                  <circle key={`c${rx}`} cx={x} cy={y} r={r} fill={dotFill} opacity={a} />
                );
              })}
            </g>
          );
        })}
      </g>

      {/* Layer 2 — bright bands streaking along the travel axis at a steady drift */}
      <g>
        {BANDS.map((band, bi) => {
          const crossPx = snap(band.cross * (horizontal ? H : W));
          const lenPx = band.len * travel;
          const halfLen = lenPx / 2;
          const drift = band.velocity * speed * t;
          const phasePx = band.phase * cycle;
          const mid =
            ((((band.anchor * travel + drift + phasePx) % cycle) + cycle) % cycle) -
            cycle * 0.3;
          const m0 = snap(mid - halfLen);
          const m1 = snap(mid + halfLen);
          if (m1 < -20 || m0 > travel + 20) return null;

          const fadePx = lenPx * FADE_FRACTION;
          const count = Math.max(2, Math.round((m1 - m0) / FINE_SPACING) + 1);
          const crossOffsets: number[] = [];
          const crossAnchor = Math.floor((band.thick - 1) / 2);
          for (let c = 0; c < band.thick; c++) {
            crossOffsets.push((c - crossAnchor) * FINE_SPACING);
          }

          return (
            <g key={`b${bi}`}>
              {crossOffsets.map((cOff, ci) => (
                <g key={`o${ci}`}>
                  {Array.from({ length: count }).map((_, di) => {
                    const m = m0 + di * FINE_SPACING;
                    if (m < -10 || m > travel + 10) return null;
                    const fromStart = m - m0;
                    const fromEnd = m1 - m;
                    let aScale = 1;
                    if (fromStart < fadePx) aScale *= fromStart / fadePx;
                    if (fromEnd < fadePx) aScale *= fromEnd / fadePx;
                    aScale = Math.max(0, Math.min(1, aScale));
                    const cx = horizontal ? m : crossPx + cOff;
                    const cy = horizontal ? crossPx + cOff : m;
                    return (
                      <circle
                        key={`d${di}`}
                        cx={cx}
                        cy={cy}
                        r={FINE_RADIUS}
                        fill={dotFill}
                        opacity={band.alpha * aScale * intensity}
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
