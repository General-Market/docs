import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { MetallicScene } from "./shared";
import { silverIso, emeraldBrand, obsidianGold, frost, prismatic } from "./configs";
import { pearl, frostedAcrylic, holoWhite, porcelain, neonEdge } from "./configs-white";

const D = 240; // 8 seconds each at 30fps

const V1 = () => <MetallicScene config={silverIso} />;
const V2 = () => <MetallicScene config={emeraldBrand} />;
const V3 = () => <MetallicScene config={obsidianGold} />;
const V4 = () => <MetallicScene config={frost} />;
const V5 = () => <MetallicScene config={prismatic} />;
const W1 = () => <MetallicScene config={pearl} />;
const W2 = () => <MetallicScene config={frostedAcrylic} />;
const W3 = () => <MetallicScene config={holoWhite} />;
const W4 = () => <MetallicScene config={porcelain} />;
const W5 = () => <MetallicScene config={neonEdge} />;

export const GMLaunchBgComposition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000000" }}>
    <Sequence from={0} durationInFrames={D} name="V1 — Silver ISO"><V1 /></Sequence>
    <Sequence from={D} durationInFrames={D} name="V2 — Emerald Brand"><V2 /></Sequence>
    <Sequence from={D*2} durationInFrames={D} name="V3 — Obsidian Gold"><V3 /></Sequence>
    <Sequence from={D*3} durationInFrames={D} name="V4 — Frost"><V4 /></Sequence>
    <Sequence from={D*4} durationInFrames={D} name="V5 — Prismatic"><V5 /></Sequence>
    <Sequence from={D*5} durationInFrames={D} name="W1 — Pearl"><W1 /></Sequence>
    <Sequence from={D*6} durationInFrames={D} name="W2 — Frosted Acrylic"><W2 /></Sequence>
    <Sequence from={D*7} durationInFrames={D} name="W3 — Holo White"><W3 /></Sequence>
    <Sequence from={D*8} durationInFrames={D} name="W4 — Porcelain"><W4 /></Sequence>
    <Sequence from={D*9} durationInFrames={D} name="W5 — Neon Edge"><W5 /></Sequence>
  </AbsoluteFill>
);

export const gmLaunchBgMeta = {
  id: "GMLaunchBg",
  component: GMLaunchBgComposition,
  width: 1920, height: 1080, fps: 30,
  durationInFrames: D * 10,
};

export const gmLaunchSceneMetas = [
  { id: "GMLaunch-V1-SilverISO", component: V1, width: 1920, height: 1080, fps: 30, durationInFrames: D },
  { id: "GMLaunch-V2-EmeraldBrand", component: V2, width: 1920, height: 1080, fps: 30, durationInFrames: D },
  { id: "GMLaunch-V3-ObsidianGold", component: V3, width: 1920, height: 1080, fps: 30, durationInFrames: D },
  { id: "GMLaunch-V4-Frost", component: V4, width: 1920, height: 1080, fps: 30, durationInFrames: D },
  { id: "GMLaunch-V5-Prismatic", component: V5, width: 1920, height: 1080, fps: 30, durationInFrames: D },
  { id: "GMLaunch-W1-Pearl", component: W1, width: 1920, height: 1080, fps: 30, durationInFrames: D },
  { id: "GMLaunch-W2-FrostedAcrylic", component: W2, width: 1920, height: 1080, fps: 30, durationInFrames: D },
  { id: "GMLaunch-W3-HoloWhite", component: W3, width: 1920, height: 1080, fps: 30, durationInFrames: D },
  { id: "GMLaunch-W4-Porcelain", component: W4, width: 1920, height: 1080, fps: 30, durationInFrames: D },
  { id: "GMLaunch-W5-NeonEdge", component: W5, width: 1920, height: 1080, fps: 30, durationInFrames: D },
];
