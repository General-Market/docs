import React from "react";
import { AbsoluteFill } from "remotion";

export const FPS = 30;
export const DURATION = 404; // 13.45s — matches reference circle2-original.mp4

export const Circle2Composition: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};

export const circle2ReplicateMeta = {
  id: "Circle2-Replicate",
  component: Circle2Composition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: DURATION,
};
