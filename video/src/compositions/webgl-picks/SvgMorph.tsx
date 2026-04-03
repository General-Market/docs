// Source: wasm.md scene #2 — SVG morph transition

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { interpolatePath } from "@remotion/paths";

// Three SVG path states (viewBox 0 0 100 100):
// Flat bottom edge — invisible
const PATH_INITIAL = "M 0 100 V 100 Q 50 100 100 100 V 100 Z";
// Curved bulge — halfway up with a bezier dome
const PATH_START = "M 0 100 V 50 Q 50 0 100 50 V 100 Z";
// Fills entire viewport
const PATH_END = "M 0 100 V 0 Q 50 0 100 0 V 100 Z";

// GSAP's power2.in = t^2, power2.out = 1 - (1-t)^2
function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Compute the morph path at a given progress [0..1].
 * 0 → initial (flat), 0.5 → start (bulge), 1 → end (full).
 */
function getMorphPath(progress: number): string {
  if (progress <= 0.5) {
    // Phase 1: initial → start with power2.in
    const t = easeIn(progress / 0.5);
    return interpolatePath(t, PATH_INITIAL, PATH_START);
  }
  // Phase 2: start → end with power2.out
  const t = easeOut((progress - 0.5) / 0.5);
  return interpolatePath(t, PATH_START, PATH_END);
}

export const SvgMorph: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Forward for first half of frames, reverse for second half
  const half = durationInFrames / 2;
  const rawProgress =
    frame <= half
      ? frame / half // 0 → 1 over first half
      : 1 - (frame - half) / half; // 1 → 0 over second half

  const progress = Math.max(0, Math.min(1, rawProgress));
  const d = getMorphPath(progress);

  // Text fades in while path is still flat, fades out as it covers the center
  const textOpacity = interpolate(progress, [0, 0.15, 0.35, 0.5], [1, 1, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0e100f" }}>
      {/* Centered text */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#fffce1",
          fontSize: 48,
          fontFamily: "sans-serif",
          zIndex: 999,
          opacity: textOpacity,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        click me
      </div>

      {/* SVG morph layer */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMin slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <linearGradient
            id="svgmorph-grad"
            x1="0"
            y1="0"
            x2="99"
            y2="99"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.2" stopColor="rgb(255, 135, 9)" />
            <stop offset="0.7" stopColor="rgb(247, 189, 248)" />
          </linearGradient>
        </defs>
        <path
          d={d}
          stroke="url(#svgmorph-grad)"
          fill="url(#svgmorph-grad)"
          strokeWidth="2px"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </AbsoluteFill>
  );
};
