// Faithful port of the original "GENERAL MARKET" title-quake sequence.
//
// The original SVG defines the wordmark once and references it through three
// <use> elements, each clipped to a polygon that carves the title into three
// chunks (left, middle, right). The chunks scale in, then quiver with a low
// blur, then shake harder. After the shake settles, each chunk slides apart
// along the crack line, the visible crack outlines fade in, and the whole
// thing comes to rest broken.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const BG = "#0a1118";

// ── Clip-path polygons (verbatim from the source) ──
// Each polygon is plotted in % of the 525 × 198 wordmark bounding box. They
// fit together to exactly cover the title; sliding them apart shows the
// crack.

const POLY_LEFT =
  "polygon(7.76% 9.16%, 18.81% 39.67%, 27.09% 45.26%, 41.57% 66.95%, 43.11% 84.74%, 20.18% 84.74%, -2.07% 85.26%, -1.55% 11.69%)";
const POLY_MIDDLE =
  "polygon(41.73% 23.68%, 48.4% 38.16%, 55.62% 59.29%, 65.64% 78.93%, 65.44% 86.84%, 43.28% 86.84%, 43.88% 69.39%, 38.63% 66.75%, 26.69% 46.24%, 21.12% 44.58%, 18.23% 43.47%, 14.06% 23.7%)";
const POLY_RIGHT =
  "polygon(70% 24.4%, 100.52% 23.9%, 100.52% 88.3%, 64.31% 87.8%, 43.96% 42.04%, 40.33% 27.3%)";

// Crack overlay path data (verbatim subset of the source) — the irregular
// fragment edges that appear at the moment the title breaks.
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

  // ── Phase timings ──
  // 0.0 → 0.3 — title scales up 0.6 → 1.05
  // 0.05 → 0.7 — low-amplitude quiver + blur (matches 142ms quiver in source)
  // 0.7 → 0.85 — hard shake (50ms shake, 20 iters in source)
  // 0.85 → 1.0 — crack: chunks slide apart along the fault line, crack
  //              strokes fade in, the wordmark stays broken to the end.
  const scale = interpolate(t, [0, 0.3], [0.62, 1.05], {
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
    extrapolateRight: "clamp",
  });

  // Blur and quiver — small Y oscillation while the title is in the
  // "quiver" phase. Frequency mirrors the source's 142ms-per-iter quiver,
  // ~7Hz.
  const inQuiver = t > 0.05 && t < 0.7;
  const blurPx = inQuiver ? Math.abs(Math.sin(seconds * 14)) * 1.6 : 0;
  const quiverY = inQuiver ? Math.sin(seconds * 18) * 1.4 : 0;

  // Hard shake.
  const inShake = t > 0.7 && t < 0.85;
  const shakeY = inShake ? Math.sin(seconds * 90) * 5.5 : 0;
  const shakeX = inShake ? Math.cos(seconds * 75) * 3 : 0;

  // Crack — chunks separate.
  const crackT = Math.max(0, Math.min(1, (t - 0.85) / 0.12));
  const crackEase = Easing.bezier(0.3, 0.8, 0.4, 1)(crackT);

  // Per-chunk offsets — left drifts down-left, middle stays roughly put with
  // a slight downward drop, right drifts up-right (matches a "two halves
  // peeling away from a central wedge" feel).
  const leftDX = -crackEase * 22;
  const leftDY = crackEase * 12;
  const midDY = crackEase * 6;
  const rightDX = crackEase * 28;
  const rightDY = -crackEase * 22;

  return (
    <AbsoluteFill
      style={{
        background: BG,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Slight vignette to bury the chrome */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "min(1400px, 75%)",
          aspectRatio: "525 / 198",
          position: "relative",
          transform: `translate(${shakeX}px, ${shakeY + quiverY}px) scale(${scale})`,
          filter: blurPx > 0 ? `blur(${blurPx}px)` : "none",
          willChange: "transform, filter",
        }}
      >
        {/* Three copies of the title, each clipped to its polygon. They start
            stacked perfectly and only separate when the crack phase begins. */}
        <TitleChunk
          clip={POLY_LEFT}
          translateX={leftDX}
          translateY={leftDY}
        />
        <TitleChunk
          clip={POLY_MIDDLE}
          translateX={0}
          translateY={midDY}
        />
        <TitleChunk
          clip={POLY_RIGHT}
          translateX={rightDX}
          translateY={rightDY}
        />

        {/* Crack outlines fade in once the title starts breaking. */}
        <svg
          viewBox="0 0 915 580"
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

// ── Inner — the wordmark, clipped. ─────────────────────────────────────────
const TitleChunk: React.FC<{
  clip: string;
  translateX: number;
  translateY: number;
}> = ({ clip, translateX, translateY }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        clipPath: clip,
        WebkitClipPath: clip,
        transform: `translate(${translateX}px, ${translateY}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "#bfbfc8",
          fontFamily:
            '"Familjen Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif',
          fontWeight: 800,
          fontSize: "20vw",
          letterSpacing: "0.06em",
          textShadow: "0 0 16px rgba(0,0,0,.55)",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        GENERAL MARKET
      </div>
    </div>
  );
};
