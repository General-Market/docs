// Source: the "blurjs" loader — two glowing dots on opposite corners of a
// 100px box, the box spinning on a 750ms ease-in-out loop, the whole body
// hue-rotating on a 5s linear loop. Both clocks are snapped to the frame here.
// The hue sweeps one full turn across the clip (clean linear loop); the spin
// runs an integer number of eased 360° cycles so the seam closes exactly.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

const BOX = 100; // px — original loader box
const SPIN_CYCLE_FRAMES = 40; // ~667ms per rotation (source was 750ms)

// Per-cycle eased spin: ease-in-out across each full 360° turn, so the rotation
// closes on a whole revolution at every cycle boundary → seamless.
function spinDeg(frame: number): number {
  const cycle = Math.floor(frame / SPIN_CYCLE_FRAMES);
  const local = (frame % SPIN_CYCLE_FRAMES) / SPIN_CYCLE_FRAMES;
  const eased = Easing.inOut(Easing.ease)(local);
  return (cycle + eased) * 360;
}

const Dot: React.FC<{ corner: "tl" | "br" }> = ({ corner }) => (
  <span
    style={{
      position: "absolute",
      width: "25%",
      height: "25%",
      top: corner === "tl" ? 0 : "unset",
      left: corner === "tl" ? 0 : "unset",
      bottom: corner === "br" ? 0 : "unset",
      right: corner === "br" ? 0 : "unset",
      borderRadius: "50%",
      backgroundColor: "#ffffff",
      boxShadow: "0 0 40px #7aa8ff, 0 0 10px #7aa8ff",
    }}
  />
);

export const BlurLoader: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const loop = (frame % durationInFrames) / durationInFrames;
  const hue = loop * 360; // one clean linear turn over the clip
  const rotate = spinDeg(frame);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        filter: `hue-rotate(${hue}deg)`,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: BOX,
          height: BOX,
          transform: `rotate(${rotate}deg)`,
        }}
      >
        <Dot corner="tl" />
        <Dot corner="br" />
      </div>
    </AbsoluteFill>
  );
};
