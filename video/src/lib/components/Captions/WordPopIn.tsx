import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "../../types";
import { msToFrame } from "../../utils/frameConvert";

interface Props {
  word: Caption;
  isCurrentWord: boolean;
  isKeyword: boolean;
  highlightColor: string;
  currentWordColor: string;
  keywords: string[];
}

const PRE_EMIT_MS = 70;

export const WordPopIn: React.FC<Props> = ({
  word,
  isCurrentWord,
  isKeyword,
  highlightColor,
  currentWordColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appearFrame = msToFrame(word.startMs - PRE_EMIT_MS, fps);

  if (frame < appearFrame) return null;

  const popIn = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 12, stiffness: 250, mass: 0.8 },
    durationInFrames: 8,
  });

  const scale = popIn;
  const translateY = (1 - popIn) * 10;
  const opacity = Math.min(1, popIn * 1.5);

  let color: string | undefined;
  if (isCurrentWord) color = currentWordColor;
  else if (isKeyword) color = highlightColor;

  return (
    <span
      style={{
        display: "inline-block",
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
        color,
        marginRight: 12,
        transition: "color 0.1s",
      }}
    >
      {word.text}
    </span>
  );
};
