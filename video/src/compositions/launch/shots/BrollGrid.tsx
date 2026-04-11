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

interface BrollGridProps {
  category: "twitch" | "pumpfun" | "movies" | "animals";
  question: string;
  words?: string[];
  showNumbers?: boolean;
}

export const BrollGrid: React.FC<BrollGridProps> = ({
  category,
  question,
  words,
  showNumbers = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const colors = PLACEHOLDER_COLORS[category] ?? ["#444"];

  const wordGroups = words ?? [question];
  const stepCount = wordGroups.length;
  const steps = GRID_STEPS.slice(0, stepCount);
  const framesPerStep = durationInFrames / stepCount;

  const progress = frame / durationInFrames;
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

  const maxCells = Math.ceil(cols) * Math.ceil(rows);
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

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Grid — cells positioned absolutely, resizing smoothly */}
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
          </div>
        ))}
      </AbsoluteFill>

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Text */}
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
          {visibleWords.join(" ")}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
