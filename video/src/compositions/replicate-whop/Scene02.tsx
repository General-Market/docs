import React from "react";
import { AbsoluteFill } from "remotion";

/**
 * Scene02 was an 11-frame transition between Scene01 and Scene03.
 * It is now merged into Scene01 (which runs 227 frames total).
 * This stub remains for the composition registry.
 */
export const Scene02: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: "#F5F5F5" }} />;
};

export const scene02Meta = {
  id: "WhopScene02",
  component: Scene02,
  width: 3840,
  height: 2160,
  fps: 25,
  durationInFrames: 11,
};
