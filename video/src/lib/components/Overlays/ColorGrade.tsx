import React from "react";
import { interpolateColors } from "remotion";
import type { Emotion } from "../../types";

interface Props {
  emotion: Emotion;
  prevEmotion?: Emotion;
  transitionProgress?: number;
}

// IndexMaker DA — subtle per-emotion tints
const emotionTint: Record<Emotion, string> = {
  neutral: "rgba(36,112,255,0.04)",
  excited: "rgba(62,220,235,0.06)",
  confused: "rgba(85,51,255,0.05)",
  panicking: "rgba(239,68,68,0.06)",
  happy: "rgba(165,254,202,0.04)",
  sad: "rgba(85,102,170,0.03)",
  angry: "rgba(255,34,68,0.06)",
};

export const ColorGrade: React.FC<Props> = ({
  emotion,
  prevEmotion,
  transitionProgress = 1,
}) => {
  let tint = emotionTint[emotion];

  if (prevEmotion && transitionProgress < 1) {
    tint = interpolateColors(
      transitionProgress,
      [0, 1],
      [emotionTint[prevEmotion], emotionTint[emotion]],
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: tint,
        mixBlendMode: "overlay",
        pointerEvents: "none",
        zIndex: 17,
      }}
    />
  );
};
