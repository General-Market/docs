import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { EmeraldLenticular, scene01Meta } from "./Scene01_EmeraldLenticular";
import { DarkPulse, scene02Meta } from "./Scene02_DarkPulse";
import { GlassGrid, scene03Meta } from "./Scene03_GlassGrid";
import { ParticleFlow, scene04Meta } from "./Scene04_ParticleFlow";
import { GradientMorph, scene05Meta } from "./Scene05_GradientMorph";

const SCENE_DURATION = 240; // 8 seconds each at 30fps

export const GMLaunchBgComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Sequence from={0} durationInFrames={SCENE_DURATION} name="01 — Emerald Lenticular">
        <EmeraldLenticular />
      </Sequence>
      <Sequence from={SCENE_DURATION} durationInFrames={SCENE_DURATION} name="02 — Dark Pulse">
        <DarkPulse />
      </Sequence>
      <Sequence from={SCENE_DURATION * 2} durationInFrames={SCENE_DURATION} name="03 — Glass Grid">
        <GlassGrid />
      </Sequence>
      <Sequence from={SCENE_DURATION * 3} durationInFrames={SCENE_DURATION} name="04 — Particle Flow">
        <ParticleFlow />
      </Sequence>
      <Sequence from={SCENE_DURATION * 4} durationInFrames={SCENE_DURATION} name="05 — Gradient Morph">
        <GradientMorph />
      </Sequence>
    </AbsoluteFill>
  );
};

export const gmLaunchBgMeta = {
  id: "GMLaunchBg",
  component: GMLaunchBgComposition,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: SCENE_DURATION * 5,
};

export const gmLaunchSceneMetas = [
  scene01Meta,
  scene02Meta,
  scene03Meta,
  scene04Meta,
  scene05Meta,
];
