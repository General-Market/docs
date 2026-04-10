/**
 * WiseScrollZoom — 3D perspective text zoom, adapted from WebGLPicks/ScrollSnap.
 *
 * Market terminology flies through z-space on the white Wise background.
 * "GM" centered in wiseGreen, all others in nearBlack.
 * Sits in the behindWebcam layer — adds depth without competing with content.
 */

import React from "react";
import {
  useCurrentFrame,
  interpolate,
} from "remotion";
import { FONT } from "../designTokens";
import { useDesignTokens } from "../TutorialTheme";
import { useTalkingHead } from "../TalkingHeadLayout";
import { Sfx } from "../components/Sfx";

// ── Grid items — market terms in CSS-function aesthetic ──────────────────────

const GRID_ITEMS: Array<{ text: string; special?: boolean }> = [
  { text: "yield()" },
  { text: "hedge()" },
  { text: "batch" },
  { text: "oracle" },
  { text: "@bet" },
  { text: "sealed" },
  { text: "@consensus" },
  { text: "nav()" },
  { text: "collateral" },
  { text: "settle()" },
  { text: "GM", special: true },
  { text: "@source" },
  { text: "fill-rate" },
  { text: "alpha" },
  { text: "liquidity" },
  { text: ":on-chain" },
  { text: "risk()" },
  { text: "pnl()" },
  { text: ":verified" },
  { text: "::market" },
  { text: "1tick" },
  { text: "exposure" },
  { text: "settlement" },
  { text: "vision" },
  { text: "predict()" },
  { text: "scale" },
  { text: "mint()" },
  { text: "burn()" },
  { text: "deploy" },
  { text: "@rebalance" },
  { text: "threshold" },
  { text: "tvl()" },
  { text: "@scope" },
  { text: "moat" },
  { text: "apr()" },
  { text: "anchor()" },
  { text: "pool" },
  { text: "::keeper" },
  { text: "::oracle" },
  { text: ":consensus" },
  { text: ":sealed" },
  { text: ":pending" },
  { text: "index()" },
  { text: "core" },
  { text: "bridge()" },
  { text: "price" },
  { text: "signal()" },
  { text: "vault()" },
  { text: "data" },
  { text: "edge()" },
];

// ── Animation ranges — per-item scroll windows (0–1) ────────────────────────

const ANIMATION_RANGES: Array<[number, number]> = [
  [0.40, 0.50], [0.20, 0.30], [0.52, 0.62], [0.50, 0.60],
  [0.45, 0.55], [0.10, 0.20], [0.90, 1.00], [0.30, 0.40],
  [0.80, 0.90], [0.70, 0.80], [-0.10, 0.50], [0.52, 0.62],
  [0.15, 0.25], [0.07, 0.17], [0.75, 0.85], [0.03, 0.13],
  [0.87, 0.97], [0.42, 0.52], [0.57, 0.67], [0.37, 0.47],
  [0.12, 0.22], [0.08, 0.18], [0.84, 0.94], [0.33, 0.43],
  [0.48, 0.58], [0.13, 0.23], [0.78, 0.88], [0.62, 0.72],
  [0.31, 0.41], [0.08, 0.18], [0.04, 0.14], [0.74, 0.84],
  [0.61, 0.71], [0.26, 0.36], [0.63, 0.73], [0.11, 0.21],
  [0.89, 0.99], [0.33, 0.43], [0.88, 0.98], [0.22, 0.32],
  [0.16, 0.26], [0.26, 0.36], [0.66, 0.76], [0.03, 0.13],
  [0.44, 0.54], [0.11, 0.21], [0.23, 0.33], [0.39, 0.49],
  [0.59, 0.69], [0.06, 0.16],
];

// ── Grid areas — 4x4 cell positions (row, col, 1-indexed) ──────────────────

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
  [3, 1], [3, 2],
];

// ── Zoom state — translateZ + opacity + blur per local progress ─────────────

const ext = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function computeZoomState(localProgress: number) {
  const z = interpolate(localProgress, [0, 0.5, 1], [-1000, 0, 1000], ext);
  const opacity = interpolate(localProgress, [0, 0.5, 1], [0, 1, 0], ext);
  const blur = interpolate(localProgress, [0, 0.5, 1], [5, 0, 5], ext);
  return { z, opacity, blur };
}

export const WiseScrollZoom: React.FC<{
  durationInFrames: number;
  centerText?: string;
}> = ({ durationInFrames, centerText = "GM" }) => {
  const { COLOR } = useDesignTokens();
  const frame = useCurrentFrame();
  const { contentArea } = useTalkingHead();

  if (!contentArea) return null;

  const areaMin = Math.min(contentArea.w, contentArea.h);
  const vmin = areaMin / 100;
  const scrollProgress = frame / durationInFrames;

  const fadeIn = interpolate(frame, [0, 15], [0, 1], ext);
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    ext,
  );
  const envelope = Math.min(fadeIn, fadeOut);

  return (
    <Sfx sound="whoosh-spin-fast" volume={0.35}>
    <div
      style={{
        position: "absolute",
        left: contentArea.x,
        top: contentArea.y,
        width: contentArea.w,
        height: contentArea.h,
        opacity: envelope,
        overflow: "hidden",
        borderRadius: 30,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateRows: `repeat(4, ${contentArea.h / 4}px)`,
          gridTemplateColumns: `repeat(4, ${contentArea.w / 4}px)`,
          placeItems: "center",
          perspective: 1000,
          transformStyle: "preserve-3d" as const,
          overflow: "hidden",
        }}
      >
        {GRID_ITEMS.map((item, i) => {
          const [rangeStart, rangeEnd] = ANIMATION_RANGES[i];
          const rangeDuration = rangeEnd - rangeStart;
          const localProgress =
            rangeDuration === 0
              ? 0
              : (scrollProgress - rangeStart) / rangeDuration;
          const clampedProgress = Math.max(0, Math.min(1, localProgress));
          const isVisible = localProgress >= -0.01 && localProgress <= 1.01;
          const { z, opacity, blur } = computeZoomState(clampedProgress);
          const [row, col] = GRID_AREAS[i] ?? [1, 1];
          const isSpecial = item.special === true;

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
                fontFamily: FONT.display,
                fontSize: isSpecial ? undefined : 4 * vmin,
                fontWeight: isSpecial ? 900 : 300,
                whiteSpace: "nowrap",
                color: isSpecial ? COLOR.wiseGreen : COLOR.nearBlack,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                fontFeatureSettings: '"calt" 1',
              }}
            >
              {isSpecial ? (
                <b style={{
                  fontSize: 72,
                  lineHeight: 0.85,
                  textAlign: "center" as const,
                  whiteSpace: "pre-line" as const,
                }}>{centerText}</b>
              ) : (
                item.text
              )}
            </div>
          );
        })}
      </div>
    </div>
    </Sfx>
  );
};
