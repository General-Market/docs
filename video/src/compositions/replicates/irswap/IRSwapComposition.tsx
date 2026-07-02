import React from "react";
import { AbsoluteFill } from "remotion";

export const FPS = 25;
export const DURATION = 5433; // 217.32s — matches reference irswap-original.mp4 (25fps/5433f)

export const IRSwapComposition: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};

export const irswapReplicateMeta = {
  id: "IRSwap-Replicate",
  component: IRSwapComposition,
  width: 854,
  height: 480,
  fps: FPS,
  durationInFrames: DURATION,
};
