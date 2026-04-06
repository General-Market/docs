import React, { Suspense } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { PenthouseScene } from "./PenthouseScene";
import { PenthouseChibi } from "./PenthouseChibi";

const WIDTH = 1920;
const HEIGHT = 1080;

export const PenthouseComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#050508" }}>
      {/* 3D Scene — desk, monitors, windows, skyline */}
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 50, near: 0.05, far: 50, position: [0, 1.35, 2.0] }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ background: "#050508" }}
      >
        <Suspense fallback={null}>
          <PenthouseScene frame={frame} />
        </Suspense>
      </ThreeCanvas>

      {/* 2D Chibi overlay — on top of the 3D scene */}
      <PenthouseChibi width={width} height={height} />
    </AbsoluteFill>
  );
};

// Composition metadata for Root.tsx registration
export const penthouseMeta = {
  id: "PenthouseTrading",
  component: PenthouseComposition,
  durationInFrames: 600,
  fps: 30,
  width: WIDTH,
  height: HEIGHT,
};
