import React from "react";
import { AbsoluteFill } from "remotion";
import { font } from "../../../common/fonts";

const GRID_COLS = 10;
const GRID_ROWS = 8;
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
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: 3,
          padding: 3,
          filter: "blur(6px)",
        }}
      >
        {Array.from({ length: CELL_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: ALL_COLORS[i % ALL_COLORS.length],
              borderRadius: 4,
            }}
          />
        ))}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 80,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
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
