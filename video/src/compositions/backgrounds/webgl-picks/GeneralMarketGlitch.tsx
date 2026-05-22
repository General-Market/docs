// Source: a SVG title sequence for "GENERAL MARKET" — the title scales up,
// blurs, quivers in place, shakes harder, then cracks into three offset
// pieces. Three <use>s reference the same <text> definition; each gets a
// different clip-path on the crack frame to split the word into pieces.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const BG = "#0a1118";

export const GeneralMarketGlitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const seconds = frame / fps;

  // Phase timings
  // 0 → 0.3: scale up
  // 0.3 → 0.7: quiver + blur
  // 0.7 → 0.8: hard shake
  // 0.8 → 1.0: crack + drift
  const scale = interpolate(t, [0, 0.3], [0.6, 1.05], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });
  const blurPx = t > 0.3 && t < 0.7
    ? Math.abs(Math.sin(seconds * 14)) * 1.6
    : 0;
  const quiverY = t > 0.3 && t < 0.7
    ? Math.sin(seconds * 18) * 1.4
    : 0;
  const shakeY = t > 0.7 && t < 0.8
    ? Math.sin(seconds * 80) * 5
    : 0;

  // Crack progression
  const crackT = Math.max(0, Math.min(1, (t - 0.78) / 0.15));

  // Per-piece offsets
  const leftDX = -crackT * 8;
  const leftDY = crackT * 6;
  const rightDX = crackT * 18;
  const rightDY = -crackT * 16;

  return (
    <AbsoluteFill
      style={{
        background: BG,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <svg viewBox="0 0 800 600" width="80%" height="80%">
        <defs>
          {/* The base title text */}
          <text
            id="gm-title"
            fill="#bfbfc8"
            fontSize={86}
            fontWeight={900}
            letterSpacing={4}
            fontFamily='"Familjen Grotesk", "Helvetica Neue", sans-serif'
            x={400}
            y={320}
            textAnchor="middle"
          >
            GENERAL MARKET
          </text>
          <filter id="gm-blur">
            <feGaussianBlur stdDeviation={blurPx} />
          </filter>
          <clipPath id="gm-left">
            <polygon points="0,0 250,0 320,400 0,400" />
          </clipPath>
          <clipPath id="gm-middle">
            <polygon points="250,0 540,0 540,400 320,400" />
          </clipPath>
          <clipPath id="gm-right">
            <polygon points="540,0 800,0 800,400 540,400" />
          </clipPath>
        </defs>
        <g
          transform={`translate(0 ${quiverY + shakeY}) scale(${scale}) translate(0 0)`}
          style={{ transformOrigin: "400px 320px" }}
          filter="url(#gm-blur)"
        >
          {/* Three crack-shifted pieces */}
          <g transform={`translate(${leftDX} ${leftDY})`}>
            <use href="#gm-title" clipPath="url(#gm-left)" />
          </g>
          <g>
            <use href="#gm-title" clipPath="url(#gm-middle)" />
          </g>
          <g transform={`translate(${rightDX} ${rightDY})`}>
            <use href="#gm-title" clipPath="url(#gm-right)" />
          </g>
        </g>

        {/* Crack lines that appear at the end */}
        {crackT > 0 && (
          <g
            stroke="#f2f2f2"
            strokeWidth={0.4}
            opacity={Math.min(1, crackT * 1.5)}
            fill="none"
          >
            <path d="M260,260 L320,340 L335,400" />
            <path d="M540,260 L555,340 L585,395" />
            <path d="M280,340 L460,360 L600,330" />
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};
