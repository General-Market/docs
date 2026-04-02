// Source: https://codepen.io/argyleink/full/ZEdrzJZ
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ── Grid item labels — all 50 CSS features from the original ──

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

// ── Animation ranges from the original CSS (percentages as 0-1) ──
// Each item has [rangeStart, rangeEnd] — the scroll range where its
// zoom-in keyframe plays. Outside this range, the item is invisible.

const ANIMATION_RANGES: Array<[number, number]> = [
  [0.40, 0.50], // 1
  [0.20, 0.30], // 2
  [0.52, 0.62], // 3
  [0.50, 0.60], // 4
  [0.45, 0.55], // 5
  [0.10, 0.20], // 6
  [0.90, 1.00], // 7
  [0.30, 0.40], // 8
  [0.80, 0.90], // 9
  [0.70, 0.80], // 10
  [-0.10, 0.50], // 11 (special CSS — very wide range)
  [0.52, 0.62], // 12
  [0.15, 0.25], // 13
  [0.07, 0.17], // 14
  [0.75, 0.85], // 15
  [0.03, 0.13], // 16
  [0.87, 0.97], // 17
  [0.42, 0.52], // 18
  [0.57, 0.67], // 19
  [0.37, 0.47], // 20
  [0.12, 0.22], // 21
  [0.08, 0.18], // 22
  [0.84, 0.94], // 23
  [0.33, 0.43], // 24
  [0.48, 0.58], // 25
  [0.13, 0.23], // 26
  [0.78, 0.88], // 27
  [0.62, 0.72], // 28
  [0.31, 0.41], // 29
  [0.08, 0.18], // 30
  [0.04, 0.14], // 31
  [0.74, 0.84], // 32
  [0.61, 0.71], // 33
  [0.26, 0.36], // 34
  [0.63, 0.73], // 35
  [0.11, 0.21], // 36
  [0.89, 0.99], // 37
  [0.33, 0.43], // 38
  [0.88, 0.98], // 39
  [0.22, 0.32], // 40
  [0.16, 0.26], // 41
  [0.26, 0.36], // 42
  [0.66, 0.76], // 43
  [0.03, 0.13], // 44
  [0.44, 0.54], // 45
  [0.11, 0.21], // 46
  [0.23, 0.33], // 47
  [0.39, 0.49], // 48
  [0.59, 0.69], // 49
  [0.06, 0.16], // 50
];

// ── Grid placement — 4x4 grid, items cycle through cells ──
// Row/col from the original CSS (1-indexed)

const GRID_AREAS: Array<[number, number]> = [
  [1, 1], [1, 2], [1, 3], [1, 4],
  [2, 1], [2, 2], [2, 3], [2, 4],
  [3, 1], [3, 2], [3, 3], [3, 4],
  [4, 1], [4, 2], [4, 3], [4, 4],
  [2, 1], [2, 2], [2, 3], [2, 4],
  [3, 1], [3, 2], [3, 3], [3, 4],
  [1, 1], [1, 2], [1, 3], [1, 4],
  [4, 1], [4, 2], [4, 3], [4, 4],
  [2, 1], [2, 2], [2, 3], [2, 4],
  [3, 1], [3, 2], [3, 3], [3, 4],
  [1, 1], [1, 2], [1, 3], [1, 4],
  [4, 1], [4, 2], [4, 3], [4, 4],
  [3, 1], [3, 2], [3, 3], [3, 4],
];

// ── The zoom-in keyframe, evaluated per-item per-frame ──
// Original CSS:
//   0%   → translateZ(-1000px), opacity: 0, blur(5px)
//   50%  → translateZ(0px),     opacity: 1, blur(0px)
//   100% → translateZ(1000px),  opacity: 0, blur(5px)

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

// ── Component ──

export const ScrollSnap: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // vmin equivalent — min(width, height) / 100
  const vmin = Math.min(width, height) / 100;

  // Global scroll progress: 0 → 1 over the full duration
  const scrollProgress = frame / durationInFrames;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#111",
        fontFamily: "system-ui, sans-serif",
        perspective: 1000,
        transformStyle: "preserve-3d" as const,
        overflow: "hidden",
      }}
    >
      {/* 4x4 grid container — fills the viewport, items placed by grid area */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateRows: "repeat(4, 25%)",
          gridTemplateColumns: "repeat(4, 25%)",
          placeItems: "center",
          perspective: 1000,
          transformStyle: "preserve-3d" as const,
        }}
      >
        {GRID_ITEMS.map((item, i) => {
          const [rangeStart, rangeEnd] = ANIMATION_RANGES[i];
          const rangeDuration = rangeEnd - rangeStart;

          // localProgress: where within this item's animation range we are (0→1)
          const localProgress =
            rangeDuration === 0
              ? 0
              : (scrollProgress - rangeStart) / rangeDuration;

          // Clamp to [0, 1] — outside the range the item is fully invisible
          const clampedProgress = Math.max(0, Math.min(1, localProgress));

          // If scroll hasn't reached this item's range or has passed it,
          // the item is invisible (opacity 0) — skip rendering for perf
          const isVisible = localProgress >= -0.01 && localProgress <= 1.01;

          const { z, opacity, blur } = computeZoomState(clampedProgress);

          const [row, col] = GRID_AREAS[i] ?? [1, 1];

          // Special item ("CSS") spans 2×2 in the center
          const isSpecial = item.special === true;

          const gridStyle: React.CSSProperties = isSpecial
            ? {
                gridRow: "2 / span 2",
                gridColumn: "2 / span 2",
              }
            : {
                gridRow: row,
                gridColumn: col,
              };

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
                fontSize: isSpecial ? undefined : 5 * vmin,
                fontWeight: 300,
                whiteSpace: "nowrap",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              {isSpecial ? (
                <b
                  style={{
                    fontSize: 15 * vmin,
                    fontWeight: "bold",
                  }}
                >
                  {item.text}
                </b>
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
