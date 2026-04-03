import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { MetallicScene } from "./shared";
import { silverIso, emeraldBrand, obsidianGold, frost, prismatic } from "./configs";

const SCENE_DURATION = 240;

const V1 = () => <MetallicScene config={silverIso} />;
const V2 = () => <MetallicScene config={emeraldBrand} />;
const V3 = () => <MetallicScene config={obsidianGold} />;
const V4 = () => <MetallicScene config={frost} />;
const V5 = () => <MetallicScene config={prismatic} />;

export const GMLaunchBgComposition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000000" }}>
    <Sequence from={0} durationInFrames={SCENE_DURATION} name="V1 — Silver ISO">
      <V1 />
    </Sequence>
    <Sequence from={SCENE_DURATION} durationInFrames={SCENE_DURATION} name="V2 — Emerald Brand">
      <V2 />
    </Sequence>
    <Sequence from={SCENE_DURATION * 2} durationInFrames={SCENE_DURATION} name="V3 — Obsidian Gold">
      <V3 />
    </Sequence>
    <Sequence from={SCENE_DURATION * 3} durationInFrames={SCENE_DURATION} name="V4 — Frost">
      <V4 />
    </Sequence>
    <Sequence from={SCENE_DURATION * 4} durationInFrames={SCENE_DURATION} name="V5 — Prismatic">
      <V5 />
    </Sequence>
  </AbsoluteFill>
);

export const gmLaunchBgMeta = {
  id: "GMLaunchBg",
  component: GMLaunchBgComposition,
  width: 1920, height: 1080, fps: 30,
  durationInFrames: SCENE_DURATION * 5,
};

export const gmLaunchSceneMetas = [
  { id: "GMLaunch-V1-SilverISO", component: V1, width: 1920, height: 1080, fps: 30, durationInFrames: SCENE_DURATION },
  { id: "GMLaunch-V2-EmeraldBrand", component: V2, width: 1920, height: 1080, fps: 30, durationInFrames: SCENE_DURATION },
  { id: "GMLaunch-V3-ObsidianGold", component: V3, width: 1920, height: 1080, fps: 30, durationInFrames: SCENE_DURATION },
  { id: "GMLaunch-V4-Frost", component: V4, width: 1920, height: 1080, fps: 30, durationInFrames: SCENE_DURATION },
  { id: "GMLaunch-V5-Prismatic", component: V5, width: 1920, height: 1080, fps: 30, durationInFrames: SCENE_DURATION },
];
