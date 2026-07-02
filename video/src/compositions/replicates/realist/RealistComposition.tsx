import React from "react";
import { AbsoluteFill } from "remotion";

export const FPS = 60;
export const DURATION = 2116; // 35.27s — matches reference realist-original.mp4 (59.94fps/2114f)

export const RealistComposition: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};

export const realistReplicateMeta = {
  id: "Realist-Replicate",
  component: RealistComposition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: DURATION,
};
