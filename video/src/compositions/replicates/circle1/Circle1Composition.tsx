import React from "react";
import { AbsoluteFill } from "remotion";

export const FPS = 30;
export const DURATION = 1252; // 41.73s — matches reference circle1-original.mp4

export const Circle1Composition: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};

export const circle1ReplicateMeta = {
  id: "Circle1-Replicate",
  component: Circle1Composition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: DURATION,
};
