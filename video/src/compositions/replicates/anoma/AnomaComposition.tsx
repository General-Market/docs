import React from "react";
import { AbsoluteFill } from "remotion";

export const FPS = 30;
export const DURATION = 969; // 32.30s — matches reference anoma-original.mp4 (30fps/968f)

export const AnomaComposition: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};

export const anomaReplicateMeta = {
  id: "Anoma-Replicate",
  component: AnomaComposition,
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};
