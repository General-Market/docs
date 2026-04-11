import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";

const GRID_COLS = 6;
const GRID_ROWS = 4;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

const ALL_COLORS = [
  "#9146FF", "#00D4AA", "#F59E0B", "#22C55E",
  "#6441A5", "#10B981", "#D97706", "#16A34A",
  "#A970FF", "#34D399", "#FBBF24", "#4ADE80",
  "#772CE8", "#059669", "#B45309", "#15803D",
  "#BF94FF", "#6EE7B7", "#FCD34D", "#86EFAC",
  "#5C16C5", "#047857", "#92400E", "#166534",
];

interface MegaGridProps {
  question: string;
}

export const MegaGrid: React.FC<MegaGridProps> = ({ question }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
    durationInFrames: 20,
  });

  const blurAmount = interpolate(frame, [0, 12], [0, 6], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Dense grid — all categories mixed */}
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: 3,
          padding: 3,
          filter: `blur(${blurAmount}px)`,
        }}
      >
        {Array.from({ length: CELL_COUNT }).map((_, i) => {
          const cellSpring = spring({
            frame: frame - i * 0.5,
            fps,
            config: { damping: 18, stiffness: 180 },
            durationInFrames: 15,
          });
          return (
            <div
              key={i}
              style={{
                backgroundColor: ALL_COLORS[i % ALL_COLORS.length],
                borderRadius: 4,
                transform: `scale(${cellSpring})`,
                opacity: interpolate(cellSpring, [0, 1], [0.2, 1]),
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* Heavier vignette for the finale */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* Question text — delayed entrance */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 80,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            transform: `scale(${Math.max(0, textScale)})`,
            textShadow: "0 4px 40px rgba(0,0,0,0.6)",
            whiteSpace: "pre-line",
          }}
        >
          {question}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
