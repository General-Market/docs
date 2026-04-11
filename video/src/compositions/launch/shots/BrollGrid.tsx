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
  const framesPerStep = durationInFrames / stepCount;
  const currentStep = Math.min(
    Math.floor(frame / framesPerStep),
    stepCount - 1,
  );
  const visibleWords = wordGroups.slice(0, currentStep + 1);

  const widthPct = interpolate(frame, [0, durationInFrames - 1], [25, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heightPct = interpolate(frame, [0, durationInFrames - 1], [30, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Grid container — starts small centered, grows to fill */}
      <div
        style={{
          position: "absolute",
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          top: `${(100 - heightPct) / 2}%`,
          left: `${(100 - widthPct) / 2}%`,
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: 3,
          filter: "blur(8px)",
          borderRadius: interpolate(widthPct, [25, 100], [16, 0]),
          overflow: "hidden",
        }}
      >
        {Array.from({ length: CELL_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: colors[i % colors.length],
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
      </div>

      {/* Vignette — always full screen */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Text — always centered, always full size */}
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
