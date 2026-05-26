// Source: a single `.block` square whose conic-gradient sweep rotates over a
// checkerboard built from a tiled conic-gradient. The original animated a CSS
// `@property --gradient-angle` 0→360deg on a 4s linear infinite loop. Here the
// angle is driven straight off the frame so the loop closes exactly — two full
// rotations across the 600-frame clip, which is seamless at the seam. The
// conic mask (content-box exclude) that hollows the block into a ring is kept
// verbatim.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

const BLOCK = 352; // px — original .block size
const CHECK = 64; // px — checker cell (~2vmax on a 1080-tall stage)
const ROTATIONS = 2; // full sweeps across the clip → clean loop

export const CheckerBlock: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const loop = (frame % durationInFrames) / durationInFrames;
  const angle = loop * 360 * ROTATIONS;

  // Tiled conic checkerboard — same four-quadrant pattern as the source,
  // expressed as a fixed-size repeating background tile.
  const checker = `conic-gradient(
      rgba(255,255,255,0.07) 0.25turn,
      rgba(0,0,0,0.33) 0.25turn 0.5turn,
      rgba(255,255,255,0.07) 0.5turn 0.75turn,
      rgba(0,0,0,0.33) 0.75turn
    )`;

  const blockGradient = `conic-gradient(
      from ${angle}deg,
      rgba(255, 255, 255, 0.1) 0deg,
      rgba(255, 255, 255, 0.1) 60deg,
      rgba(255, 255, 255, 0.9) 120deg,
      rgba(255, 255, 255, 0.1) 180deg,
      rgba(255, 255, 255, 0.1) 240deg,
      rgba(255, 255, 255, 0.9) 300deg,
      rgba(255, 255, 255, 0.1) 360deg
    )`;

  // mask: conic-gradient(#000 0 0) content-box exclude, conic-gradient(#000 0 0)
  const maskValue = "conic-gradient(#000 0 0) content-box, conic-gradient(#000 0 0)";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        backgroundImage: checker,
        backgroundSize: `${CHECK}px ${CHECK}px`,
        backgroundPosition: "top left",
        backgroundRepeat: "repeat",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: BLOCK,
          height: BLOCK,
          padding: 2,
          background: blockGradient,
          borderRadius: 32,
          WebkitMask: maskValue,
          mask: maskValue,
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
    </AbsoluteFill>
  );
};
