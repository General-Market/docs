import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  color?: string;
  height?: number;
}

export const ProgressBar: React.FC<Props> = ({
  color = "#2470ff",
  height = 3,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const progress = frame / durationInFrames;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: width * progress,
        height,
        backgroundColor: color,
        zIndex: 18,
        pointerEvents: "none",
      }}
    />
  );
};
