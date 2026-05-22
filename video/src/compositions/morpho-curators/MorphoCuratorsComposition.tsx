// MorphoCurators — animated 3D treemap of weekly TVL change across the
// Risk Curators on Morpho. Built as a cross of the project's two
// motion-language references:
//   - ExplorerProof 3D language: ExtrudeGeometry blocks, HDRI lighting,
//     snap-and-hold camera with breath micromotion.
//   - PartnershipReel chrome: dark radial bg + dot grid, InterTight
//     spring-in header, tabular numbers.
//
// 30 seconds at 60fps, square 2160×2160 for Twitter. Data is a snapshot
// of DefiLlama's "Risk Curators" category mirroring the same upstream
// our data-node's defillama_protocols collector targets.

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop } from "./Backdrop";
import { Header } from "./Header";
import { TreemapScene } from "./TreemapScene";
import { HEADLINE } from "./data";

const WIDTH = 2160;
const HEIGHT = 2160;
const FPS = 60;
const DURATION = FPS * 30; // 1800 frames

export const MorphoCurators: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = interpolate(frame, [40, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tailFade = interpolate(frame, [DURATION - 30, DURATION], [1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#06080C" }}>
      <Backdrop width={WIDTH} height={HEIGHT} />
      <AbsoluteFill
        style={{
          opacity: sceneOpacity * tailFade,
          top: 720,
          height: HEIGHT - 720,
        }}
      >
        <TreemapScene width={WIDTH} height={HEIGHT - 720} />
      </AbsoluteFill>
      <Header
        eyebrow={HEADLINE.eyebrow}
        date={HEADLINE.date}
        hookLine={HEADLINE.hookLine}
        underLine={HEADLINE.underLine}
        width={WIDTH}
      />
    </AbsoluteFill>
  );
};

export const morphoCuratorsMeta = {
  id: "MorphoCurators",
  component: MorphoCurators,
  durationInFrames: DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
};
