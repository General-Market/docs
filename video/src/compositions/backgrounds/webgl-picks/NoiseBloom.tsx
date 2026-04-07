// Variation of SvgMorph: an asymmetric, noise-displaced bloom rising from below.
// Same scaffold as WaveTide but the top edge is driven by 2D value noise
// instead of stacked sines. Asymmetric on purpose — the bulge is never quite
// where you expect it. That is what makes it read as organic.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

const N = 28;

// Hash-based 2D value noise. Cheap, deterministic, smooth.
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
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

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function buildPath(progress: number, frame: number): string {
  const baseY = 100 - 100 * easeOutQuart(progress);
  const amp = (1 - Math.min(1, progress * 1.15)) * 14;

  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * 100;

    // Two octaves of value noise — large bulges + small ripples.
    const n1 = valueNoise2D(x * 0.04, frame * 0.012) - 0.5;
    const n2 = valueNoise2D(x * 0.12 + 50, frame * 0.02) - 0.5;
    const n = n1 * 1.6 + n2 * 0.7;

    const corner = Math.sin((i / N) * Math.PI);
    pts.push([x, baseY + n * amp * corner]);
  }

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

export const NoiseBloom: React.FC = () => {
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
    <AbsoluteFill style={{ backgroundColor: "#100a14" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#fff0d6",
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
            id="noisebloom-grad"
            x1="0"
            y1="100"
            x2="100"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="rgb(214, 60, 142)" />
            <stop offset="1" stopColor="rgb(255, 188, 80)" />
          </linearGradient>
        </defs>
        <path d={d} fill="url(#noisebloom-grad)" />
      </svg>
    </AbsoluteFill>
  );
};
