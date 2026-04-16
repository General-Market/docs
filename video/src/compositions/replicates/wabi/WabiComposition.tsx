/**
 * WabiComposition — the root.
 *
 * Layers (bottom → top):
 *   1. Canvas background (#F2F2F2)
 *   2. Three.js scene (orb, bubbles, refracted text)
 *   3. DOM chrome (status bar, headline, CTAs, microcopy)
 *
 * A single loop: 13s, 390 frames, 30fps. Seamless.
 */

import React, { Suspense } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { WabiScene3D } from "./scene/WabiScene3D";
import { Chrome } from "./overlay/Chrome";
import { DURATION, FPS, WIDTH, HEIGHT, COLOR } from "./theme";

// Load Switzer from the public/fonts directory.
const SWITZER_FACE = `
@font-face {
  font-family: "Switzer";
  font-weight: 700;
  font-style: normal;
  src: url("${staticFile("fonts/switzer-700.woff2")}") format("woff2");
  font-display: block;
}
@font-face {
  font-family: "Switzer";
  font-weight: 800;
  font-style: normal;
  src: url("${staticFile("fonts/switzer-800.woff2")}") format("woff2");
  font-display: block;
}
@font-face {
  font-family: "Switzer";
  font-weight: 900;
  font-style: normal;
  src: url("${staticFile("fonts/switzer-900.woff2")}") format("woff2");
  font-display: block;
}
`;

export const WabiComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.canvas }}>
      <style>{SWITZER_FACE}</style>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 50,
          near: 0.1,
          far: 50,
          position: [0, 0, 5],
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.NoToneMapping,
        }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <WabiScene3D frame={frame} />
        </Suspense>
      </ThreeCanvas>

      <Chrome frame={frame} />
    </AbsoluteFill>
  );
};

export const wabiMeta = {
  id: "WabiOnboarding",
  component: WabiComposition,
  durationInFrames: DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
} as const;
