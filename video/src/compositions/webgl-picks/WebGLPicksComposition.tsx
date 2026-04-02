import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { DepthGallery } from "./DepthGallery";
import { GradientCarousel } from "./GradientCarousel";
import { TelescopeZoom } from "./TelescopeZoom";
import { OrganicGradients } from "./OrganicGradients";

const SCENE_DURATION = 300; // 10s at 30fps
const FPS = 30;
const W = 1920;
const H = 1080;

export const WebGLPicksComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence durationInFrames={SCENE_DURATION}>
        <DepthGallery />
      </Sequence>
      <Sequence from={SCENE_DURATION} durationInFrames={SCENE_DURATION}>
        <GradientCarousel />
      </Sequence>
      <Sequence from={SCENE_DURATION * 2} durationInFrames={SCENE_DURATION}>
        <TelescopeZoom />
      </Sequence>
      <Sequence from={SCENE_DURATION * 3} durationInFrames={SCENE_DURATION}>
        <OrganicGradients />
      </Sequence>
    </AbsoluteFill>
  );
};

export const webglPicksMeta = {
  id: "WebGLPicks",
  component: WebGLPicksComposition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: SCENE_DURATION * 4,
};

export const webglSceneMetas = [
  {
    id: "WP-DepthGallery",
    component: DepthGallery,
    width: W,
    height: H,
    fps: FPS,
    durationInFrames: SCENE_DURATION,
  },
  {
    id: "WP-GradientCarousel",
    component: GradientCarousel,
    width: W,
    height: H,
    fps: FPS,
    durationInFrames: SCENE_DURATION,
  },
  {
    id: "WP-TelescopeZoom",
    component: TelescopeZoom,
    width: W,
    height: H,
    fps: FPS,
    durationInFrames: SCENE_DURATION,
  },
  {
    id: "WP-OrganicGradients",
    component: OrganicGradients,
    width: W,
    height: H,
    fps: FPS,
    durationInFrames: SCENE_DURATION,
  },
];
