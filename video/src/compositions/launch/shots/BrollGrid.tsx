import React from "react";
import { AbsoluteFill } from "remotion";
import { font } from "../../../common/fonts";
import { PLACEHOLDER_COLORS } from "../brollAssets";
import { BrollCell } from "./BrollCell";

const GRID_COLS = 8;
const GRID_ROWS = 6;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

interface BrollGridProps {
  category: "twitch" | "pumpfun" | "movies" | "animals";
  question: string;
  showNumbers?: boolean;
}

export const BrollGrid: React.FC<BrollGridProps> = ({
  category,
  question,
  showNumbers = false,
}) => {
  const colors = PLACEHOLDER_COLORS[category] ?? ["#444"];

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: 3,
          padding: 3,
          filter: "blur(8px)",
        }}
      >
        {Array.from({ length: CELL_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: colors[i % colors.length],
              borderRadius: 4,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <BrollCell category={category} index={i} />
            {showNumbers && (
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: 4,
                  fontFamily: font,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                }}
              >
                {i + 1}
              </div>
            )}
          </div>
        ))}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
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
