import React from "react";
import { AbsoluteFill } from "remotion";

export const FPS = 60;
export const DURATION = 467; // 7.78s — matches reference loopscale-original.mp4

export const LoopscaleComposition: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};

export const loopscaleReplicateMeta = {
  id: "Loopscale-Replicate",
  component: LoopscaleComposition,
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};
