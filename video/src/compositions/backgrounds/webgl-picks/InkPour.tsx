// Variation of SvgMorph: ink pouring from above instead of rising from below.
// Same idea inverted. The path's underside is the animated edge, jagged with
// noise so it reads as a tearing front of fluid rather than a clean horizon.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

const N = 32;

function hash(x: number, y: number): number {
  const s = Math.sin(x * 91.7 + y * 173.3) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  const sx = smooth(fx);
  const sy = smooth(fy);
  return (
    a * (1 - sx) * (1 - sy) +
    b * sx * (1 - sy) +
    c * (1 - sx) * sy +
    d * sx * sy
  );
}

// Cubic out — slow then fast, like a falling drop catching gravity.
function easeInCubic(t: number): number {
  return t * t * t;
}

function buildPath(progress: number, frame: number): string {
  // baseY: 0 = above the screen (hidden), 100 = past the bottom (full).
  const baseY = 100 * easeInCubic(progress);
  const amp = (1 - Math.min(1, progress * 1.1)) * 16;

  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * 100;

    // Two octaves of value noise, plus a slow lateral drift so the front
    // tears unevenly across the screen.
    const n1 = valueNoise2D(x * 0.05 + frame * 0.004, frame * 0.015) - 0.5;
    const n2 = valueNoise2D(x * 0.14 - 33, frame * 0.025) - 0.5;
    const n = n1 * 1.8 + n2 * 0.6;

    // Anchor the corners so the front always touches both edges.
    const corner = Math.sin((i / N) * Math.PI);

    // Underside dips downward (positive y) by the noise amount.
    pts.push([x, baseY + n * amp * corner + amp * 0.4 * corner]);
  }

  // Path: top-left → top-right → wavy underside → close.
  let d = `M 0 -10 L 100 -10 L 100 ${pts[pts.length - 1][1].toFixed(2)}`;
  for (let i = pts.length - 2; i >= 0; i--) {
    const [x1, y1] = pts[i + 1];
    const [x2, y2] = pts[i];
    const mx = ((x1 + x2) / 2).toFixed(2);
    const my = ((y1 + y2) / 2).toFixed(2);
    d += ` Q ${x1.toFixed(2)} ${y1.toFixed(2)} ${mx} ${my}`;
  }
  d += ` L 0 ${pts[0][1].toFixed(2)} L 0 -10 Z`;
  return d;
}

export const InkPour: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const half = durationInFrames / 2;
  const raw = frame <= half ? frame / half : 1 - (frame - half) / half;
  const progress = Math.max(0, Math.min(1, raw));

  const d = buildPath(progress, frame);

  const textOpacity = interpolate(progress, [0, 0.18, 0.4, 0.5], [1, 1, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0c0e" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#f4f4ee",
          fontSize: 48,
          fontFamily: "sans-serif",
          zIndex: 999,
          opacity: textOpacity,
          textAlign: "center",
          whiteSpace: "nowrap",
          letterSpacing: -0.5,
        }}
      >
        click me
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient
            id="inkpour-grad"
            x1="0"
            y1="0"
            x2="0"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="rgb(28, 30, 38)" />
            <stop offset="1" stopColor="rgb(96, 30, 140)" />
          </linearGradient>
        </defs>
        <path d={d} fill="url(#inkpour-grad)" />
      </svg>
    </AbsoluteFill>
  );
};
