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
import { Counter } from "../components/Counter";

const { fontFamily } = loadFont();

const TITLE_TEXT = "Infinite markets. All liquid.";
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
        intensity={4}
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

export const Scene03GridExpands: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Grid fade-in
  const gridOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Right grid expands cols/rows from frame 20 to frame 80.
  // GMGrid memoizes geometry per (cols, rows) — stepping by 1 each frame
  // would build 60 geometries; we round to a coarser step instead.
  const expandT = interpolate(frame, [20, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // Cap expansion target so OTHERS keeps relative presence in frame.
  const colsRaw = 10 + expandT * 18;
  const rowsRaw = 8 + expandT * 12;
  // Snap to even integers — fewer recomputes, smoother visual
  const rightCols = Math.round(colsRaw / 2) * 2;
  const rightRows = Math.round(rowsRaw / 2) * 2;
  const rightScale = interpolate(frame, [20, 80], [1.0, 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
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

  // Typewriter subtitle
  const subtitleStart = 28;
  const charsPerFrame = 0.6;
  const visibleChars = Math.max(
    0,
    Math.floor((frame - subtitleStart) * charsPerFrame),
  );
  const subtitleText = SUBTITLE_TEXT.slice(0, visibleChars);

  // Radial pulse over frames 85–115
  const pulseT = interpolate(frame, [85, 100, 115], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

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
            position={[-45, 0, 0]}
            scale={0.9}
            seed={1}
          />
          <GMGrid
            cols={rightCols}
            rows={rightRows}
            fillRatio={1.0}
            activeColor={THEME.gmGreen}
            inactiveColor={THEME.grey}
            pulseFreq={0}
            position={[30, 0, 0]}
            scale={rightScale}
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

      {/* Counter under right grid — white with soft green glow for contrast */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          right: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          textShadow: `0 0 28px ${THEME.gmGreen}cc, 0 2px 6px rgba(0,0,0,0.7)`,
        }}
      >
        <Counter
          target={300000}
          durationFrames={60}
          startFrame={40}
          label="markets"
          color={THEME.textLight}
          fontSize={96}
        />
      </div>

      {/* Radial pulse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle, rgba(0,200,83,0.18) 0%, rgba(0,200,83,0) 70%)",
          opacity: pulseT,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
