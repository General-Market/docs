import React from "react";
import { AbsoluteFill } from "remotion";

export const FPS = 60;
export const DURATION = 1784; // 29.73s — matches reference tradingbook-original.mp4 (59.94fps/1782f)

export const TradingBookComposition: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};

export const tradingBookReplicateMeta = {
  id: "TradingBook-Replicate",
  component: TradingBookComposition,
  width: 1080,
  height: 1920,
  fps: FPS,
  durationInFrames: DURATION,
};
