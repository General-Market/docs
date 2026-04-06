import React from "react";
import { AbsoluteFill } from "remotion";
import { LenticularBackground } from "./LenticularShader";

export const SolanaBgComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <LenticularBackground />
    </AbsoluteFill>
  );
};

export const solanaBgMeta = {
  id: "SolanaBg",
  component: SolanaBgComposition,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 30 * 42, // 42 seconds like the reference
};
