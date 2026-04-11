import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";
import { PLACEHOLDER_COLORS } from "../brollAssets";
import { BrollCell } from "./BrollCell";

const GRID_COLS = 8;
const GRID_ROWS = 6;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

interface BrollGridStatementProps {
  category: "twitch" | "pumpfun" | "movies" | "animals";
  question: string;
  statement: string;
}

export const BrollGridStatement: React.FC<BrollGridStatementProps> = ({
  category,
  question,
  statement,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const colors = PLACEHOLDER_COLORS[category] ?? ["#444"];

  const blurAmount = interpolate(frame, [0, 8], [0, 8], {
    extrapolateRight: "clamp",
  });

  const questionScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
    durationInFrames: 18,
  });

  const midpoint = Math.floor(durationInFrames * 0.5);
  const statementOpacity = interpolate(frame, [midpoint, midpoint + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const statementY = interpolate(frame, [midpoint, midpoint + 12], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
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
        {Array.from({ length: CELL_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: colors[i % colors.length],
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <BrollCell category={category} index={i} />
          </div>
        ))}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.8) 100%)",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 200,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 56,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            transform: `scale(${questionScale})`,
            textShadow: "0 4px 40px rgba(0,0,0,0.6)",
            whiteSpace: "pre-line",
          }}
        >
          {question}
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 180,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 44,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            opacity: statementOpacity,
            transform: `translateY(${statementY}px)`,
            textShadow: "0 4px 40px rgba(0,0,0,0.6)",
            whiteSpace: "pre-line",
          }}
        >
          {statement}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
