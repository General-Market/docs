import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import * as THREE from "three";
import { THEME } from "../theme";
import { GMGrid } from "../components/GMGrid";
import { CoinBracket } from "../components/CoinBracket";

const { fontFamily } = loadFont();

const TITLE_TEXT = "$1 covers every market.";

const SceneLights: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight
        color={0xffffff}
        intensity={6}
        decay={0}
        position={[0, 20, 60]}
      />
      <pointLight
        color={0x00c853}
        intensity={3}
        decay={0}
        position={[40, 0, 30]}
      />
      <pointLight
        color={0x6b7280}
        intensity={2}
        decay={0}
        position={[-40, 0, 30]}
      />
    </>
  );
};

export const Scene02Coins: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Grid fade-in
  const gridOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Title spring-slam at frame 5
  const titleSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.7 },
    durationInFrames: 25,
  });
  const titleScale = 0.8 + titleSpring * 0.2;
  const titleOpacity = interpolate(frame, [5, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bgDark }}>
      {/* 3D grids — same backdrop as Scene 1 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: gridOpacity,
        }}
      >
        <ThreeCanvas
          width={width}
          height={height}
          camera={{ position: [0, 0, 100], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          shadows
          style={{ width: "100%", height: "100%" }}
        >
          <SceneLights />
          <GMGrid
            cols={10}
            rows={8}
            fillRatio={0.5}
            activeColor={THEME.gmGreen}
            inactiveColor={THEME.grey}
            pulseFreq={0}
            position={[-35, 0, 0]}
            seed={1}
          />
          <GMGrid
            cols={10}
            rows={8}
            fillRatio={1.0}
            activeColor={THEME.gmGreen}
            inactiveColor={THEME.grey}
            pulseFreq={0}
            position={[35, 0, 0]}
            seed={2}
          />
        </ThreeCanvas>
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 72,
            color: THEME.textLight,
            letterSpacing: -1,
            transform: `scale(${titleScale})`,
            opacity: titleOpacity,
            textAlign: "center",
          }}
        >
          {TITLE_TEXT}
        </div>
      </div>

      {/* CoinBrackets under each grid */}
      <div
        style={{
          position: "absolute",
          bottom: 140,
          left: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <CoinBracket
          startFrame={10}
          span={80}
          durationFrames={30}
          label="covers 1 market"
          color="#B8C4D1"
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 140,
          right: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <CoinBracket
          startFrame={30}
          span={800}
          durationFrames={45}
          label="covers every market"
          color={THEME.gmGreen}
        />
      </div>
    </AbsoluteFill>
  );
};
