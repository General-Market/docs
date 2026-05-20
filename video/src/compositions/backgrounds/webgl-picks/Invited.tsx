// "You Are Invited." — a Bridget Riley headline trapped inside its own
// gradient. The CodePen source uses @property + @keyframes to crawl five CSS
// variables across a 20s alternating cycle. Here the same positions are
// computed per frame and pushed in as inline CSS vars.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// 0 / 25 / 50 / 75 / 100 percent stops, verbatim from the source @keyframes
const STOPS = [0, 0.25, 0.5, 0.75, 1];
const KEYS = {
  bg1x: [25, 30, 10, 70, 25],
  bg2x: [35, 80, 30, 50, 35],
  bg2y: [40, 50, 40, 10, 40],
  bg3x: [45, 70, 50, 40, 45],
  bg3y: [20, 20, 80, 30, 20],
};

function kf(t: number, vals: number[]): number {
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t >= STOPS[i] && t <= STOPS[i + 1]) {
      const local = (t - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
      return vals[i] + (vals[i + 1] - vals[i]) * local;
    }
  }
  return vals[vals.length - 1];
}

// Inline fractal-noise SVG, same as the source's data: URL
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const Invited: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // One half-cycle across the scene — the source alternates, so this matches
  // half of its 20s walk.
  const t = frame / Math.max(1, durationInFrames - 1);

  const bg1x = kf(t, KEYS.bg1x);
  const bg2x = kf(t, KEYS.bg2x);
  const bg2y = kf(t, KEYS.bg2y);
  const bg3x = kf(t, KEYS.bg3x);
  const bg3y = kf(t, KEYS.bg3y);

  const conic = `conic-gradient(from 140deg at ${bg1x}% 90%, #1a0d00, #00011a, #fffffa, #15009e, #d232aa, #fa8c3d, #fff480, #fffffa, #7ed4fb, #040d8b, #010014)`;
  const rad2 = `radial-gradient(ellipse at ${bg2x}% ${bg2y}%, white 12%, transparent 35%)`;
  const rad3 = `radial-gradient(ellipse at ${bg3x}% ${bg3y}%, #61a8fa, transparent 35%)`;

  return (
    <AbsoluteFill style={{ backgroundColor: "hsl(240, 10%, 12%)" }}>
      {/* Colored shadow blobs, hue-blended */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(circle 480px at 20% 0%, #d25b73 100%, transparent 0),
            radial-gradient(circle 480px at 100% 0%, #2c5697 100%, transparent 0),
            radial-gradient(circle 576px at 50% 115%, #00ab84 100%, transparent 0)
          `,
          opacity: 0.5,
          filter: "blur(80px)",
          mixBlendMode: "hue",
        }}
      />
      {/* Screen-blended grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRAIN,
          backgroundSize: "500px",
          filter: "contrast(145%) brightness(650%) invert(100%)",
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill style={{ display: "grid", placeItems: "center" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "'Poppins', 'Inter', sans-serif",
            fontSize: "max(65px, 14vw)",
            fontWeight: 650,
            letterSpacing: "-0.04em",
            mixBlendMode: "lighten",
            backgroundRepeat: "repeat",
            backgroundSize: "500px, cover, cover, cover",
            backgroundBlendMode: "color-burn",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundImage: `${GRAIN}, ${conic}, ${rad2}, ${rad3}`,
          }}
        >
          You Are Invited.
        </h1>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
