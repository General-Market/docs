import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";
import { PLACEHOLDER_COLORS } from "../brollAssets";
import { BrollCell } from "./BrollCell";

const EASE_PUSH = Easing.bezier(0.5, 0, 0.15, 1);

const GRID_STEPS = [
  { cols: 2, rows: 2 },
  { cols: 3, rows: 2 },
  { cols: 4, rows: 3 },
  { cols: 5, rows: 4 },
  { cols: 6, rows: 5 },
];

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
  const steps = GRID_STEPS.slice(0, stepCount);
  const framesPerStep = midpoint / stepCount;

  const progress = Math.min(frame / midpoint, 1);
  const stepProgress = progress * (steps.length - 1);
  const stepIndex = Math.min(Math.floor(stepProgress), steps.length - 2);
  const stepFrac = stepProgress - stepIndex;

  const easedFrac = EASE_PUSH(Math.min(1, stepFrac));
  const fromStep = steps[stepIndex];
  const toStep = steps[Math.min(stepIndex + 1, steps.length - 1)];

  const cols = fromStep.cols + (toStep.cols - fromStep.cols) * easedFrac;
  const rows = fromStep.rows + (toStep.rows - fromStep.rows) * easedFrac;

  const currentWordStep = Math.min(
    Math.floor(frame / framesPerStep),
    stepCount - 1,
  );
  const visibleWords = wordGroups.slice(0, currentWordStep + 1);

  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const cells: { x: number; y: number; i: number }[] = [];
  let idx = 0;
  for (let r = 0; r < Math.ceil(rows); r++) {
    for (let c = 0; c < Math.ceil(cols); c++) {
      cells.push({ x: c * cellW, y: r * cellH, i: idx });
      idx++;
    }
  }

  const statementOpacity = interpolate(frame, [midpoint, midpoint + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <AbsoluteFill style={{ filter: "blur(8px)", overflow: "hidden" }}>
        {cells.map(({ x, y, i }) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: `${cellW}%`,
              height: `${cellH}%`,
              backgroundColor: colors[i % colors.length],
              overflow: "hidden",
              padding: 1.5,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <BrollCell category={category} index={i} />
            </div>
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
