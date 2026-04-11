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

const PUSH_FRAMES = 8;

interface BrollGridProps {
  category: "twitch" | "pumpfun" | "movies" | "animals";
  question: string;
  words?: string[];
  showNumbers?: boolean;
  expandGrid?: boolean;
}

export const BrollGrid: React.FC<BrollGridProps> = ({
  category,
  question,
  words,
  showNumbers = false,
  expandGrid = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const colors = PLACEHOLDER_COLORS[category] ?? ["#444"];

  const wordGroups = words ?? [question];
  const stepCount = wordGroups.length;
  const framesPerStep = durationInFrames / stepCount;

  const currentWordStep = Math.min(
    Math.floor(frame / framesPerStep),
    stepCount - 1,
  );
  const visibleWords = wordGroups.slice(0, currentWordStep + 1);

  let cols: number;
  let rows: number;

  if (expandGrid && words) {
    const steps = GRID_STEPS.slice(0, stepCount);
    const stepStart = currentWordStep * framesPerStep;
    const frameInStep = frame - stepStart;
    const pushProgress = Math.min(frameInStep / PUSH_FRAMES, 1);
    const easedPush = EASE_PUSH(pushProgress);

    const fromStep = steps[Math.max(0, currentWordStep - 1)] ?? steps[0];
    const toStep = steps[currentWordStep];

    if (currentWordStep === 0) {
      cols = toStep.cols;
      rows = toStep.rows;
    } else {
      cols = fromStep.cols + (toStep.cols - fromStep.cols) * easedPush;
      rows = fromStep.rows + (toStep.rows - fromStep.rows) * easedPush;
    }
  } else {
    cols = 8;
    rows = 6;
  }

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
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
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

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.6) 100%)",
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
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            textShadow: "0 4px 40px rgba(255,255,255,0.8)",
            whiteSpace: "pre-line",
          }}
        >
          {visibleWords.join(" ")}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
