// Variation of SvgMorph: a multi-frequency wave horizon rising from below.
// Same idea as the reference (bezier path covers the screen) but the top edge
// is built from many control points whose y-values are a sum of sines at
// different frequencies. Real fluids are sums of frequencies; this looks like
// real fluid for the same reason.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

const N = 24; // top-edge resolution

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function buildPath(progress: number, frame: number): string {
  // baseY: 100 = below screen (hidden), 0 = past the top (full coverage)
  const baseY = 100 - 100 * easeInOutCubic(progress);

  // The wave amplitude collapses as the fill nears completion so the surface
  // settles smoothly into a flat fill instead of slamming into the top edge.
  const amp = 1 - Math.min(1, progress * 1.2);

  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * 100;

    // Three sines, slow-medium-fast, traveling at different speeds and phases.
    const wave =
      Math.sin(x * 0.18 + frame * 0.045) * 7 +
      Math.sin(x * 0.34 + frame * 0.08) * 3.5 +
      Math.sin(x * 0.09 - frame * 0.025) * 4.5;

    // Anchor the corners (no displacement at i=0 and i=N).
    const corner = Math.sin((i / N) * Math.PI);

    pts.push([x, baseY + wave * corner * amp]);
  }

  // Catmull-Rom-ish smoothing via quadratic beziers between midpoints.
  let d = `M 0 110 L 0 ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const mx = ((x1 + x2) / 2).toFixed(2);
    const my = ((y1 + y2) / 2).toFixed(2);
    d += ` Q ${x1.toFixed(2)} ${y1.toFixed(2)} ${mx} ${my}`;
  }
  d += ` L 100 ${pts[pts.length - 1][1].toFixed(2)} L 100 110 Z`;
  return d;
}

export const WaveTide: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Forward then reverse, matching SvgMorph's behavior.
  const half = durationInFrames / 2;
  const raw = frame <= half ? frame / half : 1 - (frame - half) / half;
  const progress = Math.max(0, Math.min(1, raw));

  const d = buildPath(progress, frame);

  const textOpacity = interpolate(progress, [0, 0.15, 0.4, 0.5], [1, 1, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0e14" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#e8f4ff",
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
          <linearGradient id="wavetide-grad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(64, 196, 255)" />
            <stop offset="1" stopColor="rgb(20, 70, 160)" />
          </linearGradient>
        </defs>
        <path d={d} fill="url(#wavetide-grad)" />
      </svg>
    </AbsoluteFill>
  );
};
