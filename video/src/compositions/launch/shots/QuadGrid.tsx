import React from "react";
import { AbsoluteFill } from "remotion";
import { font } from "../../../common/fonts";
import { PLACEHOLDER_COLORS } from "../brollAssets";
import { BrollCell } from "./BrollCell";
import type { BrollCategory } from "../types";

const QUAD_COLS = 4;
const QUAD_ROWS = 3;
const QUAD_CELLS = QUAD_COLS * QUAD_ROWS;

interface QuadGridProps {
  categories: BrollCategory[];
  question: string;
}

export const QuadGrid: React.FC<QuadGridProps> = ({ categories, question }) => {
  const quadPositions = [
    { top: 0, left: 0 },
    { top: 0, left: "50%" },
    { top: "50%", left: 0 },
    { top: "50%", left: "50%" },
  ] as const;

  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      {categories.slice(0, 4).map((cat, qi) => {
        const pos = quadPositions[qi];
        const colors = PLACEHOLDER_COLORS[cat] ?? ["#444"];

        return (
          <div
            key={qi}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              width: "50%",
              height: "50%",
              display: "grid",
              gridTemplateColumns: `repeat(${QUAD_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${QUAD_ROWS}, 1fr)`,
              gap: 2,
              padding: 2,
              filter: "blur(4px)",
            }}
          >
            {Array.from({ length: QUAD_CELLS }).map((_, ci) => (
              <div
                key={ci}
                style={{
                  backgroundColor: colors[ci % colors.length],
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <BrollCell category={cat} index={ci} />
              </div>
            ))}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          width: 3,
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          width: "100%",
          height: 3,
          backgroundColor: "rgba(0,0,0,0.1)",
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
            fontWeight: 900,
            color: "#0e0f0c",
            textAlign: "center",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            textShadow: "0 4px 40px rgba(255,255,255,0.8)",
            whiteSpace: "pre-line",
          }}
        >
          {question}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
