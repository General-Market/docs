import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();

export interface FormulaBarProps {
  label: string;
  color: string;
  chunksRemoved: number;
  totalChunks: number;
  width: number;
  height?: number;
  startFrame: number;
  animationDurationFrames?: number;
}

export const FormulaBar: React.FC<FormulaBarProps> = ({
  label,
  color,
  chunksRemoved,
  totalChunks,
  width,
  height = 60,
  startFrame,
  animationDurationFrames = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;

  const safeChunksRemoved = Math.max(
    0,
    Math.min(chunksRemoved, totalChunks),
  );

  // Spring-eased shrink toward target chunk fraction
  const targetFraction =
    Math.max(0, totalChunks - safeChunksRemoved) / totalChunks;

  const shrinkSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 110, mass: 0.7 },
    durationInFrames: animationDurationFrames,
  });

  // Initial reveal: bar grows from 0 width on first appearance
  // After that, we treat targetFraction as the "current" length.
  const revealedFraction = interpolate(shrinkSpring, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const currentWidth = width * targetFraction * revealedFraction;
  const remainingPct = Math.round(targetFraction * 100);

  const opacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 24,
        fontFamily,
        opacity,
      }}
    >
      <div
        style={{
          minWidth: 220,
          textAlign: "right",
          fontSize: 24,
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          textTransform: "uppercase",
          letterSpacing: 3,
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        {/* Bar container — fixed full width, holds the shrinking fill */}
        <div
          style={{
            width,
            height,
            position: "relative",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 4,
            background: "rgba(255,255,255,0.03)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: currentWidth,
              height: "100%",
              background: color,
              boxShadow: `0 0 24px ${color}55`,
              transition: "none",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 20,
            color: "rgba(255,255,255,0.55)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: 2,
          }}
        >
          {remainingPct}%
        </div>
      </div>
    </div>
  );
};
