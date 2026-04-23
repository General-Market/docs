// Demo compositions using the DeviceBroll wrapper.
// Minimal usage; everything interesting is via props.

import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { DeviceBroll } from "../../../lib/DeviceBroll";

const GRADIENT_BG = (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(135deg, #f0f4f8 0%, #fafbfd 40%, #f2f8f4 70%, #edf2f8 100%)",
    }}
  />
);

export const PhoneBrollDemo: React.FC = () => {
  return (
    <DeviceBroll
      device="phone"
      broll={staticFile("broll/glacier-drone.mp4")}
      brollAspect={1920 / 1080}
      background={GRADIENT_BG}
    />
  );
};

export const LaptopBrollDemo: React.FC = () => {
  return (
    <DeviceBroll
      device="laptop"
      broll={staticFile("broll/mountains-aerial.mp4")}
      brollAspect={1280 / 720}
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
