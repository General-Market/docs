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

const { fontFamily } = loadFont();

const TITLE_TEXT = "Always liquid.";
const SUBTITLE_TEXT = "Because it's parimutuel.";

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

export const Scene01Liquidity: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Grid fade-in (frames 0–20)
  const gridOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Title spring-slam at frame 15
  const titleSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.7 },
    durationInFrames: 25,
  });
  const titleScale = 0.8 + titleSpring * 0.2;
  const titleOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Typewriter subtitle starting frame 35
  const subtitleStart = 35;
  const charsPerFrame = 0.6;
  const visibleChars = Math.max(
    0,
    Math.floor((frame - subtitleStart) * charsPerFrame),
  );
  const subtitleText = SUBTITLE_TEXT.slice(0, visibleChars);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bgDark }}>
      {/* 3D grids */}
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
        <div
          style={{
            marginTop: 18,
            fontFamily,
            fontWeight: 400,
            fontSize: 32,
            color: THEME.muted,
            letterSpacing: 0,
            textAlign: "center",
            minHeight: 40,
          }}
        >
          {subtitleText}
          <span
            style={{
              opacity: visibleChars < SUBTITLE_TEXT.length ? 1 : 0,
              color: THEME.gmGreen,
            }}
          >
            _
          </span>
        </div>
      </div>

      {/* Labels under each grid */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          opacity: gridOpacity,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 18,
            color: THEME.muted,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            fontWeight: 500,
          }}
        >
          OTHERS
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 120,
          right: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          opacity: gridOpacity,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 18,
            color: THEME.gmGreen,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            fontWeight: 500,
          }}
        >
          GENERAL MARKET
        </div>
      </div>
    </AbsoluteFill>
  );
};
