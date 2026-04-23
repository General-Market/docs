// Demo compositions using the DeviceBroll wrapper.
// Minimal usage; everything interesting is via props.

import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { DeviceBroll } from "../../../lib/DeviceBroll";

const GRADIENT_BG = (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(135deg, #f0f4f8 0%, #fafbfd 40%, #f2f8f4 70%, #edf2f8 100%)",
    }}
  />
);

// Simple idle animation — proves position/rotation props drive the device
// every frame. Replace with anything (spring, keyframes, no motion) by
// computing props from frame/useCurrentFrame in the caller.
export const PhoneBrollDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 60;
  const x = -3 + Math.sin(t * 0.5) * 0.4;
  const y = 2.5 + Math.cos(t * 0.7) * 0.1;
  const ry = Math.sin(t * 0.3) * 0.15;
  return (
    <DeviceBroll
      device="phone"
      broll={staticFile("broll/glacier-drone.mp4")}
      brollAspect={1920 / 1080}
      position={[x, y, 0]}
      rotation={[0, ry, 0]}
      background={GRADIENT_BG}
    />
  );
};

export const LaptopBrollDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 60;
  const rx = Math.sin(t * 0.4) * 0.08;
  const ry = Math.cos(t * 0.3) * 0.15;
  const y = Math.sin(t * 0.6) * 0.1;
  return (
    <DeviceBroll
      device="laptop"
      broll={staticFile("broll/mountains-aerial.mp4")}
      brollAspect={1280 / 720}
      position={[0, y, 0]}
      rotation={[rx, ry, 0]}
      background={GRADIENT_BG}
    />
  );
};

export const phoneBrollDemoMeta = {
  id: "PhoneBrollDemo",
  component: PhoneBrollDemo,
  width: 1920,
  height: 1080,
  fps: 60,
  durationInFrames: 60 * 8,
};

export const laptopBrollDemoMeta = {
  id: "LaptopBrollDemo",
  component: LaptopBrollDemo,
  width: 1920,
  height: 1080,
  fps: 60,
  durationInFrames: 60 * 8,
};
