// FIFA World Cup 2026 — Bortolozo's stacked-numeral logo. Twenty-one "2"
// glyphs piled on top of twenty-six "6" glyphs, each child scaled relative
// to its sibling-index and rolling through a four-key pulse cycle with a
// 100ms cascade between layers. CSS `clip-path: shape()` isn't supported
// everywhere, so the shapes are inline SVG paths.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const CYCLE_FRAMES = 600; // 10s @ 60fps — one full --scale walk per scene
const STAGGER_FRAMES = 6; // 100ms per layer

// scaleIt keyframes: 0% .8, 20% 2, 40% .6, 70% 1.4, 100% .8
const KEYS = [0, 0.2, 0.4, 0.7, 1];
const SCALES = [0.8, 2, 0.6, 1.4, 0.8];

// Cubic ease-in-out (matches CSS ease-in-out closely enough for visual)
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function scaleAt(t: number): number {
  // t wraps in [0, 1)
  const w = ((t % 1) + 1) % 1;
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (w >= KEYS[i] && w <= KEYS[i + 1]) {
      const local = (w - KEYS[i]) / (KEYS[i + 1] - KEYS[i]);
      const eased = easeInOut(local);
      return SCALES[i] + (SCALES[i + 1] - SCALES[i]) * eased;
    }
  }
  return SCALES[SCALES.length - 1];
}

// Palette — repeats every 10 children, sibling-index 1 is overridden white
const COLORS = [
  "#F1FE67",
  "#6B1D18",
  "#C3291C",
  "#AC89F7",
  "#374FF5",
  "#EB4F27",
  "#BCE949",
  "#5A0DE0",
  "#91FBDC",
  "#1E4B3F",
];

const colorAt = (siblingIndex1: number): string => {
  if (siblingIndex1 === 1) return "#ffffff";
  return COLORS[(siblingIndex1 - 1) % COLORS.length];
};

// SVG path strings for the stylized "2" and "6" — derived from the source's
// CSS `clip-path: shape()` with r=60.  viewBox: 240×180 ("2"), 240×180 ("6").
const TWO_D =
  "M 0 60 A 60 60 0 0 1 60 0 L 180 0 A 60 60 0 0 1 180 120 L 240 120 L 240 180 L 0 180 L 0 120 A 60 60 0 0 1 60 60 Z";
const SIX_D =
  "M 0 60 A 60 60 0 0 1 60 0 L 180 0 A 60 60 0 0 1 240 60 L 180 60 A 60 60 0 0 1 180 180 L 60 180 A 60 60 0 0 1 0 120 Z";

const NUM_TWO_LAYERS = 21;
const NUM_SIX_LAYERS = 26;

const Numeral: React.FC<{
  layers: number;
  path: string;
  frame: number;
  align: "top" | "bottom";
  baseSize: number;
}> = ({ layers, path, frame, align, baseSize }) => {
  // Each layer is a child <div> stacked at the same position, scaled by its
  // index × the cycling --scale. Layer 1 (first child) sits at scale 1 with
  // no animation — same rule as the source.
  return (
    <div
      style={{
        position: "relative",
        width: baseSize * 4,
        height: baseSize * 3,
      }}
    >
      {Array.from({ length: layers }).map((_, idx) => {
        const sibIdx = idx + 1; // 1-based
        const isFirst = sibIdx === 1;
        // Animation: each layer offset by sibIdx * -100ms
        const t = (frame - sibIdx * STAGGER_FRAMES) / CYCLE_FRAMES;
        const s = scaleAt(t);
        const scale = isFirst ? 1 : (sibIdx - 1) * s;
        const color = colorAt(sibIdx);
        const transformOrigin =
          align === "top"
            ? "50% 100%"
            : `50% ${(sibIdx - 1) * 0.01}%`;
        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              inset: 0,
              transform: `scale(${scale})`,
              transformOrigin,
              zIndex: layers - sibIdx,
              color,
            }}
          >
            <svg
              viewBox="0 0 240 180"
              width="100%"
              height="100%"
              style={{ overflow: "visible" }}
              preserveAspectRatio="xMidYMid meet"
            >
              <path d={path} fill="currentColor" />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

export const WorldCup2026: React.FC = () => {
  const frame = useCurrentFrame();
  useVideoConfig();
  const BASE = 60; // r in the source — final size 240×180 per numeral

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1C2379",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateRows: "1fr 1fr",
          gap: BASE / 5,
          padding: 60,
          placeItems: "center",
        }}
      >
        {/* "2" pinned to bottom of upper row — red banner behind it */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            background: "#EA394B",
            display: "grid",
            placeItems: "end center",
            paddingBottom: 8,
          }}
        >
          <Numeral
            layers={NUM_TWO_LAYERS}
            path={TWO_D}
            frame={frame}
            align="top"
            baseSize={BASE}
          />
        </div>
        {/* "6" pinned to top of lower row */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "start center",
            paddingTop: 8,
          }}
        >
          <Numeral
            layers={NUM_SIX_LAYERS}
            path={SIX_D}
            frame={frame}
            align="bottom"
            baseSize={BASE}
          />
        </div>
      </div>

      {/* "2026" cartouche at center — stands in for the absent trophy PNG */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 99,
          color: "white",
          fontFamily: "'Inter', sans-serif",
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          padding: "18px 36px",
          borderRadius: 18,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        2026
      </div>
    </AbsoluteFill>
  );
};
