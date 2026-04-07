// Simplified port of TextTrail for scene titles. 11 stacked copies, outside-in
// convergence, then hold the center. One pass — no hide phase, no image
// parallax. The title arrives like a wave and stays.

import React from "react";
import { useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { THEME } from "../theme";

const { fontFamily } = loadFont();

const TOTAL_COPIES = 11;
const MIDDLE_IDX = Math.floor(TOTAL_COPIES / 2); // 5

// 80ms at 30fps ≈ 2.4 frames — same cadence as the original.
const STAGGER_FRAMES = 2.4;

type CopyStyle = "filled" | "stroke";

interface CopySpec {
  style: CopyStyle;
  isFull: boolean;
}

// Structure echoes the 11-copy layout from TextTrail.tsx — alternating
// stroke/filled, with three "full" rows that take intrinsic size.
const COPY_PATTERN: CopySpec[] = [
  { style: "stroke", isFull: false },
  { style: "filled", isFull: false },
  { style: "stroke", isFull: true },
  { style: "stroke", isFull: false },
  { style: "filled", isFull: false },
  { style: "filled", isFull: true }, // center
  { style: "filled", isFull: false },
  { style: "filled", isFull: false },
  { style: "stroke", isFull: true },
  { style: "stroke", isFull: false },
  { style: "filled", isFull: false },
];

export interface TextTrailTitleProps {
  text: string;
  startFrame: number;
  durationFrames?: number;
  fontSize?: number;
  color?: string;
  accentColor?: string;
  weight?: number;
  italic?: boolean;
}

function computeOpacities(frameInPhase: number): number[] {
  const opacities = new Array(TOTAL_COPIES).fill(0);

  // Outside-in wave: step 0 reveals the outer pair (pos=5), step 5 reveals center.
  for (let step = 0; step < MIDDLE_IDX + 1; step++) {
    const pos = MIDDLE_IDX - step;
    const stepFrame = step * STAGGER_FRAMES;
    if (frameInPhase >= stepFrame) {
      const upIdx = MIDDLE_IDX - pos;
      const downIdx = MIDDLE_IDX + pos;
      if (upIdx >= 0 && upIdx < TOTAL_COPIES) opacities[upIdx] = 1;
      if (downIdx >= 0 && downIdx < TOTAL_COPIES) opacities[downIdx] = 1;
    }
  }

  // Once the full stack is up, fade outer copies back out over the next
  // stretch — leaving only the center visible.
  const fadeStart = (MIDDLE_IDX + 1) * STAGGER_FRAMES;
  for (let step = 0; step < MIDDLE_IDX; step++) {
    const pos = MIDDLE_IDX - step; // 5,4,3,2,1
    const stepFrame = fadeStart + step * STAGGER_FRAMES;
    if (frameInPhase >= stepFrame) {
      const upIdx = MIDDLE_IDX - pos;
      const downIdx = MIDDLE_IDX + pos;
      if (upIdx >= 0 && upIdx < TOTAL_COPIES) opacities[upIdx] = 0;
      if (downIdx >= 0 && downIdx < TOTAL_COPIES) opacities[downIdx] = 0;
    }
  }

  // Center copy remains on once revealed.
  opacities[MIDDLE_IDX] = frameInPhase >= 0 ? 1 : 0;
  return opacities;
}

export const TextTrailTitle: React.FC<TextTrailTitleProps> = ({
  text,
  startFrame,
  durationFrames = 30,
  fontSize = 120,
  color = THEME.textLight,
  accentColor = THEME.gmGreen,
  weight = 900,
  italic = false,
}) => {
  const frame = useCurrentFrame();
  const phase = frame - startFrame;
  const opacities = computeOpacities(phase);

  // Prevents unused-var complaints from tsc on the duration hint — retained
  // so callers can still lean on it for timing downstream.
  void durationFrames;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      {COPY_PATTERN.map((copy, i) => {
        const isStroke = copy.style === "stroke";
        const isCenter = i === MIDDLE_IDX;
        return (
          <span
            key={i}
            style={{
              display: "block",
              flex: copy.isFull ? "none" : 1,
              opacity: opacities[i],
              overflow: "hidden",
              lineHeight: 0.75,
            }}
          >
            <span
              style={{
                display: "block",
                fontFamily,
                fontSize,
                fontWeight: weight,
                fontStyle: italic ? "italic" : "normal",
                lineHeight: 0.75,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                textAlign: "center",
                letterSpacing: -2,
                color: isStroke ? "transparent" : isCenter ? color : accentColor,
                WebkitTextStroke: isStroke
                  ? `2px ${isCenter ? color : accentColor}`
                  : undefined,
                WebkitTextFillColor: isStroke ? "transparent" : undefined,
              }}
            >
              {text}
            </span>
          </span>
        );
      })}
    </div>
  );
};
