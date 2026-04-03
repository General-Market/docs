// Source: https://codepen.io/argyleink/full/ZEdrzJZ
// "3D spacial scroll zoom with CSS Scroll Animation" by Adam Argyle
// Ported from CSS animation-timeline: scroll() to Remotion frame progress
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ── HTML: 50 grid-items in order, item 11 is the special "CSS" ──

const GRID_ITEMS: Array<{ text: string; special?: boolean }> = [
  { text: "oklch()" },
  { text: "scroll()" },
  { text: "text-box-trim" },
  { text: "pow()" },
  { text: "@property" },
  { text: "top-layer" },
  { text: "@view-transition" },
  { text: "var()" },
  { text: "clamp()" },
  { text: "view()" },
  { text: "CSS", special: true },
  { text: "@layer" },
  { text: "@swash" },
  { text: "subgrid" },
  { text: "in oklab" },
  { text: ":popover-open" },
  { text: "abs()" },
  { text: "sin()" },
  { text: ":has()" },
  { text: "::marker" },
  { text: "1cap" },
  { text: "scrollbar-color" },
  { text: "scroll-timeline" },
  { text: "view-timeline" },
  { text: "overlay" },
  { text: "scale" },
  { text: "ascent-override" },
  { text: "initial-letter" },
  { text: "inset" },
  { text: "@container" },
  { text: "accent-color" },
  { text: "color-mix()" },
  { text: "@scope" },
  { text: "@starting-style" },
  { text: "override-colors" },
  { text: "anchor()" },
  { text: "scroll-snap" },
  { text: "::backdrop" },
  { text: "::cue" },
  { text: ":focus-visible" },
  { text: ":user-valid" },
  { text: ":fullscreen" },
  { text: ":dir()" },
  { text: "caret-color" },
  { text: "aspect-ratio" },
  { text: "cross-fade()" },
  { text: "image-set()" },
  { text: "env()" },
  { text: "place-content" },
  { text: "gap" },
];

// ── CSS: animation-range per nth-of-type (percentages as 0-1) ──
// Original scrolls body at min-block-size: 400vh, animation-timeline: scroll(root block).
// Each item's zoom-in keyframe plays within its [start%, end%] of total scroll.

const ANIMATION_RANGES: Array<[number, number]> = [
  [0.40, 0.50], // :nth-of-type(1)
  [0.20, 0.30], // :nth-of-type(2)
  [0.52, 0.62], // :nth-of-type(3)
  [0.50, 0.60], // :nth-of-type(4)
  [0.45, 0.55], // :nth-of-type(5)
  [0.10, 0.20], // :nth-of-type(6)
  [0.90, 1.00], // :nth-of-type(7)
  [0.30, 0.40], // :nth-of-type(8)
  [0.80, 0.90], // :nth-of-type(9)
  [0.70, 0.80], // :nth-of-type(10)
  [-0.10, 0.50], // :nth-of-type(11) — special CSS, wide range
  [0.52, 0.62], // :nth-of-type(12)
  [0.15, 0.25], // :nth-of-type(13)
  [0.07, 0.17], // :nth-of-type(14)
  [0.75, 0.85], // :nth-of-type(15)
  [0.03, 0.13], // :nth-of-type(16)
  [0.87, 0.97], // :nth-of-type(17)
  [0.42, 0.52], // :nth-of-type(18)
  [0.57, 0.67], // :nth-of-type(19)
  [0.37, 0.47], // :nth-of-type(20)
  [0.12, 0.22], // :nth-of-type(21)
  [0.08, 0.18], // :nth-of-type(22)
  [0.84, 0.94], // :nth-of-type(23)
  [0.33, 0.43], // :nth-of-type(24)
  [0.48, 0.58], // :nth-of-type(25)
  [0.13, 0.23], // :nth-of-type(26)
  [0.78, 0.88], // :nth-of-type(27)
  [0.62, 0.72], // :nth-of-type(28)
  [0.31, 0.41], // :nth-of-type(29)
  [0.08, 0.18], // :nth-of-type(30)
  [0.04, 0.14], // :nth-of-type(31)
  [0.74, 0.84], // :nth-of-type(32)
  [0.61, 0.71], // :nth-of-type(33)
  [0.26, 0.36], // :nth-of-type(34)
  [0.63, 0.73], // :nth-of-type(35)
  [0.11, 0.21], // :nth-of-type(36)
  [0.89, 0.99], // :nth-of-type(37)
  [0.33, 0.43], // :nth-of-type(38)
  [0.88, 0.98], // :nth-of-type(39)
  [0.22, 0.32], // :nth-of-type(40)
  [0.16, 0.26], // :nth-of-type(41)
  [0.26, 0.36], // :nth-of-type(42)
  [0.66, 0.76], // :nth-of-type(43)
  [0.03, 0.13], // :nth-of-type(44)
  [0.44, 0.54], // :nth-of-type(45)
  [0.11, 0.21], // :nth-of-type(46)
  [0.23, 0.33], // :nth-of-type(47)
  [0.39, 0.49], // :nth-of-type(48)
  [0.59, 0.69], // :nth-of-type(49)
  [0.06, 0.16], // :nth-of-type(50)
];

// ── CSS: grid-area per nth-of-type (row/col, 1-indexed) ──
// Items cycle through 4x4 cells. Multiple items occupy the same cell
// at different scroll ranges — the z-depth separates them visually.
// Original has 52 grid-area rules; items 51-52 are unused (no HTML).

const GRID_AREAS: Array<[number, number]> = [
  [1, 1], [1, 2], [1, 3], [1, 4], // 1-4
  [2, 1], [2, 2], [2, 3], [2, 4], // 5-8
  [3, 1], [3, 2], [3, 3], [3, 4], // 9-12
  [4, 1], [4, 2], [4, 3], [4, 4], // 13-16
  [2, 1], [2, 2], [2, 3], [2, 4], // 17-20
  [3, 1], [3, 2], [3, 3], [3, 4], // 21-24
  [1, 1], [1, 2], [1, 3], [1, 4], // 25-28
  [4, 1], [4, 2], [4, 3], [4, 4], // 29-32
  [2, 1], [2, 2], [2, 3], [2, 4], // 33-36
  [3, 1], [3, 2], [3, 3], [3, 4], // 37-40
  [1, 1], [1, 2], [1, 3], [1, 4], // 41-44
  [4, 1], [4, 2], [4, 3], [4, 4], // 45-48
  [3, 1], [3, 2],                  // 49-50
];

// ── @keyframes zoom-in — ported to interpolation ──
// 0%:   translateZ(-1000px), opacity: 0, filter: blur(5px)
// 50%:  translateZ(0px),     opacity: 1, filter: blur(0px)
// 100%: translateZ(1000px),  opacity: 0, filter: blur(5px)

function computeZoomState(localProgress: number) {
  const z = interpolate(localProgress, [0, 0.5, 1], [-1000, 0, 1000], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(localProgress, [0, 0.5, 1], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blur = interpolate(localProgress, [0, 0.5, 1], [5, 0, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { z, opacity, blur };
}

export const ScrollSnap: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Original uses 5vmin / 15vmin for font sizes
  const vmin = Math.min(width, height) / 100;

  // Scroll progress: 0 -> 1 over full duration
  // Original: animation-timeline: scroll(root block) over body min-block-size: 400vh
  const scrollProgress = frame / durationInFrames;

  return (
    <AbsoluteFill
      style={{
        // @layer support: color-scheme: dark light; font-family: system-ui
        backgroundColor: "#111",
        fontFamily: "system-ui, sans-serif",
        colorScheme: "dark light",
        overflow: "hidden",
      }}
    >
      {/* .stuck-grid — sticky in original, absolute-fill in Remotion */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          // grid: repeat(4, 25dvh) / repeat(4, 25dvw)
          gridTemplateRows: `repeat(4, ${height / 4}px)`,
          gridTemplateColumns: `repeat(4, ${width / 4}px)`,
          placeItems: "center",
          perspective: 1000,
          transformStyle: "preserve-3d" as const,
          overflow: "hidden", // overflow: clip in original
        }}
      >
        {GRID_ITEMS.map((item, i) => {
          const [rangeStart, rangeEnd] = ANIMATION_RANGES[i];
          const rangeDuration = rangeEnd - rangeStart;

          // Local progress within this item's animation-range
          const localProgress =
            rangeDuration === 0
              ? 0
              : (scrollProgress - rangeStart) / rangeDuration;

          const clampedProgress = Math.max(0, Math.min(1, localProgress));
          const isVisible = localProgress >= -0.01 && localProgress <= 1.01;

          const { z, opacity, blur } = computeZoomState(clampedProgress);

          const [row, col] = GRID_AREAS[i] ?? [1, 1];
          const isSpecial = item.special === true;

          // .special.special overrides grid-area to span 2x2 center
          const gridStyle: React.CSSProperties = isSpecial
            ? { gridRow: "2 / span 2", gridColumn: "2 / span 2" }
            : { gridRow: row, gridColumn: col };

          return (
            <div
              key={i}
              style={{
                ...gridStyle,
                transformStyle: "preserve-3d" as const,
                transform: `translateZ(${z}px)`,
                opacity: isVisible ? opacity : 0,
                filter: `blur(${blur}px)`,
                willChange: "transform, opacity, filter",
                // .grid-item styles
                fontSize: isSpecial ? undefined : 5 * vmin,
                fontWeight: "lighter",
                whiteSpace: "nowrap",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              {isSpecial ? (
                <b style={{ fontSize: 15 * vmin }}>{item.text}</b>
              ) : (
                item.text
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
