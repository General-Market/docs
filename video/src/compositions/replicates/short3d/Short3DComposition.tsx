import React from "react";
import { AbsoluteFill } from "remotion";

export const FPS = 60;
export const DURATION = 1962; // 32.70s — matches reference short3d-original.mp4 (59.94fps/1960f)

export const Short3DComposition: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};

export const short3dReplicateMeta = {
  id: "Short3D-Replicate",
  component: Short3DComposition,
  width: 1080,
  height: 1920,
  fps: FPS,
  durationInFrames: DURATION,
};
