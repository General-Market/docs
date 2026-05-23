// Faithful port of the original "GENERAL MARKET" title-quake sequence.
//
// The original SVG defines the wordmark once at font-size 60 and references it
// through three <use> elements positioned at (x=195.3, y=421.1) inside an
// 800 × 800 viewBox. Each <use> is clipped to a polygon that carves the title
// into three chunks (left, middle, right). The chunks scale in, then quiver
// with a low blur, then shake harder. After the shake settles, each chunk
// slides apart along the crack line, the visible crack outlines fade in, and
// the whole thing comes to rest broken.
//
// The polygon percentages resolve against the 800 × 800 viewBox, NOT the
// wordmark's bounding box. So the surface MUST be square. Anything else
// distorts the cracks.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/FamiljenGrotesk";

const { fontFamily } = loadFont("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

const BG = "#000";

// SVG-native coordinate system. The original is 800 × 800; the title <use>
// sits at (195.3, 421.1) with font-size 60 and letter-spacing 2.
const VB = 800;
const TEXT_X = 195.3;
const TEXT_Y = 421.1;
const TEXT_SIZE = 60;
const TEXT_LETTER_SPACING = 2;

// ── Clip-path polygons (verbatim from the source) ──
// Plotted in % of the 800 × 800 SVG viewBox. They fit together to cover the
// title; sliding them apart shows the crack.
const POLY_LEFT =
  "polygon(7.76% 9.16%, 18.81% 39.67%, 27.09% 45.26%, 41.57% 66.95%, 43.11% 84.74%, 20.18% 84.74%, -2.07% 85.26%, -1.55% 11.69%)";
const POLY_MIDDLE =
  "polygon(41.73% 23.68%, 48.4% 38.16%, 55.62% 59.29%, 65.64% 78.93%, 65.44% 86.84%, 43.28% 86.84%, 43.88% 69.39%, 38.63% 66.75%, 26.69% 46.24%, 21.12% 44.58%, 18.23% 43.47%, 14.06% 23.7%)";
const POLY_RIGHT =
  "polygon(70% 24.4%, 100.52% 23.9%, 100.52% 88.3%, 64.31% 87.8%, 43.96% 42.04%, 40.33% 27.3%)";

// Crack overlay path data — light shimmer cracks plus dark shard lines.
const CRACK_STROKES: Array<{ d: string; w: number; s: string }> = [
  { d: "M754 539.7 c-3.7-1.3-15.2-6.1-21.2-8.8", w: 0.1, s: "#f2f2f2" },
  { d: "M770.8 547.3 l-16.6-7.5", w: 0.18, s: "#ffffff" },
  { d: "M801 561.4 c-3.6-1.9-25.1-11.2-30.3-14.2", w: 0.1, s: "#f2f2f2" },
  { d: "M834.1 576.6 c0-0.3-32.9-15-33-15.2", w: 0.18, s: "#ffffff" },
  { d: "M691.4 517.9 c-3.6-1.9-17.3-9.8-22.4-12.7", w: 0.1, s: "#000" },
  { d: "M707.1 527.3 c-3.5-2.1-10.9-6.7-16.1-9.6", w: 0.18, s: "#000" },
  { d: "M735.8 545.9 c-3.6-1.9-23.5-15.6-28.7-18.5", w: 0.1, s: "#000" },
  { d: "M765.5 562.2 c-5.0-1.7-24.5-13.3-29.6-16.2", w: 0.2, s: "#000" },
];

export const GeneralMarketGlitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const seconds = frame / fps;

  // ── Phase timings (scaled from the source's 3.1s timeline to t ∈ [0,1]) ──
  // 0.00 → 0.30 — title scales up 0.62 → 1.05 (then holds)
  // 0.05 → 0.70 — low-amplitude quiver + blur
  // 0.70 → 0.85 — hard shake
  // 0.85 → 1.00 — crack: chunks slide apart, crack strokes fade in
  const scale = interpolate(t, [0, 0.3], [0.62, 1.05], {
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
    extrapolateRight: "clamp",
  });

  const inQuiver = t > 0.05 && t < 0.7;
  const blurPx = inQuiver ? Math.abs(Math.sin(seconds * 14)) * 1.6 : 0;
  const quiverY = inQuiver ? Math.sin(seconds * 18) * 1.4 : 0;

  const inShake = t > 0.7 && t < 0.85;
  const shakeY = inShake ? Math.sin(seconds * 90) * 5.5 : 0;
  const shakeX = inShake ? Math.cos(seconds * 75) * 3 : 0;

  // Crack — chunks separate by very small amounts. The source uses:
  //   left:  translate(-0.45%,  +0.35%)  ⇒  (-3.6,  +2.8) px on an 800-px box
  //   right: translate(+1.00%,  -1.00%)  ⇒  (+8.0,  -8.0) px on an 800-px box
  //   middle: no translate
  const crackT = Math.max(0, Math.min(1, (t - 0.85) / 0.12));
  const crackEase = Easing.bezier(0.3, 0.8, 0.4, 1)(crackT);

  const leftDX = crackEase * -0.45;
  const leftDY = crackEase * 0.35;
  const rightDX = crackEase * 1.0;
  const rightDY = crackEase * -1.0;

  return (
    <AbsoluteFill
      style={{
        background: BG,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Square stage — polygon % resolve against this box, so it MUST be 1:1. */}
      <div
        style={{
          width: "min(80vw, 80vh, 800px)",
          aspectRatio: "1 / 1",
          position: "relative",
          transform: `translate(${shakeX}px, ${shakeY + quiverY}px) scale(${scale})`,
          transformOrigin: "center",
          filter: blurPx > 0 ? `blur(${blurPx}px)` : "none",
          willChange: "transform, filter",
        }}
      >
        {/* Three copies of the title, each clipped to its polygon. They start
            stacked perfectly and only separate when the crack phase begins. */}
        <TitleChunk clip={POLY_LEFT} translateXPct={leftDX} translateYPct={leftDY} />
        <TitleChunk clip={POLY_MIDDLE} translateXPct={0} translateYPct={0} />
        <TitleChunk clip={POLY_RIGHT} translateXPct={rightDX} translateYPct={rightDY} />

        {/* Crack outlines fade in once the title starts breaking. */}
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: crackT,
            pointerEvents: "none",
          }}
        >
          {CRACK_STROKES.map((stroke, i) => (
            <path
              key={i}
              d={stroke.d}
              stroke={stroke.s}
              strokeWidth={stroke.w * 8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ── Inner — one wordmark, clipped to its polygon. ──────────────────────────
// The text is rendered as native SVG <text> at (TEXT_X, TEXT_Y) in the same
// 800-unit space the polygons reference. The clip-path is applied to the
// wrapper div (which is the square viewBox surface), so the polygons map 1:1.
const TitleChunk: React.FC<{
  clip: string;
  translateXPct: number;
  translateYPct: number;
}> = ({ clip, translateXPct, translateYPct }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        clipPath: clip,
        WebkitClipPath: clip,
        transform: `translate(${translateXPct}%, ${translateYPct}%)`,
      }}
    >
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <text
          x={TEXT_X}
          y={TEXT_Y}
          fill="#bfbfc8"
          fontSize={TEXT_SIZE}
          fontWeight={700}
          letterSpacing={TEXT_LETTER_SPACING}
          fontFamily={`${fontFamily}, "Helvetica Neue", Helvetica, Arial, sans-serif`}
        >
          GENERAL MARKET
        </text>
      </svg>
    </div>
  );
};
