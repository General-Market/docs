import React from "react";
import { AbsoluteFill } from "remotion";

export const FPS = 30;
export const DURATION = 658; // 21.93s — matches reference reflect-original.mp4

export const ReflectComposition: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};

export const reflectReplicateMeta = {
  id: "Reflect-Replicate",
  component: ReflectComposition,
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};
