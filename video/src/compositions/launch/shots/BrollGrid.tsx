import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";

const GRID_COLS = 4;
const GRID_ROWS = 3;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

const PLACEHOLDER_COLORS: Record<string, string[]> = {
  twitch: [
    "#9146FF", "#6441A5", "#B9A3E3", "#7B2FBE",
    "#A970FF", "#772CE8", "#BF94FF", "#5C16C5",
    "#D4BBFF", "#8B5CF6", "#6D28D9", "#4C1D95",
  ],
  pumpfun: [
    "#00D4AA", "#10B981", "#34D399", "#059669",
    "#6EE7B7", "#047857", "#A7F3D0", "#065F46",
    "#064E3B", "#0D9488", "#14B8A6", "#2DD4BF",
  ],
  movies: [
    "#F59E0B", "#D97706", "#FBBF24", "#B45309",
    "#FCD34D", "#92400E", "#FDE68A", "#78350F",
    "#F97316", "#EA580C", "#FB923C", "#C2410C",
  ],
  animals: [
    "#22C55E", "#16A34A", "#4ADE80", "#15803D",
    "#86EFAC", "#166534", "#BBF7D0", "#14532D",
    "#0D9488", "#0F766E", "#2DD4BF", "#134E4A",
  ],
};

interface BrollGridProps {
  category: "twitch" | "pumpfun" | "movies" | "animals";
  question: string;
}

export const BrollGrid: React.FC<BrollGridProps> = ({ category, question }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = PLACEHOLDER_COLORS[category];

  const textScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
    durationInFrames: 20,
  });

  const blurAmount = interpolate(frame, [0, 8], [0, 8], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Grid layer */}
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: 4,
          padding: 4,
          filter: `blur(${blurAmount}px)`,
        }}
      >
        {Array.from({ length: CELL_COUNT }).map((_, i) => {
          const cellSpring = spring({
            frame: frame - i * 1,
            fps,
            config: { damping: 20, stiffness: 200 },
            durationInFrames: 12,
          });
          return (
            <div
              key={i}
              style={{
                backgroundColor: colors[i % colors.length],
                borderRadius: 6,
                transform: `scale(${cellSpring})`,
                opacity: interpolate(cellSpring, [0, 1], [0.3, 1]),
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* Dark vignette overlay */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Question text */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            transform: `scale(${textScale})`,
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
