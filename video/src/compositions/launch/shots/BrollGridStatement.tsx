import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";
import { PLACEHOLDER_COLORS } from "../brollAssets";
import { BrollCell } from "./BrollCell";

const GRID_COLS = 8;
const GRID_ROWS = 6;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

const SCALE_START = 3.2;
const SCALE_END = 1;

interface BrollGridStatementProps {
  category: "twitch" | "pumpfun" | "movies" | "animals";
  question: string;
  statement: string;
  words?: string[];
}

export const BrollGridStatement: React.FC<BrollGridStatementProps> = ({
  category,
  question,
  statement,
  words,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const colors = PLACEHOLDER_COLORS[category] ?? ["#444"];

  const midpoint = Math.floor(durationInFrames * 0.5);

  const wordGroups = words ?? [question];
  const stepCount = wordGroups.length;
  const questionEnd = midpoint;
  const framesPerStep = questionEnd / stepCount;
  const currentStep = Math.min(
    Math.floor(frame / framesPerStep),
    stepCount - 1,
  );

  const gridScale = interpolate(
    frame,
    [0, questionEnd],
    [SCALE_START, SCALE_END],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const visibleWords = wordGroups.slice(0, currentStep + 1);

  const statementOpacity = interpolate(frame, [midpoint, midpoint + 6], [0, 1], {
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
          filter: "blur(8px)",
          transform: `scale(${gridScale})`,
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
            textShadow: "0 4px 40px rgba(0,0,0,0.6)",
            whiteSpace: "pre-line",
          }}
        >
          {visibleWords.join(" ")}
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
