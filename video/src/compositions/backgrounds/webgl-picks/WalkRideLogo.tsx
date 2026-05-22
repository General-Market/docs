// Source: a "Chevrolet Mobility Month"-style brand mark reveal. Diagonal bands
// of the words "WALK" and "RIDE" slide endlessly across the top and bottom of
// the frame. The center holds the brand mark: a flowing line is drawn, the
// brand wordmark slides in, then "Mobility Month" rotates into place around
// the mark.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const BG = "#008cb2";
const BLUE = "#0a5265";

// One row of repeating WALK / RIDE text
const TextRow: React.FC<{
  word: string;
  scrollPx: number;
  yOffset: number;
  faded: number;
}> = ({ word, scrollPx, yOffset, faded }) => (
  <div
    style={{
      position: "absolute",
      top: yOffset,
      left: -200,
      right: -200,
      whiteSpace: "nowrap",
      color: BLUE,
      fontFamily:
        '"Helvetica Neue", "Arial Black", Helvetica, Arial, sans-serif',
      fontWeight: 800,
      fontSize: 110,
      letterSpacing: 6,
      transform: `translateX(${scrollPx}px)`,
      opacity: faded,
    }}
  >
    {Array.from({ length: 12 }).map((_, i) => (
      <span key={i} style={{ marginRight: 60 }}>
        {word}
      </span>
    ))}
  </div>
);

export const WalkRideLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const seconds = frame / fps;

  // Walk rows move leftward; Ride rows move rightward
  const walkScroll = (-seconds * 90) % 600;
  const rideScroll = (seconds * 90) % 600;

  // Brand mark draw progress — the flowing line draws over 0..50% of scene
  const drawT = interpolate(t, [0.05, 0.55], [0, 1], {
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const linePathLen = 2200;
  const lineDashOffset = (1 - drawT) * linePathLen;

  // Wordmark slide-in (translates from x=150 to x=0)
  const wordmarkX = interpolate(t, [0.1, 0.55], [180, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordmarkOpacity = interpolate(t, [0.1, 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Mobility Month text — rotates into place
  const monthRot = interpolate(t, [0.4, 0.78], [120, 0], {
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const monthOp = interpolate(t, [0.4, 0.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 12 rows of WALK on top, 12 rows of RIDE on bottom — each row offset and
  // fading further from the centre so the brand mark stays legible.
  const ROWS = 12;
  const ROW_SPACING = 90;

  return (
    <AbsoluteFill
      style={{
        background: BG,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
      }}
    >
      {/* WALK rows, rotated and skewed */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "rotate(6deg) skewY(-11deg) translateY(-130px)",
          transformOrigin: "center",
        }}
      >
        {Array.from({ length: ROWS }).map((_, i) => (
          <TextRow
            key={i}
            word="WALK"
            scrollPx={walkScroll - i * 30}
            yOffset={120 + i * ROW_SPACING}
            faded={1 - i / ROWS}
          />
        ))}
      </div>

      {/* RIDE rows */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "rotate(6deg) skewY(-11deg) translateY(550px)",
          transformOrigin: "center",
        }}
      >
        {Array.from({ length: ROWS }).map((_, i) => (
          <TextRow
            key={i}
            word="RIDE"
            scrollPx={rideScroll - i * 30}
            yOffset={i * ROW_SPACING}
            faded={(i + 1) / ROWS}
          />
        ))}
      </div>

      {/* Brand mark */}
      <svg
        viewBox="0 0 360 230"
        width="92%"
        height="65%"
        style={{ position: "relative", zIndex: 10 }}
        overflow="visible"
      >
        {/* The drawn flowing line — simplified pair of waves */}
        <path
          d="M3 169 c4-19 28-89 28-89 s16 1 7 32 s2 31 2 31 s29-65 30-65 s17 2 5 30 s-21 53 22 58"
          fill="none"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={linePathLen}
          strokeDashoffset={lineDashOffset}
        />
        <path
          d="M103 104 c-12 15-16 27-12 35 s17 7 23-6 s12-31 10-34 s-16-3-11 10 s26-10 26-10 s9 2 4 15 s-10 30-4 30 s13-11 19-25 s10-21 5-21 s-5 6-4 11 s4 14 10 15 s22 3 30-8 s8-23-4-18 s-23 21-21 37 s29 6 36-8 c0 0-3 6 0 11 s27 4 25-4 c-2-10-13-16-16-21 c-2-4 10-22 22-15 c7 4-4 19-3 20"
          fill="none"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={linePathLen}
          strokeDashoffset={lineDashOffset * 0.7}
        />

        {/* Wordmark — emerges from the line */}
        <g
          transform={`translate(${wordmarkX} 0)`}
          opacity={wordmarkOpacity}
        >
          <text
            x={108}
            y={80}
            fontFamily='"Helvetica Neue", sans-serif'
            fontWeight={800}
            fontSize={14}
            fill="white"
            letterSpacing={2}
          >
            CHEVROLET
          </text>
          <text
            x={108}
            y={120}
            fontFamily='"Helvetica Neue", sans-serif'
            fontWeight={700}
            fontSize={18}
            fill="white"
            letterSpacing={4}
          >
            2026
          </text>
        </g>

        {/* "Mobility Month" curls around the mark */}
        <g
          transform={`rotate(${monthRot} 180 115)`}
          opacity={monthOp}
        >
          <text
            x={240}
            y={50}
            fill="white"
            fontFamily='"Helvetica Neue", sans-serif'
            fontWeight={600}
            fontSize={20}
            letterSpacing={6}
          >
            MOBILITY
          </text>
          <text
            x={240}
            y={210}
            fill="white"
            fontFamily='"Helvetica Neue", sans-serif'
            fontWeight={600}
            fontSize={20}
            letterSpacing={6}
          >
            MONTH
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
